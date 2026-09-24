"use client";

/* ------------------------------------------------------------------ *
 *  DLO office notifications + "transferred" markers.
 *   • OfficeNoticeBar — top of every /dashboard/dlo view: unread office
 *     notices (transfer received / accepted / rejected → back with you /
 *     cancelled), each with Open + Mark read.
 *   • TransferBanner — on the case page: "Transferred from X DLAO" for the
 *     receiving office, "Returned — X rejected" for the sending office.
 *   • TransferTag — small tag for queue rows.
 *  Data: dlas.db.v1 officeNotices[] + application.transfers[]
 * ------------------------------------------------------------------ */

import { useI18n } from "@/lib/i18n";
import { DISTRICTS, OfficeNotices, acceptedTransfer, formatDateTime, pendingTransfer, useCurrentOfficer, useOfficeNotices, type ApplicationRecord, type OfficeNotice } from "@/lib/dlas";
import ui from "./dlao.module.css";

type Lang = "bn" | "en";
const officeName = (office: string, lang: Lang) => {
  const d = DISTRICTS.find((x) => `DLAO-${x.code}` === office);
  return d ? (lang === "bn" ? `${d.label.bn} ডিএলএও` : `${d.label.en} DLAO`) : office;
};
const TONE: Record<OfficeNotice["kind"], { icon: string; cls: "bannerWarn" | "bannerOk" | "bannerErr" }> = {
  TRANSFER_RECEIVED: { icon: "📥", cls: "bannerWarn" },
  TRANSFER_ACCEPTED: { icon: "✓", cls: "bannerOk" },
  TRANSFER_REJECTED: { icon: "↩", cls: "bannerErr" },
  TRANSFER_CANCELLED: { icon: "✕", cls: "bannerWarn" },
  MEDIATOR_ACCEPTED: { icon: "🤝", cls: "bannerOk" },
  MEDIATOR_DECLINED: { icon: "↻", cls: "bannerWarn" },
  MEDIATOR_NONE_LEFT: { icon: "!", cls: "bannerErr" },
};

export function OfficeNoticeBar() {
  const { lang } = useI18n();
  const L = lang as Lang;
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const { unread } = useOfficeNotices();
  if (!unread.length) return null;
  return (
    <div role="region" aria-label={tx("অফিসের বিজ্ঞপ্তি", "Office notifications")} aria-live="polite" style={{ display: "grid", gap: 8, marginBottom: "var(--s-4)" }}>
      {unread.slice(0, 4).map((n) => {
        const href = n.kind === "TRANSFER_RECEIVED" ? "#transfers" : n.kind === "TRANSFER_ACCEPTED" ? "#transfers" : `#app/${encodeURIComponent(n.applicationId)}`;
        return (
          <div key={n.noticeId} className={`${ui.banner} ${ui[TONE[n.kind].cls]}`}>
            <span className={ui.bannerIcon} aria-hidden>
              {TONE[n.kind].icon}
            </span>
            <div style={{ flex: 1 }}>
              <strong>{n.title[L]}</strong> · <span style={{ fontFamily: "var(--font-mono)" }}>{n.caseRef}</span> · {formatDateTime(n.at, lang)}
              {n.body ? <div>“{n.body}”</div> : null}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <a href={href} onClick={() => OfficeNotices.markRead([n.noticeId])} style={{ fontWeight: 700 }}>
                  {n.kind === "TRANSFER_RECEIVED" ? tx("গ্রহণ / প্রত্যাখ্যান করুন →", "Accept or reject →") : n.kind === "TRANSFER_REJECTED" ? tx("কেস খুলুন →", "Open the case →") : tx("দেখুন →", "View →")}
                </a>
                <button type="button" onClick={() => OfficeNotices.markRead([n.noticeId])} style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
                  {tx("পড়া হয়েছে", "Mark read")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {unread.length > 4 ? (
        <button type="button" onClick={() => OfficeNotices.markRead(unread.map((n) => n.noticeId))} style={{ justifySelf: "start", background: "none", border: 0, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
          {tx(`আরও ${unread.length - 4}টি — সব পড়া হয়েছে`, `${unread.length - 4} more — mark all read`)}
        </button>
      ) : null}
    </div>
  );
}

/** Case page: where this case came from, or that it came back. */
export function TransferBanner({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const L = lang as Lang;
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const o = useCurrentOfficer();
  const mine = o ? `DLAO-${o.district}` : null;
  const acc = acceptedTransfer(a);
  const last = [...(a.transfers ?? [])].reverse()[0] ?? null;
  const pending = pendingTransfer(a);
  if (acc && acc.toOffice === mine) {
    return (
      <div className={`${ui.banner} ${ui.bannerWarn}`} style={{ marginBottom: "var(--s-4)" }}>
        <span className={ui.bannerIcon} aria-hidden>
          ⇄
        </span>
        <div>
          <strong>{tx(`স্থানান্তরিত কেস — ${officeName(acc.fromOffice, L)} থেকে এসেছে`, `Transferred case — received from ${officeName(acc.fromOffice, L)}`)}</strong> · {tx("গ্রহণ", "accepted")} {acc.respondedByName} · {acc.respondedAt ? formatDateTime(acc.respondedAt, lang) : ""}
          <div>
            {tx("কারণ", "Reason")}: “{acc.reason}” — {acc.requestedByName}
          </div>
        </div>
      </div>
    );
  }
  if (!pending && last?.status === "REJECTED" && last.fromOffice === mine) {
    return (
      <div className={`${ui.banner} ${ui.bannerErr}`} style={{ marginBottom: "var(--s-4)" }}>
        <span className={ui.bannerIcon} aria-hidden>
          ↩
        </span>
        <div>
          <strong>{tx(`${officeName(last.toOffice, L)} স্থানান্তর প্রত্যাখ্যান করেছে — কেস আপনার অফিসেই আছে`, `${officeName(last.toOffice, L)} rejected the transfer — the case is back with your office`)}</strong> · {last.respondedByName} · {last.respondedAt ? formatDateTime(last.respondedAt, lang) : ""}
          {last.responseMessage ? <div>“{last.responseMessage}”</div> : null}
        </div>
      </div>
    );
  }
  return null;
}

/** Small marker for queue rows. */
export function TransferTag({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const L = lang as Lang;
  const acc = acceptedTransfer(a);
  const pend = pendingTransfer(a);
  const last = [...(a.transfers ?? [])].reverse()[0] ?? null;
  if (pend) return <span className={`${ui.tag} ${ui.warn}`}>⇄ {lang === "bn" ? "স্থানান্তর অপেক্ষমাণ" : "Transfer pending"} → {officeName(pend.toOffice, L)}</span>;
  if (acc) return <span className={`${ui.tag} ${ui.ink}`}>⇄ {lang === "bn" ? "স্থানান্তরিত" : "Transferred"} · {officeName(acc.fromOffice, L)}</span>;
  if (last?.status === "REJECTED") return <span className={`${ui.tag} ${ui.err}`}>↩ {lang === "bn" ? "স্থানান্তর প্রত্যাখ্যাত" : "Transfer rejected"}</span>;
  return null;
}

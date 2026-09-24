"use client";

/* ------------------------------------------------------------------ *
 *  DLAO → DLAO case transfer UI.
 *   • CaseTransferPanel — on the case page (/dashboard/dlo#app/<id>):
 *     "Transfer to another DLAO" with district + reason; shows a pending
 *     request (cancel) and the history with the receiving office's message.
 *   • CaseTransfers — /dashboard/dlo#transfers (also /dlo/infer):
 *     incoming requests to accept / reject with a message, and the
 *     office's outgoing requests with their answers.
 *  Data: lib/dlas/case-transfer.ts
 * ------------------------------------------------------------------ */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CaseTransferService, DISTRICTS, MATTERS, formatDateTime, handlingDistrict, label, pendingTransfer, transferBlocker, useCaseTransfers, type ApplicationRecord, type CaseTransfer, type DistrictCode } from "@/lib/dlas";
import cc from "./office-control.module.css";
import ui from "./dlao.module.css";

type Lang = "bn" | "en";

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

const officeName = (office: string, lang: Lang) => {
  const d = DISTRICTS.find((x) => `DLAO-${x.code}` === office);
  return d ? (lang === "bn" ? `${d.label.bn} ডিএলএও` : `${d.label.en} DLAO`) : office;
};

const STATUS: Record<CaseTransfer["status"], { bn: string; en: string; color: string }> = {
  PENDING: { bn: "অপেক্ষমাণ", en: "Pending", color: "var(--status-pending)" },
  ACCEPTED: { bn: "গৃহীত", en: "Accepted", color: "var(--green)" },
  REJECTED: { bn: "প্রত্যাখ্যাত", en: "Rejected", color: "var(--red)" },
  CANCELLED: { bn: "বাতিল", en: "Cancelled", color: "var(--dlo-muted)" },
};

function StatusTag({ s }: { s: CaseTransfer["status"] }) {
  const { lang } = useTx();
  return (
    <span className={ui.tag} style={{ borderColor: STATUS[s].color, color: STATUS[s].color, fontWeight: 700 }}>
      {STATUS[s][lang]}
    </span>
  );
}

function History({ list }: { list: CaseTransfer[] }) {
  const { lang, tx } = useTx();
  if (!list.length) return null;
  return (
    <ol style={{ listStyle: "none", margin: "var(--s-3) 0 0", padding: 0, display: "grid", gap: 8 }}>
      {[...list].reverse().map((t) => (
        <li key={t.transferId} style={{ fontSize: "var(--t-small)", borderLeft: `3px solid ${STATUS[t.status].color}`, paddingLeft: 10 }}>
          <StatusTag s={t.status} /> {officeName(t.fromOffice, lang)} → {officeName(t.toOffice, lang)} · {formatDateTime(t.requestedAt, lang)} · {t.requestedByName}
          <div className={cc.muted}>
            {tx("কারণ", "Reason")}: “{t.reason}”
          </div>
          {t.respondedAt ? (
            <div>
              {t.status === "CANCELLED" ? tx("বাতিল করেছেন", "Cancelled by") : tx("উত্তর দিয়েছেন", "Answered by")} {t.respondedByName} · {formatDateTime(t.respondedAt, lang)}
              {t.responseMessage ? <strong> — “{t.responseMessage}”</strong> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------ on the case page ------------------------------ */

export function CaseTransferPanel({ a }: { a: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<DistrictCode | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const pending = pendingTransfer(a);
  const blocker = transferBlocker(a);
  const here = handlingDistrict(a);
  const run = (fn: () => unknown, ok: string) => {
    try {
      fn();
      setError("");
      setDone(ok);
      setOpen(false);
      setReason("");
      setTo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDone("");
    }
  };
  return (
    <section className={ui.panel} style={{ marginTop: "var(--s-6)" }} aria-label={tx("কেস স্থানান্তর", "Case transfer")}>
      <div className={ui.panelTitle}>
        <span>⇄ {tx("অন্য ডিএলএও-তে কেস স্থানান্তর", "TRANSFER TO ANOTHER DLAO")}</span>
        {pending ? <StatusTag s="PENDING" /> : null}
      </div>
      {pending ? (
        <div className={`${ui.banner} ${ui.bannerWarn}`}>
          <span className={ui.bannerIcon} aria-hidden>
            ⇄
          </span>
          <div>
            <strong>{tx(`${officeName(pending.toOffice, lang)}-এর উত্তরের অপেক্ষা`, `Waiting for ${officeName(pending.toOffice, lang)} to accept or reject`)}</strong> — {tx("উত্তর না আসা পর্যন্ত কেস আপনার অফিসেই থাকে।", "the case stays with your office until they answer.")}
            <div style={{ marginTop: 6 }}>
              <button type="button" className={cc.chip} onClick={() => run(() => CaseTransferService.cancel(a.applicationId, ""), tx("অনুরোধ বাতিল হয়েছে।", "Request cancelled."))}>
                {tx("অনুরোধ বাতিল করুন", "Cancel the request")}
              </button>
            </div>
          </div>
        </div>
      ) : !open ? (
        <div className={cc.row} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" className={cc.go} disabled={!!blocker} onClick={() => setOpen(true)} style={blocker ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            ⇄ {tx("অন্য ডিএলএও-তে স্থানান্তর", "Transfer to another DLAO")}
          </button>
          {blocker ? <span className={cc.muted} style={{ fontSize: "var(--t-small)" }}>{blocker}</span> : <span className={cc.muted} style={{ fontSize: "var(--t-small)" }}>{tx("গ্রহণকারী অফিস রাজি হলেই কেস যাবে।", "The case moves only if the receiving office accepts.")}</span>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
          <label style={{ fontSize: "var(--t-small)", fontWeight: 600 }}>
            {tx("গ্রহণকারী জেলা", "Receiving district")}
            <select value={to} onChange={(e) => setTo(e.target.value as DistrictCode)} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--line)", borderRadius: 8, font: "inherit" }}>
              <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
              {DISTRICTS.filter((d) => d.code !== here).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label[lang]} DLAO
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "var(--t-small)", fontWeight: 600 }}>
            {tx("কারণ (গ্রহণকারী অফিস দেখবে)", "Reason (the receiving office will see it)")}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("যেমন: বিরোধের জমি ও প্রতিপক্ষ ওই জেলায়; আবেদনকারী সেখানে চলে গেছেন", "e.g. the disputed land and the respondent are in that district; the applicant has moved there")} style={{ display: "block", width: "100%", minHeight: 70, marginTop: 4, padding: 8, border: "1px solid var(--line)", borderRadius: 8, font: "inherit", boxSizing: "border-box" }} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={cc.go} disabled={!to || reason.trim().length < 10} onClick={() => run(() => CaseTransferService.request(a.applicationId, { toDistrict: to as DistrictCode, reason }), tx("স্থানান্তরের অনুরোধ পাঠানো হয়েছে।", "Transfer request sent."))}>
              {tx("অনুরোধ পাঠান", "Send transfer request")}
            </button>
            <button type="button" className={`${cc.go} ${cc.goGhost}`} onClick={() => setOpen(false)}>
              {tx("বাতিল", "Cancel")}
            </button>
          </div>
        </div>
      )}
      {error ? (
        <div className={`${ui.banner} ${ui.bannerErr}`} role="alert" style={{ marginTop: 8 }}>
          <span className={ui.bannerIcon}>!</span>
          <div>{error}</div>
        </div>
      ) : null}
      {done ? <p style={{ color: "var(--green)", fontWeight: 600, fontSize: "var(--t-small)" }}>✓ {done}</p> : null}
      <History list={a.transfers ?? []} />
    </section>
  );
}

/* ------------------------------ transfers inbox ------------------------------ */

function Incoming({ a, t }: { a: ApplicationRecord; t: CaseTransfer }) {
  const { lang, tx } = useTx();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const answer = (decision: "ACCEPT" | "REJECT") => {
    try {
      CaseTransferService.respond(a.applicationId, t.transferId, { decision, message: msg });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <article className={ui.workItem}>
      <div className={ui.workItemHead}>
        <div className={ui.workItemIdentity}>
          <span className={ui.workItemEyebrow}>
            {tx("থেকে", "From")} {officeName(t.fromOffice, lang)} · {t.requestedByName} · {formatDateTime(t.requestedAt, lang)}
          </span>
          <span className={ui.workItemId}>{a.caseId ?? a.applicationId}</span>
        </div>
        <StatusTag s="PENDING" />
      </div>
      <dl className={ui.workFacts}>
        <div className={ui.workFact}>
          <dt>{tx("বিষয়", "Matter")}</dt>
          <dd>{label(MATTERS, a.data.matter.category, lang)}</dd>
        </div>
        <div className={ui.workFact}>
          <dt>{tx("অবস্থা", "Status")}</dt>
          <dd>{a.status.replaceAll("_", " ").toLowerCase()}</dd>
        </div>
        <div className={ui.workFact}>
          <dt>{tx("জমা", "Filed")}</dt>
          <dd>{formatDateTime(a.submittedAt, lang)}</dd>
        </div>
        <div className={ui.workFact}>
          <dt>{tx("নাগরিক-জরুরি", "Citizen-urgent")}</dt>
          <dd>{a.data.urgency.selfReportedUrgent || a.data.urgency.flags.length ? tx("হ্যাঁ", "Yes") : tx("না", "No")}</dd>
        </div>
      </dl>
      <p style={{ margin: "8px 0" }}>
        <strong>{tx("স্থানান্তরের কারণ", "Reason for transfer")}:</strong> “{t.reason}”
      </p>
      <p className={cc.muted} style={{ fontSize: "var(--t-small)", margin: "0 0 8px" }}>
        {tx("গ্রহণ করলে পুরো কেস রেকর্ড আপনার অফিসে আসবে; এখন শুধু সারাংশ দেখানো হচ্ছে।", "Accepting brings the full case record to your office; until then you see this summary only.")}
      </p>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tx("পাঠানো অফিসের জন্য বার্তা (প্রত্যাখ্যানে আবশ্যিক)", "Message to the sending office (required to reject)")} style={{ width: "100%", minHeight: 56, padding: 8, border: "1px solid var(--line)", borderRadius: 8, font: "inherit", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className={cc.go} style={{ background: "var(--green)" }} onClick={() => answer("ACCEPT")}>
          ✓ {tx("গ্রহণ করুন", "Accept")}
        </button>
        <button type="button" className={cc.go} style={{ background: "var(--red)" }} disabled={msg.trim().length < 5} onClick={() => answer("REJECT")}>
          ✗ {tx("বার্তাসহ প্রত্যাখ্যান", "Reject with message")}
        </button>
      </div>
      {error ? (
        <div className={`${ui.banner} ${ui.bannerErr}`} role="alert" style={{ marginTop: 8 }}>
          <span className={ui.bannerIcon}>!</span>
          <div>{error}</div>
        </div>
      ) : null}
    </article>
  );
}

export function CaseTransfers() {
  const { lang, tx } = useTx();
  const v = useCaseTransfers();
  if (!v.office) return <p className={cc.muted}>{tx("কেস স্থানান্তর শুধু জেলা লিগ্যাল এইড অফিসের জন্য।", "Case transfer is available to District Legal Aid Offices.")}</p>;
  return (
    <>
      <header className={ui.queuePlainHead}>
        <div className={ui.queueHeroCopy}>
          <span className={ui.heroKicker}>{officeName(v.office, lang)}</span>
          <h1 className={ui.queueTitle}>{tx("কেস স্থানান্তর", "Case transfers")}</h1>
          <p className={ui.heroDescription}>{tx("অন্য জেলার ডিএলএও যে কেস পাঠাতে চায় তা গ্রহণ বা বার্তাসহ প্রত্যাখ্যান করুন। কেস পাঠাতে: কেস খুলে “অন্য ডিএলএও-তে স্থানান্তর”।", "Accept, or reject with a message, the cases other DLAOs want to send you. To send one: open the case → “Transfer to another DLAO”.")}</p>
        </div>
      </header>
      <div className={ui.queueSectionHead}>
        <h2 className={ui.queueSectionTitle}>{tx("আসা অনুরোধ", "Incoming requests")}</h2>
        <span className={ui.sectionCount}>{v.incoming.length}</span>
      </div>
      {v.incoming.length ? (
        <div className={ui.worklist}>
          {v.incoming.map(({ a, t }) => (
            <Incoming key={t.transferId} a={a} t={t} />
          ))}
        </div>
      ) : (
        <p className={ui.queueEmpty}>{tx("কোনো অপেক্ষমাণ অনুরোধ নেই।", "No pending requests.")}</p>
      )}
      <div className={ui.queueSectionHead}>
        <h2 className={ui.queueSectionTitle}>{tx("পাঠানো অনুরোধ", "Sent requests")}</h2>
        <span className={ui.sectionCount}>{v.outgoing.length}</span>
      </div>
      {v.outgoing.length ? (
        <div className={cc.tableWrap}>
          <table className={cc.table}>
            <thead>
              <tr>
                <th>{tx("কেস", "Case")}</th>
                <th>{tx("প্রাপক", "To")}</th>
                <th>{tx("অবস্থা", "Status")}</th>
                <th>{tx("কারণ", "Reason")}</th>
                <th>{tx("উত্তর / বার্তা", "Answer / message")}</th>
              </tr>
            </thead>
            <tbody>
              {v.outgoing.map(({ a, t }) => (
                <tr key={t.transferId}>
                  <td>
                    <a href={`#app/${encodeURIComponent(a.applicationId)}`} style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {a.caseId ?? a.applicationId}
                    </a>
                    <span className={cc.sub}>{formatDateTime(t.requestedAt, lang)}</span>
                  </td>
                  <td>{officeName(t.toOffice, lang)}</td>
                  <td>
                    <StatusTag s={t.status} />
                  </td>
                  <td>{t.reason}</td>
                  <td>{t.respondedAt ? <>{t.respondedByName} · {formatDateTime(t.respondedAt, lang)}{t.responseMessage ? <strong style={{ display: "block" }}>“{t.responseMessage}”</strong> : null}</> : <span className={cc.muted}>{tx("উত্তরের অপেক্ষা", "Waiting for an answer")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={ui.queueEmpty}>{tx("এখনো কোনো কেস পাঠানো হয়নি।", "No cases sent yet.")}</p>
      )}
      {v.answered.length ? (
        <>
          <div className={ui.queueSectionHead}>
            <h2 className={ui.queueSectionTitle}>{tx("আপনার দেওয়া উত্তর", "Your answers")}</h2>
            <span className={ui.sectionCount}>{v.answered.length}</span>
          </div>
          <History list={v.answered.map((x) => x.t)} />
        </>
      ) : null}
    </>
  );
}

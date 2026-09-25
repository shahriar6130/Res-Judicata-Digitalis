"use client";

/* ------------------------------------------------------------------ *
 *  DLAO: all district cases (#cases) and citizen-urgent cases (#urgent).
 *  Colour dots: how long each case has been running and how long since
 *  its last update. Lawyer cases show the panel lawyer's hearings and
 *  overdue reports, with links to take control (lawyer profile: summon,
 *  red flag · case: withdraw / reassign). Read-only; every action opens
 *  the screen that owns it. Data: lib/dlas/district-cases.ts
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { DISTRICTS, MATTERS, formatDateTime, incidentLabel, label, useDistrictCases, useUrgentCases, type DistrictCaseRow } from "@/lib/dlas";
import { STATUS } from "./office-control";
import cc from "./office-control.module.css";
import ui from "./dlao.module.css";

type Lang = "bn" | "en";
type Tone = DistrictCaseRow["ageTone"];

const COLOR: Record<Tone, string> = { ok: "var(--green)", warn: "var(--status-pending)", err: "var(--red)", neutral: "var(--dlo-muted)" };
const officeName = (office: string | null, lang: Lang) => {
  const d = DISTRICTS.find((x) => `DLAO-${x.code}` === office);
  return d ? `${d.label[lang]} DLAO` : office ?? "—";
};

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

function Dot({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR[tone], flex: "none" }} />
      {children}
    </span>
  );
}

function Legend() {
  const { tx } = useTx();
  return (
    <p className={cc.muted} style={{ fontSize: "var(--t-small)", display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: "0 0 var(--s-3)" }}>
      <span>
        <strong>{tx("চলমান সময়", "Running for")}:</strong> <Dot tone="ok">&lt; 30 {tx("দিন", "d")}</Dot> · <Dot tone="warn">30–90 {tx("দিন", "d")}</Dot> · <Dot tone="err">&gt; 90 {tx("দিন", "d")}</Dot>
      </span>
      <span>
        <strong>{tx("শেষ হালনাগাদ", "Last update")}:</strong> <Dot tone="ok">≤ 7 {tx("দিন", "d")}</Dot> · <Dot tone="warn">8–14 {tx("দিন", "d")}</Dot> · <Dot tone="err">&gt; 14 {tx("দিন", "d")}</Dot>
      </span>
    </p>
  );
}

function CaseTable({ rows, showUrgency }: { rows: DistrictCaseRow[]; showUrgency?: boolean }) {
  const { lang, tx } = useTx();
  if (!rows.length) return <p className={cc.muted}>{tx("এই তালিকায় কোনো কেস নেই।", "No cases in this list.")}</p>;
  return (
    <div className={cc.tableWrap}>
      <table className={cc.table}>
        <thead>
          <tr>
            <th>{tx("কেস", "Case")}</th>
            <th>{tx("আবেদনকারী · বিষয়", "Applicant · matter")}</th>
            {showUrgency ? <th>{tx("লাল পতাকা (নিয়ম)", "Red flag (rule)")}</th> : null}
            <th>{tx("অবস্থা", "State")}</th>
            <th>{tx("চলমান", "Running")}</th>
            <th>{tx("শেষ হালনাগাদ", "Last update")}</th>
            <th>{tx("আইনজীবী / মধ্যস্থতাকারী", "Lawyer / mediator")}</th>
            <th>{tx("নিয়ন্ত্রণ", "Control")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = STATUS[r.control.status];
            const href = `#app/${encodeURIComponent(r.a.applicationId)}`;
            return (
              <tr key={r.a.applicationId} className={r.control.urgent || (r.urgent.red && !r.closed) ? cc.rowUrgent : undefined}>
                <td>
                  <a href={href} style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {r.control.caseRef}
                  </a>
                  {r.a.caseId ? <span className={cc.sub}>{r.a.applicationId}</span> : null}
                  {r.transfer.pendingTo ? <span className={cc.sub} style={{ color: "var(--status-pending)", fontWeight: 600 }}>⇄ {tx("স্থানান্তর অপেক্ষমাণ", "transfer pending")} → {officeName(r.transfer.pendingTo, lang)}</span> : null}
                  {r.transfer.receivedFrom ? <span className={cc.sub}>⇄ {tx("এসেছে", "from")} {officeName(r.transfer.receivedFrom, lang)}</span> : null}
                </td>
                <td>
                  {r.a.data.applicant.fullName ?? "—"}
                  <span className={cc.sub}>{label(MATTERS, r.a.data.matter.category, lang)}</span>
                  {r.urgent.red && !showUrgency ? <span className={cc.sub} style={{ color: "var(--red)", fontWeight: 700 }}>⚑ {incidentLabel(r.urgent.incident.category, r.urgent.incident.subcategory, lang)}</span> : null}
                </td>
                {showUrgency ? (
                  <td>
                    <strong style={{ color: r.urgent.red ? "var(--red)" : undefined }}>⚑ {incidentLabel(r.urgent.incident.category, r.urgent.incident.subcategory, lang)}</strong>
                    <span className={cc.sub}>
                      {r.urgent.incident.basis === "DESCRIPTION_KEYWORDS" ? tx("শব্দ", "words") : tx("বিষয়ের ধরন", "matter type")}: {r.urgent.incident.matched.length ? r.urgent.incident.matched.slice(0, 3).map((m) => `“${m.keyword}”`).join(", ") : label(MATTERS, r.a.data.matter.category, lang)}
                    </span>
                    {r.urgent.incident.officerReview ? <span className={cc.sub}>{r.urgent.incident.officerReview.decision === "CONFIRMED" ? tx("অফিসার নিশ্চিত করেছেন", "confirmed by officer") : tx("অফিসার সরিয়েছেন", "cleared by officer")}</span> : <span className={cc.sub}>{tx("অফিসারের পর্যালোচনা বাকি", "awaiting officer review")}</span>}
                  </td>
                ) : null}
                <td>
                  <span className={cc.status}>
                    <span className={`${cc.dot} ${s.tone === "err" ? cc.dotErr : s.tone === "warn" ? cc.dotWarn : s.tone === "ok" ? cc.dotOk : s.tone === "ink" ? cc.dotInk : ""}`} />
                    {s[lang]}
                  </span>
                  <span className={cc.sub}>{r.control.next.label[lang]}</span>
                </td>
                <td>
                  <Dot tone={r.ageTone} title={tx("আবেদন জমার পর থেকে", "since the application was filed")}>
                    {r.ageDays} {tx("দিন", "days")}
                  </Dot>
                  <span className={cc.sub}>
                    {tx("জমা", "filed")} {formatDateTime(r.a.submittedAt, lang)}
                  </span>
                </td>
                <td>
                  {r.lastUpdate ? (
                    <>
                      <Dot tone={r.staleTone}>{r.staleDays === 0 ? tx("আজ", "today") : `${r.staleDays} ${tx("দিন আগে", "days ago")}`}</Dot>
                      <span className={cc.sub}>{r.lastUpdate.text[lang]}</span>
                      <span className={cc.sub}>{r.lastUpdate.who}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.handler ? (
                    <>
                      {r.handler.kind === "LAWYER" ? (
                        <a href={`#lawyer/${encodeURIComponent(r.handler.id)}`} style={{ fontWeight: 600 }}>
                          ⚖ {r.handler.name}
                        </a>
                      ) : (
                        <a href={`#mediator/${encodeURIComponent(r.handler.id)}`} style={{ fontWeight: 600 }}>
                          🤝 {r.handler.name}
                        </a>
                      )}
                      <span className={cc.sub}>{r.handler.status.replaceAll("_", " ").toLowerCase()}</span>
                    </>
                  ) : (
                    <span className={cc.muted}>—</span>
                  )}
                  {r.lawyer ? (
                    <span className={cc.sub}>
                      {r.lawyer.hearings} {tx("শুনানি", "hearings")}
                      {r.lawyer.nextHearing ? ` · ${tx("পরবর্তী", "next")} ${formatDateTime(r.lawyer.nextHearing, lang)}` : ""}
                      {r.lawyer.overdueReports ? <strong style={{ color: "var(--red)" }}> · {r.lawyer.overdueReports} {tx("প্রতিবেদন দেরি", "report(s) overdue")}</strong> : null}
                      {r.lawyer.missed ? <strong style={{ color: "var(--red)" }}> · {r.lawyer.missed} {tx("মিস", "missed")}</strong> : null}
                    </span>
                  ) : null}
                </td>
                <td>
                  <div className={cc.actions}>
                    <a className={cc.go} href={href}>
                      {tx("কেস খুলুন", "Open case")}
                    </a>
                    {r.handler?.kind === "LAWYER" ? (
                      <>
                        <a href={`#lawyer/${encodeURIComponent(r.handler.id)}`} style={{ fontSize: "var(--t-small)" }}>
                          {tx("আইনজীবী নিয়ন্ত্রণ (তলব, লাল পতাকা)", "Lawyer control (summon, red flag)")}
                        </a>
                        <a href={href} style={{ fontSize: "var(--t-small)" }}>
                          {tx("প্রত্যাহার / পুনঃনিয়োগ", "Withdraw / reassign")}
                        </a>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Filter = "OPEN" | "LAWYER" | "MEDIATION" | "STALE" | "OLD" | "CLOSED" | "ALL";

export function DistrictCases() {
  const { lang, tx } = useTx();
  const v = useDistrictCases();
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [q, setQ] = useState("");
  const d = DISTRICTS.find((x) => x.code === v.officer?.district);
  const open = v.rows.filter((r) => !r.closed);
  const pick = (f: Filter) =>
    v.rows.filter((r) =>
      f === "ALL" ? true
      : f === "OPEN" ? !r.closed
      : f === "CLOSED" ? r.closed
      : f === "LAWYER" ? !r.closed && r.a.review?.pathway?.type === "LAWYER"
      : f === "MEDIATION" ? !r.closed && r.a.review?.pathway?.type === "MEDIATION"
      : f === "STALE" ? r.staleTone === "err"
      : r.ageTone === "err",
    );
  const needle = q.trim().toLowerCase();
  const rows = pick(filter).filter((r) => !needle || [r.control.caseRef, r.a.applicationId, r.a.data.applicant.fullName ?? "", r.handler?.name ?? ""].some((x) => x.toLowerCase().includes(needle)));
  const filters: [Filter, string][] = [
    ["OPEN", tx("চলমান", "Open")],
    ["LAWYER", tx("আইনজীবী পথ", "Lawyer cases")],
    ["MEDIATION", tx("মধ্যস্থতা", "Mediation")],
    ["STALE", tx("১৪+ দিন হালনাগাদ নেই", "No update 14+ days")],
    ["OLD", tx("৯০+ দিন চলমান", "Running 90+ days")],
    ["CLOSED", tx("বন্ধ", "Closed")],
    ["ALL", tx("সব", "All")],
  ];
  return (
    <>
      <header className={ui.queuePlainHead}>
        <div className={ui.queueHeroCopy}>
          <span className={ui.heroKicker}>{tx("জেলার সব কেস", "ALL DISTRICT CASES")}</span>
          <h1 className={ui.queueTitle}>{d ? tx(`${d.label.bn} জেলা — কেস রেজিস্টার`, `${d.label.en} district — case register`) : tx("কেস রেজিস্টার", "Case register")}</h1>
        </div>
      </header>
      <div className={cc.lanes} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 0, marginBottom: "var(--s-4)" }}>
        {(
          [
            [open.length, tx("চলমান কেস", "Open cases"), "neutral"],
            [open.filter((r) => r.ageTone === "err").length, tx("৯০+ দিন", "Running 90+ days"), "err"],
            [open.filter((r) => r.staleTone === "err").length, tx("১৪+ দিন নীরব", "Silent 14+ days"), "err"],
            [open.filter((r) => r.a.review?.pathway?.type === "LAWYER").length, tx("আইনজীবীর কেস", "Lawyer cases"), "neutral"],
            [open.filter((r) => (r.lawyer?.overdueReports ?? 0) > 0).length, tx("আইনজীবীর প্রতিবেদন দেরি", "Lawyer reports overdue"), "err"],
            [open.filter((r) => r.urgent.red).length, tx("লাল পতাকা", "Red-flagged"), "err"],
          ] as [number, string, Tone][]
        ).map(([n, l, tone]) => (
          <div key={l} className={cc.lane} style={{ padding: "10px 14px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, color: n && tone !== "neutral" ? COLOR[tone] : "var(--ink)" }}>{n}</div>
            <div className={cc.muted} style={{ fontSize: "var(--t-small)" }}>
              {l}
            </div>
          </div>
        ))}
      </div>
      <Legend />
      <div className={cc.filters} style={{ marginTop: 0 }}>
        {filters.map(([k, l]) => (
          <button key={k} type="button" className={`${cc.chip} ${filter === k ? cc.chipOn : ""}`} onClick={() => setFilter(k)}>
            {l} <span className={cc.muted}>({pick(k).length})</span>
          </button>
        ))}
        <input aria-label={tx("খুঁজুন", "Search")} placeholder={tx("কেস, নাম বা আইনজীবী খুঁজুন", "Search case, name or lawyer")} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 8, font: "inherit", fontSize: "var(--t-small)", minWidth: 200 }} />
      </div>
      <CaseTable rows={rows} />
      <p className={cc.muted} style={{ fontSize: "var(--t-small)" }}>
        {lang === "bn" ? "সব সংখ্যা ও রং কেসের রেকর্ড ও অডিট থেকে; এখানে কিছু বদলায় না।" : "All figures and colours come from the case record and audit; nothing changes here."}
      </p>
    </>
  );
}

export function UrgentCases() {
  const { tx } = useTx();
  const v = useUrgentCases();
  const open = v.rows.filter((r) => !r.closed);
  return (
    <>
      <header className={ui.queuePlainHead}>
        <div className={ui.queueHeroCopy}>
          <span className={ui.heroKicker} style={{ color: "var(--red)" }}>
            {tx("নিয়মভিত্তিক লাল পতাকা", "RED FLAG — BY RULE")}
          </span>
          <h1 className={ui.queueTitle}>{tx("জরুরি কেস", "Urgent cases")}</h1>
          <p className={ui.heroDescription}>
            {tx("আবেদনকারীর বর্ণনা ও বিষয়ের ধরন থেকে নির্দিষ্ট নিয়মে লাল পতাকা: সহিংস অপরাধ, যৌন অপরাধ, ব্যক্তিগত নিরাপত্তা, পারিবারিক সহিংসতা। প্রতিটি পতাকায় কোন শব্দে নিয়ম চলেছে তা দেখানো হয়; অফিসার নিশ্চিত করেন বা কারণসহ সরান।", "Flagged red by fixed rules from the applicant's description and matter type: violent crime, sexual offence, personal safety, domestic violence. Each flag shows the words that triggered it; the officer confirms it or clears it with a reason.")}
          </p>
        </div>
        <div className={ui.heroMetric}>
          <span className={ui.heroMetricNumber} style={{ color: open.length ? "var(--red)" : undefined }}>
            {open.length}
          </span>
          <span className={ui.heroMetricLabel}>{tx("চলমান জরুরি", "Open urgent")}</span>
        </div>
      </header>
      <Legend />
      <CaseTable rows={v.rows} showUrgency />
    </>
  );
}

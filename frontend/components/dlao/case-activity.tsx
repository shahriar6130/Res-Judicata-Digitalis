"use client";

/* ------------------------------------------------------------------ *
 *  ACTIVITY / AUDIT TRAIL (Feature 11) — case details, /dashboard/dlo#app/<id>.
 *  Chronological, read-only: WHO · WHAT · WHEN · CASE · STATUS for every
 *  audit entry of the case. There is no edit or delete control anywhere;
 *  the store itself rejects any change to earlier entries
 *  (lib/dlas/audit-trail.ts → sealAuditHistory).
 * ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { actorNames, caseActivity, useDlasDb, type ApplicationRecord, type AuditCategory, type AuditView } from "@/lib/dlas";
import ui from "./dlao.module.css";
import cc from "./office-control.module.css";

type Lang = "bn" | "en";
type Filter = "KEY" | "ALL" | "INTAKE" | "PATHWAY" | "MEDIATION" | "OUTCOME" | "LAWYER";

const FILTER_CATS: Record<Exclude<Filter, "KEY" | "ALL">, AuditCategory[]> = {
  INTAKE: ["INTAKE", "VERIFICATION"],
  PATHWAY: ["PATHWAY"],
  MEDIATION: ["MEDIATION"],
  OUTCOME: ["SETTLEMENT", "FAILURE"],
  LAWYER: ["LAWYER"],
};

const ROLE_COLOR: Record<string, string> = {
  System: "var(--dlo-muted)",
  "Legal Aid Officer": "var(--ink)",
  CLO: "var(--ink)",
  Mediator: "var(--green)",
};

const pretty = (s: string | null | undefined) => (s ? s.replaceAll("_", " ").toLowerCase() : "");

function statusText(v: AuditView, lang: Lang) {
  const s = v.status;
  if (!s) return lang === "bn" ? "অবস্থা রেকর্ড হয়নি (পুরোনো এন্ট্রি)" : "status not recorded (older entry)";
  const med = s.mediation ? (s.pathway ? ` → ${pretty(s.mediation)}` : ` · ${lang === "bn" ? "মধ্যস্থতা" : "mediation"}: ${pretty(s.mediation)}`) : "";
  return `${pretty(s.application)}${s.pathway ? ` · ${pretty(s.pathway)}` : ""}${med}`;
}

function detailRows(v: AuditView, a: ApplicationRecord) {
  const e = a.audit.find((x) => x.seq === v.seq);
  const d = e?.detail ?? {};
  return Object.entries(d)
    .filter(([k, x]) => x !== null && x !== undefined && x !== "" && !["officer", "mediator", "officerName"].includes(k))
    .map(([k, x]) => [k, typeof x === "object" ? JSON.stringify(x) : String(x)] as const);
}

export function CaseActivityTrail({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const L = lang as Lang;
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [filter, setFilter] = useState<Filter>("KEY");
  const [open, setOpen] = useState<number | null>(null);
  const db = useDlasDb();
  const all = useMemo(() => caseActivity(a, actorNames(db)), [a, db]);
  const rows = all.filter((v) => (filter === "ALL" ? true : filter === "KEY" ? v.key : FILTER_CATS[filter].includes(v.category)));

  const byDay: { day: string; items: AuditView[] }[] = [];
  for (const v of rows) {
    const day = new Date(v.at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const g = byDay[byDay.length - 1];
    if (g && g.day === day) g.items.push(v);
    else byDay.push({ day, items: [v] });
  }

  const filters: [Filter, string][] = [
    ["KEY", tx("মূল ঘটনা", "Key events")],
    ["ALL", tx("সব", "All")],
    ["INTAKE", tx("গ্রহণ ও যাচাই", "Intake & verification")],
    ["PATHWAY", tx("আইনি পথ", "Pathway")],
    ["MEDIATION", tx("মধ্যস্থতা", "Mediation")],
    ["OUTCOME", tx("নিষ্পত্তি / ব্যর্থতা", "Settlement / failure")],
    ["LAWYER", tx("আইনজীবী", "Lawyer")],
  ];

  return (
    <section id="case-activity" className={ui.panel} style={{ marginTop: "var(--s-6)" }} aria-label={tx("কার্যকলাপ / অডিট ট্রেইল", "Activity / audit trail")}>
      <div className={ui.panelTitle}>
        <span>{tx("কার্যকলাপ / অডিট ট্রেইল", "ACTIVITY / AUDIT TRAIL")}</span>
        <span className={ui.tag} title={tx("আগের এন্ট্রি বদলানো বা মোছা যায় না", "Earlier entries cannot be changed or deleted")}>
          🔒 {tx("শুধু যোগ করা যায় · পড়ার জন্য", "Append-only · read-only")}
        </span>
      </div>
      <p className={cc.muted} style={{ fontSize: "var(--t-small)", margin: "0 0 var(--s-3)" }}>
        {tx("কে · কী · কখন · কেস · তখনকার অবস্থা — পুরোনো থেকে নতুন ক্রমে। গোপন ককাস নোটের বিষয়বস্তু এখানে কখনো থাকে না।", "Who · what · when · case · status at the time — oldest first. Confidential caucus content is never included.")}
      </p>

      <div className={cc.filters} style={{ margin: "0 0 var(--s-3)" }}>
        {filters.map(([k, l]) => (
          <button key={k} type="button" className={`${cc.chip} ${filter === k ? cc.chipOn : ""}`} onClick={() => setFilter(k)} aria-pressed={filter === k}>
            {l}
          </button>
        ))}
        <span className={cc.muted} style={{ marginLeft: "auto", fontSize: "var(--t-small)" }}>
          {rows.length} / {all.length} {tx("টি এন্ট্রি", "entries")}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className={cc.muted}>{tx("এই ফিল্টারে কোনো এন্ট্রি নেই।", "No entries for this filter.")}</p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {byDay.map((g) => (
            <li key={g.day}>
              <div style={{ fontSize: "var(--t-label)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--dlo-muted)", fontWeight: 600, padding: "var(--s-3) 0 var(--s-2)", borderBottom: "1px solid var(--dlo-line)" }}>{g.day}</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {g.items.map((v) => {
                  const expanded = open === v.seq;
                  const details = expanded ? detailRows(v, a) : [];
                  return (
                    <li key={v.seq} style={{ display: "grid", gridTemplateColumns: "56px 14px minmax(0,1fr)", gap: "0 10px", padding: "10px 0", borderBottom: "1px solid var(--dlo-line)" }}>
                      <time dateTime={v.at} style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink)" }}>
                        {new Date(v.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </time>
                      <span aria-hidden style={{ width: 10, height: 10, marginTop: 5, borderRadius: "50%", background: ROLE_COLOR[v.who.en] ?? "var(--status-pending)", border: v.who.en === "System" ? "2px dashed var(--dlo-muted)" : undefined, boxSizing: "border-box" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "var(--t-small)" }}>
                          <strong style={{ color: ROLE_COLOR[v.who.en] ?? "var(--ink)" }}>{v.who[L]}</strong>
                          {v.name ? <span className={cc.muted}> · {v.name}</span> : null}
                          {v.systemOnBehalfOf ? <span className={cc.muted}> · {tx("চালিয়েছেন", "run by")} {v.systemOnBehalfOf}</span> : null}
                        </div>
                        <div style={{ fontWeight: 600, color: "var(--ink)", margin: "2px 0" }}>{v.what[L]}</div>
                        <div className={cc.muted} style={{ fontSize: "0.8rem", display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                          <span style={{ fontFamily: "var(--font-mono)" }}>{v.caseId}</span>
                          <span>
                            {tx("অবস্থা", "Status")}: {statusText(v, L)}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)" }}>#{v.seq}</span>
                          <button type="button" onClick={() => setOpen(expanded ? null : v.seq)} style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "var(--ink)", textDecoration: "underline", cursor: "pointer" }} aria-expanded={expanded}>
                            {expanded ? tx("বিস্তারিত লুকান", "hide details") : tx("বিস্তারিত", "details")}
                          </button>
                        </div>
                        {expanded ? (
                          <dl style={{ margin: "6px 0 0", display: "grid", gridTemplateColumns: "max-content minmax(0,1fr)", gap: "2px 12px", fontSize: "0.8rem" }}>
                            <dt className={cc.muted}>action</dt>
                            <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{v.action}</dd>
                            <dt className={cc.muted}>actor</dt>
                            <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{v.actorId}</dd>
                            <dt className={cc.muted}>at</dt>
                            <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{v.at}</dd>
                            {details.map(([k, x]) => (
                              <div key={k} style={{ display: "contents" }}>
                                <dt className={cc.muted}>{k}</dt>
                                <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{x}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
      <p className={cc.muted} style={{ fontSize: "0.8rem", margin: "var(--s-3) 0 0" }}>
        🔒 {tx("কোনো স্ক্রিন থেকে অডিট এন্ট্রি সম্পাদনা বা মোছা যায় না; আগের কোনো এন্ট্রি বদলালে সংরক্ষণ ব্যর্থ হয় এবং কিছুই সেভ হয় না।", "No screen can edit or delete audit entries; any write that alters an earlier entry is rejected and nothing is saved.")}
      </p>
    </section>
  );
}

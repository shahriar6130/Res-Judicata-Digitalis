"use client";

/* ------------------------------------------------------------------ *
 *  MEDIATION LIFECYCLE timeline (Feature 12).
 *  One vertical timeline per case, read from the shared record
 *  (lib/dlas/mediation-lifecycle.ts). Every stage shows its owner lane
 *  and its human checkpoint in large type:
 *    SYSTEM SUGGESTION · OFFICER REVIEW REQUIRED · OFFICER CONFIRMED ·
 *    MEDIATOR ACTION · COMPLETED
 *  Used on the demo page and in the officer's case details.
 * ------------------------------------------------------------------ */

import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, mediationLifecycle, useDlasDb, type ApplicationRecord, type Checkpoint, type LifecycleBranch, type LifecycleLane } from "@/lib/dlas";
import css from "./lifecycle.module.css";

type Lang = "bn" | "en";

export const LANE: Record<LifecycleLane, { color: string; bn: string; en: string }> = {
  CITIZEN: { color: "#6b7280", bn: "নাগরিক", en: "CITIZEN" },
  SYSTEM: { color: "#7c3aed", bn: "প্রযুক্তি", en: "TECHNOLOGY" },
  OFFICER: { color: "#111827", bn: "লিগ্যাল এইড অফিসার", en: "LEGAL AID OFFICER" },
  MEDIATOR: { color: "#047857", bn: "মধ্যস্থতাকারী", en: "MEDIATOR" },
  PARTY: { color: "#0e7490", bn: "পক্ষগণ", en: "PARTIES" },
  CLO: { color: "#6d28d9", bn: "চিফ লিগ্যাল এইড অফিসার", en: "CLO" },
  LAWYER: { color: "#1d4ed8", bn: "প্যানেল আইনজীবী", en: "PANEL LAWYER" },
  DBLA: { color: "#92400e", bn: "DBLA", en: "DBLA" },
};

export const CHECKPOINT: Record<Checkpoint, { bn: string; en: string }> = {
  CITIZEN_ACTION: { bn: "নাগরিকের কাজ", en: "CITIZEN ACTION" },
  SYSTEM_CHECK: { bn: "সিস্টেম যাচাই", en: "SYSTEM CHECK" },
  SYSTEM_SUGGESTION: { bn: "সিস্টেমের পরামর্শ", en: "SYSTEM SUGGESTION" },
  OFFICER_REVIEW_REQUIRED: { bn: "অফিসারের পর্যালোচনা প্রয়োজন", en: "OFFICER REVIEW REQUIRED" },
  OFFICER_CONFIRMED: { bn: "✓ অফিসার নিশ্চিত করেছেন", en: "✓ OFFICER CONFIRMED" },
  MEDIATOR_ACTION: { bn: "মধ্যস্থতাকারীর কাজ", en: "MEDIATOR ACTION" },
  PARTY_ACTION: { bn: "পক্ষদের কাজ", en: "PARTY ACTION" },
  LAWYER_ACTION: { bn: "আইনজীবীর কাজ", en: "LAWYER ACTION" },
  COMPLETED: { bn: "✓ সম্পন্ন", en: "✓ COMPLETED" },
  OVERSIGHT: { bn: "DBLA তত্ত্বাবধান", en: "DBLA OVERSIGHT" },
};

export function CheckpointBadge({ c }: { c: Checkpoint }) {
  const { lang } = useI18n();
  return <span className={`${css.badge} ${css[`b_${c}`]}`}>{CHECKPOINT[c][lang as Lang]}</span>;
}

export function MediationLifecycleView({ a, expected, onOpen, title = true }: { a: ApplicationRecord; expected?: LifecycleBranch; onOpen?: (href: string, lane: LifecycleLane) => void; title?: boolean }) {
  const { lang } = useI18n();
  const L = lang as Lang;
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const db = useDlasDb();
  const lc = mediationLifecycle(a, db.tasks, expected);

  return (
    <section aria-label={tx("মধ্যস্থতার জীবনচক্র", "Mediation lifecycle")}>
      {title ? (
        <>
          <p className={css.kicker}>{tx("কেসের সময়রেখা", "CASE TIMELINE")}</p>
          <h2 style={{ fontFamily: "var(--font-serif)", margin: "0 0 6px" }}>
            {tx("মধ্যস্থতার জীবনচক্র", "Mediation lifecycle")} — {lc.branch === "FAILURE" ? tx("ব্যর্থতা → আইনজীবী", "failure → panel lawyer") : tx("নিষ্পত্তি → প্রত্যয়ন", "settlement → certification")}
            {!lc.branchKnown ? <span className={css.muted} style={{ fontSize: "0.9rem" }}> ({tx("ফলাফল এখনো রেকর্ড হয়নি", "outcome not recorded yet")})</span> : null}
          </h2>
          <p className={`${css.muted} ${css.small}`} style={{ margin: "0 0 var(--s-3)" }}>
            {tx("প্রতিটি ধাপ কেসের রেকর্ড থেকে — কে করেছেন, কখন, আর কোন মানবিক সিদ্ধান্ত লেগেছে।", "Every stage is read from the case record — who did it, when, and which human decision it needed.")}
          </p>
        </>
      ) : null}
      <ol className={css.timeline}>
        {lc.stages.map((s, i) => {
          const style = { "--lane": LANE[s.lane].color } as CSSProperties;
          return (
            <li key={s.key} className={css.stage} style={style} aria-current={s.state === "CURRENT" ? "step" : undefined}>
              <span className={`${css.node} ${s.state === "DONE" ? css.nodeDone : ""} ${s.state === "CURRENT" ? css.nodeCurrent : ""}`} aria-hidden>
                {s.state === "DONE" ? "✓" : i + 1}
              </span>
              <div className={`${css.card} ${s.state === "CURRENT" ? css.cardCurrent : ""} ${s.state === "UPCOMING" ? css.cardUpcoming : ""}`}>
                <div className={css.cardTop}>
                  <span className={css.lane}>{LANE[s.lane][L]}</span>
                  <CheckpointBadge c={s.checkpoint} />
                  {s.state === "CURRENT" ? <strong style={{ fontSize: "0.75rem", color: "var(--lane)" }}>← {tx("এখন এখানে", "NOW")}</strong> : null}
                </div>
                <div className={css.title} style={{ marginTop: 4 }}>
                  {s.title[L]}
                </div>
                <p className={css.purpose}>{s.purpose[L]}</p>
                {s.by ? (
                  <div className={css.who}>
                    <strong>{s.by.role}</strong>
                    {s.by.name ? ` · ${s.by.name}` : ""} · {formatDateTime(s.by.at, lang)}
                  </div>
                ) : null}
                {s.facts.length ? (
                  <ul className={css.facts}>
                    {s.facts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : null}
                {s.state !== "UPCOMING" ? (
                  onOpen ? (
                    <button type="button" className={css.open} onClick={() => onOpen(s.href, s.lane)} style={{ background: "none", border: 0, padding: 0, marginTop: 4, color: "var(--ink)", textDecoration: "underline", cursor: "pointer", font: "inherit", fontSize: "0.8rem" }}>
                      {tx("আসল স্ক্রিনে দেখুন →", "See it in the real screen →")}
                    </button>
                  ) : (
                    <a className={css.open} href={s.href} style={{ display: "inline-block", marginTop: 4 }}>
                      {tx("এই ধাপের স্ক্রিন →", "Screen for this step →")}
                    </a>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

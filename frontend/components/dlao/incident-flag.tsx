"use client";

/* ------------------------------------------------------------------ *
 *  Rule-based RED FLAG on the DLO case page. Shows the category, the
 *  rule and the applicant's words that triggered it; the officer
 *  confirms the flag or clears it with a reason (audited).
 *  lib/dlas/incident-taxonomy.ts · lib/dlas/incident-flag.ts
 * ------------------------------------------------------------------ */

import { useState } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { IncidentFlagService, formatDateTime, incidentLabel, useIncident, type ApplicationRecord } from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

export function IncidentFlagBanner({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const c = useIncident(a);
  const [clearing, setClearing] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => unknown) => {
    try {
      fn();
      setErr(null);
      setClearing(false);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const review = c.officerReview;
  const cleared = review?.decision === "CLEARED";
  const words = c.matched.slice(0, 5).map((m) => `“${m.keyword}”`).join(", ");

  if (!c.red) {
    return (
      <p className={styles.hint} style={{ margin: "0 0 var(--s-3)" }}>
        {tx("শ্রেণি (নিয়ম)", "Category (rule)")}: <strong>{incidentLabel(c.category, c.subcategory, lang)}</strong> · {tx("লাল পতাকা নেই", "no red flag")}
      </p>
    );
  }
  return (
    <div className={`${ui.banner} ${cleared ? ui.bannerWarn : ui.bannerErr}`} role={cleared ? "status" : "alert"} style={{ marginBottom: "var(--s-4)", borderWidth: cleared ? undefined : 2 }}>
      <span className={ui.bannerIcon} aria-hidden>
        ⚑
      </span>
      <div style={{ flex: 1 }}>
        <strong>
          {cleared ? tx("লাল পতাকা সরানো হয়েছে", "Red flag cleared") : tx("লাল পতাকা — এখনই দেখুন", "RED FLAG — look at this now")} · {incidentLabel(c.category, c.subcategory, lang)}
        </strong>
        <div>
          {tx("নিয়ম", "Rule")}: <code>{c.rule}</code>
          {words ? (
            <>
              {" "}
              · {tx("আবেদনকারীর শব্দ", "applicant's words")}: {words}
            </>
          ) : null}
        </div>
        <div className={styles.hint}>{tx(`সিস্টেমের নিয়ম (${c.rulesVersion}) — পরামর্শমূলক; সিদ্ধান্ত আপনার।`, `System rule (${c.rulesVersion}) — advisory; the decision is yours.`)}</div>
        {review ? (
          <div style={{ marginTop: 4 }}>
            {review.decision === "CONFIRMED" ? tx("নিশ্চিত করেছেন", "Confirmed by") : tx("সরিয়েছেন", "Cleared by")} {review.byName} · {formatDateTime(review.at, lang)}
            {review.reason ? ` · “${review.reason}”` : ""}
          </div>
        ) : null}
        {err ? (
          <div role="alert" style={{ color: "var(--red)", marginTop: 4 }}>
            {err}
          </div>
        ) : null}
        {clearing ? (
          <div style={{ marginTop: 8 }}>
            <input className={styles.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("কেন এই পতাকা ভুল (কমপক্ষে ১০ অক্ষর)", "Why the flag is wrong (at least 10 characters)")} />
            <div className={styles.actions} style={{ marginTop: 6 }}>
              <Button variant="secondary" disabled={reason.trim().length < 10} onClick={() => run(() => IncidentFlagService.review(a.applicationId, "CLEARED", reason))}>
                {tx("পতাকা সরান", "Clear the flag")}
              </Button>
              <Button variant="secondary" onClick={() => setClearing(false)}>
                {tx("বাতিল", "Cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions} style={{ marginTop: 8 }}>
            {review?.decision !== "CONFIRMED" ? <Button onClick={() => run(() => IncidentFlagService.review(a.applicationId, "CONFIRMED", ""))}>✓ {cleared ? tx("আবার লাল করুন", "Flag red again") : tx("পতাকা নিশ্চিত করুন", "Confirm the flag")}</Button> : null}
            {!cleared ? (
              <Button variant="secondary" onClick={() => setClearing(true)}>
                {tx("ভুল পতাকা — সরান…", "Wrong flag — clear…")}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

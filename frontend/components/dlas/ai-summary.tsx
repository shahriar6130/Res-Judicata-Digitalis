"use client";

/* ------------------------------------------------------------------ *
 *  ✨ Summarize — SIMULATED AI case summary (lib/dlas/case-summary.ts).
 *  Used on the DLO case page, the DLO staff story-check page, the
 *  mediator workspace and the panel lawyer's case view. A short
 *  "reading… / drafting…" sequence, then the summary appears section by
 *  section. Role-filtered; audited on the case.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { CaseSummaryService, type CaseSummary, type SummaryRole } from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "@/components/dlao/dlao.module.css";

const STEPS: { bn: string; en: string }[] = [
  { bn: "আবেদন ও আবেদনকারীর বর্ণনা পড়ছে…", en: "Reading the application and the applicant's account…" },
  { bn: "যাচাই, আইনি পথ ও অডিট ইতিহাস দেখছে…", en: "Checking verification, pathway and the audit history…" },
  { bn: "আপনার ভূমিকার জন্য তথ্য ছেঁকে নিচ্ছে…", en: "Filtering to what your role may see…" },
  { bn: "সারসংক্ষেপ লিখছে…", en: "Writing the summary…" },
];

export function AiSummary({ applicationId, role }: { applicationId: string; role: SummaryRole }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [step, setStep] = useState<number | null>(null);
  const [sum, setSum] = useState<CaseSummary | null>(null);
  const [shown, setShown] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const start = () => {
    setErr(null);
    setSum(null);
    setShown(0);
    setStep(0);
    STEPS.forEach((_, i) => later(() => setStep(i), i * 700));
    later(() => {
      setStep(null);
      try {
        const s = CaseSummaryService.generate(applicationId, role);
        setSum(s);
        const parts = s.sections.length + 2;
        for (let i = 1; i <= parts; i += 1) later(() => setShown(i), i * 220);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    }, STEPS.length * 700);
  };

  return (
    <section aria-label={tx("AI সারসংক্ষেপ", "AI summary")} style={{ margin: "0 0 var(--s-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" disabled={step !== null} onClick={start}>
          ✨ {sum ? tx("আবার সারসংক্ষেপ", "Summarize again") : tx("সারসংক্ষেপ", "Summarize")}
        </Button>
        <span className={`${ui.tag} ${ui.ink}`}>{tx("সিমুলেটেড AI", "SIMULATED AI")}</span>
        {sum ? (
          <button type="button" className={ui.textBtn} onClick={() => setSum(null)}>
            {tx("লুকান", "Hide")}
          </button>
        ) : null}
      </div>

      {step !== null ? (
        <div className={ui.flowStep} role="status" aria-live="polite" style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <style>{"@keyframes aisum-spin{to{transform:rotate(360deg)}}@keyframes aisum-pulse{0%,100%{opacity:.35}50%{opacity:.9}}"}</style>
          {STEPS.map((s, i) => (
            <div key={s.en} style={{ display: "flex", alignItems: "center", gap: 8, opacity: i <= step ? 1 : 0.35 }}>
              {i < step ? (
                <span aria-hidden style={{ color: "var(--green)", fontWeight: 700, width: 14 }}>
                  ✓
                </span>
              ) : i === step ? (
                <span aria-hidden style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--ink)", animation: "aisum-spin .8s linear infinite" }} />
              ) : (
                <span aria-hidden style={{ width: 14 }} />
              )}
              {s[lang === "bn" ? "bn" : "en"]}
            </div>
          ))}
          {[92, 78, 85].map((w) => (
            <div key={w} aria-hidden style={{ height: 10, width: `${w}%`, borderRadius: 6, background: "var(--line)", animation: "aisum-pulse 1.2s ease-in-out infinite" }} />
          ))}
        </div>
      ) : null}

      {err ? (
        <div className={`${ui.banner} ${ui.bannerErr}`} role="alert" style={{ marginTop: 8 }}>
          {err}
        </div>
      ) : null}

      {sum ? (
        <article className={`${ui.flowStep} ${ui.suggest}`} style={{ marginTop: 8 }}>
          <span className={ui.suggestBadge}>{tx("AI সারসংক্ষেপ — সিমুলেটেড · যাচাই করে ব্যবহার করুন", "AI SUMMARY — SIMULATED · check before relying on it")}</span>
          {shown >= 1 ? <p style={{ fontWeight: 600, margin: "8px 0" }}>{sum.headline}</p> : null}
          {shown >= 2 && sum.flags.length ? (
            <ul style={{ margin: "0 0 8px", paddingLeft: 18, color: "var(--red)" }}>
              {sum.flags.map((f) => (
                <li key={f}>⚑ {f}</li>
              ))}
            </ul>
          ) : null}
          {sum.sections.slice(0, Math.max(0, shown - 2)).map((s) => (
            <div key={s.title} style={{ marginTop: 6 }}>
              <div className={ui.sectionHead}>{s.title}</div>
              <ul style={{ margin: "4px 0", paddingLeft: 18, display: "grid", gap: 2 }}>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
          {shown >= sum.sections.length + 2 ? (
            <p className={styles.hint} style={{ marginBottom: 0 }}>
              {tx("আপনার ভূমিকার জন্য বাদ দেওয়া", "Left out for your role")}: {sum.withheld.join(", ")} · {sum.summaryId} · {sum.version} · {tx("মামলার রেকর্ড থেকে তৈরি; সিদ্ধান্ত আপনার।", "built from the case record; decisions stay with you.")}
            </p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}

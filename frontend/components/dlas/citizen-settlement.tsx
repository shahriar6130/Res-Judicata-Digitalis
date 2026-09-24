"use client";

/* ------------------------------------------------------------------ *
 *  Citizen: the settlement testimonial + appeal.
 *   • CitizenSettlementCard (case page)  — the testimonial, the appeal
 *     window, "Accept the settlement" or "Appeal" with a reason, and the
 *     office's decision afterwards.
 *   • CitizenSettlementAlerts (home)     — a short banner for any case
 *     whose testimonial is waiting for the citizen's response.
 *  lib/dlas/settlement-appeal.ts
 * ------------------------------------------------------------------ */

import { useState } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { APPEAL_WINDOW_DAYS, SettlementAppealService, appealWindowOpen, formatDateTime, useSettlementAppealSweep } from "@/lib/dlas";
import { useCitizenApplication, useCitizenApplications } from "@/lib/dlas/citizen-view";
import { TestimonialView } from "./testimonial-view";
import styles from "@/components/dlas/dlas.module.css";
import ui from "@/components/dlao/dlao.module.css";

export function CitizenSettlementCard({ applicationId }: { applicationId: string }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const a = useCitizenApplication(applicationId);
  useSettlementAppealSweep();
  const [mode, setMode] = useState<"appeal" | "accept" | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flow = a?.mediation?.workspace?.settlementWorkflow;
  const t = flow?.testimonial;
  const ap = flow?.appeal ?? null;
  if (!a || !t) return null;
  const run = (fn: () => unknown, ok: string) => {
    try {
      fn();
      setMsg({ ok: true, text: ok });
      setMode(null);
      setReason("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  const open = appealWindowOpen(ap);
  return (
    <section id="settlement" aria-label={tx("নিষ্পত্তির প্রত্যয়নপত্র", "Settlement testimonial")} style={{ margin: "var(--s-5) 0", display: "grid", gap: "var(--s-3)" }}>
      {msg ? (
        <div className={`${ui.banner} ${msg.ok ? ui.bannerOk : ui.bannerErr}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </div>
      ) : null}

      {open ? (
        <div className={`${ui.banner} ${ui.bannerWarn}`}>
          <span className={ui.bannerIcon} aria-hidden>
            ⚖
          </span>
          <div style={{ flex: 1 }}>
            <strong>{tx("আপনার নিষ্পত্তির প্রত্যয়নপত্র এসেছে", "Your settlement testimonial is here")}</strong>
            <div>
              {tx(`এর সাথে একমত না হলে ${formatDateTime(ap!.windowEndsAt, lang)}-এর মধ্যে আপিল করতে পারেন। আপিল না করলে কেসটি নিষ্পন্ন হিসেবে বন্ধ হবে।`, `If you disagree, you can appeal until ${formatDateTime(ap!.windowEndsAt, lang)}. If you do not appeal, the case will be closed as resolved.`)}
            </div>
            {mode === "appeal" ? (
              <div style={{ marginTop: 8 }}>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("কেন আপনি একমত নন? (কমপক্ষে ১০ অক্ষর)", "Why do you disagree? (at least 10 characters)")}</span>
                  <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("যেমন: প্রতিপক্ষ চুক্তি মতো টাকা দিচ্ছে না", "e.g. the other side is not paying as agreed")} />
                </label>
                <div className={styles.actions} style={{ marginTop: 6 }}>
                  <Button disabled={reason.trim().length < 10} onClick={() => run(() => SettlementAppealService.file(applicationId, reason), tx("আপিল অফিসে পাঠানো হয়েছে। অফিসার সিদ্ধান্ত নিয়ে আপনাকে জানাবেন।", "Your appeal was sent to the office. The officer will decide and tell you."))}>
                    {tx("আপিল পাঠান", "Send appeal")}
                  </Button>
                  <Button variant="secondary" onClick={() => setMode(null)}>
                    {tx("বাতিল", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : mode === "accept" ? (
              <div style={{ marginTop: 8 }}>
                <div>{tx("আপনি নিষ্পত্তি মেনে নিলে কেসটি এখনই বন্ধ হবে এবং পরে আপিল করা যাবে না।", "If you accept, the case closes now and you cannot appeal later.")}</div>
                <div className={styles.actions} style={{ marginTop: 6 }}>
                  <Button onClick={() => run(() => SettlementAppealService.acceptSettlement(applicationId), tx("ধন্যবাদ — কেসটি নিষ্পন্ন হিসেবে বন্ধ হয়েছে।", "Thank you — the case is closed as resolved."))}>{tx("হ্যাঁ, মেনে নিচ্ছি", "Yes, I accept")}</Button>
                  <Button variant="secondary" onClick={() => setMode(null)}>
                    {tx("বাতিল", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions} style={{ marginTop: 8 }}>
                <Button onClick={() => setMode("accept")}>✓ {tx("নিষ্পত্তি মেনে নিচ্ছি", "I accept the settlement")}</Button>
                <Button variant="secondary" onClick={() => setMode("appeal")}>
                  {tx("আপিল করুন…", "Appeal…")}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : ap?.status === "FILED" ? (
        <div className={`${ui.banner} ${ui.bannerWarn}`} role="status">
          <span className={ui.bannerIcon} aria-hidden>
            ⏳
          </span>
          <div>
            <strong>{tx("আপনার আপিল অফিসে আছে", "Your appeal is with the office")}</strong> · {ap.filedAt ? formatDateTime(ap.filedAt, lang) : ""}
            <div>“{ap.reason}”</div>
          </div>
        </div>
      ) : ap?.status === "ACCEPTED" ? (
        <div className={`${ui.banner} ${ui.bannerOk}`} role="status">
          <span className={ui.bannerIcon} aria-hidden>
            ✓
          </span>
          <div>
            <strong>{tx("আপনার আপিল গৃহীত হয়েছে — একজন প্যানেল আইনজীবী নিয়োগ করা হবে", "Your appeal was accepted — a panel lawyer will be assigned")}</strong>
            {ap.decision ? <div>“{ap.decision.reason}” — {ap.decision.byName}</div> : null}
          </div>
        </div>
      ) : (
        <div className={`${ui.banner} ${ui.bannerOk}`} role="status">
          <span className={ui.bannerIcon} aria-hidden>
            ✓
          </span>
          <div>
            <strong>{tx("কেস বন্ধ — নিষ্পন্ন", "Case closed — resolved")}</strong>
            {ap?.status === "REJECTED" && ap.decision ? <div>{tx("আপনার আপিল গৃহীত হয়নি", "Your appeal was not accepted")}: “{ap.decision.reason}”</div> : null}
            {ap?.status === "LAPSED" ? <div>{tx(`${APPEAL_WINDOW_DAYS} দিনের মধ্যে কোনো আপিল হয়নি।`, `No appeal was made within ${APPEAL_WINDOW_DAYS} days.`)}</div> : null}
          </div>
        </div>
      )}
      <TestimonialView t={t} />
    </section>
  );
}

/** Home page: testimonials waiting for the citizen's response. */
export function CitizenSettlementAlerts() {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const apps = useCitizenApplications();
  useSettlementAppealSweep();
  const waiting = apps.filter((a) => appealWindowOpen(a.mediation?.workspace?.settlementWorkflow?.appeal ?? null));
  if (!waiting.length) return null;
  return (
    <div style={{ display: "grid", gap: 8, margin: "var(--s-3) 0" }}>
      {waiting.map((a) => (
        <a key={a.applicationId} href={`#cases/${encodeURIComponent(a.applicationId)}`} className={`${ui.banner} ${ui.bannerWarn}`} style={{ textDecoration: "none", color: "inherit" }}>
          <span className={ui.bannerIcon} aria-hidden>
            ⚖
          </span>
          <div>
            <strong>{tx("নিষ্পত্তির প্রত্যয়নপত্র — আপনার উত্তর দরকার", "Settlement testimonial — your response is needed")}</strong> · {a.caseId}
            <div>
              {tx("মেনে নিন বা আপিল করুন", "Accept it or appeal")} · {tx("শেষ সময়", "until")} {formatDateTime(a.mediation!.workspace!.settlementWorkflow!.appeal!.windowEndsAt, lang)} →
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

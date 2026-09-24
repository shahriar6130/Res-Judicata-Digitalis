"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/dlo/settlements[/<APP-ID>] — settlement VERIFICATION by the
 *  Legal Aid Officer (DLO). No separate CLO step any more.
 *    1. Both parties sign (simulated) and the mediator confirms.
 *    2. The DLO verifies (or returns for correction / asks for clarification).
 *    3. The DLO generates the settlement TESTIMONIAL → sent to the citizen,
 *       who may appeal within the window. No appeal / citizen accepts /
 *       appeal rejected → CLOSED (resolved). Appeal accepted → a panel
 *       lawyer is assigned by the DLO (lib/dlas/settlement-appeal.ts).
 *  lib/dlas/mediation-workspace.ts SettlementVerificationService
 * ------------------------------------------------------------------ */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { APPEAL_WINDOW_DAYS, CourtAuthorityService, SettlementAppealService, SettlementVerificationService, formatDateTime, useCloDistrictActivity, useCloSettlement, useCloSettlements, useSettlementAppealSweep, type SettlementAppeal, type SettlementTestimonial } from "@/lib/dlas";
import { TestimonialView } from "@/components/dlas/testimonial-view";
import styles from "@/components/dlas/dlas.module.css";
import ui from "@/components/dlao/dlao.module.css";

type Lang = "bn" | "en";
const STATUS: Record<string, { bn: string; en: string }> = {
  TERMS_RECORDED: { bn: "শর্ত নথিভুক্ত", en: "Terms recorded" },
  PARTY_EXECUTION: { bn: "পক্ষের স্বাক্ষর চলছে", en: "Party execution" },
  AWAITING_MEDIATOR_CONFIRMATION: { bn: "মধ্যস্থতাকারীর নিশ্চিতকরণ বাকি", en: "Awaiting mediator confirmation" },
  AWAITING_CLO_CERTIFICATION: { bn: "অফিসারের যাচাই বাকি", en: "Awaiting your verification" },
  RETURNED_FOR_CORRECTION: { bn: "সংশোধনের জন্য ফেরত", en: "Returned for correction" },
  CLARIFICATION_REQUESTED: { bn: "ব্যাখ্যা চাওয়া হয়েছে", en: "Clarification requested" },
  RESOLVED: { bn: "যাচাইকৃত — প্রত্যয়নপত্র বাকি", en: "Verified — testimonial pending" },
  CLOSED: { bn: "বন্ধ — নিষ্পন্ন", en: "Closed — resolved" },
  WINDOW_OPEN: { bn: "প্রত্যয়নপত্র নাগরিকের কাছে — আপিলের সময় চলছে", en: "Testimonial with the citizen — appeal window open" },
  FILED: { bn: "নাগরিক আপিল করেছেন — আপনার সিদ্ধান্ত", en: "Citizen appealed — your decision" },
  ACCEPTED: { bn: "আপিল গৃহীত — আইনজীবী নিয়োগ", en: "Appeal accepted — assign a lawyer" },
};
const statusKey = (flow: { status: string; testimonial?: SettlementTestimonial | null; appeal?: SettlementAppeal | null }) => {
  if (!flow.testimonial) return flow.status;
  const ap = flow.appeal;
  if (!ap) return "CLOSED";
  return ap.status === "WINDOW_OPEN" || ap.status === "FILED" || ap.status === "ACCEPTED" ? ap.status : "CLOSED";
};

function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

export function CloSettlementQueue() {
  const { lang, tx } = useTx();
  const settlements = useCloSettlements();
  const activity = useCloDistrictActivity();
  const toVerify = settlements.filter((a) => a.mediation?.workspace?.settlementWorkflow?.status === "AWAITING_CLO_CERTIFICATION");
  useSettlementAppealSweep();
  const appeals = settlements.filter((a) => a.mediation?.workspace?.settlementWorkflow?.appeal?.status === "FILED");
  const toIssue = settlements.filter((a) => {
    const f = a.mediation?.workspace?.settlementWorkflow;
    return f?.status === "RESOLVED" && !f.testimonial;
  });
  return (
    <div className={ui.readable}>
      <div className={ui.queuePlainHead}>
        <span className={ui.heroKicker}>{tx("লিগ্যাল এইড অফিসার", "Legal Aid Officer")}</span>
        <h1 className={ui.queueTitle}>{tx("নিষ্পত্তি যাচাই ও প্রত্যয়নপত্র", "Settlement verification & testimonial")}</h1>
        <p className={styles.lead}>{tx("শেষ ধাপ: দুই পক্ষের স্বাক্ষর ও মধ্যস্থতাকারীর নিশ্চিতকরণের পর আপনি চুক্তি যাচাই করেন, তারপর প্রত্যয়নপত্র তৈরি করলে কেস বন্ধ হয়।", "Final step: after both parties sign and the mediator confirms, you verify the agreement, then generate the testimonial — which closes the case.")}</p>
      </div>
      <div className={ui.modeBar} aria-label={tx("জেলা মধ্যস্থতা কার্যক্রম", "District mediation activity")}>
        <span className={ui.tag}>
          {tx("নিষ্পত্তি", "Settlements")} {activity.settlements}
        </span>
        <span className={`${ui.tag} ${toVerify.length ? ui.warn : ""}`}>
          {tx("যাচাই বাকি", "To verify")} {toVerify.length}
        </span>
        <span className={`${ui.tag} ${toIssue.length ? ui.warn : ""}`}>
          {tx("প্রত্যয়নপত্র বাকি", "Testimonial pending")} {toIssue.length}
        </span>
        <span className={`${ui.tag} ${appeals.length ? ui.err : ""}`}>
          {tx("আপিল", "Appeals")} {appeals.length}
        </span>
      </div>
      {!settlements.length ? <div className={ui.banner}>{tx("এই অফিসে কোনো নিষ্পত্তি চুক্তি নেই।", "No settlement agreements in this office yet.")}</div> : null}
      <div className={ui.worklist}>
        {settlements.map((a) => {
          const flow = a.mediation!.workspace!.settlementWorkflow!;
          const k = statusKey(flow);
          return (
            <article className={ui.workItem} key={a.applicationId}>
              <div className={ui.workItemHead}>
                <div className={ui.workItemIdentity}>
                  <span className={ui.workItemEyebrow}>
                    {a.caseId ?? a.applicationId} · {flow.agreementId}
                  </span>
                  <strong>
                    {a.data.applicant.fullName} · {a.data.matter.opposingParty || tx("প্রতিপক্ষের নাম নেই", "Respondent not named")}
                  </strong>
                </div>
                <span className={`${ui.tag} ${k === "CLOSED" ? ui.ok : k === "FILED" ? ui.err : k === "AWAITING_CLO_CERTIFICATION" || k === "RESOLVED" || k === "ACCEPTED" ? ui.warn : ""}`}>{STATUS[k]?.[lang] ?? k}</span>
              </div>
              <p>{flow.terms.agreedResolution}</p>
              <Link className={ui.textBtn} href={`/dashboard/dlo/settlements/${encodeURIComponent(a.applicationId)}`}>
                {k === "AWAITING_CLO_CERTIFICATION" ? tx("যাচাই করুন →", "Verify →") : k === "RESOLVED" ? tx("প্রত্যয়নপত্র তৈরি করুন →", "Generate testimonial →") : k === "FILED" ? tx("আপিলের সিদ্ধান্ত দিন →", "Decide the appeal →") : k === "CLOSED" || k === "WINDOW_OPEN" ? tx("প্রত্যয়নপত্র দেখুন →", "View testimonial →") : tx("খুলুন →", "Open →")}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function CloSettlementReview({ applicationId }: { applicationId: string }) {
  const { lang, tx } = useTx();
  const { officer, application: a, workflow: flow } = useCloSettlement(applicationId);
  useSettlementAppealSweep();
  const [decisionNote, setDecisionNote] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [dispatchReference, setDispatchReference] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => unknown, success: string) => {
    try {
      fn();
      setMessage({ ok: true, text: success });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  };
  if (!officer)
    return (
      <div className={ui.readable}>
        <h1 className={styles.title}>{tx("নিষ্পত্তি যাচাই", "Settlement verification")}</h1>
        <div className={ui.banner}>{tx("প্রথমে DLO পোর্টালে লগইন করুন।", "Sign in through the DLO portal first.")}</div>
      </div>
    );
  if (!a || !flow)
    return (
      <div className={ui.readable}>
        <Link className={ui.textBtn} href="/dashboard/dlo/settlements">
          ← {tx("কার্যতালিকা", "Worklist")}
        </Link>
        <h1 className={styles.title}>{tx("চুক্তি পাওয়া যায়নি", "Agreement not found")}</h1>
      </div>
    );
  const ready = flow.status === "AWAITING_CLO_CERTIFICATION" && flow.execution.APPLICANT.status === "SIGNED" && flow.execution.RESPONDENT.status === "SIGNED" && flow.mediatorConfirmation.status === "CONFIRMED";
  const authorityNotice = a.mediation?.authorityNotifications?.find((x) => x.kind === "SETTLEMENT_OUTCOME");
  const k = statusKey(flow);
  const ap = flow.appeal ?? null;
  const step = a.closedAt || ap?.status === "ACCEPTED" ? 4 : flow.testimonial ? 3 : flow.resolution ? 2 : 1;
  return (
    <div className={ui.readable}>
      <Link className={ui.textBtn} href="/dashboard/dlo/settlements">
        ← {tx("নিষ্পত্তি কার্যতালিকা", "Settlement worklist")}
      </Link>
      <div className={ui.queuePlainHead}>
        <span className={ui.heroKicker}>{tx("লিগ্যাল এইড অফিসারের যাচাই", "Legal Aid Officer verification")}</span>
        <h1 className={ui.queueTitle}>{flow.agreementId}</h1>
        <p className={styles.lead}>
          {a.caseId ?? a.applicationId} · {STATUS[k]?.[lang] ?? k}
        </p>
      </div>

      <ol className={ui.modeBar} style={{ listStyle: "none", padding: 0 }} aria-label={tx("শেষ ধাপ", "Final steps")}>
        {[tx("১. চুক্তি যাচাই", "1. Verify the agreement"), tx("২. প্রত্যয়নপত্র তৈরি", "2. Generate testimonial"), tx(`৩. নাগরিক — আপিলের সময় ${APPEAL_WINDOW_DAYS} দিন`, `3. Citizen — ${APPEAL_WINDOW_DAYS}-day appeal window`), ap?.status === "ACCEPTED" ? tx("৪. আপিল গৃহীত → আইনজীবী", "4. Appeal accepted → lawyer") : tx("৪. কেস বন্ধ (নিষ্পন্ন)", "4. Case closed (resolved)")].map((t, i) => (
          <li key={t} className={`${ui.tag} ${i + 1 < step || step === 4 ? ui.ok : i + 1 === step ? ui.ink : ""}`} aria-current={i + 1 === step ? "step" : undefined}>
            {i + 1 < step || step === 4 ? "✓ " : ""}
            {t}
          </li>
        ))}
      </ol>

      {message ? (
        <div className={`${ui.banner} ${message.ok ? ui.bannerOk : ui.bannerErr}`} role={message.ok ? "status" : "alert"}>
          {message.text}
        </div>
      ) : null}

      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>{tx("প্রাসঙ্গিক মামলার তথ্য", "Relevant case information")}</div>
        <div className={ui.rows}>
          <Row label={tx("আবেদনকারী", "Applicant")}>{a.data.applicant.fullName}</Row>
          <Row label={tx("প্রতিপক্ষ", "Respondent")}>{a.data.matter.opposingParty || tx("নথিভুক্ত নেই", "Not recorded")}</Row>
          <Row label={tx("বিরোধ", "Dispute")}>{a.data.matter.summary}</Row>
          <Row label={tx("পথ", "Pathway")}>{a.mediation?.pathwayStatus}</Row>
        </div>
      </section>
      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>{tx("নিষ্পত্তি চুক্তি", "Settlement agreement")}</div>
        <div className={ui.rows}>
          <Row label={tx("বিষয়", "Issue")}>{flow.terms.issue}</Row>
          <Row label={tx("প্রস্তাবিত সমাধান", "Proposed resolution")}>{flow.terms.proposedResolution}</Row>
          <Row label={tx("সম্মত সমাধান", "Agreed resolution")}>{flow.terms.agreedResolution}</Row>
          <Row label={tx("শর্তাবলি", "Conditions")}>{flow.terms.conditions}</Row>
          <Row label={tx("সময়সীমা", "Deadline")}>{flow.terms.deadline ?? tx("নেই", "None")}</Row>
          <Row label={tx("অতিরিক্ত শর্ত", "Additional terms")}>{flow.terms.additionalTerms ?? tx("নেই", "None")}</Row>
        </div>
      </section>
      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>{tx("সম্পাদন ও নিশ্চিতকরণ", "Execution and confirmation")}</div>
        <div className={ui.banner}>{tx("DEMO / SIMULATED স্বাক্ষর। বাস্তব ডিজিটাল স্বাক্ষর ব্যবস্থা সংযুক্ত নেই।", "DEMO / SIMULATED signatures. No real digital signature system is connected.")}</div>
        <div className={ui.rows}>
          <Row label={tx("আবেদনকারী", "Applicant")}>
            {flow.execution.APPLICANT.status}
            {flow.execution.APPLICANT.signedAt ? ` · ${formatDateTime(flow.execution.APPLICANT.signedAt, lang)}` : ""}
          </Row>
          <Row label={tx("প্রতিপক্ষ", "Respondent")}>
            {flow.execution.RESPONDENT.status}
            {flow.execution.RESPONDENT.signedAt ? ` · ${formatDateTime(flow.execution.RESPONDENT.signedAt, lang)}` : ""}
          </Row>
          <Row label={tx("মধ্যস্থতাকারী", "Mediator")}>
            {flow.mediatorConfirmation.status}
            {flow.mediatorConfirmation.confirmedAt ? ` · ${flow.mediatorConfirmation.mediatorName} · ${formatDateTime(flow.mediatorConfirmation.confirmedAt, lang)}` : ""}
          </Row>
        </div>
      </section>

      {/* ---------- step 1: verify ---------- */}
      {!flow.resolution ? (
        <section className={ui.flowStep}>
          <div className={ui.sectionHead}>{tx("ধাপ ১ — আপনার যাচাই", "Step 1 — your verification")}</div>
          {!ready ? <div className={`${ui.banner} ${ui.bannerWarn}`}>{tx("এখনো যাচাই করা যাবে না: দুই পক্ষের স্বাক্ষর ও মধ্যস্থতাকারীর নিশ্চিতকরণ আবশ্যক।", "You can verify only after both parties have signed and the mediator has confirmed.")}</div> : null}
          <label className={styles.field}>
            <span className={styles.label}>{tx("যাচাইকৃত ফলাফল", "Verified outcome")}</span>
            <textarea className={styles.textarea} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={tx("যেমন: মধ্যস্থতায় নিষ্পত্তি — মাসিক ভরণপোষণ চুক্তি", "e.g. Settled through mediation — monthly maintenance agreement")} />
          </label>
          <label className={styles.field} style={{ marginTop: "var(--s-4)" }}>
            <span className={styles.label}>{tx("ফেরত / ব্যাখ্যার কারণ (মধ্যস্থতাকারী দেখবেন)", "Correction / clarification note (the mediator sees it)")}</span>
            <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className={styles.actions}>
            <Button disabled={!ready || outcome.trim().length < 3} onClick={() => run(() => SettlementVerificationService.verify(applicationId, { outcome }), tx("চুক্তি যাচাই করা হয়েছে। এখন প্রত্যয়নপত্র তৈরি করুন।", "Agreement verified. Now generate the testimonial."))}>
              ✓ {tx("যাচাই করুন", "Verify")}
            </Button>
            <Button variant="secondary" disabled={note.trim().length < 5} onClick={() => run(() => SettlementVerificationService.review(applicationId, "RETURNED_FOR_CORRECTION", note), tx("সংশোধনের জন্য ফেরত পাঠানো হয়েছে।", "Returned for correction."))}>
              {tx("সংশোধনের জন্য ফেরত", "Return for correction")}
            </Button>
            <Button variant="secondary" disabled={note.trim().length < 5} onClick={() => run(() => SettlementVerificationService.review(applicationId, "CLARIFICATION_REQUESTED", note), tx("ব্যাখ্যা চাওয়া হয়েছে।", "Clarification requested."))}>
              {tx("ব্যাখ্যা চান", "Request clarification")}
            </Button>
          </div>
        </section>
      ) : (
        <section className={`${ui.flowStep} ${ui.confirmed}`}>
          <div className={ui.sectionHead}>{tx("যাচাইকৃত ফলাফল", "Verified outcome")}</div>
          <div className={ui.rows}>
            <Row label={tx("ফলাফল", "Outcome")}>{flow.resolution.outcome}</Row>
            <Row label={tx("যাচাই করেছেন", "Verified by")}>
              {flow.resolution.certifyingOfficer} · {formatDateTime(flow.resolution.certificationTimestamp, lang)}
            </Row>
          </div>
        </section>
      )}

      {/* ---------- step 2: testimonial → case closed ---------- */}
      {flow.resolution && !flow.testimonial ? (
        <section className={`${ui.flowStep} ${ui.suggest}`}>
          <span className={ui.suggestBadge}>{tx("ধাপ ২ — প্রত্যয়নপত্র", "STEP 2 — TESTIMONIAL")}</span>
          <p style={{ marginTop: 8 }}>{tx(`নিষ্পত্তির প্রত্যয়নপত্র (টেস্টিমোনিয়াল) তৈরি করুন। এটি নাগরিকের কাছে পাঠানো হবে; তিনি ${APPEAL_WINDOW_DAYS} দিনের মধ্যে আপিল করতে পারেন। আপিল না হলে কেস নিজে থেকে নিষ্পন্ন হিসেবে বন্ধ হবে।`, `Generate the settlement testimonial. It is sent to the citizen, who can appeal within ${APPEAL_WINDOW_DAYS} days. With no appeal the case closes as resolved by default.`)}</p>
          {authorityNotice?.status === "PENDING_DISPATCH" ? <div className={`${ui.banner} ${ui.bannerWarn}`}>{tx("আদালত-প্রেরিত মামলা: রেফারকারী কর্তৃপক্ষকে ফলাফল জানানো নিচে রেকর্ড করুন (কেস বন্ধ হলেও এই কাজটি খোলা থাকবে)।", "Court-referred case: record the outcome notice to the referring authority below (that task stays open even after closure).")}</div> : null}
          <div className={styles.actions}>
            <Button onClick={() => run(() => SettlementVerificationService.issueTestimonial(applicationId), tx("প্রত্যয়নপত্র নাগরিকের কাছে পাঠানো হয়েছে — আপিলের সময় শুরু।", "Testimonial sent to the citizen — the appeal window is open."))}>{tx("প্রত্যয়নপত্র তৈরি করে নাগরিককে পাঠান", "Generate testimonial & send to the citizen")}</Button>
          </div>
        </section>
      ) : null}

      {flow.testimonial ? (
        <>
          <AppealPanel applicationId={applicationId} ap={ap} closedAt={a.closedAt} note={decisionNote} setNote={setDecisionNote} run={run} />
          <TestimonialView t={flow.testimonial} />
        </>
      ) : null}

      {flow.resolution && authorityNotice ? (
        <section className={ui.flowStep}>
          <div className={ui.sectionHead}>{tx("রেফারকারী কর্তৃপক্ষকে ফলাফল", "Outcome to referring authority")}</div>
          <div className={ui.banner}>{tx("প্রোটোটাইপে বাহ্যিক প্রেরণ সিমুলেটেড; এখানে ডিসপ্যাচ রেফারেন্স নথিভুক্ত করুন।", "External dispatch is simulated in this prototype; record the dispatch reference here.")}</div>
          <div className={ui.rows}>
            <Row label={tx("কর্তৃপক্ষ", "Authority")}>{authorityNotice.authority}</Row>
            <Row label={tx("অবস্থা", "Status")}>{authorityNotice.status} · DEMO / SIMULATED</Row>
          </div>
          {authorityNotice.status === "PENDING_DISPATCH" ? (
            <div className={styles.actions}>
              <input className={styles.input} value={dispatchReference} onChange={(e) => setDispatchReference(e.target.value)} placeholder={tx("ডিসপ্যাচ রেফারেন্স", "Dispatch reference")} />
              <Button disabled={dispatchReference.trim().length < 3} onClick={() => run(() => CourtAuthorityService.recordDispatch(applicationId, authorityNotice.notificationId, dispatchReference, "Settlement outcome recorded for referring authority"), tx("ডিসপ্যাচ নথিভুক্ত হয়েছে।", "Dispatch recorded."))}>
                {tx("প্রেরণ নথিভুক্ত করুন", "Record dispatch")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------ citizen appeal (DLO side) ------------------------------ */

function AppealPanel({ applicationId, ap, closedAt, note, setNote, run }: { applicationId: string; ap: SettlementAppeal | null; closedAt: string | null; note: string; setNote: (v: string) => void; run: (fn: () => unknown, ok: string) => void }) {
  const { lang, tx } = useTx();
  if (!ap) return closedAt ? <div className={`${ui.banner} ${ui.bannerOk}`}>✓ {tx("কেস বন্ধ", "Case closed")} · {formatDateTime(closedAt, lang)}</div> : null;
  const WHY: Record<string, { bn: string; en: string }> = {
    ACCEPTED_BY_CITIZEN: { bn: "নাগরিক নিষ্পত্তি মেনে নিয়েছেন", en: "the citizen accepted the settlement" },
    LAPSED: { bn: `${APPEAL_WINDOW_DAYS} দিনে কোনো আপিল হয়নি — স্বয়ংক্রিয়ভাবে নিষ্পন্ন`, en: `no appeal within ${APPEAL_WINDOW_DAYS} days — resolved by default` },
    REJECTED: { bn: "আপিল প্রত্যাখ্যাত — নিষ্পত্তি বহাল", en: "appeal rejected — the settlement stands" },
  };
  if (ap.status === "WINDOW_OPEN")
    return (
      <div className={`${ui.banner} ${ui.bannerWarn}`} role="status">
        <span className={ui.bannerIcon} aria-hidden>
          ⏳
        </span>
        <div>
          <strong>{tx("প্রত্যয়নপত্র নাগরিকের কাছে পাঠানো হয়েছে", "Testimonial sent to the citizen")}</strong> · {tx("আপিলের সময় শেষ", "appeal window ends")} {formatDateTime(ap.windowEndsAt, lang)}
          <div>{tx("নাগরিক মেনে নিলে বা সময়ের মধ্যে আপিল না করলে কেস নিষ্পন্ন হিসেবে বন্ধ হবে।", "If the citizen accepts, or does not appeal in time, the case closes as resolved.")}</div>
        </div>
      </div>
    );
  if (ap.status === "FILED")
    return (
      <section className={`${ui.flowStep} ${ui.suggest}`} aria-label={tx("নাগরিকের আপিল", "Citizen's appeal")}>
        <span className={ui.suggestBadge}>{tx("নাগরিক আপিল করেছেন — আপনার সিদ্ধান্ত", "CITIZEN APPEAL — YOUR DECISION")}</span>
        <div className={ui.rows} style={{ marginTop: 8 }}>
          <Row label={tx("আপিলের কারণ", "Reason given")}>“{ap.reason}”</Row>
          <Row label={tx("দাখিল", "Filed")}>{ap.filedAt ? formatDateTime(ap.filedAt, lang) : "—"}</Row>
        </div>
        <label className={styles.field} style={{ marginTop: 8 }}>
          <span className={styles.label}>{tx("আপনার সিদ্ধান্তের কারণ (কমপক্ষে ১০ অক্ষর; নাগরিক এসএমএসে পাবেন)", "Reason for your decision (at least 10 characters; the citizen gets it by SMS)")}</span>
          <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className={styles.actions}>
          <Button disabled={note.trim().length < 10} onClick={() => run(() => SettlementAppealService.decide(applicationId, "ACCEPTED", note), tx("আপিল গৃহীত — কেস আইনজীবী পথে গেছে। কেস পাতায় আইনজীবী নিয়োগ করুন।", "Appeal accepted — the case moved to the lawyer pathway. Assign a panel lawyer on the case page."))}>
            {tx("আপিল গ্রহণ — আইনজীবী নিয়োগ", "Accept appeal — assign a lawyer")}
          </Button>
          <Button variant="secondary" disabled={note.trim().length < 10} onClick={() => run(() => SettlementAppealService.decide(applicationId, "REJECTED", note), tx("আপিল প্রত্যাখ্যাত — কেস নিষ্পন্ন হিসেবে বন্ধ।", "Appeal rejected — the case is closed as resolved."))}>
            {tx("আপিল প্রত্যাখ্যান — কেস বন্ধ", "Reject appeal — close the case")}
          </Button>
        </div>
      </section>
    );
  if (ap.status === "ACCEPTED")
    return (
      <div className={`${ui.banner} ${ui.bannerWarn}`} role="status">
        <span className={ui.bannerIcon} aria-hidden>
          ⚖
        </span>
        <div>
          <strong>{tx("আপিল গৃহীত — আইনজীবী নিয়োগ করুন", "Appeal accepted — assign a panel lawyer")}</strong> · {ap.decision?.byName} · {ap.decision ? formatDateTime(ap.decision.at, lang) : ""}
          <div>“{ap.decision?.reason}”</div>
          <a className={ui.textBtn} href={`/dashboard/dlo#app/${encodeURIComponent(applicationId)}`}>
            {tx("কেস খুলে আইনজীবী নিয়োগ করুন →", "Open the case to assign a lawyer →")}
          </a>
        </div>
      </div>
    );
  return (
    <div className={`${ui.banner} ${ui.bannerOk}`} role="status">
      <span className={ui.bannerIcon} aria-hidden>
        ✓
      </span>
      <div>
        <strong>{tx("কেস বন্ধ — নিষ্পন্ন", "Case closed — resolved")}</strong> · {WHY[ap.status]?.[lang] ?? ap.status} · {closedAt ? formatDateTime(closedAt, lang) : ""}
        {ap.status === "REJECTED" && ap.decision ? <div>“{ap.decision.reason}” — {ap.decision.byName}</div> : null}
        {ap.reason ? <div className={styles.hint}>{tx("নাগরিকের আপিল", "Citizen's appeal")}: “{ap.reason}”</div> : null}
      </div>
    </div>
  );
}

"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/dlo/settlements[/<APP-ID>] — settlement VERIFICATION by the
 *  Legal Aid Officer (DLO). No separate CLO step any more.
 *    1. Both parties sign (simulated) and the mediator confirms.
 *    2. The DLO verifies (or returns for correction / asks for clarification).
 *    3. The DLO generates the settlement TESTIMONIAL → the case is CLOSED.
 *  lib/dlas/mediation-workspace.ts SettlementVerificationService
 * ------------------------------------------------------------------ */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { CourtAuthorityService, MATTERS, SettlementVerificationService, formatDateTime, label, useCloDistrictActivity, useCloSettlement, useCloSettlements, type SettlementTestimonial } from "@/lib/dlas";
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
  CLOSED: { bn: "প্রত্যয়নপত্র ইস্যু — কেস বন্ধ", en: "Testimonial issued — case closed" },
};
const statusKey = (flow: { status: string; testimonial?: SettlementTestimonial | null }) => (flow.testimonial ? "CLOSED" : flow.status);

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
                <span className={`${ui.tag} ${k === "CLOSED" ? ui.ok : k === "AWAITING_CLO_CERTIFICATION" || k === "RESOLVED" ? ui.warn : ""}`}>{STATUS[k]?.[lang] ?? k}</span>
              </div>
              <p>{flow.terms.agreedResolution}</p>
              <Link className={ui.textBtn} href={`/dashboard/dlo/settlements/${encodeURIComponent(a.applicationId)}`}>
                {k === "AWAITING_CLO_CERTIFICATION" ? tx("যাচাই করুন →", "Verify →") : k === "RESOLVED" ? tx("প্রত্যয়নপত্র তৈরি করুন →", "Generate testimonial →") : k === "CLOSED" ? tx("প্রত্যয়নপত্র দেখুন →", "View testimonial →") : tx("খুলুন →", "Open →")}
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
  const step = flow.testimonial ? 3 : flow.resolution ? 2 : 1;
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
        {[tx("১. চুক্তি যাচাই", "1. Verify the agreement"), tx("২. প্রত্যয়নপত্র তৈরি", "2. Generate testimonial"), tx("৩. কেস বন্ধ", "3. Case closed")].map((t, i) => (
          <li key={t} className={`${ui.tag} ${i + 1 < step || step === 3 ? ui.ok : i + 1 === step ? ui.ink : ""}`} aria-current={i + 1 === step ? "step" : undefined}>
            {i + 1 < step || step === 3 ? "✓ " : ""}
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
          <p style={{ marginTop: 8 }}>{tx("নিষ্পত্তির প্রত্যয়নপত্র (টেস্টিমোনিয়াল) তৈরি করুন। এটি ইস্যু হলে কেস বন্ধ হবে, খোলা কাজ বন্ধ হবে এবং আবেদনকারীকে এসএমএসে জানানো হবে।", "Generate the settlement testimonial. Issuing it closes the case, closes its open tasks and tells the applicant by SMS.")}</p>
          {authorityNotice?.status === "PENDING_DISPATCH" ? <div className={`${ui.banner} ${ui.bannerWarn}`}>{tx("আদালত-প্রেরিত মামলা: রেফারকারী কর্তৃপক্ষকে ফলাফল জানানো নিচে রেকর্ড করুন (কেস বন্ধ হলেও এই কাজটি খোলা থাকবে)।", "Court-referred case: record the outcome notice to the referring authority below (that task stays open even after closure).")}</div> : null}
          <div className={styles.actions}>
            <Button onClick={() => run(() => SettlementVerificationService.issueTestimonial(applicationId), tx("প্রত্যয়নপত্র ইস্যু হয়েছে — কেস বন্ধ।", "Testimonial issued — the case is closed."))}>{tx("প্রত্যয়নপত্র তৈরি করুন ও কেস বন্ধ করুন", "Generate testimonial & close the case")}</Button>
          </div>
        </section>
      ) : null}

      {flow.testimonial ? (
        <>
          <div className={`${ui.banner} ${ui.bannerOk}`} role="status">
            ✓ {tx("কেস বন্ধ", "Case closed")} · {a.closedAt ? formatDateTime(a.closedAt, lang) : ""}
          </div>
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

/* ------------------------------ the testimonial ------------------------------ */

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function testimonialHtml(t: SettlementTestimonial, matter: string) {
  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB") : "—");
  const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Settlement testimonial ${esc(t.testimonialId)}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:32px auto;padding:0 16px;color:#111}h1{font-size:22px;text-align:center;margin:0}h2{font-size:14px;text-align:center;font-weight:normal;margin:4px 0 24px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid #ccc;font-size:14px}th{width:36%;color:#444;font-weight:normal}.demo{border:2px dashed #b45309;color:#b45309;padding:8px;text-align:center;font-family:sans-serif;font-size:12px;margin-bottom:24px}.sig{margin-top:40px;display:flex;justify-content:space-between;font-size:13px}</style></head><body>
<div class="demo">DEMO / SIMULATED — prototype document, no official seal or e-signature is attached</div>
<h1>Settlement Testimonial</h1><h2>নিষ্পত্তি প্রত্যয়নপত্র · District Legal Aid Office · ${esc(t.office)}</h2>
<p>This is to certify that the dispute recorded under case <strong>${esc(t.caseRef)}</strong> was settled through mediation under the government legal aid programme. The settlement agreement was signed by both parties, confirmed by the mediator and verified by the Legal Aid Officer. The case is closed.</p>
<table>${row("Testimonial no.", t.testimonialId)}${row("Case", t.caseRef)}${row("Agreement", t.agreementId)}${row("Matter", matter)}${row("Applicant", t.applicantName)}${row("Respondent", t.respondentName ?? "—")}${row("Mediator", t.mediatorName ?? "—")}${row("Agreed resolution", t.agreedResolution)}${row("Conditions", t.conditions)}${row("Deadline", t.deadline ?? "—")}${row("Verified outcome", t.outcome)}${row("Applicant signed", d(t.partiesSignedAt.APPLICANT))}${row("Respondent signed", d(t.partiesSignedAt.RESPONDENT))}${row("Mediator confirmed", d(t.mediatorConfirmedAt))}${row("Verified by the Legal Aid Officer", d(t.verifiedAt))}${row("Issued", d(t.issuedAt))}</table>
<div class="sig"><span>${esc(t.issuedByName)}<br>Legal Aid Officer, ${esc(t.office)}</span><span>Issued ${esc(d(t.issuedAt))}</span></div>
</body></html>`;
}

function TestimonialView({ t }: { t: SettlementTestimonial }) {
  const { lang, tx } = useTx();
  const matter = label(MATTERS, t.matter as never, "en") || t.matter;
  const open = (print: boolean) => {
    const url = URL.createObjectURL(new Blob([testimonialHtml(t, matter)], { type: "text/html" }));
    if (print) {
      const w = window.open(url, "_blank");
      w?.addEventListener("load", () => w.print());
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = `testimonial-${t.testimonialId}.html`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <section className={`${ui.flowStep} ${ui.confirmed}`} aria-label={tx("নিষ্পত্তি প্রত্যয়নপত্র", "Settlement testimonial")}>
      <span className={ui.confirmedBadge}>✓ {tx("নিষ্পত্তি প্রত্যয়নপত্র", "SETTLEMENT TESTIMONIAL")}</span>
      <div className={`${ui.banner} ${ui.bannerWarn}`} style={{ marginTop: 8 }}>
        {tx("DEMO / SIMULATED — প্রোটোটাইপ নথি; কোনো সরকারি সিল বা ই-স্বাক্ষর সংযুক্ত নেই।", "DEMO / SIMULATED — prototype document; no official seal or e-signature is attached.")}
      </div>
      <p>
        {tx(
          `এই মর্মে প্রত্যয়ন করা যাচ্ছে যে ${t.caseRef} নম্বর কেসের বিরোধ সরকারি আইনগত সহায়তা কর্মসূচির অধীনে মধ্যস্থতার মাধ্যমে নিষ্পত্তি হয়েছে। দুই পক্ষ চুক্তিতে স্বাক্ষর করেছেন, মধ্যস্থতাকারী নিশ্চিত করেছেন এবং লিগ্যাল এইড অফিসার যাচাই করেছেন। কেসটি বন্ধ।`,
          `This is to certify that the dispute in case ${t.caseRef} was settled through mediation under the government legal aid programme. Both parties signed the agreement, the mediator confirmed it and the Legal Aid Officer verified it. The case is closed.`,
        )}
      </p>
      <div className={ui.rows}>
        <Row label={tx("প্রত্যয়নপত্র নং", "Testimonial no.")}>
          <code>{t.testimonialId}</code>
        </Row>
        <Row label={tx("কেস / চুক্তি", "Case / agreement")}>
          {t.caseRef} · {t.agreementId}
        </Row>
        <Row label={tx("বিষয়", "Matter")}>{label(MATTERS, t.matter as never, lang) || t.matter}</Row>
        <Row label={tx("পক্ষ", "Parties")}>
          {t.applicantName} · {t.respondentName ?? "—"}
        </Row>
        <Row label={tx("মধ্যস্থতাকারী", "Mediator")}>{t.mediatorName ?? "—"}</Row>
        <Row label={tx("সম্মত সমাধান", "Agreed resolution")}>{t.agreedResolution}</Row>
        <Row label={tx("শর্তাবলি", "Conditions")}>{t.conditions}</Row>
        <Row label={tx("যাচাইকৃত ফলাফল", "Verified outcome")}>{t.outcome}</Row>
        <Row label={tx("ইস্যু করেছেন", "Issued by")}>
          {t.issuedByName} · {t.office} · {formatDateTime(t.issuedAt, lang)}
        </Row>
      </div>
      <div className={styles.actions} style={{ marginTop: "var(--s-3)" }}>
        <Button onClick={() => open(true)}>{tx("প্রিন্ট", "Print")}</Button>
        <Button variant="secondary" onClick={() => open(false)}>
          {tx("ডাউনলোড (.html)", "Download (.html)")}
        </Button>
      </div>
    </section>
  );
}

"use client";

/* The settlement testimonial — shown to the DLO (settlement page) and to the citizen (case page). Print / Download (.html). */

import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { MATTERS, formatDateTime, label, type SettlementTestimonial } from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "@/components/dlao/dlao.module.css";

type Lang = "bn" | "en";
function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}
function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
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

export function TestimonialView({ t }: { t: SettlementTestimonial }) {
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

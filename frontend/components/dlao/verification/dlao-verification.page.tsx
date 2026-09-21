"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ApplicationRecordService,
  AuditTrailService,
  DlaoVerificationService,
  HumanHandoffService,
  IntakeSessionService,
  SafeContactPlanService,
  ensureSeeded,
  useHelplineStore,
  type SlotKey,
} from "@/lib/shakkho";
import { Check, AlertCircle, Phone, Shield, FileText } from "@/components/icons";
import { IconButton } from "@/components/helpline/primitives/icon-button";
import { SimulationTag } from "@/components/helpline/primitives/simulation-tag";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import helplineStyles from "@/components/helpline/helpline.module.css";

export function DlaoVerificationPage({
  applicationId,
}: {
  applicationId: string;
}) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const record = envelope.records.find((r) => r.applicationId === applicationId);
  const handoff = envelope.handoffs.find((h) => h.applicationId === applicationId);
  const verification = envelope.dlaoVerifications.find(
    (v) => v.applicationId === applicationId,
  );
  const safePlan = envelope.safeContactPlans.find(
    (s) => s.applicationId === applicationId,
  );

  const [safeTime, setSafeTime] = useState("সন্ধ্যা ৬টার পর");
  const [channel, setChannel] = useState<"phone" | "sms" | "in_person">("phone");
  const [witness, setWitness] = useState("প্রতিবেশী");
  const [correctionSlot, setCorrectionSlot] = useState<SlotKey>("applicant_name");
  const [correctionValue, setCorrectionValue] = useState("");
  const [outcome, setOutcome] = useState<"confirm" | "correct" | "dispute" | "unsafe">("confirm");
  const [outcomeNote, setOutcomeNote] = useState("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  if (!record) {
    return (
      <main id="dlao-main" className={helplineStyles.page}>
        <SkipLink targetId="dlao-main" />
        <h1 className={helplineStyles.pageTitle}>DLAO Verification</h1>
        <p className={helplineStyles.empty}>{lang === "bn" ? "রেকর্ড পাওয়া যায়নি" : "Record not found"}</p>
      </main>
    );
  }

  function startVerification() {
    if (!handoff) return;
    DlaoVerificationService.start({
      applicationId: record!.applicationId,
      handoffId: handoff.id,
      channel: "outbound_voice",
      actor: "dlao",
    });
    IntakeSessionService.setStatus(
      envelope.sessions.find((s) => s.id === handoff.intakeSessionId)?.id ?? "",
      "applicant_contact_attempted",
      "dlao",
    );
  }

  function applySafePlan() {
    if (!record) return;
    SafeContactPlanService.upsert({
      applicationId: record.applicationId,
      preferredTime: { bn: safeTime, en: safeTime },
      channel,
      witness,
      actor: "dlao",
    });
  }

  function verifySafeContact() {
    if (!record) return;
    SafeContactPlanService.verify({
      applicationId: record.applicationId,
      actor: "dlao",
    });
  }

  function applyCorrection() {
    if (!record || !correctionValue.trim()) return;
    const old = record.facts[correctionSlot]?.value ?? "";
    DlaoVerificationService.correct({
      applicationId: record.applicationId,
      slot: correctionSlot,
      oldValue: old,
      newValue: correctionValue,
      actor: "dlao",
    });
    ApplicationRecordService.setSlot(
      record.applicationId,
      correctionSlot,
      { value: correctionValue, confidence: "verified", source: "dlao_reopened" },
      "dlao",
    );
    setCorrectionValue("");
  }

  function close() {
    if (!record) return;
    const map = {
      confirm: "applicant_confirmed" as const,
      correct: "applicant_corrected" as const,
      dispute: "applicant_disputed" as const,
      unsafe: "unsafe_contact_failed" as const,
    };
    DlaoVerificationService.close({
      applicationId: record.applicationId,
      outcome: map[outcome],
      note: { bn: outcomeNote, en: outcomeNote },
      actor: "dlao",
    });
    IntakeSessionService.setStatus(
      envelope.sessions.find((s) => s.applicationId === record.applicationId)?.id ?? "",
      outcome === "unsafe" ? "unsafe_contact_failed" : "verification_completed",
      "dlao",
    );
  }

  function submit() {
    if (!record) return;
    ApplicationRecordService.submit(record.applicationId, "dlao");
    if (handoff) HumanHandoffService.complete(handoff.id, "dlao");
    AuditTrailService.log(
      {
        subject: record.applicationId,
        subjectKind: "application",
        action: "application.submitted",
        actor: "dlao",
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
  }

  return (
    <>
      <SkipLink targetId="dlao-main" />
      <main id="dlao-main" className={helplineStyles.page}>
        <header className={helplineStyles.pageHeader}>
          <span className={helplineStyles.pageEyebrow}>
            {lang === "bn" ? "জেলা আইনি সহায়তা কর্মকর্তা · যাচাই" : "DLAO · field verification"}
          </span>
          <h1 className={helplineStyles.pageTitle}>{record.applicationId}</h1>
          <p className={helplineStyles.pageIntro}>{record.office}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <SimulationTag kind="voice" label={lang === "bn" ? "সিমুলেটেড ডিএলএও" : "Simulated DLAO"} />
          </div>
        </header>

        <section className={helplineStyles.callGrid}>
          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "আবেদনকারীর তথ্য" : "Applicant facts"}</h2>
            <ul className={helplineStyles.provenanceList}>
              {Object.entries(record.facts).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <span>{v?.value ?? "—"}</span>
                </li>
              ))}
            </ul>
            <IconButton Icon={Phone} onClick={startVerification}>
              {lang === "bn" ? "যাচাই শুরু করুন (আউটবাউন্ড কল)" : "Start verification (outbound call)"}
            </IconButton>
            <IconButton Icon={Shield} onClick={verifySafeContact}>
              {lang === "bn" ? "নিরাপদ পরিকল্পনা নিশ্চিত করুন" : "Verify safe-contact plan"}
            </IconButton>
          </div>

          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "নিরাপদ যোগাযোগের পরিকল্পনা" : "Safe-contact plan"}</h2>
            <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <span>{lang === "bn" ? "নিরাপদ সময়" : "Preferred time"}</span>
              <input
                type="text"
                value={safeTime}
                onChange={(e) => setSafeTime(e.target.value)}
                className={helplineStyles.callerInput}
              />
            </label>
            <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <span>{lang === "bn" ? "মাধ্যম" : "Channel"}</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as "phone" | "sms" | "in_person")}
                className={helplineStyles.callerInput}
              >
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
                <option value="in_person">In-person</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <span>{lang === "bn" ? "সাক্ষী" : "Witness"}</span>
              <input
                type="text"
                value={witness}
                onChange={(e) => setWitness(e.target.value)}
                className={helplineStyles.callerInput}
              />
            </label>
            <IconButton Icon={FileText} onClick={applySafePlan}>
              {lang === "bn" ? "পরিকল্পনা সংরক্ষণ" : "Save plan"}
            </IconButton>
            {safePlan ? (
              <p style={{ marginTop: 12 }}>
                {lang === "bn" ? "সর্বশেষ পরিকল্পনা" : "Latest plan"}: {safePlan.preferredTime.en} · {safePlan.cleared ? (lang === "bn" ? "অনুমোদিত" : "Cleared") : (lang === "bn" ? "অননুমোদিত" : "Not cleared")}
              </p>
            ) : null}
          </div>

          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "ফলাফল ও সংশোধন" : "Outcome & corrections"}</h2>
            <label style={{ display: "grid", gap: 8 }}>
              <span>{lang === "bn" ? "সংশোধনের স্লট" : "Slot to correct"}</span>
              <select
                value={correctionSlot}
                onChange={(e) => setCorrectionSlot(e.target.value as SlotKey)}
                className={helplineStyles.callerInput}
              >
                {(["applicant_name", "category", "office", "incident_date", "safe_contact_time", "caller_relation", "caller_name"] as SlotKey[]).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <input
                type="text"
                value={correctionValue}
                onChange={(e) => setCorrectionValue(e.target.value)}
                placeholder={lang === "bn" ? "সংশোধিত মান" : "Corrected value"}
                className={helplineStyles.callerInput}
              />
              <IconButton Icon={Check} onClick={applyCorrection}>
                {lang === "bn" ? "সংশোধন প্রয়োগ" : "Apply correction"}
              </IconButton>
            </label>

            <label style={{ display: "grid", gap: 8, marginTop: 16 }}>
              <span>{lang === "bn" ? "চূড়ান্ত ফলাফল" : "Final outcome"}</span>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as "confirm" | "correct" | "dispute" | "unsafe")}
                className={helplineStyles.callerInput}
              >
                <option value="confirm">{lang === "bn" ? "আবেদনকারী নিশ্চিত করেছেন" : "Applicant confirmed"}</option>
                <option value="correct">{lang === "bn" ? "আবেদনকারী সংশোধন করেছেন" : "Applicant corrected"}</option>
                <option value="dispute">{lang === "bn" ? "আবেদনকারী বিতর্ক করেছেন" : "Applicant disputed"}</option>
                <option value="unsafe">{lang === "bn" ? "নিরাপদ যোগাযোগ ব্যর্থ" : "Safe-contact failed"}</option>
              </select>
              <textarea
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder={lang === "bn" ? "ফলাফলের নোট…" : "Outcome note…"}
                className={helplineStyles.callerInput}
                rows={3}
              />
              <IconButton Icon={Check} onClick={close}>
                {lang === "bn" ? "যাচাই বন্ধ করুন" : "Close verification"}
              </IconButton>
              <IconButton Icon={AlertCircle} onClick={submit}>
                {lang === "bn" ? "APP আবেদন জমা দিন" : "Submit APP application"}
              </IconButton>
            </label>
          </div>
        </section>

        <section className={helplineStyles.section}>
          <div className={helplineStyles.sectionHead}>
            <h2>{lang === "bn" ? "যাচাই ইতিহাস" : "Verification history"}</h2>
          </div>
          <ul className={helplineStyles.auditList}>
            <li>
              <time>--</time>
              <span>{verification ? `${verification.outcome ?? "open"}` : (lang === "bn" ? "এখনো শুরু হয়নি" : "Not started")}</span>
            </li>
            {verification?.notes.map((n, i) => (
              <li key={i}>
                <time>--</time>
                <span>{n.en}</span>
              </li>
            ))}
            {verification?.corrections.map((c, i) => (
              <li key={`c-${i}`}>
                <time>--</time>
                <span>{c.slot}: {c.oldValue} → {c.newValue}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

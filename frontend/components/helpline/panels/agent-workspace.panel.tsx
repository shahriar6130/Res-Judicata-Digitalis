"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  AuditTrailService,
  CallerVerificationService,
  HumanHandoffService,
  HumanIntakeService,
  IntakeSessionService,
  SafeContactPlanService,
  ensureSeeded,
  useHelplineStore,
} from "@/lib/shakkho";
import { Check, AlertCircle, MessageCircle, Phone, FileText } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import { SimulationTag } from "../primitives/simulation-tag";
import { ActiveCallBar } from "../primitives/active-call-bar";
import { SkipLink } from "../primitives/skip-link";
import helplineStyles from "../helpline.module.css";

export function AgentWorkspacePanel({
  initialHandoffId,
}: {
  initialHandoffId?: string;
}) {
  const { lang, t } = useI18n();
  const envelope = useHelplineStore();
  const [agentNote, setAgentNote] = useState("");
  const [agentSlotKey, setAgentSlotKey] = useState("applicant_name");
  const [agentSlotValue, setAgentSlotValue] = useState("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  const queue = envelope.handoffs.filter((h) => h.status === "queued" || h.status === "acknowledged");
  const target = initialHandoffId
    ? envelope.handoffs.find((h) => h.id === initialHandoffId)
    : queue[0];
  const session = target?.intakeSessionId
    ? envelope.sessions.find((s) => s.id === target.intakeSessionId)
    : undefined;
  const record = target?.applicationId
    ? envelope.records.find((r) => r.applicationId === target.applicationId)
    : undefined;
  const humanIntake = session
    ? envelope.humanIntakes.find((h) => h.sessionId === session.id)
    : undefined;
  const safePlan = record
    ? envelope.safeContactPlans.find((s) => s.applicationId === record.applicationId)
    : undefined;

  function acknowledge() {
    if (!target) return;
    HumanHandoffService.complete; void target.id;
    // Mark handoff acknowledged (custom: mutate status to acknowledged)
    const env = envelope;
    const updated = env.handoffs.map((h) => {
      if (h.id !== target.id) return h;
      return {
        ...h,
        status: "acknowledged" as const,
        acknowledgedAt: new Date().toISOString(),
      };
    });
    useHelplineStore; // re-render via store mutation through services
    if (session) {
      IntakeSessionService.setStatus(session.id, "handoff_acknowledged", "agent");
      HumanIntakeService.pickUp({
        sessionId: session.id,
        applicationId: session.applicationId ?? target.applicationId ?? "",
        agent: "agent",
        handoff: { ...target, status: "acknowledged" },
      });
    }
    AuditTrailService.log(
      {
        subject: target.id,
        subjectKind: "handoff",
        action: "handoff.acknowledged",
        actor: "agent",
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
    void updated;
  }

  function completeHandoff() {
    if (!target) return;
    HumanHandoffService.complete(target.id, "agent");
    if (session) {
      IntakeSessionService.setStatus(session.id, "human_intake_active", "agent");
      HumanIntakeService.complete(session.id, "agent");
    }
  }

  function addNote() {
    if (!session || !agentNote.trim()) return;
    HumanIntakeService.note({
      sessionId: session.id,
      agent: "agent",
      text: { bn: agentNote, en: agentNote },
    });
    setAgentNote("");
  }

  function overrideSlot() {
    if (!session || !agentSlotValue.trim()) return;
    HumanIntakeService.override({
      sessionId: session.id,
      agent: "agent",
      slot: agentSlotValue as never,
      value: agentSlotValue,
    });
    void agentSlotKey;
    setAgentSlotValue("");
  }

  function verifyPass() {
    if (!session) return;
    const v = CallerVerificationService.begin({ sessionId: session.id, actor: "agent" });
    CallerVerificationService.pass(v.id, "agent");
    IntakeSessionService.setStatus(session.id, "applicant_safely_verified", "agent");
  }

  function verifyFail() {
    if (!session) return;
    const v = CallerVerificationService.begin({ sessionId: session.id, actor: "agent" });
    CallerVerificationService.fail(v.id, "agent");
  }

  function verifySafeContact() {
    if (!session || !record) return;
    IntakeSessionService.setStatus(session.id, "field_verification_in_progress", "agent");
    SafeContactPlanService.upsert({
      applicationId: record.applicationId,
      preferredTime: { bn: "সন্ধ্যা ৬টার পর", en: "After 6 PM" },
      channel: "phone",
      witness: "প্রতিবেশী",
      actor: "agent",
    });
  }

  return (
    <>
      <SkipLink targetId="helpline-main" />
      <main id="helpline-main" className={helplineStyles.page}>
        <header className={helplineStyles.pageHeader}>
          <span className={helplineStyles.pageEyebrow}>
            {lang === "bn" ? "১৬৬৯৯ এজেন্ট ওয়ার্কস্পেস" : "16699 human-agent workspace"}
          </span>
          <h1 className={helplineStyles.pageTitle}>
            {lang === "bn" ? "মানব এজেন্ট হস্তান্তর" : "Human agent handoff"}
          </h1>
          <p className={helplineStyles.pageIntro}>
            {lang === "bn"
              ? "এআই সংযুক্তির পর যখন ০ চাপা হয় বা জরুরি নিয়ম ট্রিগার হয়, এজেন্ট এখানে কাজ চালিয়ে যান।"
              : "When the caller presses 0 or an urgency rule fires, agents continue here."}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <SimulationTag kind="voice" label={lang === "bn" ? "সিমুলেটেড এজেন্ট" : "Simulated agent"} />
          </div>
        </header>

        <section className={helplineStyles.callGrid}>
          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "হস্তান্তর সারি" : "Handoff queue"}</h2>
            <div className={helplineStyles.queueList}>
              {queue.map((h) => (
                <div key={h.id} className={helplineStyles.queueRow}>
                  <strong>{h.id}</strong>
                  <span>{h.applicationId ?? h.intakeSessionId}</span>
                  <span>{h.reason}</span>
                  <span>{h.status}</span>
                </div>
              ))}
              {queue.length === 0 ? (
                <p className={helplineStyles.empty}>
                  {lang === "bn" ? "কোনো অপেক্ষমাণ হস্তান্তর নেই" : "No queued handoffs"}
                </p>
              ) : null}
            </div>
          </div>

          <div className={helplineStyles.callColumn}>
            <h2>
              {target
                ? lang === "bn"
                  ? `হস্তান্তর: ${target.id}`
                  : `Handoff: ${target.id}`
                : lang === "bn"
                  ? "হস্তান্তর নির্বাচন করুন"
                  : "Pick a handoff"}
            </h2>
            {target && record ? (
              <>
                <p>
                  {lang === "bn" ? "আবেদনকারী" : "Applicant"}: <strong>{record.facts.applicant_name?.value ?? record.applicationId}</strong>
                </p>
                <p>
                  {lang === "bn" ? "কারণ" : "Reason"}: {target.reason}
                </p>
                <p>
                  {lang === "bn" ? "অবস্থা" : "Status"}: {target.status}
                </p>
                {safePlan ? (
                  <p>
                    {lang === "bn" ? "নিরাপদ সময়" : "Safe contact time"}: {safePlan.preferredTime.en}
                  </p>
                ) : null}
              </>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <IconButton Icon={Phone} onClick={acknowledge}>
                {lang === "bn" ? "হস্তান্তর গ্রহণ" : "Acknowledge handoff"}
              </IconButton>
              <IconButton Icon={Check} onClick={verifyPass}>
                {lang === "bn" ? "যাচাই পাস" : "Verify pass"}
              </IconButton>
              <IconButton Icon={AlertCircle} onClick={verifyFail} variant="danger">
                {lang === "bn" ? "যাচাই ব্যর্থ" : "Verify fail"}
              </IconButton>
              <IconButton Icon={FileText} onClick={verifySafeContact}>
                {lang === "bn" ? "নিরাপদ সময় লিখুন" : "Author safe-contact plan"}
              </IconButton>
              <IconButton Icon={Check} onClick={completeHandoff}>
                {lang === "bn" ? "হস্তান্তর সম্পন্ন" : "Complete handoff"}
              </IconButton>
            </div>
          </div>

          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "নোট ও সংশোধন" : "Notes & overrides"}</h2>
            <label className={helplineStyles.searchForm} style={{ alignItems: "stretch" }}>
              <span style={{ display: "flex", gap: 8, width: "100%", alignItems: "stretch" }}>
                <input
                  type="text"
                  value={agentNote}
                  onChange={(e) => setAgentNote(e.target.value)}
                  placeholder={lang === "bn" ? "এজেন্ট নোট…" : "Agent note…"}
                  className={helplineStyles.callerInput}
                />
                <IconButton Icon={MessageCircle} onClick={addNote}>
                  {lang === "bn" ? "নোট যোগ" : "Add note"}
                </IconButton>
              </span>
            </label>
            <label style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "stretch" }}>
              <input
                type="text"
                value={agentSlotKey}
                onChange={(e) => setAgentSlotKey(e.target.value)}
                placeholder="slot"
                className={helplineStyles.callerInput}
                style={{ maxWidth: 140 }}
              />
              <input
                type="text"
                value={agentSlotValue}
                onChange={(e) => setAgentSlotValue(e.target.value)}
                placeholder={lang === "bn" ? "সংশোধিত মান…" : "Corrected value…"}
                className={helplineStyles.callerInput}
              />
              <IconButton Icon={Check} onClick={overrideSlot}>
                {lang === "bn" ? "সংশোধন" : "Override"}
              </IconButton>
            </label>
            {humanIntake ? (
              <ul className={helplineStyles.auditList} style={{ marginTop: 16 }}>
                {humanIntake.notes.map((n, i) => (
                  <li key={i}>
                    <span>{lang === "bn" ? "নোট" : "Note"}</span>
                    <span>{n.en}</span>
                  </li>
                ))}
                {humanIntake.factOverrides.map((o, i) => (
                  <li key={`o-${i}`}>
                    <span>{o.slot}</span>
                    <span>{o.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </main>
      <ActiveCallBar />
    </>
  );
}

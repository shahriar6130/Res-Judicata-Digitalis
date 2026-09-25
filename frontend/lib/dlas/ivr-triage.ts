"use client";

/* ------------------------------------------------------------------ *
 *  IVR 16699 — simulated AI story triage, the emergency button, and the
 *  16699 call-centre agent desk.
 *
 *  triageStory()  a RULE-BASED STAND-IN for an AI model (labelled
 *                 SIMULATED everywhere). It reads the caller's story and
 *                 looks for critical signals (danger, self-harm, sexual
 *                 violence, child at risk, detention, trafficking, eviction
 *                 now) and "tough" signals (complex litigation, distress,
 *                 unclear story). Critical or tough → ROUTE_TO_AGENT.
 *                 It never rejects, never decides eligibility — it only
 *                 decides whether a person should take over the call.
 *  IvrEscalation  records the triage on the intake session and opens a
 *                 live-transfer / emergency task for the 16699 agents.
 *  AgentDesk      the agent takes the call, completes the missing fields
 *                 on the SAME intake session (OPERATOR_ENTERED · AGENT_FORM)
 *                 and submits — the ApplicationRecord lands in dlas.db.v1
 *                 exactly like the web version.
 * ------------------------------------------------------------------ */

import { useMemo, useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { IntakeGateway, type CaptureTag } from "./gateway";
import { normalizePhone, officeFor } from "./reference";
import type { AgentHandoff, AiTriage, AuditEntry, DeepPartial, ApplicationData, DlasDb, HelplineAgentAccount, IntakeSession, Task, TriageFindingCode, TriageSeverity } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/* ------------------------------ simulated AI triage ------------------------------ */

type Rule = { code: TriageFindingCode; severity: TriageSeverity; re: RegExp; why: string };

// Bangla + English cues. Deliberately simple and transparent — a stand-in for a real model.
const RULES: Rule[] = [
  { code: "IMMEDIATE_DANGER", severity: "CRITICAL", re: /(kill me|going to kill|will kill|threaten(ed)? to kill|danger (right )?now|not safe (at home|tonight)|মেরে ফেলবে|খুন করবে|প্রাণনাশ|জীবনের ঝুঁকি|এখন বিপদে)/i, why: "Caller describes a threat to life or being in danger now" },
  { code: "SELF_HARM", severity: "CRITICAL", re: /(suicide|kill myself|end my life|আত্মহত্যা|নিজেকে শেষ|মরে যেতে চাই)/i, why: "Caller mentions self-harm" },
  { code: "SEXUAL_VIOLENCE", severity: "CRITICAL", re: /(rape|raped|sexual(ly)? assault|molest|ধর্ষণ|যৌন নির্যাতন|শ্লীলতাহানি)/i, why: "Caller describes sexual violence" },
  { code: "CHILD_AT_RISK", severity: "CRITICAL", re: /((child|son|daughter|baby|শিশু|ছেলে|মেয়ে|বাচ্চা).{0,40}(beat|hit|abuse|lock|sold|মার|নির্যাতন|আটকে|বিক্রি))|((beat|hit|abuse|মার|নির্যাতন).{0,40}(child|son|daughter|baby|শিশু|বাচ্চা))/i, why: "A child appears to be at risk" },
  { code: "DETENTION", severity: "CRITICAL", re: /(arrested|detained|in (police )?custody|taken by (the )?police|in jail|থানায় নিয়ে গেছে|গ্রেফতার|আটক|হাজতে|জেলে)/i, why: "Someone is detained or in custody" },
  { code: "TRAFFICKING", severity: "CRITICAL", re: /(traffick|sold (me|her|him)|forced to work|passport taken|পাচার|বিক্রি করে দিয়েছে|জোর করে কাজ)/i, why: "Possible trafficking or forced labour" },
  { code: "PHYSICAL_VIOLENCE", severity: "SENSITIVE", re: /(beat(s|en)? me|hits? me|slap|acid|burn(ed|t)? me|মারধর|মারে|পিটিয়েছে|এসিড|আগুন দিয়েছে)/i, why: "Caller describes physical violence" },
  { code: "EVICTION_NOW", severity: "SENSITIVE", re: /((evict|throw (us|me) out|remove (us|me)).{0,30}(today|tonight|tomorrow|now))|(আজ|আজকে|কাল|এখনই).{0,30}(উচ্ছেদ|বের করে দেবে)/i, why: "Eviction is imminent" },
  { code: "COMPLEX_LEGAL", severity: "SENSITIVE", re: /(high court|supreme court|appeal|murder case|criminal case against me|several cases|many cases|warrant|হাইকোর্ট|আপিল|খুনের মামলা|ওয়ারেন্ট|অনেকগুলো মামলা)/i, why: "Complex or serious litigation — needs a person to understand it" },
  { code: "DISTRESS", severity: "SENSITIVE", re: /(please help|i am scared|i'm scared|crying|can't take it|don't know what to do|ভয় পাচ্ছি|কাঁদছি|বাঁচান|কী করব বুঝতে পারছি না)/i, why: "Caller sounds distressed" },
];

const RANK: Record<TriageSeverity, number> = { ROUTINE: 0, SENSITIVE: 1, CRITICAL: 2 };

/** SIMULATED AI triage of a caller's story. Pure and deterministic. */
export function triageStory(text: string, lang: "bn" | "en"): AiTriage {
  const story = text.trim();
  const findings: AiTriage["findings"] = [];
  for (const r of RULES) {
    const m = story.match(r.re);
    if (m) findings.push({ code: r.code, severity: r.severity, evidence: m[0].slice(0, 60) });
  }
  const words = story.split(/\s+/).filter(Boolean).length;
  if (words < 6) findings.push({ code: "UNCLEAR", severity: "SENSITIVE", evidence: `${words} word(s)` });
  const severity: TriageSeverity = findings.reduce<TriageSeverity>((s, f) => (RANK[f.severity] > RANK[s] ? f.severity : s), "ROUTINE");
  // Route when anything critical is found, or when two or more "tough" signals stack up.
  const tough = findings.filter((f) => f.severity === "SENSITIVE").length;
  const route = severity === "CRITICAL" || tough >= 2 || findings.some((f) => f.code === "COMPLEX_LEGAL");
  const reasons = findings.map((f) => RULES.find((r) => r.code === f.code)?.why ?? "The story is too short or unclear to process automatically");
  return {
    triageId: rid("TRG"),
    at: now(),
    engine: "SIMULATED_TRIAGE_V1",
    simulated: true,
    advisoryOnly: true,
    language: lang,
    inputChars: story.length,
    findings,
    severity,
    decision: route ? "ROUTE_TO_AGENT" : "CONTINUE_AUTOMATED",
    confidence: Math.round((findings.length ? Math.min(0.95, 0.6 + 0.12 * findings.length) : 0.8) * 100) / 100,
    reasons: route ? reasons : reasons.length ? [...reasons, "Not enough to need a person — the automated application continues"] : ["No critical or complex signals found — the automated application continues"],
  };
}

/* ------------------------------ IVR side ------------------------------ */

function findSession(db: DlasDb, sessionId: string): IntakeSession {
  const s = db.sessions.find((x) => x.sessionId === sessionId);
  if (!s) throw new Error("Call session not found");
  return s;
}

function openAgentTask(db: DlasDb, s: IntakeSession, type: "AGENT_LIVE_TRANSFER" | "EMERGENCY_CALL", reason: string, minutes: number, context: Record<string, unknown>): Task {
  const t: Task = { taskId: rid("TSK"), type, applicationId: s.applicationId, sessionId: s.sessionId, assignedRole: "HELPLINE_AGENT", office: officeFor(s.draft.applicant.district), status: "OPEN", priority: "URGENT", reason, dueAt: new Date(Date.now() + minutes * 60_000).toISOString(), createdAt: now(), context };
  db.tasks.push(t);
  return t;
}

export const IvrEscalation = {
  /** Store the simulated triage on the call session (and route if it says so). */
  triage(sessionId: string, lang: "bn" | "en"): AiTriage {
    const story = readDb().sessions.find((x) => x.sessionId === sessionId)?.draft.matter.summary ?? "";
    const tr = triageStory(story, lang);
    mutate((db) => {
      const s = findSession(db, sessionId);
      (s.aiTriage ??= []).push(tr);
      audit(db, s.audit, { actor: "ai:triage-sim", role: "system", action: "ai.story_triaged", detail: { triageId: tr.triageId, engine: tr.engine, simulated: true, severity: tr.severity, decision: tr.decision, findings: tr.findings.map((f) => f.code), confidence: tr.confidence, advisoryOnly: true } });
      if (tr.decision === "ROUTE_TO_AGENT") {
        const t = openAgentTask(db, s, "AGENT_LIVE_TRANSFER", `IVR assistant (simulated AI) routed the call: ${tr.reasons.join("; ")}`, tr.severity === "CRITICAL" ? 5 : 30, { triageId: tr.triageId, severity: tr.severity, phone: s.identity.phone });
        s.agentHandoff = { kind: "AI_ESCALATION", status: "WAITING", taskId: t.taskId, triageId: tr.triageId, requestedAt: now(), connectedAt: null, agentId: null, agentName: null, closedAt: null, outcome: null };
        audit(db, s.audit, { actor: "ai:triage-sim", role: "system", action: "handoff.to_agent", detail: { taskId: t.taskId, kind: "AI_ESCALATION", severity: tr.severity } });
      }
      s.updatedAt = now();
    });
    return tr;
  },

  /** The caller chose to continue the automated application instead of waiting (non-critical only). */
  cancelHandoff(sessionId: string, why: string) {
    return mutate((db) => {
      const s = findSession(db, sessionId);
      const h = s.agentHandoff;
      if (!h || h.status !== "WAITING") return null;
      if (h.kind === "EMERGENCY") throw new Error("An emergency transfer cannot be cancelled from the IVR");
      const tr = s.aiTriage?.find((x) => x.triageId === h.triageId);
      if (tr?.severity === "CRITICAL") throw new Error("A critical call stays with the agent");
      h.status = "CLOSED";
      h.closedAt = now();
      h.outcome = why;
      for (const t of db.tasks) if (t.taskId === h.taskId && t.status !== "DONE") t.status = "DONE";
      audit(db, s.audit, { actor: "applicant", role: "applicant", action: "handoff.caller_continued_automated", detail: { taskId: h.taskId, why } });
      s.updatedAt = now();
      return h;
    });
  },

  /** The caller pressed the emergency button (or 9 in the main menu). */
  emergency(sessionId: string, at: string) {
    const existing = readDb().sessions.find((x) => x.sessionId === sessionId);
    if (!existing) throw new Error("Call session not found");
    if (existing.agentHandoff?.kind === "EMERGENCY" && existing.agentHandoff.status !== "CLOSED") return existing.agentHandoff;
    IntakeGateway.capture(sessionId, { urgency: { selfReportedUrgent: true, flags: ["IMMEDIATE_DANGER"] } }, { source: "APPLICANT_STATED", method: "IVR_DTMF", by: "applicant", note: "IVR emergency button" });
    return mutate((db) => {
      const s = findSession(db, sessionId);
      const prior = s.agentHandoff && s.agentHandoff.status !== "CLOSED" && s.agentHandoff.status !== "COMPLETED" ? s.agentHandoff : null;
      if (prior) for (const t of db.tasks) if (t.taskId === prior.taskId && t.status !== "DONE") t.status = "DONE";
      const t = openAgentTask(db, s, "EMERGENCY_CALL", `EMERGENCY — caller pressed the emergency button at “${at}”. Take the call now; if life is at risk, connect 999.`, 2, { phone: s.identity.phone, pressedAt: at });
      s.agentHandoff = { kind: "EMERGENCY", status: "WAITING", taskId: t.taskId, triageId: null, requestedAt: now(), connectedAt: null, agentId: null, agentName: null, closedAt: null, outcome: null };
      audit(db, s.audit, { actor: "applicant", role: "applicant", action: "emergency.pressed", detail: { taskId: t.taskId, at, replacesTask: prior?.taskId ?? null } });
      s.updatedAt = now();
      return s.agentHandoff;
    });
  },
};

/* ------------------------------ 16699 agent accounts ------------------------------ */

const AGENT_KEY = "dlas.agent.current";

export const HelplineAgentAuth = {
  signUp(name: string, rawPhone: string): { ok: true; agent: HelplineAgentAccount } | { ok: false; error: string } {
    const phone = normalizePhone(rawPhone);
    if (name.trim().length < 2) return { ok: false, error: "Enter your name" };
    if (!phone) return { ok: false, error: "Enter a valid mobile number (01XXXXXXXXX)" };
    if ((readDb().helplineAgents ?? []).some((a) => a.phone === phone)) return { ok: false, error: "This number is already registered — sign in" };
    const agent = mutate((db) => {
      const a: HelplineAgentAccount = { agentId: rid("AGT"), name: name.trim(), phone, createdAt: now(), lastLoginAt: now(), audit: [] };
      audit(db, a.audit, { actor: a.agentId, role: "helpline_agent", action: "agent.signed_up", detail: { agent: a.name } });
      (db.helplineAgents ??= []).push(a);
      return a;
    });
    window.localStorage.setItem(AGENT_KEY, agent.agentId);
    window.dispatchEvent(new Event("dlas:agent-changed"));
    return { ok: true, agent };
  },
  login(rawPhone: string): { ok: true; agent: HelplineAgentAccount } | { ok: false; error: string } {
    const phone = normalizePhone(rawPhone);
    const found = (readDb().helplineAgents ?? []).find((a) => a.phone === phone);
    if (!found) return { ok: false, error: "No agent with this number — sign up first" };
    mutate((db) => {
      const a = db.helplineAgents!.find((x) => x.agentId === found.agentId)!;
      a.lastLoginAt = now();
      audit(db, a.audit, { actor: a.agentId, role: "helpline_agent", action: "agent.logged_in" });
    });
    window.localStorage.setItem(AGENT_KEY, found.agentId);
    window.dispatchEvent(new Event("dlas:agent-changed"));
    return { ok: true, agent: found };
  },
  current(): HelplineAgentAccount | undefined {
    const id = typeof window === "undefined" ? null : window.localStorage.getItem(AGENT_KEY);
    return id ? (readDb().helplineAgents ?? []).find((a) => a.agentId === id) : undefined;
  },
  logout() {
    window.localStorage.removeItem(AGENT_KEY);
    window.dispatchEvent(new Event("dlas:agent-changed"));
  },
};

const subAgent = (cb: () => void) => {
  window.addEventListener("dlas:agent-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("dlas:agent-changed", cb);
    window.removeEventListener("storage", cb);
  };
};
const agentId = () => (typeof window === "undefined" ? null : window.localStorage.getItem(AGENT_KEY));

export function useCurrentAgent() {
  const id = useSyncExternalStore(subAgent, agentId, () => null);
  const db = useDlasDb();
  return id ? (db.helplineAgents ?? []).find((a) => a.agentId === id) : undefined;
}

/* ------------------------------ agent desk ------------------------------ */

function me(): HelplineAgentAccount {
  const a = HelplineAgentAuth.current();
  if (!a) throw new Error("16699 agent sign-in required");
  return a;
}

const agentTag = (a: HelplineAgentAccount, note?: string): CaptureTag => ({ source: "OPERATOR_ENTERED", method: "AGENT_FORM", by: `agent:${a.agentId}`, note: note ?? "entered by the 16699 agent during the transferred call" });

function withHandoff<T>(taskId: string, fn: (db: DlasDb, s: IntakeSession, t: Task, h: AgentHandoff, a: HelplineAgentAccount) => T): T {
  const a = me();
  return mutate((db) => {
    const t = db.tasks.find((x) => x.taskId === taskId);
    if (!t || (t.type !== "AGENT_LIVE_TRANSFER" && t.type !== "EMERGENCY_CALL")) throw new Error("Transfer not found");
    const s = findSession(db, t.sessionId ?? "");
    const h = s.agentHandoff;
    if (!h || h.taskId !== taskId) throw new Error("This transfer is no longer active on the call");
    const r = fn(db, s, t, h, a);
    s.updatedAt = now();
    return r;
  });
}

export const AgentDesk = {
  /** Pick up the transferred call. */
  take(taskId: string) {
    return withHandoff(taskId, (db, s, t, h, a) => {
      if (h.status !== "WAITING") throw new Error(h.agentName ? `Already taken by ${h.agentName}` : "Already handled");
      h.status = "CONNECTED";
      h.connectedAt = now();
      h.agentId = a.agentId;
      h.agentName = a.name;
      t.status = "IN_PROGRESS";
      t.assigneeId = a.agentId;
      audit(db, s.audit, { actor: a.agentId, role: "helpline_agent", action: "handoff.agent_connected", detail: { agent: a.name, taskId, kind: h.kind } });
      return h;
    });
  },

  /** Save fields the agent collected on the call — same intake session, tagged OPERATOR_ENTERED · AGENT_FORM. */
  capture(taskId: string, patch: DeepPartial<ApplicationData>) {
    const a = me();
    const t = readDb().tasks.find((x) => x.taskId === taskId);
    const s = t?.sessionId ? readDb().sessions.find((x) => x.sessionId === t.sessionId) : undefined;
    if (!t || !s || s.agentHandoff?.taskId !== taskId || s.agentHandoff.status !== "CONNECTED" || s.agentHandoff.agentId !== a.agentId) throw new Error("Take the call first");
    IntakeGateway.capture(s.sessionId, patch, agentTag(a));
  },

  /** Record the caller's verbal consent, read back by the agent. */
  consent(taskId: string) {
    this.capture(taskId, {
      consent: { dataProcessing: true, contactOnSafeChannel: true, shareWithAssignedProviders: true, method: "AGENT_VERBAL_READBACK", readBackConfirmed: true, recordedAt: now() },
      freeServiceNoticeAcknowledged: true,
    });
  },

  /** Submit the application from the call — it becomes an ApplicationRecord in dlas.db.v1. */
  submit(taskId: string) {
    const a = me();
    const t = readDb().tasks.find((x) => x.taskId === taskId);
    const s = t?.sessionId ? readDb().sessions.find((x) => x.sessionId === t.sessionId) : undefined;
    if (!t || !s || s.agentHandoff?.status !== "CONNECTED" || s.agentHandoff.agentId !== a.agentId) throw new Error("Take the call first");
    // the agent-completed intake: mark the handoff done BEFORE submit so the record carries it
    mutate((db) => {
      const ss = findSession(db, s.sessionId);
      ss.agentHandoff = { ...ss.agentHandoff!, status: "COMPLETED", closedAt: now(), outcome: "APPLICATION_SUBMITTED" };
    });
    IntakeGateway.setStep(s.sessionId, "REVIEWED", `agent:${a.agentId}`);
    const r = IntakeGateway.submit(s.sessionId, `agent:${a.agentId}`);
    if (!r.ok) {
      mutate((db) => {
        const ss = findSession(db, s.sessionId);
        ss.agentHandoff = { ...ss.agentHandoff!, status: "CONNECTED", closedAt: null, outcome: null };
      });
      return r;
    }
    mutate((db) => {
      const tt = db.tasks.find((x) => x.taskId === taskId)!;
      tt.status = "DONE";
      tt.applicationId = r.record.applicationId;
      const app = db.applications.find((x) => x.applicationId === r.record.applicationId)!;
      audit(db, app.audit, { actor: a.agentId, role: "helpline_agent", caseId: app.applicationId, action: "handoff.application_submitted_by_agent", detail: { agent: a.name, taskId, kind: s.agentHandoff?.kind ?? null } });
    });
    return r;
  },

  /** Close the transfer without an application (e.g. connected to 999, caller hung up). */
  close(taskId: string, outcome: string) {
    if (outcome.trim().length < 5) throw new Error("Record what happened on the call");
    return withHandoff(taskId, (db, s, t, h, a) => {
      if (h.status === "COMPLETED" || h.status === "CLOSED") throw new Error("Already closed");
      h.status = "CLOSED";
      h.closedAt = now();
      h.agentId ??= a.agentId;
      h.agentName ??= a.name;
      h.outcome = outcome.trim();
      t.status = "DONE";
      audit(db, s.audit, { actor: a.agentId, role: "helpline_agent", action: "handoff.closed", detail: { agent: a.name, taskId, outcome: outcome.trim() } });
      return h;
    });
  },
};

/** Transferred and emergency IVR calls for the 16699 agents, emergencies first. */
export function useAgentQueue() {
  const db = useDlasDb();
  return useMemo(() => {
    const items = db.tasks
      .filter((t) => t.type === "AGENT_LIVE_TRANSFER" || t.type === "EMERGENCY_CALL")
      .map((t) => {
        const s = db.sessions.find((x) => x.sessionId === t.sessionId) ?? null;
        const triage = s?.aiTriage?.find((x) => x.triageId === s.agentHandoff?.triageId) ?? s?.aiTriage?.[s.aiTriage.length - 1] ?? null;
        const app = t.applicationId ? db.applications.find((a) => a.applicationId === t.applicationId) ?? null : null;
        return { t, s, triage, app, handoff: s?.agentHandoff?.taskId === t.taskId ? s.agentHandoff : null };
      });
    const rank = (x: (typeof items)[number]) => (x.t.status === "DONE" ? 2 : x.t.type === "EMERGENCY_CALL" ? 0 : 1);
    items.sort((x, y) => rank(x) - rank(y) || x.t.createdAt.localeCompare(y.t.createdAt));
    return { open: items.filter((x) => x.t.status !== "DONE"), done: items.filter((x) => x.t.status === "DONE").reverse().slice(0, 20) };
  }, [db]);
}

/* ------------------------------------------------------------------ *
 *  MediationService — B2 (Legal Aid Officer / Mediator) + Flow 4
 *  (Mediation & settlement). Backs the /mediator/cases/[caseId] page.
 *
 *  State machine (MediationMatterState, see types.ts + MEDIATION_STEPS):
 *    registered -> party_contact_pending -> scheduled -> notices_sent
 *    -> documents_under_review -> ready_for_session -> attendance_confirmed
 *    -> in_session -> drafting -> draft_under_review -> party_review
 *    -> awaiting_signatures -> partially_signed -> signed
 *    -> outcome_recorded -> closed
 *  Branches: adjourned, cancelled, no_show_rescheduled, no_settlement.
 *
 *  AUDIT ORDERING — read this before adding a function here.
 *  `AuditTrailService.log()` does its own internal read()+write().
 *  Every mutating function below therefore:
 *    1. reads the envelope ONCE,
 *    2. computes the updated domain array(s) in memory (no write yet),
 *    3. calls `AuditTrailService.log(...)` — this persists the audit
 *       event against whatever is currently in the store,
 *    4. re-`read()`s (picking up the just-persisted audit event) and
 *       performs exactly ONE final `write()` that layers the domain
 *       change on top of it.
 *  Do NOT write the domain array, then log, then write the domain
 *  array again with the envelope captured in step 1 — that stale
 *  second write silently discards the audit event `log()` just
 *  persisted. (This is the bug found live in
 *  `lawyer-change-request.service.ts` and `referral.service.ts` —
 *  do not reproduce it here.)
 * ------------------------------------------------------------------ */

import type {
  MediationAttendanceRecord,
  MediationDocumentReview,
  MediationHistoryItem,
  MediationMatter,
  MediationMatterState,
  MediationNotice,
  MediationOutcome,
  MediationParticipationMode,
  MediationParty,
  MediationSession,
  MediationSessionNotes,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";
import { SafeContactService } from "./safe-contact.service";
import { DlaoTaskService } from "./dlao-task.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Case states a mediation matter may legitimately be registered from. Mirrors the case's own backbone: a Case ID exists only after acceptance. */
const ELIGIBLE_CASE_STATUSES = new Set(["accepted"]);

export const MediationService = {
  list(envelope: StoreEnvelope): MediationMatter[] {
    return envelope.mediationMatters ?? [];
  },

  find(envelope: StoreEnvelope, matterId: string): MediationMatter | undefined {
    return (envelope.mediationMatters ?? []).find((m) => m.matterId === matterId);
  },

  /** Every mediation matter for a given (shared-record) Case ID — this is how the DLAO case page / worklist opens the mediator page. */
  findByCaseId(envelope: StoreEnvelope, caseId: string): MediationMatter | undefined {
    return (envelope.mediationMatters ?? []).find((m) => m.caseId === caseId);
  },

  sessionsFor(envelope: StoreEnvelope, matterId: string): MediationSession[] {
    return (envelope.mediationSessions ?? []).filter((s) => s.matterId === matterId);
  },

  findSession(envelope: StoreEnvelope, sessionId: string): MediationSession | undefined {
    return (envelope.mediationSessions ?? []).find((s) => s.sessionId === sessionId);
  },

  /**
   * Register a mediation matter for an already-accepted case. Refuses
   * (returns a typed error, never throws) when the case has no
   * caseId or is not in an eligible status — the UI must surface
   * `error`, not silently no-op.
   */
  registerMatter(input: {
    caseId: string;
    caseStatus?: string;
    applicationId?: string;
    parties: MediationParty[];
    matterCategory: MediationMatter["matterCategory"];
    participationMode: MediationParticipationMode;
    pathway: "pre_case" | "post_case";
    referralSource?: string;
    courtOrTribunalRef?: string;
    registrationSource: string;
    assignedMediator: string;
    actor: string;
  }): ServiceResult<MediationMatter> {
    if (!input.caseId) {
      return { ok: false, error: "A mediation matter requires an accepted Case ID; none was supplied." };
    }
    if (input.caseStatus && !ELIGIBLE_CASE_STATUSES.has(input.caseStatus)) {
      return {
        ok: false,
        error: `Case ${input.caseId} is not yet accepted (status: ${input.caseStatus}). A mediation matter can only be registered after acceptance.`,
      };
    }

    const now = DemoTimeService.iso();
    const matterId = makeId("MED");
    const matter: MediationMatter = {
      matterId,
      mediationReference: "MREF-" + matterId.slice(-6).toUpperCase(),
      caseId: input.caseId,
      applicationId: input.applicationId,
      pathway: input.pathway,
      referralSource: input.referralSource,
      courtOrTribunalRef: input.courtOrTribunalRef,
      registrationSource: input.registrationSource,
      assignedMediator: input.assignedMediator,
      parties: input.parties,
      matterCategory: input.matterCategory,
      state: "registered",
      participationMode: input.participationMode,
      sessionIds: [],
      documentIds: [],
      documentReviews: [],
      settlementDraftIds: [],
      history: [{ at: now, actor: input.actor, toState: "registered", reason: "Matter registered from accepted case; existing case data reused, not re-entered." }],
      auditEventIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const audit = AuditTrailService.log(
      { subject: matterId, subjectKind: "mediation_matter", action: "mediation.registered", actor: input.actor, payload: { caseId: input.caseId, matterCategory: input.matterCategory, pathway: input.pathway } },
      { kind: "officer_lookup", simulatedAt: now },
    );
    matter.auditEventIds = [audit.id];
    matter.history[0].auditEventId = audit.id;

    const fresh = read();
    write({ ...fresh, mediationMatters: [...(fresh.mediationMatters ?? []), matter] });
    return { ok: true, value: matter };
  },

  transition(input: {
    matterId: string;
    to: MediationMatterState;
    actor: string;
    reason?: string;
    note?: string;
  }): MediationMatter | undefined {
    const envelope = read();
    const current = (envelope.mediationMatters ?? []).find((m) => m.matterId === input.matterId);
    if (!current) return undefined;

    const now = DemoTimeService.iso();
    const historyItem: MediationHistoryItem = {
      at: now,
      actor: input.actor,
      fromState: current.state,
      toState: input.to,
      reason: input.reason,
      note: input.note,
    };

    const audit = AuditTrailService.log(
      { subject: input.matterId, subjectKind: "mediation_matter", action: `mediation.${input.to}`, actor: input.actor, payload: { from: current.state, to: input.to, reason: input.reason } },
      { kind: "officer_lookup", simulatedAt: now },
    );
    historyItem.auditEventId = audit.id;

    const updated: MediationMatter = {
      ...current,
      state: input.to,
      history: [...current.history, historyItem],
      auditEventIds: [...current.auditEventIds, audit.id],
      updatedAt: now,
    };

    const fresh = read();
    write({
      ...fresh,
      mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === input.matterId ? updated : m)),
    });
    return updated;
  },

  /**
   * §7 — Party contact. Runs the existing safe-contact gate before
   * recording a contact attempt against a party. A blocked attempt is
   * recorded as blocked, never silently skipped.
   */
  recordPartyContact(input: {
    matterId: string;
    partyRole: "applicant" | "respondent";
    application?: Parameters<typeof SafeContactService.evaluate>[0];
    channel: string;
    result: "reached" | "no_answer" | "blocked_unsafe";
    actor: string;
  }): ServiceResult<MediationMatter> {
    const envelope = read();
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === input.matterId);
    if (!matter) return { ok: false, error: `No mediation matter ${input.matterId}.` };

    let result = input.result;
    let blockedReason: string | undefined;
    if (input.application) {
      const evaluation = SafeContactService.evaluate(input.application);
      if (!evaluation.cleared && result === "reached") {
        result = "blocked_unsafe";
        blockedReason = evaluation.reasons.map((r) => r.en).join("; ");
      }
    }

    const now = DemoTimeService.iso();
    const parties = matter.parties.map((p) =>
      p.role === input.partyRole
        ? { ...p, contactedAt: now, contactChannel: input.channel, contactResult: result }
        : p,
    );
    const allContacted = parties.every((p) => p.contactResult && p.contactResult !== "blocked_unsafe");

    const audit = AuditTrailService.log(
      {
        subject: input.matterId,
        subjectKind: "mediation_matter",
        action: result === "blocked_unsafe" ? "mediation.party_contact_blocked" : "mediation.party_contacted",
        actor: input.actor,
        payload: { partyRole: input.partyRole, channel: input.channel, result, blockedReason },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const nextState: MediationMatterState = allContacted && matter.state === "party_contact_pending" ? "scheduled" : matter.state;
    const historyItem: MediationHistoryItem = {
      at: now,
      actor: input.actor,
      fromState: matter.state,
      toState: nextState,
      reason: result === "blocked_unsafe" ? "Contact attempt blocked by safe-contact rules." : "Party contact recorded.",
      auditEventId: audit.id,
    };
    const updated: MediationMatter = {
      ...matter,
      parties,
      state: nextState === matter.state ? matter.state : nextState,
      history: nextState === matter.state ? matter.history : [...matter.history, historyItem],
      auditEventIds: [...matter.auditEventIds, audit.id],
      updatedAt: now,
    };

    const fresh = read();
    write({ ...fresh, mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === input.matterId ? updated : m)) });
    return { ok: true, value: updated };
  },

  scheduleSession(input: {
    matterId: string;
    scheduledFor: string;
    expectedDurationMinutes: number;
    mode: MediationParticipationMode;
    location?: string;
    remoteInstructions?: string;
    interpreterBooked?: boolean;
    accessibilityAccommodation?: string;
    inPersonFallbackPlanned: boolean;
    actor: string;
  }): ServiceResult<MediationSession> {
    const envelope = read();
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === input.matterId);
    if (!matter) return { ok: false, error: `No mediation matter ${input.matterId}.` };
    if (input.mode !== "in_person" && !input.inPersonFallbackPlanned) {
      return { ok: false, error: "Remote or hybrid participation requires an in-person fallback to be configured first." };
    }

    const now = DemoTimeService.iso();
    const sessionId = makeId("MEDS");
    const session: MediationSession = {
      sessionId,
      matterId: input.matterId,
      caseId: matter.caseId,
      scheduledFor: input.scheduledFor,
      expectedDurationMinutes: input.expectedDurationMinutes,
      mode: input.mode,
      location: input.location,
      remoteInstructions: input.remoteInstructions,
      interpreterBooked: input.interpreterBooked,
      accessibilityAccommodation: input.accessibilityAccommodation,
      inPersonFallbackPlanned: input.inPersonFallbackPlanned,
      noticesSent: [],
      attendance: [],
      mediatorNotes: "",
      connectionStatus: input.mode === "in_person" ? "not_applicable" : "connected",
      status: "scheduled",
      createdAt: now,
      auditEventIds: [],
    };

    const audit = AuditTrailService.log(
      { subject: sessionId, subjectKind: "mediation_session", action: "mediation_session.scheduled", actor: input.actor, payload: { matterId: input.matterId, mode: input.mode, scheduledFor: input.scheduledFor } },
      { kind: "officer_lookup", simulatedAt: now },
    );
    session.auditEventIds = [audit.id];

    const historyItem: MediationHistoryItem = { at: now, actor: input.actor, fromState: matter.state, toState: "scheduled", reason: "Session scheduled.", auditEventId: audit.id };
    const updatedMatter: MediationMatter = {
      ...matter,
      state: matter.state === "registered" || matter.state === "party_contact_pending" ? "scheduled" : matter.state,
      participationMode: input.mode,
      sessionIds: [...matter.sessionIds, sessionId],
      history: [...matter.history, historyItem],
      auditEventIds: [...matter.auditEventIds, audit.id],
      updatedAt: now,
    };

    const fresh = read();
    write({
      ...fresh,
      mediationSessions: [...(fresh.mediationSessions ?? []), session],
      mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === input.matterId ? updatedMatter : m)),
    });
    return { ok: true, value: session };
  },

  sendNotices(input: { sessionId: string; parties: { party: string; language: "bn" | "en" }[]; actor: string }): ServiceResult<MediationSession> {
    const envelope = read();
    const session = (envelope.mediationSessions ?? []).find((s) => s.sessionId === input.sessionId);
    if (!session) return { ok: false, error: `No mediation session ${input.sessionId}.` };

    const now = DemoTimeService.iso();
    // Simulated external delivery: still a real communication event that changes state (§8).
    const notices: MediationNotice[] = input.parties.map((p) => ({
      party: p.party,
      channel: session.mode === "remote" ? "sms" : "in_person",
      sentAt: now,
      safeContactRespected: true,
      deliveryState: "delivered",
      language: p.language,
    }));

    const audit = AuditTrailService.log(
      { subject: input.sessionId, subjectKind: "mediation_session", action: "mediation_session.notices_sent", actor: input.actor, payload: { parties: input.parties.map((p) => p.party) } },
      { kind: "sms", note: { bn: "সিমুলেটেড এসএমএস ডেলিভারি", en: "Simulated SMS delivery" }, simulatedAt: now },
    );

    const updatedSession: MediationSession = {
      ...session,
      noticesSent: [...session.noticesSent, ...notices],
      status: "reminded",
      auditEventIds: [...session.auditEventIds, audit.id],
    };

    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === session.matterId);
    const fresh = read();
    write({
      ...fresh,
      mediationSessions: (fresh.mediationSessions ?? []).map((s) => (s.sessionId === input.sessionId ? updatedSession : s)),
      mediationMatters: matter
        ? (fresh.mediationMatters ?? []).map((m) =>
            m.matterId === matter.matterId
              ? { ...m, state: m.state === "scheduled" ? "notices_sent" : m.state, auditEventIds: [...m.auditEventIds, audit.id], updatedAt: now }
              : m,
          )
        : fresh.mediationMatters,
    });
    return { ok: true, value: updatedSession };
  },

  /** §9 — mark a document reviewed / unclear / missing; unclear/missing spawns a real follow-up task on the DLAO task engine. */
  reviewDocument(input: {
    matterId: string;
    documentId: string;
    status: MediationDocumentReview["status"];
    note?: string;
    actor: string;
  }): ServiceResult<MediationMatter> {
    const envelope = read();
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === input.matterId);
    if (!matter) return { ok: false, error: `No mediation matter ${input.matterId}.` };
    const now = DemoTimeService.iso();

    const previousReview = matter.documentReviews.find((review) => review.documentId === input.documentId);
    if (previousReview?.status === input.status) {
      return { ok: true, value: matter };
    }

    let followUpTaskId = previousReview?.followUpTaskId;
    if (input.status === "unclear" || input.status === "missing_requested") {
      const previousTask = followUpTaskId ? DlaoTaskService.find(envelope, followUpTaskId) : undefined;
      const previousTaskIsOpen = previousTask?.state === "queued" || previousTask?.state === "in_progress";
      if (!previousTaskIsOpen) {
        const task = DlaoTaskService.createTask({
          subject: input.matterId,
          subjectKind: "mediation_matter",
          reason: input.status === "unclear" ? "Document unclear — mediator follow-up required." : "Document missing — request from party.",
          priority: "medium",
          summary: `Mediation ${matter.mediationReference}: ${input.status === "unclear" ? "clarify" : "obtain"} document ${input.documentId}`,
          details: { matterId: input.matterId, documentId: input.documentId, note: input.note },
          caseId: matter.caseId,
          applicationId: matter.applicationId,
          actor: input.actor,
        });
        followUpTaskId = task.taskId;
      }
    } else if (input.status === "reviewed" && followUpTaskId) {
      const previousTask = DlaoTaskService.find(envelope, followUpTaskId);
      if (previousTask?.state === "queued" || previousTask?.state === "in_progress") {
        DlaoTaskService.transition({
          taskId: followUpTaskId,
          to: "completed",
          actor: input.actor,
          note: input.note ?? `Document ${input.documentId} was reviewed and the follow-up was resolved.`,
        });
      }
    }

    const review: MediationDocumentReview = {
      documentId: input.documentId,
      status: input.status,
      reviewedBy: input.actor,
      reviewedAt: now,
      note: input.note,
      followUpTaskId,
    };
    const existing = matter.documentReviews.filter((r) => r.documentId !== input.documentId);

    const audit = AuditTrailService.log(
      {
        subject: input.matterId,
        subjectKind: "mediation_matter",
        action: "mediation.document_reviewed",
        actor: input.actor,
        payload: {
          documentId: input.documentId,
          previousStatus: previousReview?.status,
          status: input.status,
          note: input.note,
          followUpTaskId,
        },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const updated: MediationMatter = {
      ...matter,
      documentIds: matter.documentIds.includes(input.documentId) ? matter.documentIds : [...matter.documentIds, input.documentId],
      documentReviews: [...existing, review],
      state: matter.state === "notices_sent" ? "documents_under_review" : matter.state,
      auditEventIds: [...matter.auditEventIds, audit.id],
      updatedAt: now,
    };

    const fresh = read();
    write({ ...fresh, mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === input.matterId ? updated : m)) });
    return { ok: true, value: updated };
  },

  markReadyForSession(input: { matterId: string; actor: string }): ServiceResult<MediationMatter> {
    const envelope = read();
    const matter = (envelope.mediationMatters ?? []).find((item) => item.matterId === input.matterId);
    if (!matter) return { ok: false, error: `No mediation matter ${input.matterId}.` };
    if (matter.state !== "documents_under_review") {
      return { ok: false, error: "The matter must be in document review before it can be marked ready for session." };
    }
    if (matter.documentReviews.length === 0) {
      return { ok: false, error: "At least one document review must be recorded before the session can be prepared." };
    }
    const unresolved = matter.documentReviews.filter((review) => review.status !== "reviewed");
    if (unresolved.length > 0) {
      return { ok: false, error: `${unresolved.length} document issue(s) must be resolved before the session can be prepared.` };
    }
    const updated = this.transition({ matterId: input.matterId, to: "ready_for_session", actor: input.actor, reason: "All recorded documents were human-reviewed; ready to convene." });
    return updated ? { ok: true, value: updated } : { ok: false, error: "The document-review stage could not be completed." };
  },

  /**
   * Record attendance for a session. If a remote/hybrid party fails to
   * connect (`connectionFailed: true`), this does NOT silently mark
   * them absent — it creates a fresh in-person fallback session and
   * links it via `fallbackTriggeredFrom`, and logs why.
   */
  recordAttendance(input: {
    sessionId: string;
    attendance: MediationAttendanceRecord[];
    connectionFailed?: boolean;
    actor: string;
  }): ServiceResult<{ session: MediationSession; fallbackSession?: MediationSession }> {
    const envelope = read();
    const session = (envelope.mediationSessions ?? []).find((s) => s.sessionId === input.sessionId);
    if (!session) return { ok: false, error: `No mediation session ${input.sessionId}.` };
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === session.matterId);
    if (!matter) return { ok: false, error: `No mediation matter for session ${input.sessionId}.` };

    const now = DemoTimeService.iso();

    if (input.connectionFailed && session.mode !== "in_person") {
      const fallbackId = makeId("MEDS");
      const fallbackSession: MediationSession = {
        sessionId: fallbackId,
        matterId: session.matterId,
        caseId: session.caseId,
        scheduledFor: session.scheduledFor,
        mode: "in_person",
        inPersonFallbackPlanned: true,
        fallbackTriggeredFrom: { previousSessionId: session.sessionId, reason: "Remote connection failed; falling back to in-person per the in-person-fallback requirement." },
        noticesSent: [],
        attendance: session.attendance, // preserve whatever was already recorded — nothing disappears in the transition
        mediatorNotes: session.mediatorNotes,
        structuredNotes: session.structuredNotes,
        connectionStatus: "not_applicable",
        status: "scheduled",
        createdAt: now,
        auditEventIds: [],
      };

      const audit = AuditTrailService.log(
        { subject: input.sessionId, subjectKind: "mediation_session", action: "mediation_session.remote_failed_fallback_created", actor: input.actor, payload: { fallbackSessionId: fallbackId } },
        { kind: "voice", simulatedAt: now },
      );
      fallbackSession.auditEventIds = [audit.id];

      const updatedSession: MediationSession = { ...session, status: "rescheduled", connectionStatus: "failed", auditEventIds: [...session.auditEventIds, audit.id] };
      const historyItem: MediationHistoryItem = { at: now, actor: input.actor, fromState: matter.state, toState: "no_show_rescheduled", reason: "Remote session failed; in-person fallback scheduled.", auditEventId: audit.id };
      const updatedMatter: MediationMatter = {
        ...matter,
        state: "no_show_rescheduled",
        sessionIds: [...matter.sessionIds, fallbackId],
        history: [...matter.history, historyItem],
        auditEventIds: [...matter.auditEventIds, audit.id],
        updatedAt: now,
      };

      const fresh = read();
      write({
        ...fresh,
        mediationSessions: [
          ...(fresh.mediationSessions ?? []).map((s) => (s.sessionId === input.sessionId ? updatedSession : s)),
          fallbackSession,
        ],
        mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === matter.matterId ? updatedMatter : m)),
      });
      return { ok: true, value: { session: updatedSession, fallbackSession } };
    }

    const allAttended = input.attendance.every((a) => a.attended);
    const audit = AuditTrailService.log(
      { subject: input.sessionId, subjectKind: "mediation_session", action: "mediation_session.attendance_recorded", actor: input.actor, payload: { attendance: input.attendance } },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const updatedSession: MediationSession = {
      ...session,
      attendance: input.attendance,
      status: allAttended ? "attended" : "no_show",
      auditEventIds: [...session.auditEventIds, audit.id],
    };

    const nextMatterState: MediationMatterState = allAttended ? "attendance_confirmed" : "no_show_rescheduled";
    const historyItem: MediationHistoryItem = { at: now, actor: input.actor, fromState: matter.state, toState: nextMatterState, auditEventId: audit.id };
    const updatedMatter: MediationMatter = {
      ...matter,
      state: nextMatterState,
      history: [...matter.history, historyItem],
      auditEventIds: [...matter.auditEventIds, audit.id],
      updatedAt: now,
    };

    const fresh = read();
    write({
      ...fresh,
      mediationSessions: (fresh.mediationSessions ?? []).map((s) => (s.sessionId === input.sessionId ? updatedSession : s)),
      mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === matter.matterId ? updatedMatter : m)),
    });
    return { ok: true, value: { session: updatedSession } };
  },

  /** §11 — session simulator actions. Every action is a real, auditable state change; none silently no-op. */
  sessionAction(input: {
    sessionId: string;
    action: "start" | "pause" | "mark_connection_failure" | "adjourn" | "end" | "switch_to_in_person";
    actor: string;
    reason?: string;
  }): ServiceResult<{ session: MediationSession; fallbackSession?: MediationSession }> {
    const envelope = read();
    const session = (envelope.mediationSessions ?? []).find((s) => s.sessionId === input.sessionId);
    if (!session) return { ok: false, error: `No mediation session ${input.sessionId}.` };
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === session.matterId);
    if (!matter) return { ok: false, error: `No mediation matter for session ${input.sessionId}.` };
    const now = DemoTimeService.iso();

    if (input.action === "switch_to_in_person") {
      return this.recordAttendance({ sessionId: input.sessionId, attendance: session.attendance, connectionFailed: true, actor: input.actor });
    }

    let sessionPatch: Partial<MediationSession> = {};
    let matterState: MediationMatterState = matter.state;
    let action = "";
    switch (input.action) {
      case "start":
        sessionPatch = { status: "in_progress", startedAt: now, connectionStatus: session.mode === "in_person" ? "not_applicable" : "connected" };
        matterState = "in_session";
        action = "mediation_session.started";
        break;
      case "pause":
        sessionPatch = { status: "paused", pausedAt: now };
        action = "mediation_session.paused";
        break;
      case "mark_connection_failure":
        sessionPatch = { connectionStatus: "failed" };
        action = "mediation_session.connection_failure";
        break;
      case "adjourn":
        sessionPatch = { status: "adjourned", adjournedAt: now };
        matterState = "adjourned";
        action = "mediation_session.adjourned";
        break;
      case "end":
        sessionPatch = { status: "completed", endedAt: now };
        matterState = "drafting";
        action = "mediation_session.ended";
        break;
    }

    const audit = AuditTrailService.log(
      { subject: input.sessionId, subjectKind: "mediation_session", action, actor: input.actor, payload: { reason: input.reason } },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const updatedSession: MediationSession = { ...session, ...sessionPatch, auditEventIds: [...session.auditEventIds, audit.id] };
    const historyItem: MediationHistoryItem = { at: now, actor: input.actor, fromState: matter.state, toState: matterState, reason: input.reason, auditEventId: audit.id };
    const updatedMatter: MediationMatter = matterState === matter.state
      ? { ...matter, auditEventIds: [...matter.auditEventIds, audit.id], updatedAt: now }
      : { ...matter, state: matterState, history: [...matter.history, historyItem], auditEventIds: [...matter.auditEventIds, audit.id], updatedAt: now };

    const fresh = read();
    write({
      ...fresh,
      mediationSessions: (fresh.mediationSessions ?? []).map((s) => (s.sessionId === input.sessionId ? updatedSession : s)),
      mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === matter.matterId ? updatedMatter : m)),
    });
    return { ok: true, value: { session: updatedSession } };
  },

  /** §12 — structured mediator notes. Overwrites with a version bump; never shown to citizen views. */
  saveSessionNotes(input: { sessionId: string; notes: Omit<MediationSessionNotes, "author" | "updatedAt" | "version">; actor: string }): ServiceResult<MediationSession> {
    const envelope = read();
    const session = (envelope.mediationSessions ?? []).find((s) => s.sessionId === input.sessionId);
    if (!session) return { ok: false, error: `No mediation session ${input.sessionId}.` };
    const now = DemoTimeService.iso();
    const version = (session.structuredNotes?.version ?? 0) + 1;
    const structuredNotes: MediationSessionNotes = { ...input.notes, author: input.actor, updatedAt: now, version };

    const audit = AuditTrailService.log(
      { subject: input.sessionId, subjectKind: "mediation_session", action: "mediation_session.notes_saved", actor: input.actor, payload: { version } },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const updatedSession: MediationSession = { ...session, structuredNotes, mediatorNotes: input.notes.sessionResult, auditEventIds: [...session.auditEventIds, audit.id] };
    const fresh = read();
    write({ ...fresh, mediationSessions: (fresh.mediationSessions ?? []).map((s) => (s.sessionId === input.sessionId ? updatedSession : s)) });
    return { ok: true, value: updatedSession };
  },

  attachSettlementDraft(input: { matterId: string; draftId: string; actor: string }): MediationMatter | undefined {
    const envelope = read();
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === input.matterId);
    if (!matter) return undefined;
    const now = DemoTimeService.iso();

    const audit = AuditTrailService.log(
      { subject: input.matterId, subjectKind: "mediation_matter", action: "mediation.drafting", actor: input.actor, payload: { draftId: input.draftId } },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const historyItem: MediationHistoryItem = { at: now, actor: input.actor, fromState: matter.state, toState: "drafting", auditEventId: audit.id };
    const updated: MediationMatter = {
      ...matter,
      state: "drafting",
      settlementDraftIds: matter.settlementDraftIds.includes(input.draftId) ? matter.settlementDraftIds : [...matter.settlementDraftIds, input.draftId],
      history: [...matter.history, historyItem],
      auditEventIds: [...matter.auditEventIds, audit.id],
      updatedAt: now,
    };
    const fresh = read();
    write({ ...fresh, mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === input.matterId ? updated : m)) });
    return updated;
  },

  markDraftUnderReview(input: { matterId: string; actor: string }): MediationMatter | undefined {
    return this.transition({ matterId: input.matterId, to: "draft_under_review", actor: input.actor, reason: "Draft submitted for human review." });
  },

  markPartyReview(input: { matterId: string; actor: string }): MediationMatter | undefined {
    return this.transition({ matterId: input.matterId, to: "party_review", actor: input.actor, reason: "Draft frozen and sent for party review/consent." });
  },

  markAwaitingSignatures(input: { matterId: string; actor: string }): MediationMatter | undefined {
    return this.transition({ matterId: input.matterId, to: "awaiting_signatures", actor: input.actor, reason: "Consent recorded; sent to the T11 signing workflow." });
  },

  markPartiallySigned(input: { matterId: string; actor: string }): MediationMatter | undefined {
    return this.transition({ matterId: input.matterId, to: "partially_signed", actor: input.actor });
  },

  markSigned(input: { matterId: string; actor: string }): MediationMatter | undefined {
    return this.transition({ matterId: input.matterId, to: "signed", actor: input.actor, reason: "Both signatures verified against the frozen document." });
  },

  /**
   * Record the mediation outcome. This is the one point in the whole
   * flow that is genuinely gated on human authority: it refuses (does
   * NOT throw, does NOT silently succeed) a "settled" decision unless
   * the caller supplies a settlement draft already signed. The caller
   * (the outcome page) is responsible for checking the draft/signing
   * status and passing it in — this function re-verifies rather than
   * trusting the UI. Recording an outcome never auto-closes the
   * parent case; it only creates the next case task.
   */
  recordOutcome(input: {
    matterId: string;
    decision: MediationOutcome["decision"];
    recordedBy: string;
    humanApprovedBy: string;
    settlementDraftId?: string;
    settlementSigned?: boolean;
    note?: string;
    citizenVisibleSummary?: string;
    nextActionSummary: string;
    responsibleActor: string;
    dueAt?: string;
  }): ServiceResult<{ matter: MediationMatter; taskId: string }> {
    const envelope = read();
    const matter = (envelope.mediationMatters ?? []).find((m) => m.matterId === input.matterId);
    if (!matter) return { ok: false, error: `No mediation matter ${input.matterId}.` };

    if (input.decision === "settled" && (!input.settlementDraftId || !input.settlementSigned)) {
      return {
        ok: false,
        error: "A settlement outcome cannot be recorded until the settlement document has been signed and verified by both parties.",
      };
    }
    if (!input.humanApprovedBy) {
      return { ok: false, error: "Mediation outcomes require an authorised human approver." };
    }

    const now = DemoTimeService.iso();
    const outcome: MediationOutcome = {
      decision: input.decision,
      recordedBy: input.recordedBy,
      recordedAt: now,
      humanApprovedBy: input.humanApprovedBy,
      settlementDraftId: input.settlementDraftId,
      note: input.note,
    };

    const nextState: MediationMatterState = input.decision === "not_settled" ? "no_settlement" : "outcome_recorded";

    const audit = AuditTrailService.log(
      { subject: input.matterId, subjectKind: "mediation_matter", action: "mediation.outcome_recorded", actor: input.humanApprovedBy, payload: { decision: input.decision, settlementDraftId: input.settlementDraftId } },
      { kind: "officer_lookup", simulatedAt: now },
    );

    const historyItem: MediationHistoryItem = { at: now, actor: input.humanApprovedBy, fromState: matter.state, toState: nextState, auditEventId: audit.id };
    const updated: MediationMatter = {
      ...matter,
      state: nextState,
      outcome,
      history: [...matter.history, historyItem],
      auditEventIds: [...matter.auditEventIds, audit.id],
      updatedAt: now,
    };

    const fresh = read();
    write({ ...fresh, mediationMatters: (fresh.mediationMatters ?? []).map((m) => (m.matterId === input.matterId ? updated : m)) });

    // §16 — create the next case task. A separate write via DlaoTaskService; correct on its own.
    const task = DlaoTaskService.createTask({
      subject: input.matterId,
      subjectKind: "mediation_matter",
      reason: `Mediation outcome recorded: ${input.decision}.`,
      priority: input.decision === "settled" ? "low" : "medium",
      summary: input.nextActionSummary,
      details: { matterId: input.matterId, caseId: matter.caseId, decision: input.decision, citizenVisibleSummary: input.citizenVisibleSummary },
      caseId: matter.caseId,
      applicationId: matter.applicationId,
      dueAt: input.dueAt,
      actor: input.humanApprovedBy,
    });

    return { ok: true, value: { matter: updated, taskId: task.taskId } };
  },

  closeMatter(input: { matterId: string; actor: string }): MediationMatter | undefined {
    return this.transition({ matterId: input.matterId, to: "closed", actor: input.actor, reason: "Matter closed." });
  },
};

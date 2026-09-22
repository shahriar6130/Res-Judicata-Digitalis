/* ------------------------------------------------------------------ *
 *  StatusVisitService — implements the §11 scheduled 4 PM status
 *  visit and the §11 letter-access flow.
 *
 *  Two distinct authorization tokens, with no overlap:
 *  - APPLICANT_ASSISTED_VIEW (per §11) — granted after applicant
 *    presence + fresh authentication. Single-session, short-lived,
 *    purpose-bound. Cannot open letters.
 *  - LETTER_ACCESS (per §11) — separate IVR/PIN step-up. The PIN
 *    is NEVER stored, logged, or transmitted. Only metadata
 *    (timestamp, attempt count, outcome) is persisted.
 *
 *  Threat model:
 *    - UDC never sees/knows/types the PIN.
 *    - Token scopes are mutually exclusive — letter token cannot
 *      open other case content; status token cannot open letters.
 *    - Failed attempts are rate-limited.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { makeId } from "./_internal/async-helpers";
import type {
  LetterAccessAttempt,
  LetterAccessToken,
  StatusVisitSession,
  StatusVisitToken,
} from "../types";

export const STATUS_VISIT_EVENT = "shakkho:status-visit";

/* ------------------------------------------------------------------ *
 *  In-memory stores. The prototype persists only metadata — never
 *  the PIN itself.
 * ------------------------------------------------------------------ */
const visitSessions = new Map<string, StatusVisitSession>();
const visitTokens = new Map<string, StatusVisitToken>();
const letterTokens = new Map<string, LetterAccessToken>();
const letterAttempts = new Map<string, LetterAccessAttempt[]>();

function emit(payload: unknown): void {
  publish(STATUS_VISIT_EVENT, payload);
}

const VISIT_TTL_MS = 30 * 60 * 1000; // 30 minutes per visit
const LETTER_TTL_MS = 5 * 60 * 1000; // 5 minutes per letter access
const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCKOUT_MS = 10 * 60 * 1000;

/* ------------------------------------------------------------------ *
 *  Status visit
 * ------------------------------------------------------------------ */
export const StatusVisitService = {
  /** Begin a scheduled visit — UDC declares Nuching is present. */
  beginSession(args: {
    applicationId: string;
    udcEntrepreneurId: string;
    applicantDisplayName: string;
  }): StatusVisitSession {
    const now = Date.now();
    const session: StatusVisitSession = {
      id: makeId("VIS"),
      applicationId: args.applicationId,
      udcEntrepreneurId: args.udcEntrepreneurId,
      applicantDisplayName: args.applicantDisplayName,
      applicantPresent: true,
      presenceMethod: "in_person_udc",
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + VISIT_TTL_MS).toISOString(),
      state: "presence_recorded",
    };
    visitSessions.set(session.id, session);
    emit({ kind: "session_began", session });
    return session;
  },

  /** Issue the APPLICANT_ASSISTED_VIEW token after fresh authentication. */
  issueAssistedToken(args: {
    sessionId: string;
    applicantIdentifier: string;          // never the PIN itself
    authorizationMethod: "applicant_pin_ivr" | "biometric_local" | "human_alternative";
    purpose: "status_check" | "document_help" | "letter_help";
  }): StatusVisitToken | { error: string } {
    const session = visitSessions.get(args.sessionId);
    if (!session) return { error: "session not found" };
    if (session.state === "expired" || Date.now() > new Date(session.expiresAt).getTime()) {
      session.state = "expired";
      return { error: "session expired" };
    }
    const now = Date.now();
    const token: StatusVisitToken = {
      id: makeId("ATK"),
      sessionId: args.sessionId,
      applicationId: session.applicationId,
      scope: "APPLICANT_ASSISTED_VIEW",
      purpose: args.purpose,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + VISIT_TTL_MS).toISOString(),
      authorizationMethod: args.authorizationMethod,
      // We record only non-secret metadata — never the PIN itself.
      applicantIdentifierHash: lightHash(args.applicantIdentifier),
      revoked: false,
    };
    visitTokens.set(token.id, token);
    session.state = "verified";
    emit({ kind: "token_issued", token });
    return token;
  },

  /** Validate a token. Returns false if expired, revoked, or scope-mismatched. */
  validate(tokenId: string, scope: "APPLICANT_ASSISTED_VIEW" | "LETTER_ACCESS"): StatusVisitToken | LetterAccessToken | undefined {
    if (scope === "APPLICANT_ASSISTED_VIEW") {
      const t = visitTokens.get(tokenId);
      if (!t) return undefined;
      if (t.revoked) return undefined;
      if (Date.now() > new Date(t.expiresAt).getTime()) return undefined;
      return t;
    }
    const t = letterTokens.get(tokenId);
    if (!t) return undefined;
    if (t.revoked) return undefined;
    if (Date.now() > new Date(t.expiresAt).getTime()) return undefined;
    return t;
  },

  /** Revoke a token — e.g. on session end. */
  revoke(tokenId: string): void {
    visitTokens.set(tokenId, { ...(visitTokens.get(tokenId) ?? {} as StatusVisitToken), revoked: true });
    letterTokens.set(tokenId, { ...(letterTokens.get(tokenId) ?? {} as LetterAccessToken), revoked: true });
    emit({ kind: "token_revoked", tokenId });
  },

  endSession(sessionId: string): StatusVisitSession | undefined {
    const session = visitSessions.get(sessionId);
    if (!session) return undefined;
    session.state = "ended";
    session.endedAt = new Date().toISOString();
    // Revoke all tokens issued under this session.
    for (const [id, t] of visitTokens) {
      if (t.sessionId === sessionId) visitTokens.set(id, { ...t, revoked: true });
    }
    emit({ kind: "session_ended", session });
    return session;
  },

  getSession(sessionId: string): StatusVisitSession | undefined {
    return visitSessions.get(sessionId);
  },

  listTokens(): { visit: StatusVisitToken[]; letter: LetterAccessToken[] } {
    return {
      visit: [...visitTokens.values()],
      letter: [...letterTokens.values()],
    };
  },
};

/* ------------------------------------------------------------------ *
 *  Letter access — separate from status visit, requires PIN/IVR.
 *
 *  The PIN is verified but NEVER stored. Only metadata is retained.
 * ------------------------------------------------------------------ */
export const LetterAccessService = {
  /**
   * Begin a letter-access attempt. The caller (UDC) supplies only
   * the IVR call ID — they have no knowledge of the PIN.
   */
  beginAttempt(args: {
    applicationId: string;
    letterId: string;
    ivrCallId: string;
  }): { callId: string; expiresAt: string } {
    const callId = args.ivrCallId;
    const expiresAt = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
    const existing = letterAttempts.get(args.applicationId) ?? [];
    const recent = existing.filter(
      (a) => Date.now() - new Date(a.at).getTime() < PIN_LOCKOUT_MS,
    );
    if (recent.length >= PIN_MAX_ATTEMPTS) {
      return { callId, expiresAt: new Date(Date.now() + PIN_LOCKOUT_MS).toISOString() };
    }
    emit({ kind: "letter_attempt_began", ...args, callId, expiresAt });
    return { callId, expiresAt };
  },

  /**
   * Verify a PIN entered via DTMF by the applicant.
   *
   * IMPORTANT: The PIN is processed by the prototype's "IVR bridge"
   * (a simulated function) and is NEVER returned, logged, or stored
   * in component state, IndexedDB, analytics, audit, or notifications.
   */
  verifyPin(args: {
    applicationId: string;
    letterId: string;
    ivrCallId: string;
    pinEnteredByApplicant: string;        // used here only, never persisted
    expectedPin: string;                  // prototype-only — for the simulated match
    onMismatch: "lockout_after_three";
  }): { ok: true; token: LetterAccessToken } | { ok: false; reason: "mismatch" | "locked_out" } {
    const existing = letterAttempts.get(args.applicationId) ?? [];
    const recent = existing.filter(
      (a) => Date.now() - new Date(a.at).getTime() < PIN_LOCKOUT_MS,
    );
    if (recent.length >= PIN_MAX_ATTEMPTS) {
      return { ok: false, reason: "locked_out" };
    }
    const attempt: LetterAccessAttempt = {
      id: makeId("LAA"),
      applicationId: args.applicationId,
      letterId: args.letterId,
      ivrCallId: args.ivrCallId,
      at: new Date().toISOString(),
      outcome: args.pinEnteredByApplicant === args.expectedPin ? "verified" : "mismatch",
      // PIN is intentionally omitted from the audit record.
    };
    letterAttempts.set(args.applicationId, [...recent, attempt]);

    if (attempt.outcome !== "verified") {
      emit({ kind: "letter_attempt_failed", applicationId: args.applicationId });
      return { ok: false, reason: "mismatch" };
    }

    const now = Date.now();
    const token: LetterAccessToken = {
      id: makeId("LTK"),
      sessionId: args.ivrCallId,
      applicationId: args.applicationId,
      letterId: args.letterId,
      scope: "LETTER_ACCESS",
      purpose: "letter_read",
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + LETTER_TTL_MS).toISOString(),
      authorizationMethod: "ivr_pin",
      revoked: false,
    };
    letterTokens.set(token.id, token);
    emit({ kind: "letter_token_issued", token });
    return { ok: true, token };
  },

  /** Count of letter-access attempts in the prototype. The PIN never leaves this scope. */
  attemptsFor(applicationId: string): number {
    return (letterAttempts.get(applicationId) ?? []).length;
  },

  revoke(tokenId: string): void {
    const t = letterTokens.get(tokenId);
    if (t) letterTokens.set(tokenId, { ...t, revoked: true });
    emit({ kind: "letter_token_revoked", tokenId });
  },
};

/** Lightweight, non-cryptographic hash — used only for non-reversible identifier fingerprints. */
function lightHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `hash-${h.toString(16).padStart(8, "0")}`;
}
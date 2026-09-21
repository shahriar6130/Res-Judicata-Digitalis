/* ------------------------------------------------------------------ *
 *  CallerVerificationService — non-visual, knowledge-based.
 *
 *  Prototype-only: questions are seeded strings and pass/fail is set
 *  explicitly. The service writes an audit event for every state
 *  change and forwards `failed` to `IntakeSessionService.requestHandoff`
 *  so a DLAO bridge task is queued automatically.
 * ------------------------------------------------------------------ */

import type { CallerVerification, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { IntakeSessionService } from "./intake-session.service";

function makeId(): string {
  return "ver-" + Math.random().toString(36).slice(2, 10);
}

export const CallerVerificationService = {
  list(envelope: StoreEnvelope): CallerVerification[] {
    return [...envelope.verifications];
  },

  begin(input: {
    sessionId: string;
    actor: string;
  }): CallerVerification {
    const record: CallerVerification = {
      id: makeId(),
      sessionId: input.sessionId,
      questions: [
        {
          bn: "আপনার জাতীয় পরিচয়পত্রের শেষ ৪ সংখ্যা?",
          en: "Last 4 digits of your national ID?",
        },
        {
          bn: "গত সপ্তাহে কোন দিন প্রথম যোগাযোগ হয়েছিল?",
          en: "What day last week did we first contact you?",
        },
      ],
      responses: [],
      passed: null,
      method: "knowledge_based",
    };
    const envelope = read();
    write({ ...envelope, verifications: [...envelope.verifications, record] });
    AuditTrailService.log(
      {
        subject: input.sessionId,
        subjectKind: "verification",
        action: "verification.started",
        actor: input.actor,
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
    return record;
  },

  pass(verificationId: string, actor: string): CallerVerification | undefined {
    return this.setPassed(verificationId, true, actor);
  },

  fail(verificationId: string, actor: string): CallerVerification | undefined {
    const updated = this.setPassed(verificationId, false, actor);
    if (updated) {
      IntakeSessionService.requestHandoff({
        sessionId: updated.sessionId,
        reason: "voice_failure",
        targetRole: "dlao",
        actor,
      });
    }
    return updated;
  },

  setPassed(
    verificationId: string,
    passed: boolean,
    actor: string,
  ): CallerVerification | undefined {
    const envelope = read();
    let updated: CallerVerification | undefined;
    const verifications = envelope.verifications.map((v) => {
      if (v.id !== verificationId) return v;
      updated = {
        ...v,
        passed,
        passedAt: new Date().toISOString(),
      };
      return updated;
    });
    write({ ...envelope, verifications });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.sessionId,
          subjectKind: "verification",
          action: passed ? "verification.passed" : "verification.failed",
          actor,
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },
};

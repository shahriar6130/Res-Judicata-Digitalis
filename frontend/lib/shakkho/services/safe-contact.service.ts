/* ------------------------------------------------------------------ *
 *  SafeContactService — gate that must clear before any disclosure.
 *
 *  For the prototype, the rule set is minimal but the gate is real:
 *  every service that reveals address / SMS / dispatch consults
 *  `evaluate(...)` first.
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  SafeContactEvaluation,
  StoreEnvelope,
} from "../types";
import { SafeContactBlockedError } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

export const SafeContactService = {
  evaluate(
    record: Pick<ApplicationRecord, "applicationId" | "safeContact" | "facts">,
  ): SafeContactEvaluation {
    const hasSafeTime =
      typeof record.facts.safe_contact_time?.value === "string" &&
      record.facts.safe_contact_time.value.length > 0;
    const baseCleared = record.safeContact?.cleared ?? false;
    const cleared = baseCleared && hasSafeTime;
    const reasons: SafeContactEvaluation["reasons"] = cleared
      ? [
          { bn: "নিরাপদ সময় নিশ্চিত", en: "Safe time confirmed" },
        ]
      : [
          {
            bn: "নিরাপদ সময় পাওয়া যায়নি",
            en: "Safe contact time is missing",
          },
        ];
    return {
      cleared,
      reasons,
      evaluatedAt: new Date().toISOString(),
      rulesApplied: ["safe_time_window"],
    };
  },

  attach(
    applicationId: string,
    evaluation: SafeContactEvaluation,
    actor: string,
  ): void {
    const envelope = read();
    const records = envelope.records.map((r) =>
      r.applicationId === applicationId
        ? { ...r, safeContact: evaluation }
        : r,
    );
    write({ ...envelope, records });
    AuditTrailService.log(
      {
        subject: applicationId,
        subjectKind: "application",
        action: evaluation.cleared ? "safe_contact.cleared" : "safe_contact.blocked",
        actor,
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
  },

  assertCleared(evaluation: SafeContactEvaluation): void {
    if (!evaluation.cleared) {
      throw new SafeContactBlockedError(
        "Safe-contact evaluation did not clear — disclosure blocked.",
      );
    }
  },

  list(envelope: StoreEnvelope): SafeContactEvaluation[] {
    return envelope.records
      .map((r) => r.safeContact)
      .filter((s): s is SafeContactEvaluation => Boolean(s));
  },
};

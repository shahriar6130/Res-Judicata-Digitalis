/* ------------------------------------------------------------------ *
 *  ContactReliabilityService — owner-of-number tracking + attempts.
 *
 *  Used when the only reachable number belongs to a third party
 *  (Malek's shop owner). The service flags `safeToUse`, the permitted
 *  message type, and reliability scoring without ever leaking
 *  sensitive context. It records every attempt (succeeded / failed /
 *  alternative-channel) for audit.
 * ------------------------------------------------------------------ */

import type {
  ContactAttempt,
  ContactReliability,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

export const ContactReliabilityService = {
  list(envelope: StoreEnvelope): ContactReliability[] {
    return envelope.contactReliabilities ?? [];
  },

  forCase(envelope: StoreEnvelope, caseId: string): ContactReliability[] {
    return (envelope.contactReliabilities ?? []).filter((c) => c.caseId === caseId);
  },

  registerContact(input: {
    caseId: string;
    applicantId?: string;
    number: string;
    numberOwner: ContactReliability["numberOwner"];
    relationshipToApplicant?: string;
    channel: ContactReliability["channel"];
    safeToUse: boolean;
    permittedMessageType: ContactReliability["permittedMessageType"];
    mayMentionLegalAid: boolean;
    reliability: ContactReliability["reliability"];
    preferredTime?: string;
    reviewDate?: string;
    source: ContactReliability["source"];
    confirmationStatus: ContactReliability["confirmationStatus"];
    notes?: string;
    actor: string;
  }): ContactReliability {
    const envelope = read();
    const item: ContactReliability = {
      contactId: makeId("cnt"),
      caseId: input.caseId,
      applicantId: input.applicantId ?? "applicant-" + input.caseId,
      number: input.number,
      numberOwner: input.numberOwner,
      relationshipToApplicant: input.relationshipToApplicant,
      channel: input.channel,
      safeToUse: input.safeToUse,
      permittedMessageType: input.permittedMessageType,
      mayMentionLegalAid: input.mayMentionLegalAid,
      reliability: input.reliability,
      preferredTime: input.preferredTime,
      reviewDate: input.reviewDate,
      source: input.source,
      confirmationStatus: input.confirmationStatus,
      notes: input.notes,
    };
    write({
      ...envelope,
      contactReliabilities: [...(envelope.contactReliabilities ?? []), item],
    });
    AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "contact_attempt",
        action: "contact.registered",
        actor: input.actor,
        payload: { owner: input.numberOwner, safeToUse: input.safeToUse, reliability: input.reliability },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return item;
  },

  recordAttempt(input: {
    contactId: string;
    caseId: string;
    channel: ContactAttempt["channel"];
    outcome: ContactAttempt["outcome"];
    whoAnswered?: string;
    note?: string;
    actor: string;
  }): ContactAttempt {
    const envelope = read();
    const attempt: ContactAttempt = {
      attemptId: makeId("cat"),
      contactId: input.contactId,
      caseId: input.caseId,
      attemptedAt: DemoTimeService.iso(),
      attemptedBy: input.actor,
      channel: input.channel,
      outcome: input.outcome,
      whoAnswered: input.whoAnswered,
      note: input.note,
    };
    const list = (envelope.contactReliabilities ?? []).map((c) => {
      if (c.contactId !== input.contactId) return c;
      const lastSuccessfulContactAt = input.outcome === "answered_by_applicant" ? attempt.attemptedAt : c.lastSuccessfulContactAt;
      return { ...c, lastSuccessfulContactAt };
    });
    write({
      ...envelope,
      contactReliabilities: list,
      contactAttempts: [...(envelope.contactAttempts ?? []), attempt],
    });
    AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "contact_attempt",
        action: `contact.attempt_${input.outcome}`,
        actor: input.actor,
        payload: { contactId: input.contactId, whoAnswered: input.whoAnswered, channel: input.channel },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return attempt;
  },
};

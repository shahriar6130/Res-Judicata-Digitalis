/* ------------------------------------------------------------------ *
 *  ApplicationRecordService — CRUD + state transitions on
 *  `ApplicationRecord`.
 *
 *  - `applicationId` is minted ONLY here on `submit(...)`. Drafts use
 *    `TEMP-xxxxx` until then. Case IDs (DLAS-YYYY-XXXXX) are never
 *    minted in Phase 1.
 *  - All transitions write an `AuditEvent`.
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  ProvenanceEntry,
  SlotKey,
  SlotValue,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { ingestLegacyHelplineRecord } from "../../dlas/legacy-bridge";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

function nextYearlyId(): string {
  // APP-YYYY-XXXXX — 5 random digits, deterministic enough for a demo.
  const year = new Date().getFullYear();
  const n = String(Math.floor(10000 + Math.random() * 90000));
  return `APP-${year}-${n}`;
}

function safeIngest(r: ApplicationRecord, actor: string): string | null {
  try {
    return ingestLegacyHelplineRecord(r, actor);
  } catch {
    return null;
  }
}

export const ApplicationRecordService = {
  list(envelope: StoreEnvelope): ApplicationRecord[] {
    return [...envelope.records];
  },

  find(envelope: StoreEnvelope, applicationId: string): ApplicationRecord | undefined {
    return envelope.records.find((r) => r.applicationId === applicationId);
  },

  createDraft(input: {
    office: string;
    channel: ApplicationRecord["channel"];
    intakeSessionId?: string;
    actor: string;
  }): ApplicationRecord {
    const record: ApplicationRecord = {
      applicationId: makeId("TEMP"),
      status: "draft",
      channel: input.channel,
      office: input.office,
      intakeSessionId: input.intakeSessionId,
      urgencyIndicators: [],
      facts: {},
      provenance: [],
      audit: [],
      createdAt: new Date().toISOString(),
    };
    const envelope = read();
    write({ ...envelope, records: [...envelope.records, record] });
    AuditTrailService.log(
      {
        subject: record.applicationId,
        subjectKind: "application",
        action: "draft.created",
        actor: input.actor,
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
    return record;
  },

  setSlot(
    applicationId: string,
    slot: SlotKey,
    value: SlotValue,
    actor: string,
  ): ApplicationRecord | undefined {
    const envelope = read();
    let updated: ApplicationRecord | undefined;
    const records = envelope.records.map((r) => {
      if (r.applicationId !== applicationId) return r;
      const provenance: ProvenanceEntry = {
        slot,
        source: value.source,
        confidence: value.confidence,
        recordedAt: new Date().toISOString(),
        by: actor,
      };
      updated = {
        ...r,
        facts: { ...r.facts, [slot]: value },
        provenance: [...r.provenance, provenance],
      };
      return updated;
    });
    write({ ...envelope, records });
    if (updated) {
      AuditTrailService.log(
        {
          subject: applicationId,
          subjectKind: "application",
          action: `slot.${slot}`,
          actor,
          payload: { value: value.value, confidence: value.confidence },
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },

  submit(applicationId: string, actor: string): ApplicationRecord | undefined {
    const envelope = read();
    let updated: ApplicationRecord | undefined;
    const records = envelope.records.map((r) => {
      if (r.applicationId !== applicationId) return r;
      // Mint the final APP-YYYY-XXXXX ONLY on submit.
      // One ID for the whole system: the canonical DLAS gateway mints it
      // (and stores the shared record). Falls back only if that fails.
      const finalId = r.applicationId.startsWith("APP-")
        ? r.applicationId
        : (safeIngest(r, actor) ?? nextYearlyId());
      updated = {
        ...r,
        applicationId: finalId,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      };
      return updated;
    });
    write({ ...envelope, records });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.applicationId,
          subjectKind: "application",
          action: "application.submitted",
          actor,
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },
};

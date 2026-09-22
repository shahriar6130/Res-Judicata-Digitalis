/* ------------------------------------------------------------------ *
 *  SensitiveEvidenceService — restricted evidence workspace.
 *
 *  - Lists safe metadata only (no thumbnails, no inline images).
 *  - Grants are time-bounded and purpose-bound.
 *  - Every grant / view / download writes an EvidenceAccessEvent
 *    that the audit trail reads through.
 *  - Original files are NEVER altered. Redacted derivatives are
 *    separate records linked via parentEvidenceId.
 * ------------------------------------------------------------------ */

import type {
  EvidenceAccessEvent,
  EvidenceAccessGrant,
  EvidenceAccessPurpose,
  EvidenceDerivative,
  SensitiveEvidenceItem,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

const GRANT_DURATION_MS = 5 * 60 * 1000; // 5 minutes for the demo.

export const SensitiveEvidenceService = {
  listFor(envelope: StoreEnvelope, applicationId: string): SensitiveEvidenceItem[] {
    return (envelope.sensitiveEvidence?.items ?? []).filter(
      (i) => i.applicationId === applicationId,
    );
  },

  find(envelope: StoreEnvelope, evidenceId: string): SensitiveEvidenceItem | undefined {
    return envelope.sensitiveEvidence?.items.find((i) => i.evidenceId === evidenceId);
  },

  upsert(item: SensitiveEvidenceItem, actor: string): SensitiveEvidenceItem {
    const envelope = read();
    const store = envelope.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] };
    const existing = store.items.find((i) => i.evidenceId === item.evidenceId);
    const items = existing ? store.items.map((i) => (i.evidenceId === item.evidenceId ? item : i)) : [...store.items, item];
    write({ ...envelope, sensitiveEvidence: { ...store, items } });
    AuditTrailService.log(
      {
        subject: item.evidenceId,
        subjectKind: "evidence",
        action: existing ? "evidence.updated" : "evidence.registered",
        actor,
        payload: { applicationId: item.applicationId, kind: item.kind, classification: item.accessClassification },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return item;
  },

  requestAccess(input: {
    evidenceId: string;
    applicantId: string;
    purpose: EvidenceAccessPurpose["code"];
    reauthMethod: EvidenceAccessGrant["reauthMethod"];
    minimumNecessary: boolean;
    actor: string;
  }): EvidenceAccessGrant | undefined {
    const envelope = read();
    const item = this.find(envelope, input.evidenceId);
    if (!item) return undefined;
    const now = Date.now() + (envelope.demoTimeOffsetMs ?? 0);
    const grant: EvidenceAccessGrant = {
      grantId: "evg-" + Math.random().toString(36).slice(2, 10),
      evidenceId: input.evidenceId,
      applicationId: item.applicationId,
      purpose: input.purpose,
      grantedTo: input.actor,
      grantedBy: input.actor,
      grantedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + GRANT_DURATION_MS).toISOString(),
      reauthMethod: input.reauthMethod,
      minimumNecessary: input.minimumNecessary,
    };
    const store = envelope.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] };
    const audit = AuditTrailService.log(
      {
        subject: input.evidenceId,
        subjectKind: "evidence",
        action: "evidence.access_requested",
        actor: input.actor,
        payload: { purpose: input.purpose, minimumNecessary: input.minimumNecessary },
      },
      { kind: "officer_lookup", simulatedAt: new Date(now).toISOString() },
    );
    const event: EvidenceAccessEvent = {
      eventId: "eva-" + Math.random().toString(36).slice(2, 10),
      evidenceId: input.evidenceId,
      applicationId: item.applicationId,
      grantId: grant.grantId,
      actor: input.actor,
      role: "officer",
      purpose: input.purpose,
      action: "grant_created",
      occurredAt: grant.grantedAt,
      version: item.version,
      auditEventId: audit.id,
    };
    write({
      ...envelope,
      sensitiveEvidence: {
        ...store,
        grants: [...store.grants, grant],
        events: [...store.events, event],
      },
    });
    return grant;
  },

  activeGrant(envelope: StoreEnvelope, evidenceId: string, actor: string): EvidenceAccessGrant | undefined {
    const now = Date.now() + (envelope.demoTimeOffsetMs ?? 0);
    return (envelope.sensitiveEvidence?.grants ?? [])
      .filter((g) => g.evidenceId === evidenceId && g.grantedTo === actor && !g.revokedAt)
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())
      .find((g) => new Date(g.expiresAt).getTime() > now);
  },

  recordView(input: {
    evidenceId: string;
    grantId: string;
    actor: string;
    role: string;
    purpose: EvidenceAccessPurpose["code"];
  }): EvidenceAccessEvent | undefined {
    const envelope = read();
    const store = envelope.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] };
    const item = store.items.find((i) => i.evidenceId === input.evidenceId);
    if (!item) return undefined;
    const audit = AuditTrailService.log(
      {
        subject: input.evidenceId,
        subjectKind: "evidence",
        action: "evidence.viewed",
        actor: input.actor,
        payload: { purpose: input.purpose, version: item.version, grantId: input.grantId },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    const event: EvidenceAccessEvent = {
      eventId: "eva-" + Math.random().toString(36).slice(2, 10),
      evidenceId: input.evidenceId,
      applicationId: item.applicationId,
      grantId: input.grantId,
      actor: input.actor,
      role: input.role,
      purpose: input.purpose,
      action: "viewed",
      occurredAt: DemoTimeService.iso(),
      version: item.version,
      auditEventId: audit.id,
    };
    write({ ...envelope, sensitiveEvidence: { ...store, events: [...store.events, event] } });
    return event;
  },

  recordDownload(input: {
    evidenceId: string;
    grantId: string;
    actor: string;
    role: string;
    purpose: EvidenceAccessPurpose["code"];
  }): EvidenceAccessEvent | undefined {
    const envelope = read();
    const store = envelope.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] };
    const item = store.items.find((i) => i.evidenceId === input.evidenceId);
    if (!item) return undefined;
    const audit = AuditTrailService.log(
      {
        subject: input.evidenceId,
        subjectKind: "evidence",
        action: "evidence.downloaded",
        actor: input.actor,
        payload: { purpose: input.purpose, grantId: input.grantId },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    const event: EvidenceAccessEvent = {
      eventId: "eva-" + Math.random().toString(36).slice(2, 10),
      evidenceId: input.evidenceId,
      applicationId: item.applicationId,
      grantId: input.grantId,
      actor: input.actor,
      role: input.role,
      purpose: input.purpose,
      action: "downloaded",
      occurredAt: DemoTimeService.iso(),
      version: item.version,
      auditEventId: audit.id,
    };
    write({ ...envelope, sensitiveEvidence: { ...store, events: [...store.events, event] } });
    return event;
  },

  createDerivative(input: {
    parentEvidenceId: string;
    transformation: EvidenceDerivative["transformation"];
    responsibleActor: string;
    note?: string;
  }): EvidenceDerivative | undefined {
    const envelope = read();
    const store = envelope.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] };
    const parent = store.items.find((i) => i.evidenceId === input.parentEvidenceId);
    if (!parent) return undefined;
    const derivative: EvidenceDerivative = {
      derivativeId: "evd-" + Math.random().toString(36).slice(2, 10),
      parentEvidenceId: parent.evidenceId,
      transformation: input.transformation,
      newHash: "sha256-" + Math.random().toString(36).slice(2, 18).padEnd(16, "0"),
      responsibleActor: input.responsibleActor,
      createdAt: DemoTimeService.iso(),
      note: input.note,
    };
    AuditTrailService.log(
      {
        subject: parent.evidenceId,
        subjectKind: "evidence",
        action: "evidence.derivative_created",
        actor: input.responsibleActor,
        payload: { derivativeId: derivative.derivativeId, transformation: input.transformation },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    write({
      ...envelope,
      sensitiveEvidence: {
        ...store,
        derivatives: [...store.derivatives, derivative],
        items: store.items.map((i) =>
          i.evidenceId === parent.evidenceId ? { ...i, sharingStatus: "redacted_derivative_created" } : i,
        ),
      },
    });
    return derivative;
  },

  revokeGrant(input: { grantId: string; revokedBy: string; actor: string; reason?: string }): void {
    const envelope = read();
    const store = envelope.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] };
    const grant = store.grants.find((g) => g.grantId === input.grantId);
    if (!grant) return;
    AuditTrailService.log(
      {
        subject: grant.evidenceId,
        subjectKind: "evidence",
        action: "evidence.grant_revoked",
        actor: input.actor,
        payload: { grantId: input.grantId, reason: input.reason },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    write({
      ...envelope,
      sensitiveEvidence: {
        ...store,
        grants: store.grants.map((g) =>
          g.grantId === input.grantId
            ? { ...g, revokedAt: DemoTimeService.iso(), revokedBy: input.revokedBy }
            : g,
        ),
      },
    });
  },

  eventsFor(envelope: StoreEnvelope, evidenceId: string): EvidenceAccessEvent[] {
    return (envelope.sensitiveEvidence?.events ?? []).filter((e) => e.evidenceId === evidenceId);
  },
};
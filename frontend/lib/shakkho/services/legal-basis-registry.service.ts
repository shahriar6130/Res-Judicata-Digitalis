/* ------------------------------------------------------------------ *
 *  LegalBasisRegistryService — versioned legal-basis entries that
 *  link authority directory entries to routing rules. Only active,
 *  verified entries are returned to the routing service; an empty
 *  result means "no verified routing rule — human review required".
 * ------------------------------------------------------------------ */

import type { LegalBasisEntry, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

export const LegalBasisRegistryService = {
  list(envelope: StoreEnvelope): LegalBasisEntry[] {
    return envelope.legalBasis ?? [];
  },

  active(envelope: StoreEnvelope): LegalBasisEntry[] {
    return (envelope.legalBasis ?? []).filter(
      (b) => b.verificationStatus === "verified" && !b.supersededByBasisId,
    );
  },

  upsert(entry: LegalBasisEntry, actor: string): LegalBasisEntry {
    const envelope = read();
    const existing = (envelope.legalBasis ?? []).find((b) => b.basisId === entry.basisId);
    const list = existing
      ? (envelope.legalBasis ?? []).map((b) => (b.basisId === entry.basisId ? entry : b))
      : [...(envelope.legalBasis ?? []), entry];
    write({ ...envelope, legalBasis: list });
    AuditTrailService.log(
      {
        subject: entry.basisId,
        subjectKind: "system",
        action: existing ? "legal_basis.updated" : "legal_basis.created",
        actor,
        payload: { matterCategory: entry.matterCategory, receivingAuthorityType: entry.receivingAuthorityType },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return entry;
  },

  markVerified(basisId: string, verifiedBy: string, actor: string): LegalBasisEntry | undefined {
    const envelope = read();
    const list: LegalBasisEntry[] = (envelope.legalBasis ?? []).map((b) =>
      b.basisId === basisId
        ? { ...b, verificationStatus: "verified", verifiedBy, lastReviewedAt: DemoTimeService.iso() }
        : b,
    );
    write({ ...envelope, legalBasis: list });
    AuditTrailService.log(
      {
        subject: basisId,
        subjectKind: "system",
        action: "legal_basis.verified",
        actor,
        payload: { verifiedBy },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return list.find((b) => b.basisId === basisId);
  },

  supersede(basisId: string, supersededByBasisId: string, actor: string): LegalBasisEntry | undefined {
    const envelope = read();
    const list: LegalBasisEntry[] = (envelope.legalBasis ?? []).map((b) =>
      b.basisId === basisId ? { ...b, verificationStatus: "superseded", supersededByBasisId } : b,
    );
    write({ ...envelope, legalBasis: list });
    AuditTrailService.log(
      {
        subject: basisId,
        subjectKind: "system",
        action: "legal_basis.superseded",
        actor,
        payload: { supersededByBasisId },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return list.find((b) => b.basisId === basisId);
  },
};
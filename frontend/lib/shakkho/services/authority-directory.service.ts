/* ------------------------------------------------------------------ *
 *  AuthorityDirectoryService — read/mutate the configured list of
 *  possible receiving bodies. Only an authorized administrator may
 *  activate a route; entries can be marked `unverified` or `expired`
 *  to drive `no_verified_route` routing recommendations.
 * ------------------------------------------------------------------ */

import type { AuthorityDirectoryEntry, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

export const AuthorityDirectoryService = {
  list(envelope: StoreEnvelope): AuthorityDirectoryEntry[] {
    return envelope.authorityDirectory ?? [];
  },

  find(envelope: StoreEnvelope, entryId: string): AuthorityDirectoryEntry | undefined {
    return (envelope.authorityDirectory ?? []).find((e) => e.entryId === entryId);
  },

  byOffice(envelope: StoreEnvelope, officeName: string): AuthorityDirectoryEntry | undefined {
    return (envelope.authorityDirectory ?? []).find(
      (e) => e.displayNameBn === officeName || e.displayNameEn === officeName,
    );
  },

  upsert(entry: AuthorityDirectoryEntry, actor: string): AuthorityDirectoryEntry {
    const envelope = read();
    const existing = (envelope.authorityDirectory ?? []).find((e) => e.entryId === entry.entryId);
    const list = existing
      ? (envelope.authorityDirectory ?? []).map((e) => (e.entryId === entry.entryId ? entry : e))
      : [...(envelope.authorityDirectory ?? []), entry];
    write({ ...envelope, authorityDirectory: list });
    AuditTrailService.log(
      {
        subject: entry.entryId,
        subjectKind: "system",
        action: existing ? "authority_directory.updated" : "authority_directory.created",
        actor,
        payload: { type: entry.type, displayNameEn: entry.displayNameEn },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return entry;
  },

  markVerified(entryId: string, verifiedBy: string, actor: string): AuthorityDirectoryEntry | undefined {
    const envelope = read();
    const list: AuthorityDirectoryEntry[] = (envelope.authorityDirectory ?? []).map((e) =>
      e.entryId === entryId
        ? { ...e, verificationStatus: "verified", verifiedBy, lastReviewedAt: DemoTimeService.iso() }
        : e,
    );
    write({ ...envelope, authorityDirectory: list });
    AuditTrailService.log(
      {
        subject: entryId,
        subjectKind: "system",
        action: "authority_directory.verified",
        actor,
        payload: { verifiedBy },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return list.find((e) => e.entryId === entryId);
  },

  markExpired(entryId: string, actor: string): AuthorityDirectoryEntry | undefined {
    const envelope = read();
    const list: AuthorityDirectoryEntry[] = (envelope.authorityDirectory ?? []).map((e) =>
      e.entryId === entryId ? { ...e, verificationStatus: "expired" } : e,
    );
    write({ ...envelope, authorityDirectory: list });
    AuditTrailService.log(
      {
        subject: entryId,
        subjectKind: "system",
        action: "authority_directory.expired",
        actor,
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return list.find((e) => e.entryId === entryId);
  },

  /** Filter to verified, non-expired entries for a given matter + geography. */
  eligibleFor(
    envelope: StoreEnvelope,
    matter: string,
    district?: string,
  ): AuthorityDirectoryEntry[] {
    const now = Date.now();
    return (envelope.authorityDirectory ?? []).filter((e) => {
      if (e.verificationStatus !== "verified") return false;
      if (e.expiryDate && new Date(e.expiryDate).getTime() < now) return false;
      if (
        matter &&
        e.subjectCoverage.length > 0 &&
        !e.subjectCoverage.some((s) => s.toLowerCase().includes(matter.toLowerCase()))
      )
        return false;
      if (district && e.geographicCoverage.length > 0 && !e.geographicCoverage.includes(district))
        return false;
      return true;
    });
  },
};
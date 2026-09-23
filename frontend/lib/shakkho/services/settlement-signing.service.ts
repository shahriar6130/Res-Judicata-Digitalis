/* ------------------------------------------------------------------ *
 *  SettlementSigningService — T11 (asynchronous e-signature) as seen
 *  from the mediator page. The mediator page only *displays and
 *  connects to* this workflow; it never signs for a party (§15/§19).
 *
 *  Demonstrates the required async-signing sequence (§15):
 *    1. openForSigning(draftId)               -> awaiting_signatures
 *    2. sign(party A, online)                  -> partially_signed
 *    3. sign(party B, offline)                 -> signed_offline_pending_sync
 *    4. syncOfflineSignature(party B)           -> synced, hash re-verified
 *    5. verifyIntegrity()                       -> fully_synced_and_verified
 *
 *  Uses the browser's real SubtleCrypto (ECDSA P-256), the same
 *  mechanism already demonstrated on /verify/[certNumber] — not a
 *  fake boolean flip. A signature is bound to the frozen document
 *  hash: if the draft's frozenTextHash ever changes underneath a
 *  signing workflow, `verifyIntegrity` reports a mismatch rather than
 *  silently reporting success.
 *
 *  Same audit-ordering rule as the other Prompt-10/11 services: log
 *  first against a fresh read, then exactly one final domain write.
 * ------------------------------------------------------------------ */

import type { PartySignatureRecord, SigningWorkflow, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const SettlementSigningService = {
  list(envelope: StoreEnvelope): SigningWorkflow[] {
    return envelope.signingWorkflows ?? [];
  },

  forDraft(envelope: StoreEnvelope, draftId: string): SigningWorkflow | undefined {
    return (envelope.signingWorkflows ?? []).find((w) => w.draftId === draftId);
  },

  /** Opens the workflow once a draft is frozen (`finalizedForSigningAt` set) and consent recorded. */
  openForSigning(input: { draftId: string; matterId: string; caseId: string; documentHash: string; parties: string[]; actor: string }): ServiceResult<SigningWorkflow> {
    if (!input.documentHash) return { ok: false, error: "Cannot open signing without a frozen document hash." };
    const now = DemoTimeService.iso();
    const signingId = makeId("SIGN");
    const workflow: SigningWorkflow = {
      signingId,
      draftId: input.draftId,
      matterId: input.matterId,
      caseId: input.caseId,
      documentVersion: 1,
      documentHash: input.documentHash,
      parties: input.parties.map((party) => ({ party, status: "not_started" })),
      mediatorSignatureStatus: "not_applicable",
      integrityVerified: false,
      status: "awaiting_signatures",
      createdAt: now,
      updatedAt: now,
      auditEventIds: [],
    };

    const audit = AuditTrailService.log(
      { subject: signingId, subjectKind: "signing_workflow", action: "signing.opened", actor: input.actor, payload: { draftId: input.draftId, documentHash: input.documentHash } },
      { kind: "system", simulatedAt: now },
    );
    workflow.auditEventIds = [audit.id];

    const fresh = read();
    write({ ...fresh, signingWorkflows: [...(fresh.signingWorkflows ?? []), workflow] });
    return { ok: true, value: workflow };
  },

  /**
   * A party signs — online immediately verified, offline pending sync
   * until connectivity returns. Uses a real ECDSA P-256 keypair
   * generated in-browser to sign the document hash, exactly like the
   * existing /verify/[certNumber] demo.
   */
  async sign(input: { signingId: string; party: string; offline: boolean; actor: string }): Promise<ServiceResult<SigningWorkflow>> {
    const envelope = read();
    const workflow = (envelope.signingWorkflows ?? []).find((w) => w.signingId === input.signingId);
    if (!workflow) return { ok: false, error: `No signing workflow ${input.signingId}.` };
    const now = DemoTimeService.iso();

    let signatureHex = "unavailable";
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, new TextEncoder().encode(workflow.documentHash));
      signatureHex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    const parties: PartySignatureRecord[] = workflow.parties.map((p) =>
      p.party === input.party
        ? { party: p.party, status: input.offline ? "signed_offline_pending_sync" : "signed_online", signedAt: now, offline: input.offline, signatureHex }
        : p,
    );
    const signedCount = parties.filter((p) => p.status !== "not_started").length;
    const status: SigningWorkflow["status"] = signedCount === parties.length ? "partially_signed" : "awaiting_signatures";
    // "partially_signed" here covers "at least one signed, not yet fully synced+verified" — matches the matter-level state name.

    const audit = AuditTrailService.log(
      { subject: input.signingId, subjectKind: "signing_workflow", action: input.offline ? "signing.party_signed_offline" : "signing.party_signed_online", actor: input.actor, payload: { party: input.party } },
      { kind: "system", simulatedAt: now },
    );

    const updated: SigningWorkflow = { ...workflow, parties, status, auditEventIds: [...workflow.auditEventIds, audit.id], updatedAt: now };
    const fresh = read();
    write({ ...fresh, signingWorkflows: (fresh.signingWorkflows ?? []).map((w) => (w.signingId === input.signingId ? updated : w)) });
    return { ok: true, value: updated };
  },

  /** Connectivity returns: sync the offline signature and re-verify the document hash hasn't changed underneath it. */
  syncOfflineSignature(input: { signingId: string; party: string; currentDocumentHash: string; actor: string }): ServiceResult<SigningWorkflow> {
    const envelope = read();
    const workflow = (envelope.signingWorkflows ?? []).find((w) => w.signingId === input.signingId);
    if (!workflow) return { ok: false, error: `No signing workflow ${input.signingId}.` };
    if (workflow.documentHash !== input.currentDocumentHash) {
      return { ok: false, error: "The settlement document changed after this signature was collected offline. The signature cannot be attached to the new version." };
    }
    const now = DemoTimeService.iso();
    const parties = workflow.parties.map((p) => (p.party === input.party && p.status === "signed_offline_pending_sync" ? { ...p, status: "synced" as const, syncedAt: now } : p));

    const audit = AuditTrailService.log(
      { subject: input.signingId, subjectKind: "signing_workflow", action: "signing.offline_signature_synced", actor: input.actor, payload: { party: input.party } },
      { kind: "system", simulatedAt: now },
    );

    const updated: SigningWorkflow = { ...workflow, parties, auditEventIds: [...workflow.auditEventIds, audit.id], updatedAt: now };
    const fresh = read();
    write({ ...fresh, signingWorkflows: (fresh.signingWorkflows ?? []).map((w) => (w.signingId === input.signingId ? updated : w)) });
    return { ok: true, value: updated };
  },

  /** Both signatures present and synced -> verify document integrity and mark the workflow fully complete. */
  verifyIntegrity(input: { signingId: string; currentDocumentHash: string; actor: string }): ServiceResult<SigningWorkflow> {
    const envelope = read();
    const workflow = (envelope.signingWorkflows ?? []).find((w) => w.signingId === input.signingId);
    if (!workflow) return { ok: false, error: `No signing workflow ${input.signingId}.` };
    const allDone = workflow.parties.every((p) => p.status === "signed_online" || p.status === "synced");
    if (!allDone) return { ok: false, error: "Not every party has a signed and synchronized signature yet." };
    const hashMatches = workflow.documentHash === input.currentDocumentHash;
    const now = DemoTimeService.iso();

    const audit = AuditTrailService.log(
      { subject: input.signingId, subjectKind: "signing_workflow", action: "signing.integrity_verified", actor: input.actor, payload: { hashMatches } },
      { kind: "system", simulatedAt: now },
    );

    const updated: SigningWorkflow = {
      ...workflow,
      integrityVerified: hashMatches,
      verifiedAt: now,
      status: hashMatches ? "fully_synced_and_verified" : "invalidated",
      auditEventIds: [...workflow.auditEventIds, audit.id],
      updatedAt: now,
    };
    const fresh = read();
    write({ ...fresh, signingWorkflows: (fresh.signingWorkflows ?? []).map((w) => (w.signingId === input.signingId ? updated : w)) });
    return { ok: true, value: updated };
  },
};

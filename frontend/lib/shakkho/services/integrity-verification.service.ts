/* ------------------------------------------------------------------ *
 *  IntegrityVerificationService
 *
 *  Verifies that an acknowledged submission digest matches what the
 *  client originally sent — i.e. the wire payload was not silently
 *  rewritten, reordered, or dropped between sender and server.
 *
 *  - Algorithm: SHA-256 (or documented FNV-1a fallback).
 *  - Threat model is documented in `integrityThreatModel()` so
 *    reviewers see what this demo protects against (and what it does
 *    not).
 * ------------------------------------------------------------------ */

import { canonicalStringify, isBrowser, noteUnverifiable, sha256Digest } from "./_internal/async-helpers";
import { publish } from "../event-bus";
import type { IntegrityDigest, IntegrityVerification, OfflineDraft, SyncReceipt } from "../types";

export const INTEGRITY_EVENT = "shakkho:integrity";

interface IntegrityListener {
  (v: IntegrityVerification): void;
}
const listeners = new Set<IntegrityListener>();

function notify(v: IntegrityVerification): void {
  publish(INTEGRITY_EVENT, v);
  listeners.forEach((cb) => cb(v));
}

export const IntegrityVerificationService = {
  /**
   * Compute a canonical SHA-256 digest over a draft's authoritative
   * payload. The same payload, no matter the order of properties, must
   * produce the same digest — hence the canonicalStringify pass.
   */
  async digestDraft(draft: OfflineDraft): Promise<IntegrityDigest> {
    const canonical = canonicalStringify({
      temporaryId: draft.temporaryId,
      payload: draft.payload,
      confirmedFields: [...draft.confirmedFields].sort(),
      provenance: draft.provenance.map((p) => p.id).sort(),
      consent: draft.consent.map((c) => c.id).sort(),
      localVersion: draft.localVersion,
      documentMetadata: draft.documentMetadata.map((d) => d.id).sort(),
    });
    const hex = await sha256Digest(canonical);
    return {
      algorithm: "sha-256",
      hex,
      generatedAt: new Date().toISOString(),
      canonicalForm: canonical.length > 120 ? canonical.slice(0, 120) + "…" : canonical,
    };
  },

  /**
   * Compare what the client sent with what the server acknowledged.
   * `acknowledgedDigest` is taken from the SyncReceipt the server
   * returned. Mismatch → IntegrityVerification with result="mismatch".
   */
  async verify(draft: OfflineDraft, receipt: SyncReceipt): Promise<IntegrityVerification> {
    const submitted = await IntegrityVerificationService.digestDraft(draft);
    const result: IntegrityVerification["result"] =
      submitted.hex === receipt.payloadDigest ? "pass" : "mismatch";
    if (!isBrowser()) noteUnverifiable();
    const v: IntegrityVerification = {
      id: `int-${Date.now().toString(36)}`,
      temporaryId: draft.temporaryId,
      submittedDigest: submitted.hex,
      acknowledgedDigest: receipt.payloadDigest,
      result,
      verifiedAt: new Date().toISOString(),
      note:
        result === "pass"
          ? { bn: "পেলোড অক্ষত", en: "Payload intact" }
          : {
              bn: "অখণ্ডতা পরীক্ষায় মিল নেই — পর্যালোচনা প্রয়োজন",
              en: "Integrity check mismatch — review required",
            },
    };
    notify(v);
    return v;
  },

  subscribe(cb: IntegrityListener): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/* ------------------------------------------------------------------ *
 *  Threat model — required by Phase 5 §19 ("Integrity-verifiable sync
 *  with explicit threat model"). Honest disclosure: this demo lives
 *  entirely in the browser, so it cannot truly defend against a
 *  compromised client. It DOES demonstrate the verification pattern.
 * ------------------------------------------------------------------ */
export interface IntegrityThreat {
  inScope: boolean;
  bn: string;
  en: string;
}
export function integrityThreatModel(): IntegrityThreat[] {
  return [
    {
      inScope: true,
      bn: "ট্রানজিটে পেলোড রিঅর্ডার বা বাদ দেওয়া",
      en: "Payload reordering or drop in transit",
    },
    {
      inScope: true,
      bn: "আইডেম্পোটেন্সি-কী মিসম্যাচ",
      en: "Idempotency-key mismatch between retry attempts",
    },
    {
      inScope: true,
      bn: "বিভিন্ন সেশনে একই অস্থায়ী আইডি",
      en: "Same temporary UUID across different sessions",
    },
    {
      inScope: false,
      bn: "সম্পূর্ণ ক্লায়েন্ট আপোস — এই ডেমো ব্রাউজারে চলে",
      en: "Total client compromise — this demo runs in the browser",
    },
    {
      inScope: false,
      bn: "TLS স্ট্রিপিং — পরিবহন নেটওয়ার্কের দায়িত্ব",
      en: "TLS stripping — handled by transport, not the app",
    },
    {
      inScope: false,
      bn: "সার্ভার-সাইড লগ টেম্পারিং — সার্ভারের দায়িত্ব",
      en: "Server-side log tampering — out of app's hands",
    },
  ];
}

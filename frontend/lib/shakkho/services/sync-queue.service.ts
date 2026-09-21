/* ------------------------------------------------------------------ *
 *  SyncQueueService — drives the "submit now / retry later" flow.
 *
 *  Per Phase 5 §16: every submit is an OfflineOperation with a
 *  stable idempotency key. Replays with the same key resolve to the
 *  same SyncReceipt. Network profile determines whether the queue
 *  drains immediately or is held.
 *
 *  Pure in-process implementation: it never blocks on a real server.
 *  The "server" is `SimulatedDlasServer` — deterministic and
 *  auditable.
 * ------------------------------------------------------------------ */

import {
  canonicalStringify,
  isBrowser,
  makeId,
  sha256Digest,
} from "./_internal/async-helpers";
import { publish } from "../event-bus";
import {
  OfflineStore,
  type OfflineCapabilities,
  offlineCapabilities,
} from "./offline-store.service";
import { IntegrityVerificationService } from "./integrity-verification.service";
import { NetworkConditionService } from "./network-condition.service";
import type {
  IdempotencyRecord,
  IntegrityVerification,
  OfflineDraft,
  OfflineOperation,
  OfflineStatus,
  SyncQueueItem,
  SyncReceipt,
} from "../types";

export const SYNC_EVENT = "shakkho:sync";

interface SyncListener {
  (item: SyncQueueItem): void;
}
const syncListeners = new Set<SyncListener>();

function emit(item: SyncQueueItem): void {
  publish(SYNC_EVENT, item);
  syncListeners.forEach((cb) => cb(item));
}

/* ------------------------------------------------------------------ *
 *  In-memory simulated server. Stores the canonical payload per
 *  temporaryId and refuses to create duplicates.
 * ------------------------------------------------------------------ */
interface ServerEntry {
  temporaryId: string;
  authoritativeApplicationId: string;
  payloadDigest: string;
  receivedAt: string;
  payload: Record<string, unknown>;
}
const server: Map<string, ServerEntry> = new Map();
const idemLog: Map<string, SyncReceipt> = new Map();

function currentYear(): number {
  return new Date().getFullYear();
}
function nextAuthoritativeId(): string {
  let n = server.size + 1;
  do {
    n += 1;
  } while ([...server.values()].some((e) => e.authoritativeApplicationId === `APP-${currentYear()}-${String(n).padStart(5, "0")}`));
  return `APP-${currentYear()}-${String(n).padStart(5, "0")}`;
}

export const SimulatedDlasServer = {
  async submit(
    draft: OfflineDraft,
    idempotencyKey: string,
  ): Promise<{ receipt: SyncReceipt; duplicate: boolean; }> {
    const canonical = canonicalStringify(draft.payload);
    const payloadDigest = await sha256Digest(canonical);

    // Idempotency replay — return the prior receipt.
    const prior = idemLog.get(idempotencyKey);
    if (prior) return { receipt: prior, duplicate: true };

    // Permanent storage key is the temporaryId. If two operations
    // share a key, the second is a duplicate.
    if (server.has(draft.temporaryId)) {
      const existing = server.get(draft.temporaryId)!;
      const receipt: SyncReceipt = {
        id: makeId("RCV"),
        temporaryId: draft.temporaryId,
        authoritativeApplicationId: existing.authoritativeApplicationId,
        payloadDigest: existing.payloadDigest,
        serverAckAt: new Date().toISOString(),
        message: { bn: "পূর্বে গৃহীত", en: "Already accepted" },
        verificationId: makeId("VER"),
      };
      idemLog.set(idempotencyKey, receipt);
      return { receipt, duplicate: true };
    }

    const entry: ServerEntry = {
      temporaryId: draft.temporaryId,
      authoritativeApplicationId: nextAuthoritativeId(),
      payloadDigest,
      receivedAt: new Date().toISOString(),
      payload: draft.payload,
    };
    server.set(draft.temporaryId, entry);
    const receipt: SyncReceipt = {
      id: makeId("RCV"),
      temporaryId: draft.temporaryId,
      authoritativeApplicationId: entry.authoritativeApplicationId,
      payloadDigest,
      serverAckAt: entry.receivedAt,
      message: {
        bn: "DLAS গৃহীত — আবেদন আইডি প্রদান",
        en: "DLAS accepted — Application ID issued",
      },
      verificationId: makeId("VER"),
    };
    idemLog.set(idempotencyKey, receipt);
    return { receipt, duplicate: false };
  },

  /** Test helper — used by conflict simulation. */
  __seedConflict(temporaryId: string, authoritativeValue: string, authoritativeActor: string): void {
    if (!server.has(temporaryId)) {
      server.set(temporaryId, {
        temporaryId,
        authoritativeApplicationId: nextAuthoritativeId(),
        payloadDigest: "seeded",
        receivedAt: new Date().toISOString(),
        payload: { _seed: true },
      });
    }
    const entry = server.get(temporaryId)!;
    (entry.payload as Record<string, unknown>).__authoritativeSeed = {
      value: authoritativeValue,
      actor: authoritativeActor,
      at: new Date().toISOString(),
    };
  },

  __getEntry(temporaryId: string): ServerEntry | undefined {
    return server.get(temporaryId);
  },

  __reset(): void {
    server.clear();
    idemLog.clear();
  },
};

/* ------------------------------------------------------------------ *
 *  SyncQueueService API.
 * ------------------------------------------------------------------ */
export const SyncQueueService = {
  subscribe(cb: SyncListener): () => void {
    syncListeners.add(cb);
    return () => {
      syncListeners.delete(cb);
    };
  },

  /** Build the OfflineOperation envelope for a draft. */
  buildOperation(
    draft: OfflineDraft,
    operationType: OfflineOperation["operationType"] = "submit_draft",
  ): OfflineOperation {
    const network = NetworkConditionService.current();
    const isOnline = network.kind !== "offline";
    const baseDelay = isOnline ? Math.max(50, network.latencyMs) : 0;
    return {
      id: makeId("OP"),
      temporaryId: draft.temporaryId,
      idempotencyKey: draft.idempotencyKey,
      clientVersion: draft.localVersion,
      simulatedServerVersion: 0,
      operationType,
      payloadDigest: draft.integrityDigest || "",
      retryPolicy: {
        maxRetries: 3,
        backoffMs: baseDelay,
      },
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
  },

  /** Push the draft onto the offline queue, then try to drain. */
  async enqueue(draft: OfflineDraft): Promise<OfflineStatus> {
    const next: OfflineStatus = "queued_offline";
    await OfflineStore.upsert({ ...draft, syncStatus: next });
    emit({
      id: makeId("Q"),
      operation: SyncQueueService.buildOperation(draft),
      draft: { ...draft, syncStatus: next },
      state: next,
      scheduledAt: new Date().toISOString(),
      nextAction: "await_network",
      auditOrLocalEventRef: draft.lastEventRef,
    });
    void SyncQueueService.tryDrain(draft.temporaryId);
    return next;
  },

  /**
   * Try to drain one queued item. The simulator checks the network
   * profile — if the profile is `offline` or has packet loss, it
   * either reschedules or routes the operation into conflict review.
   */
  async tryDrain(temporaryId: string): Promise<OfflineStatus> {
    const draft = await OfflineStore.get(temporaryId);
    if (!draft) return "sync_failed_safely";
    const network = NetworkConditionService.current();

    if (network.kind === "offline") {
      await OfflineStore.setStatus(temporaryId, "retry_scheduled");
      return "retry_scheduled";
    }

    // Simulated packet loss — transient failure.
    if (network.packetLoss > 0 && Math.random() < network.packetLoss) {
      await OfflineStore.upsert({
        ...draft,
        syncStatus: "retry_scheduled",
        retryCount: draft.retryCount + 1,
        lastError: "simulated packet loss",
      });
      return "retry_scheduled";
    }

    await OfflineStore.setStatus(temporaryId, "synchronizing");
    emit({
      id: makeId("Q"),
      operation: SyncQueueService.buildOperation(draft),
      draft: { ...draft, syncStatus: "synchronizing" },
      state: "synchronizing",
      scheduledAt: new Date().toISOString(),
      auditOrLocalEventRef: draft.lastEventRef,
    });

    try {
      const { receipt, duplicate } = await SimulatedDlasServer.submit(
        draft,
        draft.idempotencyKey,
      );
      // Persist the idempotency record so retries short-circuit.
      const idem: IdempotencyRecord = {
        key: draft.idempotencyKey,
        operationType: "submit_draft",
        result: receipt,
        attempts: draft.retryCount + 1,
        lastAttemptAt: new Date().toISOString(),
        history: [
          ...(await OfflineStore.listIdempotency()).find((r) => r.key === draft.idempotencyKey)?.history ?? [],
          {
            at: new Date().toISOString(),
            outcome: duplicate ? "duplicate" : "ok",
            digest: receipt.payloadDigest,
          },
        ],
      };
      await OfflineStore.saveIdempotency(idem);

      // Integrity verification — same digest as the receipt.
      const v: IntegrityVerification = await IntegrityVerificationService.verify(draft, receipt);

      if (v.result !== "pass") {
        await OfflineStore.upsert({
          ...draft,
          syncStatus: "integrity_review_required",
          lastError: "digest mismatch",
        });
        emit({
          id: makeId("Q"),
          operation: SyncQueueService.buildOperation(draft),
          draft: { ...draft, syncStatus: "integrity_review_required" },
          state: "integrity_review_required",
          auditOrLocalEventRef: v.id,
        });
        return "integrity_review_required";
      }

      await OfflineStore.attachReceipt(draft.temporaryId, receipt);
      emit({
        id: makeId("Q"),
        operation: SyncQueueService.buildOperation(draft),
        draft: { ...draft, syncStatus: "synced", authoritativeApplicationId: receipt.authoritativeApplicationId },
        state: "synced",
        auditOrLocalEventRef: v.id,
      });
      return "synced";
    } catch (err) {
      await OfflineStore.upsert({
        ...draft,
        syncStatus: "sync_failed_safely",
        retryCount: draft.retryCount + 1,
        lastError: String(err),
      });
      return "sync_failed_safely";
    }
  },

  /**
   * The "Nuching network-drop" demo path. Mid-submit the network
   * turns offline, then reconnects. The caller passes the resulting
   * network profile changes and we report each step.
   */
  async runOfflineThenReconnect(temporaryId: string): Promise<OfflineStatus[]> {
    const trail: OfflineStatus[] = [];
    NetworkConditionService.setProfile("offline");
    trail.push(await SyncQueueService.tryDrain(temporaryId));
    NetworkConditionService.setProfile("slow");
    trail.push(await SyncQueueService.tryDrain(temporaryId));
    NetworkConditionService.setProfile("reconnected");
    trail.push(await SyncQueueService.tryDrain(temporaryId));
    NetworkConditionService.setProfile("normal");
    return trail;
  },
};

/* ------------------------------------------------------------------ *
 *  Capability export so UI can show what is actually supported.
 * ------------------------------------------------------------------ */
export function syncCapabilities(): OfflineCapabilities & {
  simulatedServerOnly: boolean;
} {
  return {
    ...offlineCapabilities(),
    simulatedServerOnly: true,
  };
}

void isBrowser;

/* ------------------------------------------------------------------ *
 *  ConflictResolutionService — handles sync conflicts.
 *
 *  Per Phase 5 §17: when the offline draft and the server record
 *  disagree on a field, the operation must NOT silently overwrite.
 *  Instead a SyncConflict is queued for human review.
 *
 *  This module exposes:
 *    - `detect(...)` — compare an offline draft to the server seed
 *    - `applyResolution(...)` — record the decision and propagate it
 *    - `outstanding()` — for the UDC sync-centre UI
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { makeId } from "./_internal/async-helpers";
import {
  SimulatedDlasServer,
  SyncQueueService,
} from "./sync-queue.service";
import type {
  ConflictDecision,
  ConflictResolution,
  OfflineDraft,
  SyncConflict,
  SyncConflictKind,
} from "../types";

export const CONFLICT_EVENT = "shakkho:conflict";

const conflicts: Map<string, SyncConflict> = new Map();
const listeners = new Set<(c: SyncConflict) => void>();
function emit(c: SyncConflict): void {
  publish(CONFLICT_EVENT, c);
  listeners.forEach((cb) => cb(c));
}

function detectConflictKind(
  draft: OfflineDraft,
  seed: { value: string; actor: string; at: string } | undefined,
): { kind: SyncConflictKind; field: string; offlineValue: string } | null {
  if (!seed) return null;
  // Look for any field where offline draft disagrees with server seed.
  const payload = draft.payload as Record<string, unknown>;
  for (const [key, val] of Object.entries(payload)) {
    if (typeof val === "string" && val !== seed.value && key === "seed_field") {
      return {
        kind: "field_value",
        field: key,
        offlineValue: val,
      };
    }
  }
  // Fallback — use the canonical `incident_date` field to demo conflict.
  const offlineIncidentDate =
    typeof payload.incident_date === "string" ? payload.incident_date : "";
  if (offlineIncidentDate && offlineIncidentDate !== seed.value) {
    return {
      kind: "field_value",
      field: "incident_date",
      offlineValue: offlineIncidentDate,
    };
  }
  return null;
}

export const ConflictResolutionService = {
  /** Seed an offline-vs-server disagreement for the demo path. */
  detectForDraft(draft: OfflineDraft): SyncConflict | null {
    const entry = SimulatedDlasServer.__getEntry(draft.temporaryId);
    const seed = (entry?.payload as Record<string, unknown> | undefined)
      ?.__authoritativeSeed as { value: string; actor: string; at: string } | undefined;
    const detection = detectConflictKind(draft, seed);
    if (!detection) return null;
    const conflict: SyncConflict = {
      id: makeId("CONF"),
      temporaryId: draft.temporaryId,
      kind: detection.kind,
      fieldOrObject: detection.field,
      baseVersion: `v${draft.localVersion - 1}`,
      authoritativeValue: seed?.value ?? "",
      authoritativeActor: seed?.actor ?? "system",
      authoritativeAt: seed?.at ?? new Date().toISOString(),
      offlineValue: detection.offlineValue,
      offlineActor: "udc_entrepreneur",
      offlineAt: new Date().toISOString(),
      provenance: {
        bn: "অফলাইন খসড়া ও DLAS রেকর্ডে মিল নেই",
        en: "Offline draft and DLAS record disagree",
      },
      safetyImplications:
        detection.field === "incident_date"
          ? {
              bn: "ঘটনার তারিখ ভিন্ন — আইনি সময়সীমা প্রভাবিত হতে পারে",
              en: "Incident date differs — may affect legal deadlines",
            }
          : undefined,
      suggestedMerge: { kind: "defer_review" },
    };
    conflicts.set(conflict.id, conflict);
    emit(conflict);
    return conflict;
  },

  /** Apply a reviewer decision and propagate to the local draft. */
  applyResolution(input: {
    conflictId: string;
    reviewer: string;
    decision: ConflictDecision;
    reason: { bn: string; en: string };
    resultingValue?: string;
  }): { conflict: SyncConflict; resolution: ConflictResolution } | null {
    const conflict = conflicts.get(input.conflictId);
    if (!conflict) return null;
    const resolution: ConflictResolution = {
      reviewer: input.reviewer,
      decision: input.decision,
      reason: input.reason,
      resolvedAt: new Date().toISOString(),
      resultingVersion: `v${Date.now().toString(36)}`,
      resultingValue: input.resultingValue,
    };
    conflict.resolution = resolution;
    conflicts.set(conflict.id, conflict);

    // If the reviewer chose "accept_offline", the next sync attempt will
    // re-submit the draft with the new authoritative value baked in.
    emit(conflict);
    return { conflict, resolution };
  },

  outstanding(): SyncConflict[] {
    return [...conflicts.values()].filter((c) => !c.resolution);
  },

  all(): SyncConflict[] {
    return [...conflicts.values()];
  },

  reset(): void {
    conflicts.clear();
  },

  /** Used by the demo path: re-try the sync after a defer. */
  async retryAfterResolution(temporaryId: string): Promise<OfflineDraft["syncStatus"]> {
    const status = await SyncQueueService.tryDrain(temporaryId);
    return status;
  },

  subscribe(cb: (c: SyncConflict) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

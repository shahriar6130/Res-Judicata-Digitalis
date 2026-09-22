"use client";

import { useEffect, useRef, useState } from "react";
import { OfflineStore, SyncQueueService, NetworkConditionService } from "@/lib/shakkho";
import type { OfflineDraft } from "@/lib/shakkho";

export type SaveState = "idle" | "saving" | "saved" | "queued" | "syncing" | "synced" | "error";

/**
 * Live auto-save: writes the draft to IndexedDB on every `payload` change.
 * - If network is offline → marks status=queued_offline.
 * - If online → runs SyncQueueService.tryDrain() after a short debounce.
 * - The returned state is reactive so a "● saved" indicator changes live.
 */
export function useDraftAutoSave(
  temporaryId: string,
  payload: () => Record<string, unknown>,
  deps: unknown[],
): { state: SaveState; lastSavedAt?: string; authoritativeAppId?: string } {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [appId, setAppId] = useState<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const net = NetworkConditionService.current();
    const isOffline = net.kind === "offline";

    setState("saving");
    const t = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        const draft: OfflineDraft = {
          id: temporaryId,
          temporaryId,
          payload: payload(),
          idempotencyKey: tempIdToIdempotencyKey(temporaryId),
          integrityDigest: "",
          chainDigest: "",
          confirmedFields: Object.keys(payload()),
          documentMetadata: [],
          consent: [],
          provenance: [],
          blobKeys: [],
          syncStatus: isOffline ? "queued_offline" : "ready_to_submit",
          retryCount: 0,
          localVersion: Date.now(),
          lastModified: now,
          networkProfile: net,
        };

        await OfflineStore.upsert(draft);

        if (isOffline) {
          setState("queued");
          setLastSavedAt(now);
          return;
        }

        // Online: try to drain after a short delay so the user can keep typing.
        setState("syncing");
        const status = await SyncQueueService.tryDrain(temporaryId);
        const fresh = await OfflineStore.get(temporaryId);
        if (fresh) {
          setLastSavedAt(fresh.lastModified);
          setAppId(fresh.authoritativeApplicationId);
        }
        if (status === "synced") setState("synced");
        else if (status === "queued_offline" || status === "retry_scheduled") setState("queued");
        else setState("error");
      } catch (err) {
        setState("error");
        void err;
      }
    }, 600);
    timer.current = t;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temporaryId, ...deps]);

  return { state, lastSavedAt, authoritativeAppId: appId };
}

/** Stable per-temporaryId idempotency key — same key for every retry. */
function tempIdToIdempotencyKey(temporaryId: string): string {
  // Lightweight deterministic hash so retries are idempotent.
  let h = 0x811c9dc5;
  for (let i = 0; i < temporaryId.length; i += 1) {
    h ^= temporaryId.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `idem-${temporaryId}-${h.toString(16).padStart(8, "0")}`;
}

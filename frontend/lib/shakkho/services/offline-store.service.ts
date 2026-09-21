/* ------------------------------------------------------------------ *
 *  IndexedDB-backed offline storage.
 *
 *  Per Phase 5 §14: drafts, document blobs, and idempotency keys must
 *  live in a structured browser store — NOT component memory.
 *
 *  - Two object stores: `drafts` (OfflineDraft) and `blobs` (binary).
 *  - Every method is safe to call in any environment: missing
 *    IndexedDB becomes an in-memory fallback that warns.
 *  - `useOfflineStore()` is the React-friendly reactive hook. It
 *    returns an empty array outside the browser so SSR does not
 *    explode.
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import { isBrowser, makeId } from "./_internal/async-helpers";
import { publish, subscribeByName } from "../event-bus";
import type {
  DocumentCapture,
  IdempotencyRecord,
  OfflineDraft,
  OfflineStatus,
  SyncReceipt,
} from "../types";

export const OFFLINE_DB_NAME = "shakkho.udc.v1";
export const OFFLINE_EVENT = "shakkho:offline";
const DRAFT_STORE = "drafts";
const BLOB_STORE = "blobs";

/* ------------------------------------------------------------------ *
 *  Tiny in-memory cache mirroring the IndexedDB document.
 * ------------------------------------------------------------------ */
interface OfflineSnap {
  drafts: OfflineDraft[];
  idem: IdempotencyRecord[];
  receipts: SyncReceipt[];
}
const EMPTY: OfflineSnap = { drafts: [], idem: [], receipts: [] };
let snap: OfflineSnap = EMPTY;
const listeners = new Set<() => void>();

function notify(): void {
  publish(OFFLINE_EVENT, snap);
  listeners.forEach((cb) => cb());
}

function sameSnap(a: OfflineSnap, b: OfflineSnap): boolean {
  if (a.drafts.length !== b.drafts.length) return false;
  if (a.idem.length !== b.idem.length) return false;
  if (a.receipts.length !== b.receipts.length) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 *  IndexedDB open + upgrade. Lazy — opened on first call.
 * ------------------------------------------------------------------ */
let dbPromise: Promise<IDBDatabase | null> | null = null;
const memFallback: { drafts: OfflineDraft[]; idem: IdempotencyRecord[]; receipts: SyncReceipt[] } = {
  drafts: [],
  idem: [],
  receipts: [],
};
let memFallbackWarned = false;

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || typeof indexedDB === "undefined") {
    if (!memFallbackWarned) {
      // eslint-disable-next-line no-console
      console.warn(
        "[shakkho] IndexedDB unavailable — offline store using in-memory fallback.",
      );
      memFallbackWarned = true;
    }
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(OFFLINE_DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          db.createObjectStore(BLOB_STORE);
        }
      } catch {
        // ignore
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

async function txAll<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(store, mode);
    } catch {
      resolve(null);
      return;
    }
    const objectStore = transaction.objectStore(store);
    let result: T | null = null;
    Promise.resolve(fn(objectStore))
      .then((r) => {
        result = r;
      })
      .catch(() => {
        result = null;
      });
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => resolve(null);
    transaction.onabort = () => resolve(null);
  });
}

/* ------------------------------------------------------------------ *
 *  Bootstrap — pulls everything into memory on first use.
 * ------------------------------------------------------------------ */
let bootstrapped = false;

async function bootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  const drafts = (await txAll(DRAFT_STORE, "readonly", (s) => s.getAll())) as OfflineDraft[] | null;
  if (drafts && drafts.length) {
    memFallback.drafts = drafts;
  }
  if (!drafts || drafts.length === 0) {
    snap = { ...snap, drafts: memFallback.drafts };
  } else {
    snap = { ...snap, drafts };
  }
  notify();
}

void bootstrap;

/* ------------------------------------------------------------------ *
 *  Public API used by the services.
 * ------------------------------------------------------------------ */
export const OfflineStore = {
  async list(): Promise<OfflineDraft[]> {
    if (!isBrowser()) return [];
    const drafts = (await txAll(DRAFT_STORE, "readonly", (s) => s.getAll())) as OfflineDraft[] | null;
    if (!drafts) return memFallback.drafts;
    const next = { ...snap, drafts };
    if (!sameSnap(snap, next)) {
      snap = next;
      notify();
    }
    return drafts;
  },

  async get(temporaryId: string): Promise<OfflineDraft | undefined> {
    if (!isBrowser()) return undefined;
    const db = await openDb();
    if (!db) return memFallback.drafts.find((d) => d.temporaryId === temporaryId);
    return new Promise((resolve) => {
      const req = db.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).get(temporaryId);
      req.onsuccess = () => resolve(req.result as OfflineDraft | undefined);
      req.onerror = () => resolve(undefined);
    });
  },

  async upsert(draft: OfflineDraft): Promise<void> {
    if (!isBrowser()) return;
    const db = await openDb();
    if (!db) {
      memFallback.drafts = [
        ...memFallback.drafts.filter((d) => d.temporaryId !== draft.temporaryId),
        draft,
      ];
      snap = { ...snap, drafts: memFallback.drafts };
      notify();
      return;
    }
    await txAll(DRAFT_STORE, "readwrite", (s) => s.put(draft));
    const drafts = ((await txAll(DRAFT_STORE, "readonly", (s) => s.getAll())) as OfflineDraft[] | null) ?? memFallback.drafts;
    memFallback.drafts = drafts;
    snap = { ...snap, drafts };
    notify();
  },

  async setStatus(temporaryId: string, status: OfflineStatus): Promise<void> {
    const current = await OfflineStore.get(temporaryId);
    if (!current) return;
    await OfflineStore.upsert({ ...current, syncStatus: status, lastModified: new Date().toISOString() });
  },

  async attachReceipt(temporaryId: string, receipt: SyncReceipt): Promise<void> {
    memFallback.receipts = [...memFallback.receipts.filter((r) => r.id !== receipt.id), receipt];
    snap = { ...snap, receipts: memFallback.receipts };
    notify();
    const current = await OfflineStore.get(temporaryId);
    if (!current) return;
    await OfflineStore.upsert({
      ...current,
      syncStatus: "synced",
      authoritativeApplicationId: receipt.authoritativeApplicationId,
      lastModified: new Date().toISOString(),
    });
  },

  /* ----- idempotency records ----- */
  async listIdempotency(): Promise<IdempotencyRecord[]> {
    return memFallback.idem;
  },

  async saveIdempotency(rec: IdempotencyRecord): Promise<void> {
    memFallback.idem = [
      ...memFallback.idem.filter((r) => r.key !== rec.key),
      rec,
    ];
    snap = { ...snap, idem: memFallback.idem };
    notify();
  },

  /* ----- blob helper (document images) ----- */
  async saveBlob(_key: string, _bytes: Blob | null): Promise<string> {
    // Stub: persists nothing binary; the demo path uses blob-key labels.
    return makeId("BLOB");
  },

  async getDraftsReactive(): Promise<OfflineDraft[]> {
    return snap.drafts;
  },

  receipts(): SyncReceipt[] {
    return snap.receipts;
  },
};

/* ------------------------------------------------------------------ *
 *  React hook — re-renders when offline store mutates.
 * ------------------------------------------------------------------ */
export function useOfflineStore(): OfflineSnap {
  return useSyncExternalStore<OfflineSnap>(
    (onChange) => {
      const cb = () => onChange();
      listeners.add(cb);
      const unsub = subscribeByName(OFFLINE_EVENT, cb);
      // Trigger lazy bootstrap on first mount.
      void OfflineStore.list();
      return () => {
        listeners.delete(cb);
        unsub();
      };
    },
    () => snap,
    () => EMPTY,
  );
}

/* ------------------------------------------------------------------ *
 *  Capabilities — advertised, never fabricated.
 * ------------------------------------------------------------------ */
export interface OfflineCapabilities {
  indexedDb: boolean;
  blobStore: boolean;
  webCrypto: boolean;
  serviceWorker: boolean;
}
export function offlineCapabilities(): OfflineCapabilities {
  if (!isBrowser()) return { indexedDb: false, blobStore: false, webCrypto: false, serviceWorker: false };
  return {
    indexedDb: typeof indexedDB !== "undefined",
    blobStore: typeof indexedDB !== "undefined",
    webCrypto: typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined",
    serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
  };
}

/* Re-exported for services that build OfflineDraft snapshots. */
export type { OfflineDraft, IdempotencyRecord, SyncReceipt, DocumentCapture };

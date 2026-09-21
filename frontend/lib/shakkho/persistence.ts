/* ------------------------------------------------------------------ *
 *  Owns the single localStorage key `shakkho.helpline.v1`.
 *
 *  - Safe JSON read/write (returns empty envelope on parse failure).
 *  - Debounced writes via `setTimeout(0)` so burst updates coalesce.
 *  - Server-side render returns an empty envelope without touching
 *    `window` — every helper is a no-op outside the browser.
 *
 *  No citizen or DLAO arrays are stored here; they keep their own
 *  state in `lib/case-demo.ts` and `components/role-dashboard.tsx`.
 * ------------------------------------------------------------------ */

import type { StoreEnvelope } from "./types";
import { publish, STORE_EVENT } from "./event-bus";

export const STORE_KEY = "shakkho.helpline.v1";

/* A single empty-envelope reference for the SSR snapshot. Returning a
   fresh `emptyEnvelope()` on every call would cause
   `useSyncExternalStore` to detect an unstable snapshot and throw an
   "infinite loop" warning. */
const EMPTY: StoreEnvelope = {
  v: 1,
  records: [],
  sessions: [],
  representations: [],
  verifications: [],
  handoffs: [],
  communications: [],
  audit: [],
  dlaoTasks: [],
  humanIntakes: [],
  dlaoVerifications: [],
  safeContactPlans: [],
};

function emptyEnvelope(): StoreEnvelope {
  return EMPTY;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function read(): StoreEnvelope {
  if (!isBrowser()) return emptyEnvelope();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw) as Partial<StoreEnvelope>;
    if (!parsed || parsed.v !== 1) return emptyEnvelope();
    return {
      v: 1,
      seededAt: typeof parsed.seededAt === "string" ? parsed.seededAt : undefined,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      representations: Array.isArray(parsed.representations)
        ? parsed.representations
        : [],
      verifications: Array.isArray(parsed.verifications) ? parsed.verifications : [],
      handoffs: Array.isArray(parsed.handoffs) ? parsed.handoffs : [],
      communications: Array.isArray(parsed.communications) ? parsed.communications : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      dlaoTasks: Array.isArray(parsed.dlaoTasks) ? parsed.dlaoTasks : [],
      activeCallBar: parsed.activeCallBar,
      humanIntakes: Array.isArray(parsed.humanIntakes) ? parsed.humanIntakes : [],
      dlaoVerifications: Array.isArray(parsed.dlaoVerifications)
        ? parsed.dlaoVerifications
        : [],
      safeContactPlans: Array.isArray(parsed.safeContactPlans)
        ? parsed.safeContactPlans
        : [],
      offlineDrafts: Array.isArray(parsed.offlineDrafts) ? parsed.offlineDrafts : undefined,
      syncConflicts: Array.isArray(parsed.syncConflicts) ? parsed.syncConflicts : undefined,
      integrityVerifications: Array.isArray(parsed.integrityVerifications)
        ? parsed.integrityVerifications
        : undefined,
      performanceMeasurements: Array.isArray(parsed.performanceMeasurements)
        ? parsed.performanceMeasurements
        : undefined,
      assistedIntakes: Array.isArray(parsed.assistedIntakes) ? parsed.assistedIntakes : undefined,
      idMappings: Array.isArray(parsed.idMappings) ? parsed.idMappings : undefined,
      pwaCapability: parsed.pwaCapability,
    };
  } catch {
    return emptyEnvelope();
  }
}

/* ------------------------------------------------------------------ *
 *  Module-level snapshot cache.
 *
 *  - `currentSnapshot` is what `getSnapshot` returns. We only swap the
 *    reference when something genuinely changed, so React's identity
 *    check stays happy.
 *  - `write(next)` updates the cache synchronously and schedules a
 *    debounced `localStorage.setItem` + `publish`. If `next` is
 *    referentially the same as the current snapshot (e.g. a no-op
 *    seed run), it short-circuits — that kills the infinite loop
 *    where `ensureSeeded` was firing a write → STORE_EVENT → onChange
 *    → re-render → effect re-fires write every render.
 * ------------------------------------------------------------------ */

let currentSnapshot: StoreEnvelope = EMPTY;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function shallowEqual(a: StoreEnvelope, b: StoreEnvelope): boolean {
  if (a === b) return true;
  if (a.seededAt !== b.seededAt) return false;
  const aList = a.records;
  const bList = b.records;
  if (aList.length !== bList.length) return false;
  if (a.sessions.length !== b.sessions.length) return false;
  if (a.representations.length !== b.representations.length) return false;
  if (a.verifications.length !== b.verifications.length) return false;
  if (a.handoffs.length !== b.handoffs.length) return false;
  if (a.communications.length !== b.communications.length) return false;
  if (a.audit.length !== b.audit.length) return false;
  if (a.dlaoTasks.length !== b.dlaoTasks.length) return false;
  if (a.activeCallBar !== b.activeCallBar) return false;
  if (a.humanIntakes.length !== b.humanIntakes.length) return false;
  if (a.dlaoVerifications.length !== b.dlaoVerifications.length) return false;
  if (a.safeContactPlans.length !== b.safeContactPlans.length) return false;
  return true;
}

export function write(next: StoreEnvelope): void {
  if (!isBrowser()) return;
  // Short-circuit if nothing actually changed. This stops the
  // seed-on-mount effect from re-publishing every render.
  if (shallowEqual(next, currentSnapshot)) return;
  currentSnapshot = next;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      publish(next);
    } catch {
      // storage quota / private mode — keep in-memory only
    }
  }, 0);
}

export function clear(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ *
 *  React hook — re-renders any panel when the store is mutated.
 *
 *  `getSnapshot` returns the SAME module-level reference between
 *  mutations, so React sees a stable value and does not loop.
 * ------------------------------------------------------------------ */
import { useSyncExternalStore } from "react";

export function useHelplineStore(): StoreEnvelope {
  return useSyncExternalStore<StoreEnvelope>(
    (onChange) => {
      function onStorage(event: StorageEvent) {
        if (event.key === STORE_KEY) {
          currentSnapshot = read();
          onChange();
        }
      }
      function onStoreEvent() {
        // The `write()` helper has already swapped `currentSnapshot`
        // by the time this fires. Just notify React.
        onChange();
      }
      window.addEventListener("storage", onStorage);
      window.addEventListener(STORE_EVENT, onStoreEvent as EventListener);
      // Initialise lazily on the client so the very first render
      // already has the seeded data instead of the empty fallback.
      if (currentSnapshot === EMPTY) {
        currentSnapshot = read();
      }
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(STORE_EVENT, onStoreEvent as EventListener);
      };
    },
    () => currentSnapshot,
    () => EMPTY,
  );
}

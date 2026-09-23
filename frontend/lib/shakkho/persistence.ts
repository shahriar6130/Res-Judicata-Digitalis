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
  referrals: [],
  sensitiveEvidence: { items: [], derivatives: [], grants: [], events: [] },
  authorityDirectory: [],
  legalBasis: [],
  routingRecommendations: [],
  deliveryOperations: [],
  escalationTasks: [],
  citizenSafeStatuses: [],
  demoTimeOffsetMs: 0,
  panelLawyers: [],
  lawyerAvailabilities: [],
  lawyerAssignments: [],
  lawyerAssignmentResponses: [],
  caseHearings: [],
  caseProgressUpdates: [],
  requiredUpdates: [],
  updateReminders: [],
  contactReliabilities: [],
  contactAttempts: [],
  lawyerChangeRequests: [],
  lawyerChangeReviews: [],
  reassignments: [],
  caseHandovers: [],
  inactivityPatterns: [],
  patternReviews: [],
  feeSchedules: [],
  paymentStages: [],
  paymentReconciliations: [],
  voiceStatusSessions: [],
  dlaoTaskItems: [],
};

function emptyEnvelope(): StoreEnvelope {
  return EMPTY;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/* UDC demo records that older builds seeded into this store. They are
   dropped on read so no browser keeps showing them. */
const LEGACY_UDC_DEMO = new Set(["OFF-NUCH-01", "OFF-RANG-02", "OFF-BAND-03"]);
const LEGACY_UDC_DEMO_IDS = new Set(["conf-nuch-01", "int-pass-01", "int-mis-02", "perf-light", "perf-normal", "ain-nuch"]);
function notDemo<T>(list: T[] | undefined): T[] | undefined {
  if (!Array.isArray(list)) return list;
  return list.filter((x) => {
    const r = x as { id?: string; temporaryId?: string; draftTemporaryId?: string };
    return !(
      (r.id && LEGACY_UDC_DEMO_IDS.has(r.id)) ||
      (r.temporaryId && LEGACY_UDC_DEMO.has(r.temporaryId)) ||
      (r.draftTemporaryId && LEGACY_UDC_DEMO.has(r.draftTemporaryId))
    );
  });
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
      offlineDrafts: Array.isArray(parsed.offlineDrafts) ? notDemo(parsed.offlineDrafts) : undefined,
      syncConflicts: Array.isArray(parsed.syncConflicts) ? notDemo(parsed.syncConflicts) : undefined,
      integrityVerifications: Array.isArray(parsed.integrityVerifications)
        ? notDemo(parsed.integrityVerifications)
        : undefined,
      performanceMeasurements: Array.isArray(parsed.performanceMeasurements)
        ? notDemo(parsed.performanceMeasurements)
        : undefined,
      assistedIntakes: Array.isArray(parsed.assistedIntakes) ? notDemo(parsed.assistedIntakes) : undefined,
      idMappings: Array.isArray(parsed.idMappings) ? notDemo(parsed.idMappings) : undefined,
      pwaCapability: parsed.pwaCapability,
      referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
      sensitiveEvidence: parsed.sensitiveEvidence ?? { items: [], derivatives: [], grants: [], events: [] },
      authorityDirectory: Array.isArray(parsed.authorityDirectory) ? parsed.authorityDirectory : [],
      legalBasis: Array.isArray(parsed.legalBasis) ? parsed.legalBasis : [],
      routingRecommendations: Array.isArray(parsed.routingRecommendations) ? parsed.routingRecommendations : [],
      deliveryOperations: Array.isArray(parsed.deliveryOperations) ? parsed.deliveryOperations : [],
      escalationTasks: Array.isArray(parsed.escalationTasks) ? parsed.escalationTasks : [],
      citizenSafeStatuses: Array.isArray(parsed.citizenSafeStatuses) ? parsed.citizenSafeStatuses : [],
      referralInbox: Array.isArray(parsed.referralInbox) ? parsed.referralInbox : undefined,
      escalationInbox: Array.isArray(parsed.escalationInbox) ? parsed.escalationInbox : undefined,
      deliveryInbox: Array.isArray(parsed.deliveryInbox) ? parsed.deliveryInbox : undefined,
      referralReminders: Array.isArray(parsed.referralReminders) ? parsed.referralReminders : undefined,
      demoTimeOffsetMs: typeof parsed.demoTimeOffsetMs === "number" ? parsed.demoTimeOffsetMs : 0,

      panelLawyers: Array.isArray(parsed.panelLawyers) ? parsed.panelLawyers : [],
      lawyerAvailabilities: Array.isArray(parsed.lawyerAvailabilities) ? parsed.lawyerAvailabilities : [],
      lawyerAssignments: Array.isArray(parsed.lawyerAssignments) ? parsed.lawyerAssignments : [],
      lawyerAssignmentResponses: Array.isArray(parsed.lawyerAssignmentResponses) ? parsed.lawyerAssignmentResponses : [],
      caseHearings: Array.isArray(parsed.caseHearings) ? parsed.caseHearings : [],
      caseProgressUpdates: Array.isArray(parsed.caseProgressUpdates) ? parsed.caseProgressUpdates : [],
      requiredUpdates: Array.isArray(parsed.requiredUpdates) ? parsed.requiredUpdates : [],
      updateReminders: Array.isArray(parsed.updateReminders) ? parsed.updateReminders : [],
      contactReliabilities: Array.isArray(parsed.contactReliabilities) ? parsed.contactReliabilities : [],
      contactAttempts: Array.isArray(parsed.contactAttempts) ? parsed.contactAttempts : [],
      lawyerChangeRequests: Array.isArray(parsed.lawyerChangeRequests) ? parsed.lawyerChangeRequests : [],
      lawyerChangeReviews: Array.isArray(parsed.lawyerChangeReviews) ? parsed.lawyerChangeReviews : [],
      reassignments: Array.isArray(parsed.reassignments) ? parsed.reassignments : [],
      caseHandovers: Array.isArray(parsed.caseHandovers) ? parsed.caseHandovers : [],
      inactivityPatterns: Array.isArray(parsed.inactivityPatterns) ? parsed.inactivityPatterns : [],
      patternReviews: Array.isArray(parsed.patternReviews) ? parsed.patternReviews : [],
      feeSchedules: Array.isArray(parsed.feeSchedules) ? parsed.feeSchedules : [],
      paymentStages: Array.isArray(parsed.paymentStages) ? parsed.paymentStages : [],
      paymentReconciliations: Array.isArray(parsed.paymentReconciliations) ? parsed.paymentReconciliations : [],
      voiceStatusSessions: Array.isArray(parsed.voiceStatusSessions) ? parsed.voiceStatusSessions : [],
      dlaoTaskItems: Array.isArray(parsed.dlaoTaskItems) ? parsed.dlaoTaskItems : [],
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
  if (a.records.length !== b.records.length) return false;
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
  if (a.referrals.length !== b.referrals.length) return false;
  if (a.escalationTasks.length !== b.escalationTasks.length) return false;
  if (a.deliveryOperations.length !== b.deliveryOperations.length) return false;
  if (a.lawyerAssignments.length !== b.lawyerAssignments.length) return false;
  if (a.caseHearings.length !== b.caseHearings.length) return false;
  if (a.caseProgressUpdates.length !== b.caseProgressUpdates.length) return false;
  if (a.requiredUpdates.length !== b.requiredUpdates.length) return false;
  if (a.contactAttempts.length !== b.contactAttempts.length) return false;
  if (a.lawyerChangeRequests.length !== b.lawyerChangeRequests.length) return false;
  if (a.inactivityPatterns.length !== b.inactivityPatterns.length) return false;
  if (a.paymentReconciliations.length !== b.paymentReconciliations.length) return false;
  if (a.voiceStatusSessions.length !== b.voiceStatusSessions.length) return false;
  if (a.dlaoTaskItems.length !== b.dlaoTaskItems.length) return false;
  if (a.demoTimeOffsetMs !== b.demoTimeOffsetMs) return false;
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

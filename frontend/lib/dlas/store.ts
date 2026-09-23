/* ------------------------------------------------------------------ *
 *  DLAS store — one localStorage key, one JSON document.
 *
 *    localStorage["dlas.db.v1"] = DlasDb (see schema.ts)
 *
 *  - Writes are SYNCHRONOUS so state survives an immediate reload or
 *    navigation (a juror can refresh and see the change).
 *  - Every mutation re-reads the latest JSON first, so two open tabs
 *    (e.g. USSD simulator + /debug) never overwrite each other.
 *  - Other tabs are notified through the native `storage` event;
 *    the current tab through a custom event.
 *  - Only `IntakeGateway` (and future workflow services) should call
 *    `mutate`. UI components read through `useDlasDb()`.
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import { SCHEMA_VERSION, type DlasDb } from "./schema";
import { demoUdcDirectory } from "./udc-directory";

export const DLAS_KEY = "dlas.db.v1";
const EVENT = "dlas:db-changed";

export function emptyDb(): DlasDb {
  return {
    v: 1,
    schemaVersion: SCHEMA_VERSION,
    counters: { application: 0, case: 0, auditSeq: 0 },
    citizens: [],
    udcOperators: [],
    officers: [],
    lawyers: [],
    lawyerRules: null,
    udcCentres: demoUdcDirectory(new Date(0).toISOString()),
    eligibilityRulesets: [],
    sessions: [],
    applications: [],
    tasks: [],
    outbox: [],
    otp: [],
    adminAudit: [],
    updatedAt: null,
  };
}

const EMPTY = emptyDb();
let snapshot: DlasDb = EMPTY;
let snapshotRaw: string | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function parse(raw: string | null): DlasDb {
  if (!raw) return emptyDb();
  try {
    const p = JSON.parse(raw) as Partial<DlasDb>;
    if (!p || p.v !== 1) return emptyDb();
    const base = emptyDb();
    return {
      ...base,
      ...p,
      counters: { ...base.counters, ...(p.counters ?? {}) },
      citizens: Array.isArray(p.citizens) ? p.citizens : [],
      udcOperators: Array.isArray(p.udcOperators) ? p.udcOperators : [],
      officers: Array.isArray(p.officers) ? p.officers : [],
      lawyers: Array.isArray(p.lawyers) ? p.lawyers.map((l) => ({ ...l, attendance: l.attendance ?? [], notificationsReadAt: l.notificationsReadAt ?? null, contacts: l.contacts ?? [] })) : [],
      lawyerRules: p.lawyerRules ?? null,
      // The demo UDC directory is written into the JSON on first read; it is saved with the next write.
      udcCentres: Array.isArray(p.udcCentres) && p.udcCentres.length ? p.udcCentres : demoUdcDirectory(new Date().toISOString()),
      eligibilityRulesets: Array.isArray(p.eligibilityRulesets) ? p.eligibilityRulesets : [],
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
      // Records written before Step 2 existed get the new fields as null.
      applications: Array.isArray(p.applications)
        ? p.applications.map((a) => ({
            ...a,
            review: a.review
              ? {
                  ...a.review,
                  identity: { ...a.review.identity, nid: a.review.identity.nid ?? { status: null, formatValid: null, simulatedRegistryCheck: null } },
                  verifiedAt: a.review.verifiedAt ?? null,
                  pathway: a.review.pathway ?? null,
                }
              : null,
            closedAt: a.closedAt ?? null,
            lawyer: a.lawyer
              ? {
                  ...a.lawyer,
                  access: a.lawyer.access ?? [],
                  shortlists: a.lawyer.shortlists ?? [],
                  completion: a.lawyer.completion ?? null,
                  hearings: a.lawyer.hearings.map((h) => ({ ...h, assignmentId: h.assignmentId ?? null, result: h.result ?? null })),
                  assignments: a.lawyer.assignments.map((s) => ({
                    ...s,
                    handoverFrom: s.handoverFrom ?? null,
                    reassignFlaggedAt: s.reassignFlaggedAt ?? null,
                    payment: s.payment ?? null,
                    ledger: s.ledger ?? { hearingsAttended: 0, hearingsMissed: 0, hearingsNotHeld: 0, hearingsUnreported: 0, updatesOnTime: 0, updatesLate: 0, updatedAt: s.offeredAt },
                  })),
                }
              : null,
          }))
        : [],
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      outbox: Array.isArray(p.outbox) ? p.outbox : [],
      otp: Array.isArray(p.otp) ? p.otp : [],
      adminAudit: Array.isArray(p.adminAudit) ? p.adminAudit : [],
    } as DlasDb;
  } catch {
    return emptyDb();
  }
}

/** Latest persisted state (always re-reads storage). */
export function readDb(): DlasDb {
  if (!isBrowser()) return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(DLAS_KEY);
  } catch {
    return snapshot;
  }
  if (raw === snapshotRaw && snapshot !== EMPTY) return snapshot;
  snapshotRaw = raw;
  snapshot = parse(raw);
  return snapshot;
}

export class StorageWriteError extends Error {}

function persist(next: DlasDb) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(DLAS_KEY, raw);
  } catch (e) {
    // Fail visibly — never pretend a write succeeded.
    throw new StorageWriteError(
      "Could not save to browser storage (quota full or private mode): " + String(e),
    );
  }
  snapshotRaw = raw;
  snapshot = next;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Apply a mutation to a fresh copy of the latest DB and persist it.
 * The mutator may return a value, which is passed back to the caller.
 */
export function mutate<T>(fn: (db: DlasDb) => T): T {
  if (!isBrowser()) throw new Error("DLAS store is browser-only");
  const draft = structuredClone(readDb());
  const result = fn(draft);
  draft.updatedAt = new Date().toISOString();
  persist(draft);
  return result;
}

export function resetDb(): void {
  if (!isBrowser()) return;
  persist(emptyDb());
}

export function exportDb(): string {
  return JSON.stringify(readDb(), null, 2);
}

export function importDb(json: string): void {
  const parsed = parse(json);
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Not a " + SCHEMA_VERSION + " export");
  }
  persist(parsed);
}

function subscribe(onChange: () => void) {
  function onStorage(e: StorageEvent) {
    if (e.key === DLAS_KEY || e.key === null) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

/** React hook — re-renders whenever the DLAS DB changes (any tab). */
export function useDlasDb(): DlasDb {
  return useSyncExternalStore(subscribe, readDb, () => EMPTY);
}

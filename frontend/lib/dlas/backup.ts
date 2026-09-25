"use client";

import { DLAS_KEY, exportDb } from "./store";
import { FILES_KEY } from "./files";
import { SCHEMA_VERSION, type DlasDb } from "./schema";

const FORMAT = "shakkho.admin-backup.v1";
const prefixes = ["dlas.", "shakkho.", "rjd."];
const owns = (key: string) => prefixes.some((prefix) => key.startsWith(prefix));

type Backup = {
  format: typeof FORMAT;
  exportedAt: string;
  storage: Record<string, string>;
};

export type BackupPreview = {
  exportedAt: string | null;
  applications: number;
  people: number;
  documents: number;
  keys: number;
  storage: Record<string, string>;
};

function validateDb(value: unknown): DlasDb {
  if (!value || typeof value !== "object") throw new Error("The shared record is missing.");
  const db = value as Partial<DlasDb>;
  if (db.v !== 1 || db.schemaVersion !== SCHEMA_VERSION) throw new Error("Unsupported shared-record version.");
  for (const field of ["citizens", "lawyers", "officers", "udcOperators", "udcCentres", "sessions", "applications", "tasks", "outbox", "otp"] as const) {
    if (!Array.isArray(db[field])) throw new Error(`The shared record has no valid ${field} list.`);
  }
  if (!db.counters || typeof db.counters !== "object") throw new Error("The shared record has no counters.");
  return db as DlasDb;
}

function validateFiles(raw: string | undefined): number {
  if (!raw) return 0;
  const files = JSON.parse(raw) as unknown;
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error("The document store is invalid.");
  for (const entry of Object.values(files)) {
    if (!entry || typeof entry !== "object" || typeof (entry as { dataUrl?: unknown }).dataUrl !== "string") {
      throw new Error("A stored document is invalid.");
    }
  }
  return Object.keys(files).length;
}

export function exportBackup(): string {
  const storage: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && owns(key)) storage[key] = window.localStorage.getItem(key) ?? "";
  }
  // A fresh browser has no persisted shared record yet.
  if (!storage[DLAS_KEY]) storage[DLAS_KEY] = exportDb();
  return JSON.stringify({ format: FORMAT, exportedAt: new Date().toISOString(), storage } satisfies Backup, null, 2);
}

export function previewBackup(json: string): BackupPreview {
  const parsed = JSON.parse(json) as unknown;
  let storage: Record<string, string>;
  let exportedAt: string | null = null;
  if (parsed && typeof parsed === "object" && (parsed as Partial<Backup>).format === FORMAT) {
    const bundle = parsed as Partial<Backup>;
    if (!bundle.storage || typeof bundle.storage !== "object" || Array.isArray(bundle.storage)) throw new Error("The backup has no storage map.");
    if (typeof bundle.exportedAt !== "string" || Number.isNaN(Date.parse(bundle.exportedAt))) throw new Error("The backup date is invalid.");
    exportedAt = bundle.exportedAt;
    storage = bundle.storage;
  } else {
    // The older /debug export was the shared-record JSON itself.
    validateDb(parsed);
    storage = { [DLAS_KEY]: JSON.stringify(parsed) };
  }
  if (Object.entries(storage).some(([key, value]) => !owns(key) || typeof value !== "string")) throw new Error("The backup contains an unsupported storage entry.");
  const db = validateDb(JSON.parse(storage[DLAS_KEY] ?? "null"));
  const documents = validateFiles(storage[FILES_KEY]);
  for (const [key, value] of Object.entries(storage)) {
    if (key === DLAS_KEY || key === FILES_KEY) continue;
    if ((key.startsWith("shakkho.") && key.endsWith(".v1")) || key.startsWith("rjd.intake.")) {
      const parsedValue = JSON.parse(value) as unknown;
      if (!parsedValue || typeof parsedValue !== "object") throw new Error(`Invalid saved data in ${key}.`);
    }
  }
  return {
    exportedAt,
    applications: db.applications.length,
    people: db.citizens.length + db.lawyers.length + db.officers.length + db.udcOperators.length,
    documents,
    keys: Object.keys(storage).length,
    storage,
  };
}

export function importBackup(preview: BackupPreview): void {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && owns(key)) keys.push(key);
  }
  const previous: Record<string, string | null> = {};
  for (const key of new Set([...keys, ...Object.keys(preview.storage)])) previous[key] = window.localStorage.getItem(key);
  try {
    for (const key of keys) window.localStorage.removeItem(key);
    for (const [key, value] of Object.entries(preview.storage)) window.localStorage.setItem(key, value);
  } catch (error) {
    for (const key of Object.keys(preview.storage)) window.localStorage.removeItem(key);
    for (const [key, value] of Object.entries(previous)) {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    }
    throw error;
  }
  // Notify the current page without reloading: callers may still need to await
  // an online flush of the restored DLAS snapshot before navigation is safe.
  window.dispatchEvent(new StorageEvent("storage", {
    key: DLAS_KEY,
    newValue: window.localStorage.getItem(DLAS_KEY),
    storageArea: window.localStorage,
  }));
}

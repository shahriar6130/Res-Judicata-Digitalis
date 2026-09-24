/* ------------------------------------------------------------------ *
 *  UDC LIGHT MODE — "text first, files later" on a weak network.
 *
 *  When the (simulated) network is slow, intermittent or offline:
 *    • the application TEXT is sent as usual (a few KB),
 *    • captured files (photos / PDFs) are HELD on this device — the record
 *      lists them as WILL_SUBMIT_LATER ("held on the UDC device"),
 *    • nothing big is pushed over the weak link.
 *  When the network is normal / reconnected again, held files upload
 *  automatically with a simulated progress bar (time ≈ size ÷ bandwidth),
 *  then UdcDoor.completeHeldUpload attaches them to the shared record.
 *
 *  Held bytes live in this browser's IndexedDB ("shakkho.udc.held.v1");
 *  the queue manifest lives in localStorage so every UDC screen sees it.
 *  Network and uploads are SIMULATED (NetworkConditionService).
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import { NetworkConditionService } from "./network-condition.service";
import { UdcDoor } from "../../dlas/door-bridges";
import { FileStore } from "../../dlas/files";
import type { NetworkProfile, NetworkProfileKind } from "../types";

export type HeldUpload = {
  id: string;
  temporaryId: string;
  docId: string;
  checklistItemId: string;
  label: string;
  sensitive: boolean;
  fileName: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  heldAt: string;
  heldBecause: NetworkProfileKind;
  status: "HELD" | "UPLOADING" | "SENT" | "FAILED";
  progress: number; // 0–100
  sentAt: string | null;
  attachedTo: "SESSION" | "APPLICATION" | null;
  error: string | null;
};

export type TextSend = { temporaryId: string; bytes: number; at: string; network: NetworkProfileKind; heldFiles: number; heldBytes: number };

const KEY = "shakkho.udc.lightmode.v1";
const EVENT = "shakkho:lightmode";
const DB = "shakkho.udc.held.v1";
const STORE = "files";
const WEAK: NetworkProfileKind[] = ["slow", "intermittent", "offline"];

type State = { uploads: HeldUpload[]; lastText: TextSend | null };
const EMPTY: State = { uploads: [], lastText: null };
let cache: State | null = null;

const isBrowser = () => typeof window !== "undefined";
function read(): State {
  if (!isBrowser()) return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as State) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}
function write(next: State) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — the in-memory copy still drives the UI */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}
function patch(id: string, p: Partial<HeldUpload>) {
  const s = read();
  write({ ...s, uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...p } : u)) });
}

/* ---------- device-side byte store (IndexedDB) ---------- */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function putBytes(id: string, blob: Blob) {
  const db = await openDb();
  if (!db) throw new Error("This device cannot keep the file (no IndexedDB)");
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function getBytes(id: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  const blob = await new Promise<Blob | null>((res) => {
    const q = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    q.onsuccess = () => res((q.result as Blob) ?? null);
    q.onerror = () => res(null);
  });
  db.close();
  return blob;
}
async function dropBytes(id: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((res) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
  db.close();
}

async function sha256(blob: Blob): Promise<string | null> {
  try {
    const h = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/* ---------- public API ---------- */

let flushing = false;

export const LightMode = {
  /** Weak network → text only; files wait on the device. */
  active(p: NetworkProfile = NetworkConditionService.current()): boolean {
    return WEAK.includes(p.kind);
  },

  /** Size of what is actually sent as text (the JSON body). */
  textBytes(payload: unknown): number {
    try {
      return new Blob([JSON.stringify(payload)]).size;
    } catch {
      return 0;
    }
  },

  /** Keep a captured file on this device instead of sending it now. */
  async hold(input: { temporaryId: string; docId: string; checklistItemId: string; label: string; sensitive: boolean; file: File }): Promise<HeldUpload> {
    const id = `HLD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await putBytes(id, input.file);
    const u: HeldUpload = {
      id,
      temporaryId: input.temporaryId,
      docId: input.docId,
      checklistItemId: input.checklistItemId,
      label: input.label,
      sensitive: input.sensitive,
      fileName: input.file.name,
      mime: input.file.type || "application/octet-stream",
      bytes: input.file.size,
      sha256: await sha256(input.file),
      heldAt: new Date().toISOString(),
      heldBecause: NetworkConditionService.current().kind,
      status: "HELD",
      progress: 0,
      sentAt: null,
      attachedTo: null,
      error: null,
    };
    const s = read();
    write({ ...s, uploads: [...s.uploads, u] });
    return u;
  },

  /** Record that the text of an application went out (shown in the light-mode banner). */
  noteTextSent(temporaryId: string, payload: unknown) {
    const s = read();
    const held = s.uploads.filter((u) => u.temporaryId === temporaryId && u.status !== "SENT");
    write({ ...s, lastText: { temporaryId, bytes: LightMode.textBytes(payload), at: new Date().toISOString(), network: NetworkConditionService.current().kind, heldFiles: held.length, heldBytes: held.reduce((n, u) => n + u.bytes, 0) } });
  },

  list(): HeldUpload[] {
    return read().uploads;
  },

  /** Upload every held file — only when the network is good. Simulated progress ≈ size ÷ bandwidth. */
  async flush(): Promise<number> {
    if (flushing || LightMode.active()) return 0;
    flushing = true;
    let sent = 0;
    try {
      for (const u of read().uploads.filter((x) => x.status === "HELD" || x.status === "FAILED")) {
        if (LightMode.active()) break; // the link got weak again — stop, keep the rest held
        patch(u.id, { status: "UPLOADING", progress: 0, error: null });
        const bps = Math.max(64_000, NetworkConditionService.current().bandwidthBps);
        const ms = Math.min(6000, Math.max(1200, ((u.bytes * 8) / bps) * 1000));
        const steps = 12;
        let dropped = false;
        for (let i = 1; i <= steps; i += 1) {
          await new Promise((r) => setTimeout(r, ms / steps));
          if (LightMode.active()) {
            dropped = true;
            break;
          }
          patch(u.id, { progress: Math.round((i / steps) * 100) });
        }
        if (dropped) {
          patch(u.id, { status: "HELD", progress: 0, error: "connection dropped during upload — will retry" });
          break;
        }
        try {
          const blob = await getBytes(u.id);
          if (!blob) throw new Error("the held file is no longer on this device");
          const preview = await FileStore.put(u.docId, blob, u.mime);
          const where = UdcDoor.completeHeldUpload(u.temporaryId, { docId: u.docId, checklistItemId: u.checklistItemId, label: u.label, sensitive: u.sensitive }, { name: u.fileName, type: u.mime, size: u.bytes, sha256: u.sha256, heldAt: u.heldAt, heldBecause: u.heldBecause }, preview);
          await dropBytes(u.id);
          patch(u.id, { status: "SENT", progress: 100, sentAt: new Date().toISOString(), attachedTo: where });
          sent += 1;
        } catch (e) {
          patch(u.id, { status: "FAILED", error: e instanceof Error ? e.message : String(e) });
        }
      }
    } finally {
      flushing = false;
    }
    return sent;
  },

  clearSent() {
    const s = read();
    write({ ...s, uploads: s.uploads.filter((u) => u.status !== "SENT") });
  },

  subscribe(cb: () => void): () => void {
    if (!isBrowser()) return () => {};
    const h = () => {
      cache = null;
      cb();
    };
    window.addEventListener(EVENT, cb);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener("storage", h);
    };
  },

  snapshot(): State {
    return read();
  },
};

/** Auto-upload when the (simulated) connection comes back. Installed once per browser tab. */
let autoInstalled = false;
export function installLightModeAutoFlush() {
  if (autoInstalled || !isBrowser()) return;
  autoInstalled = true;
  NetworkConditionService.subscribe((p) => {
    if (!WEAK.includes(p.kind) && read().uploads.some((u) => u.status === "HELD" || u.status === "FAILED")) void LightMode.flush();
  });
}

export function useLightMode(): State {
  return useSyncExternalStore(LightMode.subscribe, LightMode.snapshot, () => EMPTY);
}

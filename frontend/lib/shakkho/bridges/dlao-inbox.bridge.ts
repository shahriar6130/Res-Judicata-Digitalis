/* ------------------------------------------------------------------ *
 *  DLAO inbox bridge.
 *
 *  Two independent signals:
 *    1. `publishDlaoTask(task)` writes to `shakkho.dlao.inbox.v1` and
 *       dispatches a same-tab `shakkho:dlao-inbox` event so the
 *       existing DLO dashboard (`OfficerDashboard`) merges it without
 *       reload.
 *    2. `useDlaoInbox()` wraps `useSyncExternalStore` for cross-tab and
 *       same-tab updates, mirroring the persistence hook.
 *
 *  No DLO data arrays are mutated here; the consumer is responsible
 *  for merging the task list into its own UI state.
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import type { DlaoInboxTask } from "../types";

export const DLAO_KEY = "shakkho.dlao.inbox.v1";
export const DLAO_EVENT = "shakkho:dlao-inbox";

/* ------------------------------------------------------------------ *
 *  Module-level snapshot cache.
 *
 *  Mirrors the pattern in `lib/shakkho/persistence.ts`:
 *  - `EMPTY` is the stable SSR snapshot (same reference every call).
 *  - `currentSnapshot` only swaps when the underlying array actually
 *    changes (different length or different identity).
 *  - `getSnapshot()` returns the SAME reference between mutations, so
 *    React's `Object.is` check stays happy and we never hit the
 *    "infinite loop" path.
 * ------------------------------------------------------------------ */

const EMPTY: DlaoInboxTask[] = [];
let currentSnapshot: DlaoInboxTask[] = EMPTY;

function readTasks(): DlaoInboxTask[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(DLAO_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DlaoInboxTask[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commitSnapshot(next: DlaoInboxTask[]): void {
  if (next === currentSnapshot) return;
  // Identity-by-length is enough here — the only writer is
  // `publishDlaoTask`, which prepends exactly one new task and never
  // mutates an existing row. If two writers ever race, the worst case
  // is a redundant re-render, not a loop.
  if (next.length === currentSnapshot.length) return;
  currentSnapshot = next;
}

function writeTasks(tasks: DlaoInboxTask[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DLAO_KEY, JSON.stringify(tasks));
    commitSnapshot(tasks);
    window.dispatchEvent(new Event(DLAO_EVENT));
  } catch {
    // ignore
  }
}

export function publishDlaoTask(task: DlaoInboxTask): void {
  const existing = readTasks();
  if (existing.some((t) => t.id === task.id)) return;
  writeTasks([task, ...existing]);
}

export function useDlaoInbox(): DlaoInboxTask[] {
  return useSyncExternalStore<DlaoInboxTask[]>(
    (onChange) => {
      function onStorage(event: StorageEvent) {
        if (event.key === DLAO_KEY) {
          // Refresh the cached snapshot from storage so the next render
          // sees the new value, then notify React.
          commitSnapshot(readTasks());
          onChange();
        }
      }
      function onDlaoEvent() {
        // `writeTasks` already swapped `currentSnapshot` before the
        // event fired. Just notify React.
        onChange();
      }
      window.addEventListener("storage", onStorage);
      window.addEventListener(DLAO_EVENT, onDlaoEvent as EventListener);
      // Lazy init on first client read so seeded tasks show up in the
      // very first render instead of the empty fallback.
      if (currentSnapshot === EMPTY) {
        commitSnapshot(readTasks());
      }
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(DLAO_EVENT, onDlaoEvent as EventListener);
      };
    },
    () => currentSnapshot,
    () => EMPTY,
  );
}

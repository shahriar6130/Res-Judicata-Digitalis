/* ------------------------------------------------------------------ *
 *  Referral inbox bridge — mirrors a referral-inbox projection into
 *  localStorage so the receiving-office dashboard updates without
 *  having to re-read the full envelope.
 *
 *  Mirrors the existing dlao-inbox.bridge.ts shape.
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import type { ReferralInboxItem } from "../types";

const KEY = "shakkho.referrals.inbox.v1";
const EVENT = "shakkho:referral-inbox";

function read(): ReferralInboxItem[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed as ReferralInboxItem[];
  } catch {
    return EMPTY;
  }
}

const EMPTY: ReferralInboxItem[] = [];

let current: ReferralInboxItem[] = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function publishReferralInboxItem(item: ReferralInboxItem): void {
  if (typeof window === "undefined") return;
  const list = read();
  if (list.some((i) => i.itemId === item.itemId)) return;
  const next = [item, ...list];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  current = next;
  emit();
}

export function clearReferralInbox(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  current = EMPTY;
  emit();
}

export function useReferralInbox(): ReferralInboxItem[] {
  return useSyncExternalStore<ReferralInboxItem[]>(
    (onChange) => {
      function onStorage(e: StorageEvent) {
        if (e.key === KEY) {
          current = read();
          onChange();
        }
      }
      function onLocal() {
        current = read();
        onChange();
      }
      window.addEventListener("storage", onStorage);
      window.addEventListener(EVENT, onLocal as EventListener);
      listeners.add(onChange);
      if (current === EMPTY) current = read();
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(EVENT, onLocal as EventListener);
        listeners.delete(onChange);
      };
    },
    () => current,
    () => EMPTY,
  );
}

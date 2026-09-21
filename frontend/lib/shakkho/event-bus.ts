/* ------------------------------------------------------------------ *
 *  Tiny pub/sub used by services + the DLAO bridge. Listeners receive
 *  a shallow snapshot of the store envelope so a panel that only cares
 *  about one slice can re-render without rebuilding everything.
 *
 *  Same-tab subscribers receive `eventName` events; cross-tab updates
 *  piggyback on the existing `storage` event so a switch between
 *  helpline and DLAO dashboards shows fresh handoff tasks.
 *
 *  Phase 5 services additionally publish typed events keyed by event
 *  name. Subscribers receive the payload directly.
 * ------------------------------------------------------------------ */

import type { StoreEnvelope } from "./types";

export const STORE_EVENT = "shakkho:helpline-store";

type Listener = (snapshot: StoreEnvelope) => void;

const listeners = new Set<Listener>();
let current: StoreEnvelope | null = null;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publish(snapshot: StoreEnvelope): void;
export function publish(eventName: string, payload: unknown): void;
export function publish(arg1: string | StoreEnvelope, arg2?: unknown): void {
  if (typeof arg1 === "string") {
    const eventName = arg1;
    const payload = arg2;
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
    } catch {
      // ignore
    }
    return;
  }
  current = arg1;
  listeners.forEach((listener) => listener(arg1));
}

export function snapshot(): StoreEnvelope | null {
  return current;
}

/* ------------------------------------------------------------------ *
 *  Generic subscribe-by-event-name helper used by Phase 5 services.
 *  Returns an unsubscribe function.
 * ------------------------------------------------------------------ */
type GenericListener = (payload: unknown) => void;
const namedListeners = new Map<string, Set<GenericListener>>();

export function subscribeByName(eventName: string, cb: GenericListener): () => void {
  let bucket = namedListeners.get(eventName);
  if (!bucket) {
    bucket = new Set();
    namedListeners.set(eventName, bucket);
  }
  bucket.add(cb);
  if (typeof window !== "undefined") {
    const handler = (event: Event) => {
      const ce = event as CustomEvent;
      cb(ce.detail);
    };
    window.addEventListener(eventName, handler as EventListener);
    return () => {
      bucket?.delete(cb);
      window.removeEventListener(eventName, handler as EventListener);
    };
  }
  return () => {
    bucket?.delete(cb);
  };
}

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_EVENT = void 0;
exports.subscribe = subscribe;
exports.publish = publish;
exports.snapshot = snapshot;
exports.subscribeByName = subscribeByName;
exports.STORE_EVENT = "shakkho:helpline-store";
const listeners = new Set();
let current = null;
function subscribe(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
function publish(arg1, arg2) {
    if (typeof arg1 === "string") {
        const eventName = arg1;
        const payload = arg2;
        if (typeof window === "undefined")
            return;
        try {
            window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
        }
        catch {
            // ignore
        }
        return;
    }
    current = arg1;
    listeners.forEach((listener) => listener(arg1));
}
function snapshot() {
    return current;
}
const namedListeners = new Map();
function subscribeByName(eventName, cb) {
    let bucket = namedListeners.get(eventName);
    if (!bucket) {
        bucket = new Set();
        namedListeners.set(eventName, bucket);
    }
    bucket.add(cb);
    if (typeof window !== "undefined") {
        const handler = (event) => {
            const ce = event;
            cb(ce.detail);
        };
        window.addEventListener(eventName, handler);
        return () => {
            bucket?.delete(cb);
            window.removeEventListener(eventName, handler);
        };
    }
    return () => {
        bucket?.delete(cb);
    };
}

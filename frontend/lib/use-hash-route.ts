"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ *
 *  Generalised hash navigation hook.
 *
 *  Background: Next.js <Link> short-circuits same-pathname-hash
 *  navigation to a scroll-into-view and does NOT fire `hashchange`.
 *  A click handler that writes `window.location.hash = itemHash` from
 *  inside an event handler is blocked by `react-hooks/immutability`,
 *  and doing the same work inside a useEffect after `setState` is
 *  blocked by `react-hooks/set-state-in-effect`. So we wrap the same
 *  ref + commitTick dance the sidebar already uses, expose a single
 *  `navigate()` callback, and keep the actual mutation inside an
 *  effect that runs after the commit tick.
 *
 *  Usage:
 *    const { navigate } = useHashRoute();
 *    navigate("#cases/SHK-DEMO-007");
 * ------------------------------------------------------------------ */

export type HashRouter = {
  /**
   * Push a new fragment to the URL. Pass either `"complaint"` or
   * `"#complaint"` — the leading `#` is normalised. If the new hash
   * is identical to the current one, a synthetic `hashchange` is
   * dispatched so subscribers re-fire (handles re-clicking the same
   * case / notification).
   */
  navigate: (hash: string) => void;
  /**
   * The current hash with the leading `#` removed. Empty string if
   * none. Updates whenever `hashchange` fires.
   */
  current: string;
};

export function useHashRoute(): HashRouter {
  const pendingRef = useRef<string | null>(null);
  const [commitTick, setCommitTick] = useState(0);
  const [current, setCurrent] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, ""),
  );

  // Commit effect — performs the actual `window.location.hash` write.
  useEffect(() => {
    const desired = pendingRef.current;
    if (!desired) return;
    pendingRef.current = null;
    const normalised = desired.replace(/^#/, "");
    const now = window.location.hash.replace(/^#/, "");
    if (now === normalised) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = normalised;
    }
  }, [commitTick]);

  // Track the current hash so callers can render reactively without
  // reading window.location directly.
  useEffect(() => {
    function sync() {
      setCurrent(window.location.hash.replace(/^#/, ""));
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((hash: string) => {
    pendingRef.current = hash;
    setCommitTick((n) => n + 1);
  }, []);

  return { navigate, current };
}
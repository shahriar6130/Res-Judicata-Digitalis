"use client";

/* ------------------------------------------------------------------ *
 *  UDC operator accounts — prototype sign-up / login.
 *
 *    Sign up : name + mobile + UDC centre + district → dlas.db.v1.udcOperators
 *    Log in  : mobile number only (no password, by design for the demo)
 *
 *  The logged-in operator is kept per browser in
 *  localStorage["dlas.udc.current"]; its operatorId is stamped on every
 *  assisted application (filedBy.operatorId) and audit entry.
 * ------------------------------------------------------------------ */


import { useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DISTRICTS, normalizePhone } from "./reference";
import type { DistrictCode, UdcOperatorAccount } from "./schema";

const CURRENT_KEY = "dlas.udc.current";

function setCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
    window.dispatchEvent(new CustomEvent("dlas:db-changed"));
  } catch {
    /* storage unavailable */
  }
}

export type UdcAuthResult =
  | { ok: true; account: UdcOperatorAccount }
  | { ok: false; error: "INVALID_NAME" | "INVALID_PHONE" | "INVALID_CENTRE" | "INVALID_DISTRICT" | "PHONE_TAKEN" | "NOT_FOUND" };

export const UdcAuth = {
  signUp(input: { name: string; phone: string; centre: string; district: string }): UdcAuthResult {
    const phone = normalizePhone(input.phone);
    if (input.name.trim().length < 2) return { ok: false, error: "INVALID_NAME" };
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    if (input.centre.trim().length < 2) return { ok: false, error: "INVALID_CENTRE" };
    if (!DISTRICTS.some((d) => d.code === input.district)) return { ok: false, error: "INVALID_DISTRICT" };
    if (readDb().udcOperators.some((o) => o.phone === phone)) return { ok: false, error: "PHONE_TAKEN" };
    const account = mutate((db) => {
      const now = new Date().toISOString();
      db.counters.auditSeq += 1;
      const a: UdcOperatorAccount = {
        operatorId: "UDC-" + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0"),
        name: input.name.trim(),
        phone,
        centre: input.centre.trim(),
        district: input.district as DistrictCode,
        createdAt: now,
        lastLoginAt: now,
        audit: [{ seq: db.counters.auditSeq, at: now, actor: "udc_operator", role: "udc_operator", action: "udc.signed_up", detail: { phone } }],
      };
      db.udcOperators.push(a);
      // The operator's real centre joins the directory citizens see.
      db.udcCentres.push({
        centreId: `UDCC-${a.operatorId}`,
        name: { bn: a.centre, en: a.centre },
        area: { bn: a.centre, en: a.centre },
        district: a.district,
        hours: { bn: "কেন্দ্রের সময় অনুযায়ী", en: "As per centre hours" },
        services: ["ASSISTED_APPLICATION", "DOCUMENT_SCAN", "STATUS_CHECK"],
        source: "REGISTERED_OPERATOR",
        operatorId: a.operatorId,
        createdAt: now,
      });
      return a;
    });
    setCurrent(account.operatorId);
    return { ok: true, account };
  },

  login(rawPhone: string): UdcAuthResult {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const found = readDb().udcOperators.find((o) => o.phone === phone);
    if (!found) return { ok: false, error: "NOT_FOUND" };
    const account = mutate((db) => {
      const a = db.udcOperators.find((o) => o.operatorId === found.operatorId)!;
      const now = new Date().toISOString();
      db.counters.auditSeq += 1;
      a.lastLoginAt = now;
      a.audit.push({ seq: db.counters.auditSeq, at: now, actor: a.operatorId, role: "udc_operator", action: "udc.logged_in" });
      return a;
    });
    setCurrent(account.operatorId);
    return { ok: true, account };
  },

  current(): UdcOperatorAccount | undefined {
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(CURRENT_KEY);
    } catch {
      return undefined;
    }
    return id ? readDb().udcOperators.find((o) => o.operatorId === id) : undefined;
  },

  logout() {
    setCurrent(null);
  },
};

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("dlas:db-changed", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("dlas:db-changed", cb);
  };
}
function currentId() {
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

/** The logged-in UDC operator (undefined when logged out / during SSR). */
export function useCurrentUdcOperator(): UdcOperatorAccount | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.udcOperators.find((o) => o.operatorId === id) : undefined;
}

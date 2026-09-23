/* ------------------------------------------------------------------ *
 *  Citizen accounts — prototype sign-up / login.
 *
 *    Sign up : name + mobile number  → CitizenAccount in dlas.db.v1
 *    Log in  : mobile number only (no password, by design for the demo)
 *
 *  The logged-in citizen id is kept per browser in
 *  localStorage["dlas.citizen.current"]. The application itself still
 *  verifies the phone by OTP (simulated SMS) before submitting.
 * ------------------------------------------------------------------ */

import { mutate, readDb } from "./store";
import { normalizePhone } from "./reference";
import type { CitizenAccount } from "./schema";

const CURRENT_KEY = "dlas.citizen.current";

function rid() {
  return "CIT-" + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
}

function setCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
    window.dispatchEvent(new CustomEvent("dlas:db-changed"));
  } catch {
    /* storage unavailable */
  }
}

export type AuthResult = { ok: true; account: CitizenAccount } | { ok: false; error: "INVALID_NAME" | "INVALID_PHONE" | "PHONE_TAKEN" | "NOT_FOUND" };

export const CitizenAuth = {
  signUp(name: string, rawPhone: string): AuthResult {
    const phone = normalizePhone(rawPhone);
    if (name.trim().length < 2) return { ok: false, error: "INVALID_NAME" };
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    if (readDb().citizens.some((c) => c.phone === phone)) return { ok: false, error: "PHONE_TAKEN" };
    const account = mutate((db) => {
      const now = new Date().toISOString();
      db.counters.auditSeq += 1;
      const a: CitizenAccount = {
        citizenId: rid(),
        name: name.trim(),
        phone,
        createdAt: now,
        lastLoginAt: now,
        notificationsReadAt: null,
        audit: [{ seq: db.counters.auditSeq, at: now, actor: "applicant", role: "applicant", action: "citizen.signed_up", detail: { phone } }],
      };
      db.citizens.push(a);
      return a;
    });
    setCurrent(account.citizenId);
    return { ok: true, account };
  },

  login(rawPhone: string): AuthResult {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const found = readDb().citizens.find((c) => c.phone === phone);
    if (!found) return { ok: false, error: "NOT_FOUND" };
    const account = mutate((db) => {
      const a = db.citizens.find((c) => c.citizenId === found.citizenId)!;
      const now = new Date().toISOString();
      db.counters.auditSeq += 1;
      a.lastLoginAt = now;
      a.audit.push({ seq: db.counters.auditSeq, at: now, actor: "applicant", role: "applicant", action: "citizen.logged_in" });
      return a;
    });
    setCurrent(account.citizenId);
    return { ok: true, account };
  },

  current(): CitizenAccount | undefined {
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(CURRENT_KEY);
    } catch {
      return undefined;
    }
    return id ? readDb().citizens.find((c) => c.citizenId === id) : undefined;
  },

  /** "Mark all as read" — stored on the account so it survives reload. */
  markNotificationsRead(citizenId: string) {
    mutate((db) => {
      const a = db.citizens.find((c) => c.citizenId === citizenId);
      if (a) a.notificationsReadAt = new Date().toISOString();
    });
  },

  /** Ends the session on this browser. Saved accounts and applications stay. */
  logout() {
    setCurrent(null);
    try {
      // The unfinished wizard session pointer belongs to the account that left.
      window.localStorage.removeItem("dlas.active.WEB_PORTAL");
    } catch {
      /* ignore */
    }
  },
};

"use client";

/* ------------------------------------------------------------------ *
 *  DLO office staff (/dlo-stuff).
 *
 *  Staff work inside a District Legal Aid Office. They can:
 *    • see the office's INCOMING cases (not yet decided), and
 *    • check the applicant's STORY (is it clear, does the problem type
 *      match, is the other party named, do urgency signals fit).
 *  They cannot see documents, NID, phone / safe-contact details, the
 *  officer's review, eligibility or decisions — the read model below only
 *  exposes story fields. The staff check is advisory: the officer still
 *  verifies and decides (it shows as "Staff pre-check" in the DLO queue).
 *
 *  Stored in localStorage["dlas.db.v1"]:
 *    db.officeStaff[]            accounts (sign-up / login by phone)
 *    application.staffCheck      latest check + history; audited on the case
 * ------------------------------------------------------------------ */

import { useMemo, useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DISTRICTS, normalizePhone } from "./reference";
import type { ApplicationRecord, AuditEntry, DistrictCode, DlasDb, OfficeStaffAccount, StaffStoryCheck, StoryCheckKey } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

export const STORY_CHECKS: { key: StoryCheckKey; label: { bn: string; en: string } }[] = [
  { key: "STORY_CLEAR", label: { bn: "ঘটনার বিবরণ পরিষ্কার ও যথেষ্ট", en: "The story is clear and complete enough to act on" } },
  { key: "CATEGORY_MATCHES", label: { bn: "সমস্যার ধরন বিবরণের সাথে মেলে", en: "The problem type matches the story" } },
  { key: "OTHER_PARTY", label: { bn: "অপর পক্ষ চিহ্নিত", en: "The other party is identified" } },
  { key: "URGENCY_CONSISTENT", label: { bn: "জরুরি / নিরাপত্তা সংকেত বিবরণের সাথে মেলে", en: "Urgency / safety signals fit the story" } },
];

/* ------------------------------ accounts ------------------------------ */

const CURRENT_KEY = "dlas.staff.current";

function setCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
    window.dispatchEvent(new CustomEvent("dlas:db-changed"));
  } catch {
    /* storage unavailable */
  }
}

export type StaffAuthResult = { ok: true; account: OfficeStaffAccount } | { ok: false; error: "INVALID_NAME" | "INVALID_PHONE" | "INVALID_DISTRICT" | "PHONE_TAKEN" | "NOT_FOUND" };

export const StaffAuth = {
  signUp(input: { name: string; phone: string; district: string }): StaffAuthResult {
    const phone = normalizePhone(input.phone);
    if (input.name.trim().length < 2) return { ok: false, error: "INVALID_NAME" };
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    if (!DISTRICTS.some((d) => d.code === input.district)) return { ok: false, error: "INVALID_DISTRICT" };
    if (readDb().officeStaff.some((x) => x.phone === phone)) return { ok: false, error: "PHONE_TAKEN" };
    const account = mutate((db) => {
      const a: OfficeStaffAccount = { staffId: rid("STF"), name: input.name.trim(), phone, district: input.district as DistrictCode, createdAt: now(), lastLoginAt: now(), audit: [] };
      audit(db, a.audit, { actor: a.staffId, role: "dlo_staff", action: "staff.signed_up", detail: { district: a.district } });
      db.officeStaff.push(a);
      return a;
    });
    setCurrent(account.staffId);
    return { ok: true, account };
  },

  login(rawPhone: string): StaffAuthResult {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const found = readDb().officeStaff.find((x) => x.phone === phone);
    if (!found) return { ok: false, error: "NOT_FOUND" };
    const account = mutate((db) => {
      const a = db.officeStaff.find((x) => x.staffId === found.staffId)!;
      a.lastLoginAt = now();
      audit(db, a.audit, { actor: a.staffId, role: "dlo_staff", action: "staff.logged_in" });
      return a;
    });
    setCurrent(account.staffId);
    return { ok: true, account };
  },

  current(): OfficeStaffAccount | undefined {
    try {
      const id = window.localStorage.getItem(CURRENT_KEY);
      return id ? readDb().officeStaff.find((x) => x.staffId === id) : undefined;
    } catch {
      return undefined;
    }
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

export function useCurrentStaff(): OfficeStaffAccount | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.officeStaff.find((x) => x.staffId === id) : undefined;
}

/* ------------------------------ read model (story only) ------------------------------ */

/** What staff are allowed to see — no documents, NID, phone, safe contact, review or decision. */
export type StaffCaseView = {
  applicationId: string;
  submittedAt: string;
  channel: string;
  district: DistrictCode | null;
  applicantName: string | null;
  filedBy: "SELF" | "REPRESENTATIVE" | "UDC_OPERATOR" | "HELPLINE_AGENT" | string;
  category: ApplicationRecord["data"]["matter"]["category"];
  summary: string | null;
  summaryOriginal: string | null;
  opposingParty: string | null;
  incidentDate: string | null;
  urgencyFlags: string[];
  selfReportedUrgent: boolean;
  officeStage: "NEW" | "WITH_OFFICER";
  staffCheck: StaffStoryCheck | null;
};

function toView(a: ApplicationRecord): StaffCaseView {
  return {
    applicationId: a.applicationId,
    submittedAt: a.submittedAt,
    channel: a.channel.code,
    district: a.data.applicant.district,
    applicantName: a.data.applicant.fullName,
    filedBy: a.data.filedBy.kind,
    category: a.data.matter.category,
    summary: a.data.matter.summary,
    summaryOriginal: a.data.matter.summaryOriginal,
    opposingParty: a.data.matter.opposingParty,
    incidentDate: a.data.matter.incidentDate,
    urgencyFlags: [...a.data.urgency.flags],
    selfReportedUrgent: a.data.urgency.selfReportedUrgent,
    officeStage: a.review ? "WITH_OFFICER" : "NEW",
    staffCheck: a.staffCheck ?? null,
  };
}

/** Incoming = in this office's district and not yet decided by the officer. */
function incoming(a: ApplicationRecord, s: OfficeStaffAccount) {
  return a.data.applicant.district === s.district && !a.review?.decision && (a.status === "SUBMITTED" || a.status === "UNDER_REVIEW" || a.status === "INFO_REQUESTED");
}

export function useStaffQueue() {
  const db = useDlasDb();
  const me = useCurrentStaff();
  return useMemo(() => {
    const list = me ? db.applications.filter((a) => incoming(a, me)).sort((x, y) => x.submittedAt.localeCompare(y.submittedAt)).map(toView) : [];
    return {
      me,
      toCheck: list.filter((v) => !v.staffCheck),
      needsClarification: list.filter((v) => v.staffCheck?.outcome === "NEEDS_CLARIFICATION"),
      verified: list.filter((v) => v.staffCheck?.outcome === "STORY_VERIFIED"),
      all: list,
    };
  }, [db, me]);
}

/* ------------------------------ action ------------------------------ */

export const StaffService = {
  /** Record the story check. All YES → STORY_VERIFIED; anything else → NEEDS_CLARIFICATION (note required). */
  checkStory(applicationId: string, input: { items: { key: StoryCheckKey; answer: "YES" | "NO" | "UNSURE" }[]; note: string }) {
    const me = StaffAuth.current();
    if (!me) throw new Error("Staff login required");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !incoming(a, me)) throw new Error("This case is not in your office's incoming list");
      const answers = STORY_CHECKS.map((c) => input.items.find((i) => i.key === c.key) ?? { key: c.key, answer: "UNSURE" as const });
      const outcome: StaffStoryCheck["outcome"] = answers.every((i) => i.answer === "YES") ? "STORY_VERIFIED" : "NEEDS_CLARIFICATION";
      const note = input.note.trim() || null;
      if (outcome === "NEEDS_CLARIFICATION" && (!note || note.length < 10)) throw new Error("Explain what is unclear (at least 10 characters) so the officer can follow up");
      const prev = a.staffCheck;
      a.staffCheck = {
        outcome,
        items: answers,
        note,
        by: me.staffId,
        byName: me.name,
        at: now(),
        history: [...(prev?.history ?? []), ...(prev ? [{ outcome: prev.outcome, note: prev.note, by: prev.by, byName: prev.byName, at: prev.at }] : [])],
      };
      audit(db, a.audit, { actor: me.staffId, role: "dlo_staff", caseId: a.caseId ?? a.applicationId, action: "staff.story_checked", detail: { staff: me.name, outcome, answers: Object.fromEntries(answers.map((i) => [i.key, i.answer])), note, advisoryOnly: true } });
      a.version += 1;
      a.updatedAt = now();
      return a.staffCheck;
    });
  },
};

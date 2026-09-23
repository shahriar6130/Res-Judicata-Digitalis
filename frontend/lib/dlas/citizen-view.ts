"use client";

/* ------------------------------------------------------------------ *
 *  Citizen view of the shared record.
 *
 *  The citizen dashboard (home, sidebar, "My cases", case detail) used
 *  hard-coded demo data. These hooks replace it with the
 *  LOGGED-IN citizen's own applications from localStorage["dlas.db.v1"]:
 *
 *    mine = applications where
 *      session.meta.citizenId === account.citizenId       (filed after login)
 *      OR applicant.phone === account.phone              (any door: IVR/USSD/UDC)
 *      OR filedBy.phone   === account.phone              (filed as representative)
 *
 *  Output uses the existing CaseRecord / CitizenCaseSummary shapes so the
 *  existing UI renders unchanged. Nothing here is invented: timeline steps
 *  after the record's current stage are shown as "upcoming".
 * ------------------------------------------------------------------ */

import { useMemo, useSyncExternalStore } from "react";
import type { CaseRecord, CaseStatus, CitizenCaseSummary, DocumentRecord, TimelineEvent } from "../case-demo";
import { useDlasDb } from "./store";
import { DISTRICTS, MATTERS, label, safeTimeLabel } from "./reference";
import { PIPELINE, type ApplicationRecord, type CitizenAccount, type DlasDb } from "./schema";

const CURRENT_KEY = "dlas.citizen.current";

function subscribe(cb: () => void) {
  const on = () => cb();
  window.addEventListener("storage", on);
  window.addEventListener("dlas:db-changed", on);
  return () => {
    window.removeEventListener("storage", on);
    window.removeEventListener("dlas:db-changed", on);
  };
}
function currentId(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

/** The logged-in citizen account (undefined when logged out or during SSR). */
export function useCurrentCitizen(): CitizenAccount | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.citizens.find((c) => c.citizenId === id) : undefined;
}

export function applicationsFor(db: DlasDb, account: CitizenAccount | undefined): ApplicationRecord[] {
  if (!account) return [];
  return db.applications
    .filter((a) => {
      const s = db.sessions.find((x) => x.sessionId === a.channel.sessionId);
      return (
        s?.meta.citizenId === account.citizenId ||
        a.data.applicant.phone === account.phone ||
        a.data.filedBy.phone === account.phone
      );
    })
    .sort((x, y) => y.submittedAt.localeCompare(x.submittedAt));
}

function statusOf(a: ApplicationRecord): CaseStatus {
  switch (a.status) {
    case "UNDER_REVIEW":
    case "INFO_REQUESTED":
      return "under_review";
    case "ACCEPTED":
      return "approved";
    case "REJECTED":
    case "WITHDRAWN":
    case "CLOSED":
      return "closed";
    default:
      return "submitted";
  }
}

const fmt = (iso: string, lang: "bn" | "en") =>
  new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

function title(a: ApplicationRecord): { bn: string; en: string } {
  const who = a.data.applicant.fullName ?? "—";
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim();
  const matterBn = label(MATTERS, a.data.matter.category, "bn");
  const matterEn = label(MATTERS, a.data.matter.category, "en");
  return other
    ? { bn: `${who} বনাম ${other}`, en: `${who} v. ${other}` }
    : { bn: `${who} — ${matterBn}`, en: `${who} — ${matterEn}` };
}

export function toSummary(a: ApplicationRecord): CitizenCaseSummary {
  const t = title(a);
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim() ?? "—";
  return {
    id: a.applicationId,
    displayId: `#${a.applicationId}`,
    status: statusOf(a),
    complainantBn: a.data.applicant.fullName ?? "—",
    complainantEn: a.data.applicant.fullName ?? "—",
    respondentBn: other,
    respondentEn: other,
    titleBn: t.bn,
    titleEn: t.en,
  };
}

const STAGE_TEXT: Record<string, { tBn: string; tEn: string; dBn: string; dEn: string }> = {
  ACCESS_APPLICATION: { tBn: "আবেদন জমা হয়েছে", tEn: "Application submitted", dBn: "আবেদন আইডি প্রদান করা হয়েছে", dEn: "Application ID issued" },
  VERIFICATION_REVIEW: { tBn: "যাচাই ও যোগ্যতা পর্যালোচনা", tEn: "Verification & eligibility review", dBn: "জেলা লিগ্যাল এইড অফিসার পর্যালোচনা করবেন", dEn: "The District Legal Aid Officer will review it" },
  CASE_OPENED: { tBn: "কেস খোলা", tEn: "Case opened", dBn: "গ্রহণের পর কেস আইডি দেওয়া হবে", dEn: "A Case ID is issued after acceptance" },
  SERVICE_DELIVERY: { tBn: "সেবা: মধ্যস্থতা / আইনজীবী / রেফারেল", tEn: "Service: mediation / lawyer / referral", dBn: "অফিসার সিদ্ধান্ত নেবেন", dEn: "Decided by the officer" },
  FOLLOW_UP: { tBn: "ফলো-আপ", tEn: "Follow-up", dBn: "", dEn: "" },
  OUTCOME: { tBn: "ফলাফল", tEn: "Outcome", dBn: "", dEn: "" },
  CLOSURE: { tBn: "নিষ্পত্তি", tEn: "Closure", dBn: "", dEn: "" },
};

function timeline(a: ApplicationRecord): TimelineEvent[] {
  // Step 1 is done at submit; the next backbone stage is "current" (waiting on a human).
  const doneUpTo = PIPELINE.indexOf(a.stage);
  return PIPELINE.map((stage, i) => {
    const s = STAGE_TEXT[stage];
    const state: TimelineEvent["state"] = i <= doneUpTo ? "completed" : i === doneUpTo + 1 ? "current" : "upcoming";
    return {
      id: stage,
      titleBn: s.tBn,
      titleEn: s.tEn,
      descriptionBn: s.dBn,
      descriptionEn: s.dEn,
      dateBn: i === 0 ? fmt(a.submittedAt, "bn") : "",
      dateEn: i === 0 ? fmt(a.submittedAt, "en") : "",
      state,
    };
  });
}

function documents(a: ApplicationRecord): DocumentRecord[] {
  const out: DocumentRecord[] = [
    { id: "application", kind: "application", status: "filed", metaBn: fmt(a.submittedAt, "bn"), metaEn: fmt(a.submittedAt, "en") },
  ];
  if (a.channel.code === "IVR_16699") out.push({ id: "voice", kind: "voice", status: "filed", metaBn: "১৬৬৯৯", metaEn: "16699" });
  const nid = a.data.documents.find((d) => d.type === "NID");
  if (nid) out.push({ id: nid.docId, kind: "id", status: nid.status === "ATTACHED" ? "filed" : "pending" });
  return out;
}

export function toCaseRecord(a: ApplicationRecord): CaseRecord {
  const t = title(a);
  const office = DISTRICTS.find((d) => d.code === a.data.applicant.district);
  const filer = a.data.filedBy.kind === "REPRESENTATIVE" ? a.data.filedBy.name : a.data.applicant.fullName;
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim() ?? "—";
  return {
    id: a.applicationId,
    titleBn: t.bn,
    titleEn: t.en,
    displayId: `#${a.applicationId}`,
    officeBn: office ? `${office.label.bn} জেলা লিগ্যাল এইড অফিস` : "—",
    officeEn: office ? `${office.label.en} District Legal Aid Office` : "—",
    applicantBn: filer ?? "—",
    applicantEn: filer ?? "—",
    beneficiaryBn: a.data.applicant.fullName ?? "—",
    beneficiaryEn: a.data.applicant.fullName ?? "—",
    complainantBn: a.data.applicant.fullName ?? "—",
    complainantEn: a.data.applicant.fullName ?? "—",
    respondentBn: other,
    respondentEn: other,
    issueBn: a.data.matter.summary ?? label(MATTERS, a.data.matter.category, "bn"),
    issueEn: a.data.matter.summary ?? label(MATTERS, a.data.matter.category, "en"),
    submittedAtBn: fmt(a.submittedAt, "bn"),
    submittedAtEn: fmt(a.submittedAt, "en"),
    safeContactTimeBn: safeTimeLabel(a.data.safeContact, "bn"),
    safeContactTimeEn: safeTimeLabel(a.data.safeContact, "en"),
    status: statusOf(a),
    mediator: null,
    timeline: timeline(a),
    messages: [],
    documents: documents(a),
  };
}

/** The logged-in citizen's cases (newest first). */
export function useCitizenCases(): CitizenCaseSummary[] {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => applicationsFor(db, me).map(toSummary), [db, me]);
}

/** One of the logged-in citizen's cases, or null. */
export function useCitizenCase(id: string): CaseRecord | null {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => {
    const a = applicationsFor(db, me).find((x) => x.applicationId === id);
    return a ? toCaseRecord(a) : null;
  }, [db, me, id]);
}

/* ------------------------------------------------------------------ *
 *  Notifications — derived from the citizen's own records (audit,
 *  open tasks, simulated SMS). Nothing is hard-coded.
 * ------------------------------------------------------------------ */

export type CitizenNotification = {
  id: string;
  at: string;
  icon: "shield" | "user" | "check" | "bell";
  title: { bn: string; en: string };
  body: { bn: string; en: string };
  href: string;
  unread: boolean;
};

export function notificationsFor(db: DlasDb, me: CitizenAccount | undefined): CitizenNotification[] {
  if (!me) return [];
  const readAt = me.notificationsReadAt ?? "";
  const out: Omit<CitizenNotification, "unread">[] = [];
  const apps = applicationsFor(db, me);
  for (const a of apps) {
    out.push({
      id: `sub-${a.applicationId}`,
      at: a.submittedAt,
      icon: "check",
      title: { bn: `আবেদন জমা হয়েছে · ${a.applicationId}`, en: `Application submitted · ${a.applicationId}` },
      body: { bn: `${label(MATTERS, a.data.matter.category, "bn")} — ${a.routing.office}`, en: `${label(MATTERS, a.data.matter.category, "en")} — ${a.routing.office}` },
      href: `cases/${a.applicationId}`,
    });
    for (const t of db.tasks.filter((x) => x.applicationId === a.applicationId && x.status !== "DONE")) {
      const map: Partial<Record<string, { icon: CitizenNotification["icon"]; bn: string; en: string }>> = {
        ELIGIBILITY_REVIEW: { icon: "shield", bn: "অফিসারের পর্যালোচনার অপেক্ষায়", en: "Waiting for officer review" },
        URGENT_SAFETY_REVIEW: { icon: "shield", bn: "জরুরি নিরাপত্তা পর্যালোচনা চলছে", en: "Urgent safety review in progress" },
        DOCUMENT_FOLLOW_UP: { icon: "bell", bn: "কিছু নথি পরে জমা দিতে হবে", en: "Some documents are still to be submitted" },
        COMPLETE_MISSING_INFO: { icon: "bell", bn: "কিছু তথ্য বাকি আছে", en: "Some information is missing" },
        HUMAN_CALLBACK: { icon: "user", bn: "সহায়তা কর্মী আপনাকে ফোন করবেন", en: "A helpline agent will call you back" },
      };
      const m = map[t.type];
      if (!m) continue;
      out.push({
        id: `task-${t.taskId}`,
        at: t.createdAt,
        icon: m.icon,
        title: { bn: m.bn, en: m.en },
        body: { bn: `${a.applicationId} · ${t.reason}`, en: `${a.applicationId} · ${t.reason}` },
        href: `cases/${a.applicationId}`,
      });
    }
  }
  for (const m of db.outbox.filter((x) => x.to === me.phone && x.kind === "SMS_CONFIRMATION")) {
    out.push({
      id: `sms-${m.msgId}`,
      at: m.at,
      icon: "bell",
      title: m.status === "DELIVERED" ? { bn: "এসএমএস পাঠানো হয়েছে (সিমুলেটেড)", en: "SMS sent (simulated)" } : { bn: "এসএমএস পাঠানো হয়নি — আপনার নির্দেশ অনুযায়ী", en: "SMS not sent — as you asked" },
      body: { bn: m.body, en: m.body },
      href: m.applicationId ? `cases/${m.applicationId}` : "home",
    });
  }
  return out
    .sort((x, y) => y.at.localeCompare(x.at))
    .map((n) => ({ ...n, unread: n.at > readAt }));
}

export function useCitizenNotifications(): CitizenNotification[] {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => notificationsFor(db, me), [db, me]);
}

/* ------------------------------------------------------------------ *
 *  "My legal aid centre" — derived from the citizen's latest application.
 *  No officer is shown until a DLAO is actually assigned on the record.
 * ------------------------------------------------------------------ */

export type MyOffice = {
  district: { bn: string; en: string } | null;
  officeName: { bn: string; en: string } | null;
  applications: number;
  openTasks: number;
  safeTime: { bn: string; en: string } | null;
  latestApplicationId: string | null;
};

export function useMyOffice(): MyOffice {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => {
    const apps = applicationsFor(db, me);
    const latest = apps[0];
    const d = latest ? DISTRICTS.find((x) => x.code === latest.data.applicant.district) : undefined;
    return {
      district: d ? d.label : null,
      officeName: d ? { bn: `${d.label.bn} জেলা লিগ্যাল এইড অফিস`, en: `${d.label.en} District Legal Aid Office` } : null,
      applications: apps.length,
      openTasks: db.tasks.filter((t) => t.status !== "DONE" && apps.some((a) => a.applicationId === t.applicationId)).length,
      safeTime: latest?.data.safeContact.safeTime
        ? { bn: safeTimeLabel(latest.data.safeContact, "bn"), en: safeTimeLabel(latest.data.safeContact, "en") }
        : null,
      latestApplicationId: latest?.applicationId ?? null,
    };
  }, [db, me]);
}

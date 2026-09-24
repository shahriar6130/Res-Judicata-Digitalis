"use client";

/* ------------------------------------------------------------------ *
 *  End-to-end mediation demo (Feature 12) — /demo/mediation.
 *
 *  Two fictional cases walked through the REAL services, one step at a
 *  time, each step performed by the role that owns it:
 *    Case A  family maintenance → mediation → settlement → CLO → resolved → follow-up
 *    Case B  inherited-land partition → mediation fails → failure record →
 *            officer review → lawyer pathway → panel lawyer accepts
 *
 *  Nothing is simulated except what is simulated everywhere (SMS gateway,
 *  OTP delivery, party signatures). Every step writes dlas.db.v1 through
 *  the same service a person would use from their own screen, so each
 *  step can equally be done in the real screen instead — the runner
 *  simply picks up from the record (lib/dlas/mediation-lifecycle.ts).
 *
 *  All people are fictional and marked "(demo)". The runner signs in as
 *  the demo account for one step and then restores whoever was signed in.
 * ------------------------------------------------------------------ */

import { readDb } from "./store";
import { CitizenAuth } from "./citizen-auth";
import { CitizenDoor } from "./door-bridges";
import { DlaoAuth, DlaoReviewService, factChecklist, withOfficerApp } from "./dlao";
import { PathwayService } from "./pathway";
import { MediatorRegistry } from "./mediators";
import { MediatorAssignmentService, evaluateMediator } from "./mediator-assignment";
import { MediatorOfferService, rankCandidates } from "./mediator-offers";
import { SettlementAppealService } from "./settlement-appeal";
import { SettlementVerificationService, MediationFailureReviewService, MediationWorkspaceService, MediatorAuth } from "./mediation-workspace";
import { DlaoLawyerService, LawyerAuth, LawyerService } from "./lawyer";
import { mediationLifecycle, type LifecycleBranch, type StageKey } from "./mediation-lifecycle";
import type { ApplicationRecord, DistrictCode, DlasDb, MediationCaseType } from "./schema";

export const DEMO_DISTRICT: DistrictCode = "JHENAIDAH";
export type DemoCaseKey = "A" | "B";

/** Fictional people. Phone numbers use the unassigned 01300-0000xx block. */
export const DEMO_CAST = {
  lao: { name: "Nusrat Jahan (demo Legal Aid Officer)", phone: "01300000201" },
  clo: { name: "Kamrul Hasan (demo Chief Legal Aid Officer)", phone: "01300000202" },
  lawyer: { name: "Adv. Sharmin Sultana (demo panel lawyer)", phone: "01300000301", bar: "DEMO-BAR-0301" },
  A: { name: "Rumana Khatun (demo)", phone: "01300000101", respondent: "Mizanur Rahman (demo)" },
  B: { name: "Jahangir Alam (demo)", phone: "01300000102", respondent: "Shafiqul Alam (demo)" },
} as const;

export const DEMO_CASES: Record<DemoCaseKey, { branch: LifecycleBranch; title: { bn: string; en: string }; story: { bn: string; en: string }; category: "family" | "land"; subcategory: string; caseType: MediationCaseType; description: string }> = {
  A: {
    branch: "SETTLEMENT",
    title: { bn: "কেস A — ভরণপোষণ · মধ্যস্থতায় নিষ্পত্তি", en: "Case A — Maintenance · settled by mediation" },
    story: { bn: "স্বামী আট মাস ধরে স্ত্রী ও ৬ বছরের মেয়ের ভরণপোষণ দিচ্ছেন না। সহিংসতা নেই, কোনো মামলা নেই।", en: "A husband has not paid maintenance for his wife and their 6-year-old daughter for eight months. No violence, no court case." },
    category: "family",
    subcategory: "MAINTENANCE",
    caseType: "SPOUSAL_MAINTENANCE",
    description: "My husband stopped paying maintenance for me and our 6-year-old daughter eight months ago. We live separately at my parents' house. There is no violence. I want regular monthly maintenance. (fictional demo case)",
  },
  B: {
    branch: "FAILURE",
    title: { bn: "কেস B — উত্তরাধিকার জমি বণ্টন · মধ্যস্থতা ব্যর্থ → প্যানেল আইনজীবী", en: "Case B — Inherited land partition · mediation fails → panel lawyer" },
    story: { bn: "বাবার মৃত্যুর পর বড় ভাই পুরো জমি চাষ করছেন, ভাগ দিতে রাজি নন। মধ্যস্থতায় মীমাংসা হয় না।", en: "After their father died, the elder brother farms all the inherited land and refuses to divide it. Mediation does not settle it." },
    category: "land",
    subcategory: "PARTITION",
    caseType: "PROPERTY_PARTITION",
    description: "After our father died, my elder brother has been cultivating all 1.5 bigha of our inherited land and refuses to give my share. I want the land partitioned lawfully. (fictional demo case)",
  },
};

/* ------------------------------ acting as a role ------------------------------ */

const SESSION_KEYS = ["dlas.dlao.current", "dlas.mediator.current", "dlas.lawyer.current", "dlas.citizen.current", "dlas.active.WEB_PORTAL"];

/** Run fn signed in as a demo account, then restore whoever was signed in before. */
async function as<T>(signIn: () => void, fn: () => T | Promise<T>): Promise<T> {
  const saved = SESSION_KEYS.map((k) => [k, window.localStorage.getItem(k)] as const);
  try {
    signIn();
    return await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === null) window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    }
  }
}

function ok(r: { ok: boolean; error?: string }, what: string) {
  if (!r.ok) throw new Error(`Demo ${what}: ${r.error ?? "sign-in failed"}`);
}

const signIn = {
  lao() {
    const r = DlaoAuth.login(DEMO_CAST.lao.phone);
    if (!r.ok) ok(DlaoAuth.signUp({ name: DEMO_CAST.lao.name, phone: DEMO_CAST.lao.phone, officeType: "DLAO", district: DEMO_DISTRICT, authorityRole: "LEGAL_AID_OFFICER" }), "Legal Aid Officer");
  },
  clo() {
    const r = DlaoAuth.login(DEMO_CAST.clo.phone);
    if (!r.ok) ok(DlaoAuth.signUp({ name: DEMO_CAST.clo.name, phone: DEMO_CAST.clo.phone, officeType: "DLAO", district: DEMO_DISTRICT, authorityRole: "CHIEF_LEGAL_AID_OFFICER" }), "CLO");
  },
  lawyer() {
    const r = LawyerAuth.login(DEMO_CAST.lawyer.phone);
    if (!r.ok) ok(LawyerAuth.signUp({ name: DEMO_CAST.lawyer.name, phone: DEMO_CAST.lawyer.phone, district: DEMO_DISTRICT, barEnrolmentNo: DEMO_CAST.lawyer.bar, practiceAreas: ["LAND", "FAMILY"] }), "panel lawyer");
  },
  citizen(k: DemoCaseKey) {
    const r = CitizenAuth.login(DEMO_CAST[k].phone);
    if (!r.ok) ok(CitizenAuth.signUp(DEMO_CAST[k].name, DEMO_CAST[k].phone), "citizen");
  },
  mediator(a: ApplicationRecord) {
    const asg = a.mediation?.assignments.find((x) => x.status === "ASSIGNED" || x.status === "COMPLETED");
    const m = asg ? readDb().mediators.find((x) => x.mediatorId === asg.mediatorId) : null;
    if (!m) throw new Error("No mediator is assigned yet");
    ok(MediatorAuth.login(m.contact.phone), "mediator");
  },
};

/* ------------------------------ finding the demo cases ------------------------------ */

/** The latest application filed by each demo citizen (a new run files a new one — nothing is ever deleted). */
export function demoCases(db: DlasDb): Record<DemoCaseKey, ApplicationRecord | null> {
  const latest = (phone: string) => [...db.applications].filter((a) => a.data.applicant.phone === phone).sort((x, y) => y.submittedAt.localeCompare(x.submittedAt))[0] ?? null;
  return { A: latest(DEMO_CAST.A.phone), B: latest(DEMO_CAST.B.phone) };
}

/** Everything the demo needs in the district: the demo accounts and sample (illustrative) mediators. */
export async function ensureDemoCast() {
  await as(signIn.clo, () => undefined);
  await as(signIn.lawyer, () => undefined);
  await as(signIn.lao, () => {
    if (!readDb().mediators.some((m) => m.sample && m.district === DEMO_DISTRICT)) MediatorRegistry.loadSamples();
  });
}

/* ------------------------------ the steps ------------------------------ */

export type DemoStep = { stage: StageKey; actor: string; action: { bn: string; en: string }; note?: string };

/** What the runner will do for each stage; `note` is the human reason that gets recorded (editable in the UI). */
export const DEMO_STEPS: Partial<Record<StageKey, Omit<DemoStep, "stage">>> = {
  submitted: { actor: "Citizen", action: { bn: "নাগরিক হিসেবে আবেদন জমা দিন", en: "Submit the application as the citizen" } },
  verification: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে পরিচয়, নথি, তথ্য ও যোগ্যতা যাচাই", en: "Verify identity, documents, facts and eligibility as the officer" } },
  case_id: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে যোগ্য ঘোষণা করুন (কেস আইডি তৈরি)", en: "Declare eligible as the officer (creates the case ID)" }, note: "Income below the legal aid threshold; identity and facts verified by phone." },
  pathway_suggested: { actor: "System", action: { bn: "নিয়ম দিয়ে আইনি পথ শ্রেণিবিন্যাস চালান", en: "Run the rule-based pathway classification" } },
  pathway_confirmed: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে প্রস্তাবিত পথ নিশ্চিত করুন", en: "Confirm the suggested pathway as the officer" }, note: "No suit filed and no safety risk reported — mandatory pre-case mediation applies." },
  eligibility: { actor: "System", action: { bn: "মধ্যস্থতাকারীর যোগ্যতা যাচাই চালান", en: "Run the mediator eligibility check" } },
  recommended: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে সেরা পছন্দকে (#১) প্রস্তাব পাঠান", en: "Send the offer to the best pick (#1) as the officer" }, note: "Best pick by the system ranking: relevant experience and free capacity this week." },
  assigned: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে প্রস্তাব গ্রহণ করুন", en: "Accept the offer as the mediator" } },
  workspace: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে কর্মক্ষেত্র খুলুন", en: "Open the case workspace as the mediator" } },
  contact: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে সেশন নির্ধারণ ও পক্ষদের জানান", en: "Schedule the session and notify the parties as the mediator" } },
  session: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে সেশন পরিচালনা করুন", en: "Conduct the session as the mediator" } },
  settlement: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে পক্ষদের সম্মত শর্ত রেকর্ড করুন", en: "Record the terms the parties agreed as the mediator" }, note: "Parties agreed on monthly maintenance and shared school costs." },
  execution: { actor: "Parties", action: { bn: "দুই পক্ষের স্বাক্ষর (সিমুলেটেড)", en: "Both parties sign (simulated)" } },
  mediator_confirmation: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে নিশ্চিত করে অফিসারের কাছে যাচাইয়ের জন্য পাঠান", en: "Confirm and submit to the Legal Aid Officer as the mediator" } },
  dlo_verification: { actor: "Legal Aid Officer", action: { bn: "অফিসার (DLO) হিসেবে চুক্তি যাচাই করুন", en: "Verify the agreement as the Legal Aid Officer (DLO)" }, note: "Settled by mediation — maintenance agreement verified." },
  testimonial: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে নিষ্পত্তি প্রত্যয়নপত্র তৈরি করে নাগরিককে পাঠান", en: "Generate the settlement testimonial and send it to the citizen as the officer" } },
  closed: { actor: "Citizen", action: { bn: "নাগরিক হিসেবে নিষ্পত্তি মেনে নিন (আপিল নয়) — কেস বন্ধ", en: "Accept the settlement as the citizen (no appeal) — the case closes" } },
  failed: { actor: "Mediator", action: { bn: "মধ্যস্থতাকারী হিসেবে ব্যর্থতার আনুষ্ঠানিক রেকর্ড করুন", en: "Record the formal failure record as the mediator" }, note: "No agreement — the respondent disputes the applicant's share of the land." },
  failure_review: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে রেফারেল পর্যালোচনা ও নিশ্চিত করুন", en: "Review and confirm the referral as the officer" }, note: "Title is contested; the applicant needs representation to file a partition suit." },
  shortlist: { actor: "System", action: { bn: "প্যানেল আইনজীবী শর্টলিস্ট তৈরি", en: "Generate the panel lawyer shortlist" } },
  lawyer_offer: { actor: "Legal Aid Officer", action: { bn: "অফিসার হিসেবে আইনজীবীকে কেস দিন", en: "Offer the case to a lawyer as the officer" }, note: "Land partition experience; within the district." },
  lawyer_accepted: { actor: "Panel lawyer", action: { bn: "আইনজীবী হিসেবে কেস গ্রহণ করুন", en: "Accept the case as the panel lawyer" } },
};

const localIn = (hours: number) => {
  const d = new Date(Date.now() + hours * 3_600_000);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dateIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function fresh(id: string) {
  const a = readDb().applications.find((x) => x.applicationId === id);
  if (!a) throw new Error("Demo case not found");
  return a;
}

/** Performs the CURRENT stage of the demo case with the role that owns it. Throws (visibly) on any refusal. */
export async function runDemoStep(k: DemoCaseKey, note?: string, newRun = false): Promise<StageKey> {
  const spec = DEMO_CASES[k];
  const cast = DEMO_CAST[k];
  const existing = demoCases(readDb())[k];
  const stage = existing && !newRun ? mediationLifecycle(existing, readDb().tasks, spec.branch).current?.key ?? null : "submitted";
  if (!stage) throw new Error("This demo case is complete");
  const reason = (note ?? DEMO_STEPS[stage]?.note ?? "").trim();
  const inputs = { subcategory: spec.subcategory, courtStatus: "NONE" as const, mediationOrigin: null, courtName: null, courtLevel: null, courtCaseNo: null, referralDate: null, referralOrderReference: null, referringAuthority: null, currentLitigationStage: null, referralDeadline: null };

  if (stage === "submitted") {
    await ensureDemoCast();
    await as(() => signIn.citizen(k), async () => {
      window.localStorage.removeItem("dlas.active.WEB_PORTAL"); // a fresh intake session for this run
      CitizenDoor.requestOtp(cast.phone);
      const sid = CitizenDoor.ensure();
      const otp = [...readDb().otp].reverse().find((o) => o.sessionId === sid);
      if (!otp) throw new Error("No OTP was issued");
      CitizenDoor.verifyOtp(otp.code); // delivered by the simulated SMS gateway
      const res = await CitizenDoor.submit({ name: cast.name, phone: cast.phone, nidNumber: k === "A" ? "1000000101" : "1000000102", actingFor: "self", proxyRel: "", proxyName: "", proxyPhone: "", matter: spec.category, partyName: cast.respondent, partyAddress: "Jhenaidah Sadar (demo)", description: spec.description, documents: [], contactSlot: "anytime", contactDay: "", contactTime: "", specialInstructions: "", consentOk: true }, DEMO_DISTRICT);
      if (!res.ok) throw new Error("Submission was refused: " + JSON.stringify(res));
    });
    return stage;
  }

  const a = existing!;
  const id = a.applicationId;
  const officer = (fn: () => unknown) => as(signIn.lao, fn);
  const mediator = (fn: () => unknown) => as(() => signIn.mediator(fresh(id)), fn);

  switch (stage) {
    case "verification":
      await officer(() => {
        if (!fresh(id).review) DlaoReviewService.receive(id);
        DlaoReviewService.verifyIdentity(id, { outcome: "CONFIRMED", method: "PHONE_CALL", note: "Called the applicant at her safe time; details confirmed.", nid: "MATCHES_DOCUMENT", corrections: [] });
        for (const d of fresh(id).data.documents) DlaoReviewService.markDocumentReceived(id, d.docId, "");
        DlaoReviewService.reviewFacts(id, { items: factChecklist(fresh(id)).map((f) => ({ key: f.key, status: "CORROBORATED" as const, note: "" })), missingEvidence: [] });
        DlaoReviewService.assessEligibility(id, { courtLevel: "OTHER_COURTS", income: 60000, exempt: [], vulnerabilityNotes: k === "A" ? "Single mother, no independent income." : "" });
      });
      break;
    case "case_id":
      await officer(() => DlaoReviewService.decide(id, { decision: "ELIGIBLE", reason }));
      break;
    case "pathway_suggested":
      await officer(() => PathwayService.saveInputs(id, inputs));
      break;
    case "pathway_confirmed":
      await officer(() => PathwayService.confirm(id, inputs, reason, null));
      break;
    case "eligibility":
      await officer(() => MediatorAssignmentService.checkEligibility(id));
      break;
    case "recommended":
      await officer(() => {
        const a0 = fresh(id);
        const matter = a0.mediation!;
        const district = a0.data.applicant.district;
        const cands = readDb().mediators.filter((m) => m.district === district).map((m) => evaluateMediator(readDb(), m, a0, matter, Date.now()));
        const best = rankCandidates(cands)[0];
        if (!best) throw new Error("No eligible mediator in the district — the officer would widen the search or reassign");
        MediatorOfferService.offer(id, best.c.mediatorId, reason);
      });
      break;
    case "assigned":
      await as(() => {
        const rec = fresh(id).mediation?.assignments.find((x) => x.status === "OFFERED");
        const m = rec ? readDb().mediators.find((x) => x.mediatorId === rec.mediatorId) : null;
        if (!m) throw new Error("No open offer");
        ok(MediatorAuth.login(m.contact.phone), "mediator");
      }, () => MediatorOfferService.accept(id));
      break;
    case "workspace":
      await mediator(() => MediationWorkspaceService.open(id));
      break;
    case "contact":
      await mediator(() => MediationWorkspaceService.schedule(id, { at: localIn(20), channel: "PHYSICAL", place: "District Legal Aid Office, Jhenaidah", room: "Mediation room 1" }));
      break;
    case "session":
      await mediator(() => {
        MediationWorkspaceService.start(id);
        MediationWorkspaceService.markAttendance(id, "APPLICANT", "PRESENT", "PHYSICAL");
        MediationWorkspaceService.markAttendance(id, "RESPONDENT", "PRESENT", "PHYSICAL");
        MediationWorkspaceService.addCaucusNote(id, "APPLICANT", "Private caucus note (demo) — kept confidential to the mediator.");
        MediationWorkspaceService.addCaucusNote(id, "RESPONDENT", "Private caucus note (demo) — kept confidential to the mediator.");
        if (k === "A") {
          MediationWorkspaceService.addItem(id, "ISSUES", "Monthly maintenance for the wife and daughter");
          MediationWorkspaceService.addItem(id, "AGREED", "Monthly maintenance paid by the 5th of each month (amount agreed by the parties)");
          MediationWorkspaceService.addItem(id, "AGREED", "School costs for the daughter shared equally");
        } else {
          MediationWorkspaceService.addItem(id, "ISSUES", "Share of the inherited agricultural land");
          MediationWorkspaceService.addItem(id, "OUTSTANDING", "Respondent disputes the applicant's share and the title documents");
        }
        MediationWorkspaceService.end(id);
      });
      break;
    case "settlement":
      await mediator(() =>
        MediationWorkspaceService.recordOutcome(id, {
          kind: "SETTLEMENT_REACHED",
          note: reason,
          settlementTerms: { issue: "Unpaid maintenance for the wife and daughter", proposedResolution: "Regular monthly maintenance and shared school costs", agreedResolution: "Respondent pays the monthly maintenance amount the parties agreed, by the 5th of each month, and shares the daughter's school costs equally", conditions: "Payments by mobile banking with receipts kept by both parties", deadline: dateIn(180), additionalTerms: "" },
        }),
      );
      break;
    case "execution":
      await mediator(() => {
        MediationWorkspaceService.simulatePartySignature(id, "APPLICANT");
        MediationWorkspaceService.simulatePartySignature(id, "RESPONDENT");
      });
      break;
    case "mediator_confirmation":
      await mediator(() => MediationWorkspaceService.confirmSettlement(id));
      break;
    case "dlo_verification":
      await officer(() => SettlementVerificationService.verify(id, { outcome: reason }));
      break;
    case "testimonial":
      await officer(() => SettlementVerificationService.issueTestimonial(id));
      break;
    case "closed":
      await as(() => signIn.citizen(k), () => SettlementAppealService.acceptSettlement(id));
      break;
    case "failed":
      await mediator(() =>
        MediationWorkspaceService.recordOutcome(id, {
          kind: "MEDIATION_FAILED",
          note: reason,
          failureRecord: { mediationDate: dateIn(0), attendance: { APPLICANT: "PRESENT", RESPONDENT: "PRESENT" }, issuesDiscussed: "Share of the inherited agricultural land; possession by the elder brother", outcome: "No agreement reached", reasonStatus: reason, followUpRequirement: "", referralPathway: "LAWYER_ASSIGNMENT" },
        }),
      );
      break;
    case "failure_review":
      await officer(() => {
        const rec = fresh(id).mediation?.workspace?.failureRecord;
        if (!rec) throw new Error("No failure record");
        const suggested = rec.systemSuggestion.pathway;
        MediationFailureReviewService.confirmReferral(id, { pathway: "LAWYER_ASSIGNMENT", changed: suggested !== "LAWYER_ASSIGNMENT", note: reason });
      });
      break;
    case "shortlist":
      await ensureDemoCast();
      await officer(() => DlaoLawyerService.createShortlist(id));
      break;
    case "lawyer_offer":
      await ensureDemoCast();
      await officer(() => {
        const demoLawyer = readDb().lawyers.find((l) => l.phone === DEMO_CAST.lawyer.phone);
        const sl = fresh(id).lawyer?.shortlists.find((s) => s.status === "ACTIVE");
        const c = sl?.candidates.find((x) => x.lawyerId === demoLawyer?.lawyerId && x.outcome === "PENDING");
        if (!c) throw new Error("The demo panel lawyer is not on this shortlist — offer the case from the officer screen instead");
        DlaoLawyerService.assign(id, { lawyerId: c.lawyerId, note: reason });
      });
      break;
    case "lawyer_accepted":
      await as(signIn.lawyer, () => LawyerService.accept(id));
      break;
    default:
      throw new Error(`The “${stage}” stage completes on its own when the previous step is done`);
  }
  return stage;
}

/** Sign in as the demo account that owns a stage, so the judge can open the real screen. */
export async function signInForDemo(role: "CITIZEN" | "OFFICER" | "MEDIATOR" | "CLO" | "LAWYER", k: DemoCaseKey) {
  if (role === "CITIZEN") signIn.citizen(k);
  else if (role === "OFFICER") signIn.lao();
  else if (role === "CLO") signIn.clo();
  else if (role === "LAWYER") signIn.lawyer();
  else {
    const a = demoCases(readDb())[k];
    if (!a) throw new Error("Start the demo case first");
    signIn.mediator(a);
  }
}

/* ------------------------------ follow-up (real service) ------------------------------ */

/** The officer records that a CLO-required settlement follow-up was carried out. */
export const SettlementFollowUpService = {
  complete(applicationId: string, taskId: string, note: string) {
    if (note.trim().length < 10) throw new Error("Describe what was checked (at least 10 characters)");
    return withOfficerApp(applicationId, (db, a, o) => {
      const t = db.tasks.find((x) => x.taskId === taskId && x.applicationId === a.applicationId && x.type === "SETTLEMENT_FOLLOW_UP");
      if (!t) throw new Error("Follow-up not found");
      if (t.status === "DONE") throw new Error("This follow-up is already recorded");
      t.status = "DONE";
      const left = db.tasks.filter((x) => x.applicationId === a.applicationId && x.type === "SETTLEMENT_FOLLOW_UP" && x.status !== "DONE").length;
      if (!left) a.stage = "OUTCOME";
      db.counters.auditSeq += 1;
      a.audit.push({ seq: db.counters.auditSeq, at: new Date().toISOString(), actor: o.officerId, role: o.authorityRole === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action: "settlement.follow_up_completed", detail: { officer: o.name, taskId, kind: t.context?.kind ?? null, note: note.trim(), remaining: left } });
      return t;
    });
  },
};


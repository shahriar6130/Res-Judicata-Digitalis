"use client";

/* ------------------------------------------------------------------ *
 *  "Summarize" — SIMULATED AI case summary for the DLO, DLO office staff,
 *  the mediator and the panel lawyer.
 *
 *  Shown to the user as an AI summary, but it is a deterministic template
 *  over the SHARED record (application, review, pathway, mediation, lawyer,
 *  audit). Each role only gets what it may already see:
 *   • DLO / DLO staff — the full public record (never caucus notes)
 *   • mediator        — need-to-know: no NID, no income, no staff notes
 *   • panel lawyer    — the case facts; offered-only → no party names
 *  No phone numbers, no NID numbers, no caucus text for anyone.
 *  Generating it is audited (case.ai_summary_generated). Pure builder.
 * ------------------------------------------------------------------ */

import { mutate } from "./store";
import { DlaoAuth, officerCanAccessApplication } from "./dlao";
import { StaffAuth } from "./staff";
import { MediatorAuth } from "./mediation-workspace";
import { mediatorCanAccessCase } from "./mediation-access";
import { LawyerAuth, activeAssignment, hasCaseAccess } from "./lawyer";
import { incidentLabel, incidentOf, isRedFlagged } from "./incident-taxonomy";
import { MATTERS, label } from "./reference";
import type { ApplicationRecord, AuditEntry, DlasDb } from "./schema";

export type SummaryRole = "DLO" | "DLO_STAFF" | "MEDIATOR" | "LAWYER";
export const CASE_SUMMARY_VERSION = "case-summary-sim-2026.09";

export type CaseSummary = {
  summaryId: string;
  role: SummaryRole;
  headline: string;
  sections: { title: string; bullets: string[] }[];
  flags: string[]; // watch-outs, shown first
  withheld: string[]; // what this role's summary leaves out
  generatedAt: string;
  version: string;
  simulated: true;
};

const words = (s: string | null | undefined) => (s ?? "").toLowerCase().replaceAll("_", " ");
const d = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const DAY = 86_400_000;

/** Build the summary (pure). */
export function buildCaseSummary(a: ApplicationRecord, role: SummaryRole, opts: { summaryId: string; at?: number; lawyerOfferOnly?: boolean } ): CaseSummary {
  const at = opts.at ?? Date.now();
  const inc = incidentOf(a);
  const red = isRedFlagged(a);
  const r = a.review;
  const m = a.mediation;
  const ws = m?.workspace ?? null;
  const flow = ws?.settlementWorkflow ?? null;
  const lw = a.lawyer;
  const hideNames = role === "LAWYER" && !!opts.lawyerOfferOnly;
  const matter = label(MATTERS, a.data.matter.category, "en") || "Unspecified matter";
  const story = (a.data.matter.summary ?? "").replace(/\s+/g, " ").trim();
  const ageDays = Math.max(0, Math.floor((at - new Date(a.submittedAt).getTime()) / DAY));
  const applicant = hideNames ? "the applicant" : a.data.applicant.fullName ?? "the applicant";
  const respondent = hideNames ? "the other party" : a.data.matter.opposingParty?.split(",")[0]?.trim() || "the other party (not named)";

  // where it stands, in one line
  const assignedMediator = m?.assignments.find((x) => x.status === "ASSIGNED")?.mediatorName ?? null;
  const acceptedLawyer = lw?.assignments.find((x) => x.status === "ACCEPTED")?.lawyerName ?? null;
  let stands = a.status === "SUBMITTED" ? "Waiting for the office to receive it" : !r?.decision ? "Under verification by the Legal Aid Officer" : r.decision.decision !== "ELIGIBLE" ? `Decided: ${words(r.decision.decision)}` : !r.pathway ? "Eligible — legal pathway not chosen yet" : `Eligible — ${words(r.pathway.type)} pathway`;
  if (r?.pathway?.type === "MEDIATION") stands += assignedMediator ? `, mediator ${hideNames ? "assigned" : assignedMediator}` : m?.assignmentStatus === "AWAITING_MEDIATOR_ACCEPTANCE" ? ", mediator offer pending" : ", mediator not assigned yet";
  if (r?.pathway?.type === "LAWYER") stands += acceptedLawyer ? `, panel lawyer ${acceptedLawyer}` : ", panel lawyer not assigned yet";
  if (flow?.testimonial) stands += flow.appeal?.status === "FILED" ? " — citizen appealed the settlement" : flow.appeal?.status === "ACCEPTED" ? " — settlement appeal accepted" : a.closedAt ? " — settled and closed" : " — settlement testimonial with the citizen";
  else if (flow) stands += ` — settlement ${words(flow.status === "AWAITING_CLO_CERTIFICATION" ? "awaiting officer verification" : flow.status)}`;
  if (a.closedAt) stands = `Closed ${d(a.closedAt)} (${words(a.status)})`;

  const headline = `${matter}${inc.subcategory ? ` — ${incidentLabel(inc.category, inc.subcategory, "en")}` : ""}. ${stands}. Filed ${ageDays} day${ageDays === 1 ? "" : "s"} ago via ${words(a.channel.code)}.`;

  const flags: string[] = [];
  if (red) flags.push(`RED FLAG by rule: ${incidentLabel(inc.category, inc.subcategory, "en")}${inc.matched[0] ? ` (words: “${inc.matched.slice(0, 3).map((x) => x.keyword).join("”, “")}”)` : ""}`);
  if (a.data.safeContact.neutralWordingRequired) flags.push("Contact only with neutral wording, at the applicant's safe time");
  if (!a.data.safeContact.smsAllowed) flags.push("SMS to the applicant is not safe — do not text");
  if (a.data.urgency.flags.includes("CHILD_INVOLVED")) flags.push("A child is involved");
  if (a.data.applicant.accessibilityNeeds?.length) flags.push(`Accessibility: ${a.data.applicant.accessibilityNeeds.map(words).join(", ")}`);
  if (a.data.applicant.canRead === false) flags.push("Applicant cannot read — explain documents aloud");
  if (role !== "MEDIATOR" && role !== "LAWYER" && a.transfers?.some((t) => t.status === "PENDING")) flags.push("A transfer to another DLAO is pending");
  if (lw?.hearings.some((h) => !h.updateId && new Date(h.updateDueAt).getTime() < at)) flags.push("A hearing report from the panel lawyer is overdue");

  const sections: CaseSummary["sections"] = [];
  sections.push({
    title: "What happened",
    bullets: [
      story ? `In the applicant's words: “${clip(story, role === "LAWYER" && hideNames ? 160 : 260)}”` : "No description was given.",
      `Category by rule: ${incidentLabel(inc.category, inc.subcategory, "en")}${red ? " (red)" : ""}.`,
      a.pathwayClassification?.inputs.subcategory ? `Pathway subcategory: ${words(a.pathwayClassification.inputs.subcategory)}${a.pathwayClassification.inputs.courtStatus ? `, court status ${words(a.pathwayClassification.inputs.courtStatus)}` : ""}.` : "",
    ].filter(Boolean),
  });
  sections.push({
    title: "Parties",
    bullets: [
      `Applicant: ${applicant}${a.data.filedBy.kind !== "SELF" && !hideNames ? ` (filed by ${a.data.filedBy.name ?? "a representative"}, ${words(a.data.filedBy.relation) || words(a.data.filedBy.kind)})` : ""}${role !== "LAWYER" && r?.identity.state === "COMPLETED" ? " — identity verified by the officer" : ""}.`,
      `Other party: ${respondent}.`,
    ],
  });
  const stand: string[] = [stands + "."];
  if (role === "DLO" || role === "DLO_STAFF") {
    if (r?.eligibility?.state === "COMPLETED") stand.push(`Eligibility: income ${words(r.eligibility.incomeBand ?? "not disclosed")} (${words(r.eligibility.courtLevel)}).`);
    if (a.staffCheck) stand.push(`Staff story check: ${words(a.staffCheck.outcome)}${a.staffCheck.note ? ` — “${clip(a.staffCheck.note, 100)}”` : ""}.`);
  }
  if (ws?.sessions.length) {
    const last = ws.sessions[ws.sessions.length - 1];
    stand.push(`Mediation: ${ws.sessions.length} session(s); latest #${last.number} ${words(last.status)}${last.scheduledFor ? ` (${d(last.scheduledFor)})` : ""}.`);
  }
  if (flow) stand.push(`Settlement ${flow.agreementId}: “${clip(flow.terms.agreedResolution, 140)}” — parties ${Object.values(flow.execution).every((x) => x.status === "SIGNED") ? "signed" : "not yet signed"}, mediator ${words(flow.mediatorConfirmation.status)}.`);
  if (ws?.failureRecord) stand.push(`Mediation did not settle — referral ${words(ws.failureRecord.confirmedPathway ?? ws.failureRecord.systemSuggestion.pathway)} (${words(ws.failureRecord.status)}).`);
  if (lw?.hearings.length) {
    const next = [...lw.hearings].filter((h) => new Date(h.at).getTime() > at).sort((x, y) => x.at.localeCompare(y.at))[0];
    stand.push(`Court: ${lw.hearings.length} hearing(s) recorded${next ? `; next on ${d(next.at)}` : ""}${lw.hearings.some((h) => h.result === "MISSED") ? "; one or more missed" : ""}.`);
  }
  sections.push({ title: "Where it stands", bullets: stand });

  const docs = a.data.documents;
  const attached = docs.filter((x) => x.status === "ATTACHED").length;
  const requested = docs.filter((x) => x.requested && x.status !== "ATTACHED");
  sections.push({
    title: "Documents",
    bullets: [
      `${attached} of ${docs.length} document(s) received${role === "MEDIATOR" ? " (national ID not shown to mediators)" : ""}.`,
      requested.length ? `Still requested: ${requested.map((x) => words(x.type)).join(", ")}.` : "Nothing outstanding that the office asked for.",
    ],
  });

  const VIEWS = new Set(["case.ai_summary_generated", "mediation.record_viewed", "settlement.ai_draft_generated"]);
  const last = [...a.audit].reverse().find((e) => !VIEWS.has(e.action));
  sections.push({
    title: "Key dates",
    bullets: [`Filed ${d(a.submittedAt)}${a.caseId ? `; case ${a.caseId} opened ${d(a.audit.find((e) => e.action === "case.created")?.at)}` : ""}.`, last ? `Last activity ${d(last.at)} (${words(last.action.split(".").pop())}).` : ""].filter(Boolean),
  });

  const next: string[] = [];
  if (role === "DLO") {
    if (red && !inc.officerReview) next.push("Review the red flag first (confirm or clear it).");
    if (!r?.decision) next.push("Finish verification and the eligibility decision.");
    else if (r.decision.decision === "ELIGIBLE" && !r.pathway) next.push("Choose the legal pathway: Gram Adalat, mediation or a lawyer.");
    if (flow?.status === "AWAITING_CLO_CERTIFICATION") next.push("Verify the settlement agreement.");
    if (flow?.appeal?.status === "FILED") next.push("Decide the citizen's appeal.");
    if (flow?.appeal?.status === "ACCEPTED" && !acceptedLawyer) next.push("Assign a panel lawyer (appeal accepted).");
  }
  if (role === "DLO" && !next.length) next.push(a.closedAt ? "Nothing open — the case is closed." : "Nothing is waiting on you right now; keep monitoring the case.");
  if (role === "DLO_STAFF") next.push(a.staffCheck ? "Story check done — the officer takes it from here." : "Do the story check and flag anything unclear for the officer.");
  if (role === "MEDIATOR") next.push(!ws?.sessions.length ? "Schedule the first session and contact the parties at their safe time." : flow ? "Follow the settlement through signatures and your confirmation." : "Continue the session; record the outcome when it ends.");
  if (role === "LAWYER") next.push(opts.lawyerOfferOnly ? "Accept or decline the offer before its deadline." : lw?.hearings.some((h) => !h.updateId && new Date(h.updateDueAt).getTime() < at) ? "File the overdue hearing report." : "Keep hearings and reports up to date.");
  if (next.length) sections.push({ title: "Suggested next step", bullets: next });

  const withheld = ["phone numbers", "NID numbers", "mediator's confidential caucus notes"];
  if (role === "MEDIATOR") withheld.push("income / eligibility details", "office staff notes");
  if (role === "LAWYER") withheld.push("office staff notes", ...(hideNames ? ["party names (until you accept)"] : []));

  return { summaryId: opts.summaryId, role, headline, sections: sections.map((s) => ({ ...s, bullets: s.bullets.filter(Boolean) })), flags, withheld, generatedAt: new Date(at).toISOString(), version: CASE_SUMMARY_VERSION, simulated: true };
}

/* ------------------------------ service (access-checked, audited) ------------------------------ */

const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: new Date().toISOString(), ...e });
}

export const CaseSummaryService = {
  generate(applicationId: string, role: SummaryRole): CaseSummary {
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a) throw new Error("Unknown case");
      let actor: { id: string; role: AuditEntry["role"] };
      let offerOnly = false;
      if (role === "DLO") {
        const o = DlaoAuth.current();
        if (!o || !officerCanAccessApplication(a, o)) throw new Error("This case is not in your office");
        actor = { id: o.officerId, role: "dlao" };
      } else if (role === "DLO_STAFF") {
        const s = StaffAuth.current();
        if (!s || a.data.applicant.district !== s.district) throw new Error("This case is not in your office");
        actor = { id: s.staffId, role: "dlo_staff" };
      } else if (role === "MEDIATOR") {
        const me = MediatorAuth.current();
        if (!me || !mediatorCanAccessCase(a, me.mediatorId)) throw new Error("This case is not assigned to you");
        actor = { id: me.mediatorId, role: "mediator" };
      } else {
        const me = LawyerAuth.current();
        const s = activeAssignment(a);
        const full = !!me && hasCaseAccess(a, me.lawyerId);
        if (!me || (!full && !(s && s.lawyerId === me.lawyerId && s.status === "OFFERED"))) throw new Error("This case is not assigned to you");
        offerOnly = !full;
        actor = { id: me.lawyerId, role: "panel_lawyer" };
      }
      const summary = buildCaseSummary(a, role, { summaryId: rid("SUM"), lawyerOfferOnly: offerOnly });
      audit(db, a.audit, { actor: actor.id, role: actor.role, caseId: a.caseId ?? a.applicationId, action: "case.ai_summary_generated", detail: { summaryId: summary.summaryId, forRole: role, simulated: true, version: summary.version, withheld: summary.withheld } });
      return summary;
    });
  },
};

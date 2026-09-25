/* ------------------------------------------------------------------ *
 *  SIMULATED "AI" draft for the mediator's settlement discussion.
 *
 *  Presented to the mediator as an AI draft, but it is a deterministic
 *  template over the SHARED case record only: matter, case type, the
 *  applicant's own description, parties, session attendance and the
 *  points already written. It NEVER reads the confidential caucus notes,
 *  never invents amounts (it leaves "[amount the parties agree]"), and
 *  saves nothing — the mediator edits each box and adds it. Pure.
 * ------------------------------------------------------------------ */

import { classifyIncident } from "./incident-taxonomy";
import type { ApplicationRecord, IncidentSubcategory, MediationCaseType, MediationWorkspace, SettlementList } from "./schema";

export const SETTLEMENT_DRAFT_VERSION = "settlement-draft-sim-2026.09";

type Pack = { issue: string; proposed: string; agreed: string; outstanding: string };

/** Neutral starting points by the kind of dispute. Placeholders in [brackets] must be filled by the mediator. */
const PACKS: Record<string, Pack> = {
  MAINTENANCE: {
    issue: "Regular maintenance for the applicant (and children, if any) has not been paid",
    proposed: "Respondent pays monthly maintenance of [amount the parties agree] by the [day] of each month",
    agreed: "[Write only what both parties said they agree to — e.g. the monthly amount and payment day]",
    outstanding: "Payment method and proof of payment (e.g. mobile banking receipts); arrears for past months",
  },
  DOWER: {
    issue: "Unpaid dower (denmohor) under the marriage registration (kabinnama)",
    proposed: "Respondent pays the unpaid dower of [amount per kabinnama / agreed] in [number] instalments",
    agreed: "[Write only what both parties said they agree to — the amount, instalments and dates]",
    outstanding: "Instalment dates; what happens if an instalment is missed",
  },
  CHILD_CUSTODY: {
    issue: "Where the child lives and how the other parent keeps contact",
    proposed: "Child lives with [parent]; the other parent has contact on [days/times]",
    agreed: "[Write only the arrangement both parents said they accept — keep the child's welfare first]",
    outstanding: "School costs and holidays; how changes to the arrangement are agreed",
  },
  DIVORCE: {
    issue: "Consequences of the separation / talaq for both parties",
    proposed: "Parties settle dower, maintenance during iddat and return of personal belongings by [date]",
    agreed: "[Write only what both parties said they agree to]",
    outstanding: "Registration of the talaq with the Kazi office; any children's arrangements",
  },
  LAND_DISPUTE: {
    issue: "Possession of / boundary of the land in dispute",
    proposed: "Joint demarcation by a surveyor chosen by both parties; each keeps to the recorded boundary",
    agreed: "[Write only what both parties said they agree to — e.g. surveyor, date, who pays the fee]",
    outstanding: "Records to check (khatian / mutation); access path or water rights, if raised",
  },
  INHERITANCE: {
    issue: "Division of the inherited property among the heirs",
    proposed: "Property divided according to the heirs' shares — [share list]; a partition deed to be drawn up",
    agreed: "[Write only what all heirs present said they agree to]",
    outstanding: "Heirs not present; mutation of each share after the partition",
  },
  TENANCY: {
    issue: "Rent, deposit or eviction between tenant and landlord",
    proposed: "Tenant stays until [date] / pays arrears of [amount the parties agree] by [date]",
    agreed: "[Write only what both parties said they agree to]",
    outstanding: "Return of the advance / deposit; condition of the premises",
  },
  UNPAID_WAGES: {
    issue: "Wages or dues not paid by the employer",
    proposed: "Employer pays the outstanding wages of [amount the parties agree] in [number] instalments",
    agreed: "[Write only what both parties said they agree to]",
    outstanding: "Service certificate / release letter; any other dues (overtime, gratuity)",
  },
  DEBT: {
    issue: "Money lent and not returned",
    proposed: "Borrower repays [amount the parties agree] in [number] instalments starting [date]",
    agreed: "[Write only what both parties said they agree to]",
    outstanding: "Proof of each repayment; what happens if a payment is missed",
  },
  DEFAULT: {
    issue: "The dispute between the parties as described in the application",
    proposed: "[What one party put forward — write it in their words]",
    agreed: "[Write only what both parties said they agree to]",
    outstanding: "[Points still unresolved after the session]",
  },
};

const BY_CASE_TYPE: Partial<Record<MediationCaseType, keyof typeof PACKS>> = {
  DOWER: "DOWER",
  SPOUSAL_MAINTENANCE: "MAINTENANCE",
  PARENTS_MAINTENANCE: "MAINTENANCE",
  CHILD_CUSTODY: "CHILD_CUSTODY",
  PROPERTY_PARTITION: "INHERITANCE",
  NEIGHBOURHOOD_BOUNDARY: "LAND_DISPUTE",
  TITLE_DISPUTE: "LAND_DISPUTE",
  MONEY_SUIT: "DEBT",
  EVICTION: "TENANCY",
};
const BY_SUB: Partial<Record<IncidentSubcategory, keyof typeof PACKS>> = {
  MAINTENANCE: "MAINTENANCE",
  CHILD_CUSTODY: "CHILD_CUSTODY",
  DIVORCE: "DIVORCE",
  LAND_DISPUTE: "LAND_DISPUTE",
  INHERITANCE: "INHERITANCE",
  TENANCY: "TENANCY",
  UNPAID_WAGES: "UNPAID_WAGES",
  DEBT: "DEBT",
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const ATT: Record<string, string> = { PRESENT: "present", ABSENT: "absent", REPRESENTED: "represented", UNRECORDED: "not recorded" };

export type SettlementDraft = { draftId: string; texts: Record<SettlementList, string>; basis: string[]; version: string; simulated: true };

/** Build the draft (pure). `draftId` comes from the caller so the audit and the UI refer to the same draft. */
export function draftSettlementPoints(a: ApplicationRecord, ws: MediationWorkspace | null, draftId: string): SettlementDraft {
  const summary = (a.data.matter.summary ?? "").replace(/\s+/g, " ").trim();
  const inc = a.incident ?? classifyIncident({ matter: a.data.matter.category, summary });
  const key = (a.mediation?.caseType && BY_CASE_TYPE[a.mediation.caseType]) || (inc.subcategory && BY_SUB[inc.subcategory]) || "DEFAULT";
  const p = PACKS[key];
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim() || "the respondent";
  const last = [...(ws?.sessions ?? [])].reverse().find((s) => s.status === "COMPLETED" || s.status === "IN_PROGRESS" || s.status === "PAUSED") ?? null;
  const already = new Set((ws?.settlement ?? []).filter((x) => x.status === "ACTIVE").map((x) => x.text.trim().toLowerCase()));
  const skip = (t: string) => (already.has(t.trim().toLowerCase()) ? "" : t);
  const discussion = [
    last ? `Session ${last.number}: applicant ${ATT[last.attendance.APPLICANT.status] ?? "—"}, ${other} ${ATT[last.attendance.RESPONDENT.status] ?? "—"}.` : "Session not held yet.",
    summary ? `Applicant's account: “${clip(summary, 140)}”` : "",
    `${other}'s position: [record what they said]`,
  ].filter(Boolean).join(" ");
  return {
    draftId,
    texts: {
      ISSUES: skip(`${p.issue}${summary && key === "DEFAULT" ? ` — “${clip(summary, 100)}”` : ""}`),
      DISCUSSION: skip(discussion),
      PROPOSED: skip(p.proposed),
      AGREED: skip(p.agreed),
      OUTSTANDING: skip(p.outstanding),
    },
    basis: [`template: ${key}`, a.mediation?.caseType ? `case type ${a.mediation.caseType}` : `category ${inc.category}${inc.subcategory ? `/${inc.subcategory}` : ""}`, last ? `session ${last.number} attendance` : "no session yet", "applicant's description", "no caucus notes used", "no amounts invented"],
    version: SETTLEMENT_DRAFT_VERSION,
    simulated: true,
  };
}

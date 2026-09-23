/* ------------------------------------------------------------------ *
 *  Citizen case VIEW types.
 *
 *  The demo cases that used to live here (Rahima Begum etc.) are gone.
 *  Citizen screens now build these shapes from the logged-in citizen's
 *  own applications in localStorage["dlas.db.v1"] —
 *  see lib/dlas/citizen-view.ts.
 * ------------------------------------------------------------------ */

export type CaseStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "mediation_started"
  | "agreement_pending"
  | "resolved"
  | "closed";

export type TimelineState = "completed" | "current" | "upcoming";

export type TimelineEvent = {
  /** Stable id so React can key properly. */
  id: string;
  /** Workflow-stage label shown in bold. */
  titleBn: string;
  titleEn: string;
  /** Short context sentence (Bangla). */
  descriptionBn: string;
  descriptionEn: string;
  /** Bangla date string (e.g. "১৮ সেপ্টেম্বর, ২০২৬"). Empty when upcoming. */
  dateBn: string;
  dateEn: string;
  state: TimelineState;
};

export type Mediator = {
  nameBn: string;
  nameEn: string;
  designationBn: string;
  designationEn: string;
  areaBn: string;
  areaEn: string;
  contactTimeBn: string;
  contactTimeEn: string;
};

export type Message = {
  id: string;
  /** "mediator" or "citizen" — drives the label "মধ্যস্থতাকারী" / "আপনি". */
  from: "mediator" | "citizen";
  bodyBn: string;
  bodyEn: string;
  /** Bangla-formatted timestamp e.g. "১৮ সেপ্টেম্বর, ২০২৬ • ৪:২০ PM". */
  timestampBn: string;
  timestampEn: string;
};

export type DocumentRecord = {
  id: string;
  /** Translation key handled inside the component. */
  kind: "application" | "voice" | "id" | "agreement";
  /** Whether the document exists yet. */
  status: "filed" | "verified" | "pending";
  /** Optional sub-label shown beneath the name (date / duration / etc.). */
  metaBn?: string;
  metaEn?: string;
};

export type CaseRecord = {
  id: string;
  titleBn: string;
  titleEn: string;
  /** Form display id like "#DLAS-2026-0847". */
  displayId: string;
  officeBn: string;
  officeEn: string;
  applicantBn: string;
  applicantEn: string;
  beneficiaryBn: string;
  beneficiaryEn: string;
  /** Structured party split — used by the sidebar's "X vs Y" sub-items
   *  and by any future structured case-list rendering. May equal
   *  applicant (when the complainant files in person). */
  complainantBn: string;
  complainantEn: string;
  respondentBn: string;
  respondentEn: string;
  issueBn: string;
  issueEn: string;
  submittedAtBn: string;
  submittedAtEn: string;
  safeContactTimeBn: string;
  safeContactTimeEn: string;
  status: CaseStatus;
  mediator: Mediator | null;
  timeline: TimelineEvent[];
  messages: Message[];
  documents: DocumentRecord[];
};

/** Lightweight projection of `CaseRecord` used by the sidebar's
 *  collapsible My Cases list and the case-list page in the main
 *  content area. Keeps the full record (mediator, timeline,
 *  messages, documents) out of those renders. */
export type CitizenCaseSummary = Pick<
  CaseRecord,
  | "id"
  | "displayId"
  | "status"
  | "complainantBn"
  | "complainantEn"
  | "respondentBn"
  | "respondentEn"
  | "titleBn"
  | "titleEn"
>;

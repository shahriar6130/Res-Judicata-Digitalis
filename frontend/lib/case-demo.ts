/* ------------------------------------------------------------------ *
 *  Mock case-tracking data for the citizen "My Cases" detail view.
 *  Three realistic demo cases:
 *
 *    SHK-DEMO-007  → status: mediation_started
 *    SHK-DEMO-011  → status: under_review
 *    SHK-DEMO-014  → status: agreement_pending
 *
 *  When the real backend / case API lands, this module is the single
 *  thing to replace. The shape below (`CaseRecord`) is the surface
 *  the UI consumes — keep it stable.
 *
 *  `complainant` / `respondent` are the structured party split used by
 *  the sidebar's collapsible My Cases list ("Rahim Uddin vs Karim Ali").
 *  `applicant` / `beneficiary` are kept for the case detail header
 *  (আবেদনকারী / যার পক্ষে — they describe filing relationships, not
 *  opposing parties).
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

/* ------------------------------------------------------------------ *
 *  Case 1 — Mediation in progress.
 *  Timeline reaches the current step ("mediation_started"), the
 *  mediator has been assigned, and 3 of 4 documents are ready.
 * ------------------------------------------------------------------ */

const CASE_007: CaseRecord = {
  id: "SHK-DEMO-007",
  titleBn: "রহিমা বেগম বনাম মোহাম্মদ আলী",
  titleEn: "Rahima Begum v. Mohammad Ali",
  displayId: "#DLAS-2026-0847",
  officeBn: "জয়পুরহাট জেলা আইনি সহায়তা কেন্দ্র",
  officeEn: "Joypurhat District Legal Aid Centre",
  applicantBn: "রিপন আহমেদ",
  applicantEn: "Ripon Ahmed",
  beneficiaryBn: "রহিমা বেগম",
  beneficiaryEn: "Rahima Begum",
  complainantBn: "রহিমা বেগম",
  complainantEn: "Rahima Begum",
  respondentBn: "মোহাম্মদ আলী",
  respondentEn: "Mohammad Ali",
  issueBn: "গার্হস্থ্য সহিংসতা ও ভরণপোষণ বন্ধ",
  issueEn: "Family violence and maintenance stopped",
  submittedAtBn: "১৫ সেপ্টেম্বর, ২০২৬",
  submittedAtEn: "15 September 2026",
  safeContactTimeBn: "শুক্রবার সকাল ১০–১০:৩০",
  safeContactTimeEn: "Friday morning 10–10:30",
  status: "mediation_started",
  mediator: {
    nameBn: "ফাতেমা খাতুন",
    nameEn: "Fatema Khatun",
    designationBn: "প্যানেল মধ্যস্থতাকারী (NLASO)",
    designationEn: "Panel mediator (NLASO)",
    areaBn: "পাঁচবিবি, জয়পুরহাট",
    areaEn: "Panchbibi, Joypurhat",
    contactTimeBn: "শুক্রবার সকাল ১০–১০:৩০",
    contactTimeEn: "Friday morning 10–10:30",
  },
  timeline: [
    {
      id: "t1",
      titleBn: "আবেদন জমা হয়েছে",
      titleEn: "Application submitted",
      descriptionBn: "ডিজিটাল আবেদন ভেরিফাইড",
      descriptionEn: "Digital application verified",
      dateBn: "১৫ সেপ্টেম্বর, ২০২৬",
      dateEn: "15 September 2026",
      state: "completed",
    },
    {
      id: "t2",
      titleBn: "প্রাথমিক যাচাই",
      titleEn: "Initial verification",
      descriptionBn: "জয়পুরহাট জেলা লিগ্যাল এইড অফিসার কর্তৃক যোগ্যতা যাচাই",
      descriptionEn: "Eligibility check by Joypurhat District Legal Aid Officer",
      dateBn: "১৬ সেপ্টেম্বর, ২০২৬",
      dateEn: "16 September 2026",
      state: "completed",
    },
    {
      id: "t3",
      titleBn: "মধ্যস্থতাকারী নির্ধারণ",
      titleEn: "Mediator assigned",
      descriptionBn: "ফাতেমা খাতুন (প্যানেল মধ্যস্থতাকারী) নির্ধারিত হয়েছেন",
      descriptionEn: "Fatema Khatun (Panel mediator) assigned",
      dateBn: "১৭ সেপ্টেম্বর, ২০২৬",
      dateEn: "17 September 2026",
      state: "completed",
    },
    {
      id: "t4",
      titleBn: "মধ্যস্থতা শুরু হয়েছে",
      titleEn: "Mediation started",
      descriptionBn:
        "মধ্যস্থতাকারী আপনার বক্তব্য ও তথ্য নিয়ে সমঝোতার আলোচনা চালিয়ে যাচ্ছেন",
      descriptionEn:
        "The mediator is continuing conciliation discussions based on your statement and evidence",
      dateBn: "১৮ সেপ্টেম্বর, ২০২৬",
      dateEn: "18 September 2026",
      state: "current",
    },
    {
      id: "t5",
      titleBn: "চুক্তি/সমঝোতা প্রস্তুত",
      titleEn: "Agreement preparation",
      descriptionBn: "মধ্যস্থতার ফলাফল আপনার অনুমোদনের অপেক্ষায় থাকবে",
      descriptionEn: "The outcome of mediation will await your approval",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
    {
      id: "t6",
      titleBn: "মামলা নিষ্পত্তি",
      titleEn: "Case resolved",
      descriptionBn: "চুক্তি স্বাক্ষর ও চূড়ান্ত নিষ্পত্তি",
      descriptionEn: "Agreement signed and final resolution",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
  ],
  messages: [
    {
      id: "m1",
      from: "mediator",
      bodyBn:
        "আপনার বক্তব্য ও নথিপত্র আমরা পেয়েছি। শুক্রবার নির্ধারিত সময়ে আপনার সঙ্গে কথা বলা হবে।",
      bodyEn:
        "We have received your statement and documents. We will speak with you at the time you chose on Friday.",
      timestampBn: "১৮ সেপ্টেম্বর, ২০২৬ • ৪:২০ PM",
      timestampEn: "18 September 2026 • 4:20 PM",
    },
    {
      id: "m2",
      from: "citizen",
      bodyBn: "ঠিক আছে।",
      bodyEn: "Okay.",
      timestampBn: "১৮ সেপ্টেম্বর, ২০২৬ • ৪:২৫ PM",
      timestampEn: "18 September 2026 • 4:25 PM",
    },
    {
      id: "m3",
      from: "mediator",
      bodyBn:
        "পরবর্তী ধাপে আপনার নিরাপদ সময় নিশ্চিত করতে একটি বার্তা পাঠানো হবে।",
      bodyEn:
        "In the next step we will send you a confirmation request for your safe contact time.",
      timestampBn: "১৮ সেপ্টেম্বর, ২০২৬ • ৪:২৭ PM",
      timestampEn: "18 September 2026 • 4:27 PM",
    },
  ],
  documents: [
    {
      id: "d1",
      kind: "application",
      status: "filed",
      metaBn: "জমা হয়েছে • ১৫ সেপ্টেম্বর",
      metaEn: "Filed • 15 September",
    },
    {
      id: "d2",
      kind: "voice",
      status: "filed",
      metaBn: "২৮ সেকেন্ড • ১৫ সেপ্টেম্বর",
      metaEn: "28 sec • 15 September",
    },
    {
      id: "d3",
      kind: "id",
      status: "verified",
      metaBn: "যাচাই সম্পন্ন",
      metaEn: "Verified",
    },
    {
      id: "d4",
      kind: "agreement",
      status: "pending",
      metaBn: "চুক্তি এখনো প্রস্তুত হয়নি",
      metaEn: "Agreement not yet prepared",
    },
  ],
};

/* ------------------------------------------------------------------ *
 *  Case 2 — Under review.
 *  The officer is still checking eligibility. Mediator not yet
 *  assigned. Only the first two documents exist.
 * ------------------------------------------------------------------ */

const CASE_011: CaseRecord = {
  id: "SHK-DEMO-011",
  titleBn: "সালমা আক্তার বনাম রাশেদ আহমেদ",
  titleEn: "Salma Akter v. Rashed Ahmed",
  displayId: "#DLAS-2026-1204",
  officeBn: "জয়পুরহাট জেলা আইনি সহায়তা কেন্দ্র",
  officeEn: "Joypurhat District Legal Aid Centre",
  applicantBn: "মোঃ কামাল হোসেন",
  applicantEn: "Mohammad Kamal Hossain",
  beneficiaryBn: "সালমা আক্তার",
  beneficiaryEn: "Salma Akter",
  complainantBn: "সালমা আক্তার",
  complainantEn: "Salma Akter",
  respondentBn: "রাশেদ আহমেদ",
  respondentEn: "Rashed Ahmed",
  issueBn: "সন্তানের দেখাশোনা ও ভরণপোষণ নিয়ে বিরোধ",
  issueEn: "Dispute over child custody and maintenance",
  submittedAtBn: "২০ সেপ্টেম্বর, ২০২৬",
  submittedAtEn: "20 September 2026",
  safeContactTimeBn: "সন্ধ্যা ৭–৮ টা",
  safeContactTimeEn: "Evening 7–8 PM",
  status: "under_review",
  mediator: null,
  timeline: [
    {
      id: "t1",
      titleBn: "আবেদন জমা হয়েছে",
      titleEn: "Application submitted",
      descriptionBn: "ডিজিটাল আবেদন গৃহীত",
      descriptionEn: "Digital application received",
      dateBn: "২০ সেপ্টেম্বর, ২০২৬",
      dateEn: "20 September 2026",
      state: "completed",
    },
    {
      id: "t2",
      titleBn: "পর্যালোচনা চলছে",
      titleEn: "Review in progress",
      descriptionBn: "কর্মকর্তা আপনার দেওয়া তথ্য যাচাই করছেন",
      descriptionEn: "An officer is verifying the information you provided",
      dateBn: "২২ সেপ্টেম্বর, ২০২৬",
      dateEn: "22 September 2026",
      state: "current",
    },
    {
      id: "t3",
      titleBn: "যোগ্যতা নিশ্চিতকরণ",
      titleEn: "Eligibility confirmed",
      descriptionBn: "আইনি সহায়তার জন্য যোগ্যতা নিশ্চিত করা হবে",
      descriptionEn: "Eligibility for legal aid will be confirmed",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
    {
      id: "t4",
      titleBn: "মধ্যস্থতাকারী নির্ধারণ",
      titleEn: "Mediator assigned",
      descriptionBn: "একজন প্যানেল মধ্যস্থতাকারী নির্ধারণ করা হবে",
      descriptionEn: "A panel mediator will be assigned",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
    {
      id: "t5",
      titleBn: "মধ্যস্থতা শুরু",
      titleEn: "Mediation begins",
      descriptionBn: "নির্ধারিত সময়ে মধ্যস্থতাকারী আপনার সঙ্গে যোগাযোগ করবেন",
      descriptionEn: "The mediator will contact you at the time you chose",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
    {
      id: "t6",
      titleBn: "মামলা নিষ্পত্তি",
      titleEn: "Case resolved",
      descriptionBn: "চূড়ান্ত নিষ্পত্তি",
      descriptionEn: "Final resolution",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
  ],
  messages: [
    {
      id: "m1",
      from: "mediator",
      bodyBn:
        "আপনার আবেদন গ্রহণ করা হয়েছে। একজন কর্মকর্তা শীঘ্রই পর্যালোচনা করবেন।",
      bodyEn:
        "Your application has been received. An officer will review it shortly.",
      timestampBn: "২০ সেপ্টেম্বর, ২০২৬ • ১১:১০ AM",
      timestampEn: "20 September 2026 • 11:10 AM",
    },
  ],
  documents: [
    {
      id: "d1",
      kind: "application",
      status: "filed",
      metaBn: "জমা হয়েছে • ২০ সেপ্টেম্বর",
      metaEn: "Filed • 20 September",
    },
    {
      id: "d2",
      kind: "voice",
      status: "filed",
      metaBn: "২২ সেকেন্ড • ২০ সেপ্টেম্বর",
      metaEn: "22 sec • 20 September",
    },
    {
      id: "d3",
      kind: "id",
      status: "pending",
      metaBn: "যাচাই অপেক্ষমান",
      metaEn: "Verification pending",
    },
    {
      id: "d4",
      kind: "agreement",
      status: "pending",
      metaBn: "চুক্তি এখনো প্রস্তুত হয়নি",
      metaEn: "Agreement not yet prepared",
    },
  ],
};

/* ------------------------------------------------------------------ *
 *  Case 3 — Agreement pending.
 *  Mediation has produced a draft agreement; the agreement is now
 *  awaiting the citizen's confirmation. All four documents are ready
 *  and the mediator has been in touch twice. Timeline reaches the
 *  "agreement_pending" step as current.
 * ------------------------------------------------------------------ */

const CASE_014: CaseRecord = {
  id: "SHK-DEMO-014",
  titleBn: "জামাল হোসেন বনাম আব্দুল মান্নান",
  titleEn: "Jamal Hossain v. Abdul Mannan",
  displayId: "#DLAS-2026-1563",
  officeBn: "নওগাঁ জেলা আইনি সহায়তা কেন্দ্র",
  officeEn: "Naogaon District Legal Aid Centre",
  applicantBn: "জামাল হোসেন",
  applicantEn: "Jamal Hossain",
  beneficiaryBn: "জামাল হোসেন",
  beneficiaryEn: "Jamal Hossain",
  complainantBn: "জামাল হোসেন",
  complainantEn: "Jamal Hossain",
  respondentBn: "আব্দুল মান্নান",
  respondentEn: "Abdul Mannan",
  issueBn: "জমির সীমানা ও ফসলের ক্ষতিপূরণ বিষয়ে বিরোধ",
  issueEn: "Dispute over land boundary and crop compensation",
  submittedAtBn: "০৫ সেপ্টেম্বর, ২০২৬",
  submittedAtEn: "5 September 2026",
  safeContactTimeBn: "শনিবার বিকেল ৪–৫ টা",
  safeContactTimeEn: "Saturday afternoon 4–5 PM",
  status: "agreement_pending",
  mediator: {
    nameBn: "মাহফুজুর রহমান",
    nameEn: "Mahfuzur Rahman",
    designationBn: "প্যানেল মধ্যস্থতাকারী (NLASO)",
    designationEn: "Panel mediator (NLASO)",
    areaBn: "মহাদেবপুর, নওগাঁ",
    areaEn: "Mahadebpur, Naogaon",
    contactTimeBn: "শনিবার বিকেল ৪–৫ টা",
    contactTimeEn: "Saturday afternoon 4–5 PM",
  },
  timeline: [
    {
      id: "t1",
      titleBn: "আবেদন জমা হয়েছে",
      titleEn: "Application submitted",
      descriptionBn: "ডিজিটাল আবেদন গৃহীত",
      descriptionEn: "Digital application received",
      dateBn: "০৫ সেপ্টেম্বর, ২০২৬",
      dateEn: "5 September 2026",
      state: "completed",
    },
    {
      id: "t2",
      titleBn: "প্রাথমিক যাচাই",
      titleEn: "Initial verification",
      descriptionBn: "নওগাঁ জেলা লিগ্যাল এইড অফিসার কর্তৃক যোগ্যতা যাচাই",
      descriptionEn: "Eligibility check by Naogaon District Legal Aid Officer",
      dateBn: "০৭ সেপ্টেম্বর, ২০২৬",
      dateEn: "7 September 2026",
      state: "completed",
    },
    {
      id: "t3",
      titleBn: "মধ্যস্থতাকারী নির্ধারণ",
      titleEn: "Mediator assigned",
      descriptionBn: "মাহফুজুর রহমান (প্যানেল মধ্যস্থতাকারী) নির্ধারিত হয়েছেন",
      descriptionEn: "Mahfuzur Rahman (Panel mediator) assigned",
      dateBn: "০৯ সেপ্টেম্বর, ২০২৬",
      dateEn: "9 September 2026",
      state: "completed",
    },
    {
      id: "t4",
      titleBn: "মধ্যস্থতা সম্পন্ন",
      titleEn: "Mediation completed",
      descriptionBn: "মধ্যস্থতাকারী উভয়পক্ষের সমঝোতায় চুক্তির খসড়া প্রস্তুত করেছেন",
      descriptionEn: "The mediator has drafted an agreement based on mutual consent",
      dateBn: "১৪ সেপ্টেম্বর, ২০২৬",
      dateEn: "14 September 2026",
      state: "completed",
    },
    {
      id: "t5",
      titleBn: "চুক্তি অনুমোদনের অপেক্ষায়",
      titleEn: "Agreement awaiting approval",
      descriptionBn: "চুক্তির খসড়া আপনার পর্যালোচনা ও অনুমোদনের অপেক্ষায় আছে",
      descriptionEn: "The agreement draft is awaiting your review and approval",
      dateBn: "১৯ সেপ্টেম্বর, ২০২৬",
      dateEn: "19 September 2026",
      state: "current",
    },
    {
      id: "t6",
      titleBn: "মামলা নিষ্পত্তি",
      titleEn: "Case resolved",
      descriptionBn: "চুক্তি স্বাক্ষর ও চূড়ান্ত নিষ্পত্তি",
      descriptionEn: "Agreement signed and final resolution",
      dateBn: "",
      dateEn: "",
      state: "upcoming",
    },
  ],
  messages: [
    {
      id: "m1",
      from: "mediator",
      bodyBn:
        "চুক্তির খসড়া প্রস্তুত হয়েছে। শনিবার নির্ধারিত সময়ে আপনি পর্যালোচনা করে অনুমোদন দিতে পারবেন।",
      bodyEn:
        "The agreement draft is ready. You can review and approve it at your chosen time on Saturday.",
      timestampBn: "১৯ সেপ্টেম্বর, ২০২৬ • ৩:১০ PM",
      timestampEn: "19 September 2026 • 3:10 PM",
    },
    {
      id: "m2",
      from: "citizen",
      bodyBn: "ঠিক আছে, আমি শনিবার দেখব।",
      bodyEn: "Alright, I will review it on Saturday.",
      timestampBn: "১৯ সেপ্টেম্বর, ২০২৬ • ৩:২৫ PM",
      timestampEn: "19 September 2026 • 3:25 PM",
    },
  ],
  documents: [
    {
      id: "d1",
      kind: "application",
      status: "filed",
      metaBn: "জমা হয়েছে • ০৫ সেপ্টেম্বর",
      metaEn: "Filed • 5 September",
    },
    {
      id: "d2",
      kind: "voice",
      status: "filed",
      metaBn: "৩১ সেকেন্ড • ০৫ সেপ্টেম্বর",
      metaEn: "31 sec • 5 September",
    },
    {
      id: "d3",
      kind: "id",
      status: "verified",
      metaBn: "যাচাই সম্পন্ন",
      metaEn: "Verified",
    },
    {
      id: "d4",
      kind: "agreement",
      status: "filed",
      metaBn: "খসড়া প্রস্তুত • ১৪ সেপ্টেম্বর",
      metaEn: "Draft prepared • 14 September",
    },
  ],
};

const CASES: Record<string, CaseRecord> = {
  [CASE_007.id]: CASE_007,
  [CASE_011.id]: CASE_011,
  [CASE_014.id]: CASE_014,
};

export function getCaseById(id: string): CaseRecord | null {
  return CASES[id] ?? null;
}

export function listCaseIds(): string[] {
  return Object.keys(CASES);
}

/** Returns the lightweight projection of every demo case in a stable
 *  order. Used by the sidebar's collapsible "My Cases" group and by
 *  the case list rendered in the main content area. */
export function listCitizenCases(): CitizenCaseSummary[] {
  return [
    CASE_007,
    CASE_011,
    CASE_014,
  ].map(
    ({
      id,
      displayId,
      status,
      complainantBn,
      complainantEn,
      respondentBn,
      respondentEn,
      titleBn,
      titleEn,
    }) => ({
      id,
      displayId,
      status,
      complainantBn,
      complainantEn,
      respondentBn,
      respondentEn,
      titleBn,
      titleEn,
    }),
  );
}

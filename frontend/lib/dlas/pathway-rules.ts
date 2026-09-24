/* ------------------------------------------------------------------ *
 *  Legal pathway rule table + deterministic classifier (Feature 2).
 *
 *  • The rules are DATA: DEFAULT_PATHWAY_RULES below is the shipped
 *    table; an install can override it with db.pathwayRules (same shape)
 *    without touching any component. `pathwayRulesOf(db)` picks the one
 *    in force.
 *  • `classifyPathway()` is pure: the same record + rules always give the
 *    same result. No AI, no free-text inference — it reads structured
 *    fields only (category, officer-entered subcategory and court status,
 *    district, urgency flags, other party, documents).
 *  • The result is a SUGGESTION. The Legal Aid Officer confirms, changes
 *    or asks for more information (lib/dlas/pathway.ts).
 *
 *  Statutory references are for the officer to verify; they are not legal
 *  advice. Mandatory pre-case mediation (Legal Aid Services (Amendment)
 *  Ordinance 2025 and its rules) is being rolled out district by district,
 *  so it only applies where `mandatoryPreCaseDistricts` says it does.
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  CourtStatus,
  DistrictCode,
  DlasDb,
  DocType,
  MatterCategory,
  MediationTrack,
  PathwayAssessment,
  PathwayInputs,
  PathwayRule,
  PathwayRuleset,
  PathwayStatus,
  PathwayType,
  ReferralTarget,
  UrgencyFlag,
} from "./schema";

type L = { bn: string; en: string };

/* ------------------------------ labels ------------------------------ */

export const PATHWAY_STATUSES: { code: PathwayStatus; label: L; help: L }[] = [
  { code: "MANDATORY_PRE_CASE_MEDIATION", label: { bn: "বাধ্যতামূলক মামলা-পূর্ব মধ্যস্থতা", en: "Mandatory pre-case mediation" }, help: { bn: "আইনে তালিকাভুক্ত বিরোধ — মামলা করার আগে লিগ্যাল এইড অফিসে মধ্যস্থতা।", en: "A listed dispute — mediation at the legal aid office before any suit is filed." } },
  { code: "MEDIATION_AVAILABLE", label: { bn: "মধ্যস্থতা করা যায়", en: "Mediation available" }, help: { bn: "স্বেচ্ছায় মামলা-পূর্ব মধ্যস্থতা — উভয় পক্ষ রাজি ও নিরাপদ হলে।", en: "Voluntary pre-case mediation — if both parties agree and it is safe." } },
  { code: "COURT_REFERRED_MEDIATION", label: { bn: "আদালত-প্রেরিত মধ্যস্থতা", en: "Court-referred mediation" }, help: { bn: "চলমান মামলা আদালত মধ্যস্থতায় পাঠিয়েছে — ভিন্ন প্রক্রিয়া।", en: "A pending case the court sent to mediation — a different lifecycle." } },
  { code: "LAWYER_ASSISTANCE", label: { bn: "আইনজীবী / আইনি সহায়তা", en: "Lawyer / legal assistance" }, help: { bn: "আদালতে প্রতিনিধিত্ব, মামলা দায়ের বা সুরক্ষা আদেশ।", en: "Court representation, filing a claim or seeking protection." } },
  { code: "URGENT_ESCALATION", label: { bn: "জরুরি / বিশেষ এসকেলেশন", en: "Urgent / special escalation" }, help: { bn: "নিরাপত্তা বা স্বাধীনতার ঝুঁকি — আগে সুরক্ষা, মধ্যস্থতা নয়।", en: "Safety or liberty at risk — protection first, not mediation." } },
  { code: "OTHER_REFERRAL", label: { bn: "অন্য সেবায় রেফারেল", en: "Other referral" }, help: { bn: "গ্রাম আদালত, পুলিশ, ওসিসি, শ্রম বা সমাজসেবা।", en: "Village court, police, OCC, labour or social services." } },
  { code: "REQUIRES_OFFICER_REVIEW", label: { bn: "কর্মকর্তার পর্যালোচনা প্রয়োজন", en: "Requires officer review" }, help: { bn: "নিয়ম দিয়ে ঠিক করা যায়নি বা তথ্য অসম্পূর্ণ।", en: "No rule fits, or the structured information is incomplete." } },
];

export const COURT_STATUSES: { code: CourtStatus; label: L }[] = [
  { code: "UNKNOWN", label: { bn: "জানা নেই", en: "Not recorded yet" } },
  { code: "NONE", label: { bn: "কোনো মামলা নেই", en: "No court case" } },
  { code: "FILED_PENDING", label: { bn: "মামলা দায়ের / চলমান", en: "Case filed / pending" } },
  { code: "REFERRED_FOR_MEDIATION", label: { bn: "আদালত মধ্যস্থতায় পাঠিয়েছে", en: "Court referred it for mediation" } },
  { code: "DECIDED", label: { bn: "রায় হয়েছে", en: "Decided" } },
  { code: "APPEAL", label: { bn: "আপিল চলমান", en: "On appeal" } },
];

export const REFERRAL_TARGETS: { code: ReferralTarget; label: L }[] = [
  { code: "GRAM_ADALAT", label: { bn: "গ্রাম আদালত", en: "Gram Adalat (village court)" } },
  { code: "POLICE", label: { bn: "পুলিশ", en: "Police" } },
  { code: "ONE_STOP_CRISIS_CENTRE", label: { bn: "ওয়ান-স্টপ ক্রাইসিস সেন্টার", en: "One-Stop Crisis Centre" } },
  { code: "LABOUR_AUTHORITY", label: { bn: "শ্রম কর্তৃপক্ষ / শ্রম আদালত", en: "Labour authority / Labour Court" } },
  { code: "SOCIAL_SERVICES", label: { bn: "সমাজসেবা", en: "Social services" } },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other service" } },
];

export const statusLabel = (s: PathwayStatus, lang: "bn" | "en") => PATHWAY_STATUSES.find((x) => x.code === s)?.label[lang] ?? s;

/** Final pathway status → the downstream pathway (task + service) it starts. */
export function pathwayTypeFor(status: PathwayStatus, target: ReferralTarget | null): PathwayType | null {
  switch (status) {
    case "MANDATORY_PRE_CASE_MEDIATION":
    case "MEDIATION_AVAILABLE":
    case "COURT_REFERRED_MEDIATION":
      return "MEDIATION";
    case "LAWYER_ASSISTANCE":
    case "URGENT_ESCALATION":
      return "LAWYER";
    case "OTHER_REFERRAL":
      return target === "GRAM_ADALAT" ? "GRAM_ADALAT" : "REFERRAL";
    default:
      return null; // REQUIRES_OFFICER_REVIEW can never be a final pathway
  }
}

export const isMediationStatus = (s: PathwayStatus) => s === "MANDATORY_PRE_CASE_MEDIATION" || s === "MEDIATION_AVAILABLE" || s === "COURT_REFERRED_MEDIATION";

/* ------------------------------ default rule table ------------------------------ */

const MANDATORY_SUBS = ["DIVORCE", "CONJUGAL_RIGHTS", "DOWER", "MAINTENANCE", "CUSTODY_GUARDIANSHIP", "DOWRY_DEMAND", "HOUSE_RENT", "PRE_EMPTION_AGRICULTURAL", "PRE_EMPTION_NON_AGRICULTURAL", "PARENTS_MAINTENANCE", "PARTITION"];
const NO_COURT: CourtStatus[] = ["NONE"];

function rule(r: Omit<PathwayRule, "enabled" | "track" | "referralTarget" | "expectedDocs" | "law"> & Partial<Pick<PathwayRule, "track" | "referralTarget" | "expectedDocs" | "law">>): PathwayRule {
  return { enabled: true, track: null, referralTarget: null, expectedDocs: [], law: null, ...r };
}

function mandatory(ruleId: string, subs: string[], law: string, en: string, bn: string, docs: DocType[]): PathwayRule {
  return rule({
    ruleId,
    when: { subcategories: subs, courtStatus: NO_COURT, mandatoryDistrictOnly: true },
    result: "MANDATORY_PRE_CASE_MEDIATION",
    title: { bn, en },
    basis: {
      bn: "তালিকাভুক্ত বিরোধ, আদালতে মামলা নেই, এবং এই জেলায় বাধ্যতামূলক মামলা-পূর্ব মধ্যস্থতা চালু — মামলা করার আগে লিগ্যাল এইড অফিসে মধ্যস্থতা। ব্যর্থ হলে মধ্যস্থতা-ব্যর্থতার সনদ নিয়ে আদালতে যাওয়া যায়।",
      en: "Listed dispute, no court case yet, and mandatory pre-case mediation is in force in this district — mediation at the legal aid office before a suit. If it fails, a mediation-failure certificate lets the party go to court.",
    },
    law: `${law} · Legal Aid Services (Amendment) Ordinance 2025 (mandatory pre-case mediation)`,
    track: "PRE_LITIGATION",
    expectedDocs: docs,
  });
}

export const DEFAULT_PATHWAY_RULES: PathwayRuleset = {
  version: "PATHWAY-RULES-demo-v1",
  source: "PROTOTYPE_RULE",
  updatedAt: "2026-09-23T00:00:00.000Z",
  mandatoryPreCaseDistricts: "ALL",
  mandatoryNote: {
    bn: "বাধ্যতামূলক মামলা-পূর্ব মধ্যস্থতা জেলাভিত্তিকভাবে চালু হচ্ছে। প্রোটোটাইপে সব জেলা ধরা হয়েছে — অফিসের জেলায় চালু আছে কিনা কর্মকর্তা নিশ্চিত করবেন।",
    en: "Mandatory pre-case mediation is being rolled out district by district. The prototype treats every district as notified — the officer confirms it applies in this office's district.",
  },
  subcategories: {
    FAMILY: [
      { code: "DIVORCE", label: { bn: "তালাক / বিবাহবিচ্ছেদ", en: "Divorce / dissolution of marriage" } },
      { code: "CONJUGAL_RIGHTS", label: { bn: "দাম্পত্য অধিকার পুনরুদ্ধার", en: "Restitution of conjugal rights" } },
      { code: "DOWER", label: { bn: "দেনমোহর", en: "Dower (denmohor)" } },
      { code: "MAINTENANCE", label: { bn: "ভরণপোষণ (স্ত্রী / সন্তান)", en: "Maintenance (spouse / child)" } },
      { code: "CUSTODY_GUARDIANSHIP", label: { bn: "সন্তানের হেফাজত / অভিভাবকত্ব", en: "Child custody / guardianship" } },
      { code: "DOWRY_DEMAND", label: { bn: "যৌতুক দাবি (সহিংসতা ছাড়া)", en: "Dowry demand (no violence)" } },
      { code: "PARENTS_MAINTENANCE", label: { bn: "পিতা-মাতার ভরণপোষণ", en: "Parents' maintenance" } },
      { code: "MARITAL_RECONCILIATION", label: { bn: "দাম্পত্য মীমাংসা", en: "Marital reconciliation" } },
      { code: "OTHER_FAMILY", label: { bn: "অন্য পারিবারিক বিরোধ", en: "Other family dispute" } },
    ],
    VIOLENCE: [
      { code: "DOMESTIC_VIOLENCE", label: { bn: "পারিবারিক সহিংসতা", en: "Domestic violence" } },
      { code: "DOWRY_VIOLENCE", label: { bn: "যৌতুকের জন্য নির্যাতন", en: "Dowry-related violence" } },
      { code: "SEXUAL_VIOLENCE", label: { bn: "যৌন সহিংসতা", en: "Sexual violence" } },
      { code: "OTHER_VIOLENCE", label: { bn: "অন্য সহিংসতা", en: "Other violence" } },
    ],
    LAND: [
      { code: "PARTITION", label: { bn: "সম্পত্তি বণ্টন", en: "Partition" } },
      { code: "PRE_EMPTION_AGRICULTURAL", label: { bn: "অগ্রক্রয় (কৃষি জমি)", en: "Pre-emption (agricultural land)" } },
      { code: "PRE_EMPTION_NON_AGRICULTURAL", label: { bn: "অগ্রক্রয় (অকৃষি জমি)", en: "Pre-emption (non-agricultural land)" } },
      { code: "HOUSE_RENT", label: { bn: "বাড়িভাড়া বিরোধ", en: "House rent dispute" } },
      { code: "BOUNDARY_NEIGHBOUR", label: { bn: "সীমানা / প্রতিবেশী বিরোধ", en: "Boundary / neighbour dispute" } },
      { code: "TITLE", label: { bn: "স্বত্ব / মালিকানা", en: "Title / ownership" } },
      { code: "EVICTION", label: { bn: "উচ্ছেদ", en: "Eviction" } },
      { code: "SMALL_LOCAL_DISPUTE", label: { bn: "ছোট স্থানীয় বিরোধ (গ্রাম আদালত)", en: "Small local dispute (village court)" } },
    ],
    CIVIL_MONEY: [
      { code: "MONEY_CLAIM", label: { bn: "টাকা আদায়", en: "Money claim" } },
      { code: "HOUSE_RENT", label: { bn: "বাড়িভাড়া বিরোধ", en: "House rent dispute" } },
      { code: "CHEQUE_DISHONOUR", label: { bn: "চেক ডিজঅনার", en: "Cheque dishonour" } },
      { code: "SMALL_LOCAL_DISPUTE", label: { bn: "ছোট স্থানীয় বিরোধ (গ্রাম আদালত)", en: "Small local dispute (village court)" } },
    ],
    LABOUR: [
      { code: "UNPAID_WAGES", label: { bn: "বকেয়া মজুরি", en: "Unpaid wages" } },
      { code: "TERMINATION", label: { bn: "চাকরিচ্যুতি", en: "Termination" } },
      { code: "WORKPLACE_INJURY", label: { bn: "কর্মস্থলে দুর্ঘটনা / ক্ষতিপূরণ", en: "Workplace injury / compensation" } },
    ],
    CRIMINAL_DEFENCE: [
      { code: "ACCUSED", label: { bn: "আসামি / অভিযুক্ত", en: "Accused person" } },
      { code: "BAIL", label: { bn: "জামিন", en: "Bail" } },
    ],
    CYBER_HARASSMENT: [{ code: "ONLINE_HARASSMENT", label: { bn: "অনলাইন হয়রানি", en: "Online harassment" } }],
    SEXUAL_HARASSMENT: [
      { code: "SEXUAL_HARASSMENT", label: { bn: "যৌন হয়রানি", en: "Sexual harassment" } },
      { code: "SEXUAL_ASSAULT", label: { bn: "যৌন নিপীড়ন / ধর্ষণ", en: "Sexual assault / rape" } },
    ],
    SECURITY: [
      { code: "THREAT", label: { bn: "হুমকি / প্রাণনাশের ভয়", en: "Threats / fear for life" } },
      { code: "MISSING_OR_KIDNAPPED", label: { bn: "নিখোঁজ / অপহরণ", en: "Missing / kidnapped" } },
    ],
    OTHER: [{ code: "OTHER", label: { bn: "অন্যান্য", en: "Other" } }],
  },
  rules: [
    rule({
      ruleId: "R01-URGENT-SAFETY",
      when: { urgencyAny: ["IMMEDIATE_DANGER", "DETENTION", "VIOLENCE_OR_THREAT"] },
      result: "URGENT_ESCALATION",
      title: { bn: "জরুরি নিরাপত্তা / স্বাধীনতার ঝুঁকি", en: "Urgent safety / liberty risk" },
      basis: { bn: "রেকর্ডে তাৎক্ষণিক বিপদ, আটক বা সহিংসতা/হুমকির সংকেত আছে। ঝুঁকি থাকা অবস্থায় অপর পক্ষের সাথে মধ্যস্থতা করা হয় না — আগে সুরক্ষা।", en: "The record carries an immediate-danger, detention or violence/threat flag. While that risk is open, mediation with the other party is not attempted — protection comes first." },
      expectedDocs: ["POLICE_REPORT"],
    }),
    rule({
      ruleId: "R02-VIOLENCE",
      when: { categories: ["VIOLENCE"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "নির্যাতন / সহিংসতা", en: "Violence / abuse" },
      basis: { bn: "সহিংসতার অভিযোগ অভিযুক্তের সাথে মধ্যস্থতায় পাঠানো হয় না; যৌতুক-সংক্রান্ত আঘাতের ফৌজদারি মামলা বাধ্যতামূলক মধ্যস্থতার বাইরে রাখা হয়েছে।", en: "Violence is not mediated with the alleged perpetrator; criminal dowry-injury cases were kept out of mandatory pre-case mediation." },
      law: "Nari o Shishu Nirjatan Daman Ain 2000 (s.11(g) excluded from mandatory mediation)",
      expectedDocs: ["MEDICAL", "POLICE_REPORT"],
    }),
    rule({
      ruleId: "R03-CRIMINAL",
      when: { categories: ["CRIMINAL_DEFENCE"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "ফৌজদারি মামলা", en: "Criminal proceedings" },
      basis: { bn: "ফৌজদারি মামলায় আদালতে প্রতিনিধিত্ব লাগে; মামলা-পূর্ব মধ্যস্থতার বিষয় নয়।", en: "Criminal proceedings need representation in court; not a pre-case mediation matter." },
      expectedDocs: ["POLICE_REPORT"],
    }),
    rule({
      ruleId: "R04-COURT-REFERRED",
      when: { courtStatus: ["REFERRED_FOR_MEDIATION"] },
      result: "COURT_REFERRED_MEDIATION",
      title: { bn: "আদালত মধ্যস্থতায় পাঠিয়েছে", en: "Referred by the court" },
      basis: { bn: "চলমান মামলা আদালত বা ট্রাইব্যুনাল লিগ্যাল এইড অফিসে মধ্যস্থতার জন্য পাঠিয়েছে। নিষ্পত্তি হলে চলমান মামলা নিষ্পন্ন হয় — মামলা-পূর্ব প্রক্রিয়া থেকে আলাদা।", en: "A court or tribunal referred a pending case to the legal aid office for mediation. A settlement disposes of the pending case — a different lifecycle from pre-case mediation." },
      law: "Legal Aid Services Act 2000, s.21A · Code of Civil Procedure 1908, s.89A",
      track: "COURT_REFERRED",
    }),
    rule({
      ruleId: "R05-COURT-STATUS-UNKNOWN",
      when: { courtStatus: ["UNKNOWN"] },
      result: "REQUIRES_OFFICER_REVIEW",
      title: { bn: "আদালতের অবস্থা জানা নেই", en: "Court status not recorded" },
      basis: { bn: "আগে থেকে মামলা আছে কিনা না জেনে মামলা-পূর্ব ও আদালত-প্রেরিত মধ্যস্থতা আলাদা করা যায় না। আদালতের অবস্থা লিখুন।", en: "Without knowing whether a court case exists, pre-case and court-referred paths cannot be told apart. Record the court status." },
    }),
    rule({
      ruleId: "R06-PENDING-SUIT",
      when: { courtStatus: ["FILED_PENDING", "APPEAL"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "চলমান মামলা", en: "Case already in court" },
      basis: { bn: "মামলা চলমান — প্রতিনিধিত্ব প্রয়োজন। পরে আদালত মধ্যস্থতায় পাঠালে পুনরায় শ্রেণিবিন্যাস করুন।", en: "A case is pending — representation is needed. If the court later refers it to mediation, reclassify." },
    }),
    rule({
      ruleId: "R07-DECIDED",
      when: { courtStatus: ["DECIDED"] },
      result: "REQUIRES_OFFICER_REVIEW",
      title: { bn: "রায় হয়ে গেছে", en: "Already decided" },
      basis: { bn: "রায় হয়ে গেছে — আপিল, রায় বাস্তবায়ন বা অন্য সহায়তা কর্মকর্তা ঠিক করবেন।", en: "Already decided — appeal, execution or other help is for the officer to decide." },
    }),
    rule({
      ruleId: "R08-NO-SUBCATEGORY",
      when: { subcategoryMissing: true },
      result: "REQUIRES_OFFICER_REVIEW",
      title: { bn: "উপ-ধরন নেই", en: "Subcategory not recorded" },
      basis: { bn: "নিয়ম প্রয়োগ করতে বিরোধের নির্দিষ্ট ধরন (উপ-ধরন) দরকার।", en: "The rules need the specific kind of dispute (subcategory)." },
    }),
    mandatory("R10-FAMILY-COURTS", ["DIVORCE", "CONJUGAL_RIGHTS", "DOWER", "MAINTENANCE", "CUSTODY_GUARDIANSHIP"], "Family Courts Act 2023, s.5", "Family Courts matter (divorce, conjugal rights, dower, maintenance, custody)", "পারিবারিক আদালতের বিষয় (তালাক, দাম্পত্য অধিকার, দেনমোহর, ভরণপোষণ, হেফাজত)", ["MARRIAGE_CERT", "NID"]),
    mandatory("R11-DOWRY", ["DOWRY_DEMAND"], "Dowry Prohibition Act 2018, ss.3–4", "Dowry demand / transaction", "যৌতুক দাবি / লেনদেন", ["MARRIAGE_CERT"]),
    mandatory("R12-HOUSE-RENT", ["HOUSE_RENT"], "House Rent Control Act 1991", "House rent dispute", "বাড়িভাড়া বিরোধ", []),
    mandatory("R13-PRE-EMPTION-AGRI", ["PRE_EMPTION_AGRICULTURAL"], "State Acquisition and Tenancy Act 1950, s.96", "Pre-emption — agricultural land", "অগ্রক্রয় — কৃষি জমি", ["LAND_DEED"]),
    mandatory("R14-PRE-EMPTION-NONAGRI", ["PRE_EMPTION_NON_AGRICULTURAL"], "Non-Agricultural Tenancy Act 1949, s.24", "Pre-emption — non-agricultural land", "অগ্রক্রয় — অকৃষি জমি", ["LAND_DEED"]),
    mandatory("R15-PARENTS", ["PARENTS_MAINTENANCE"], "Parents Maintenance Act 2013, s.8", "Parents' maintenance", "পিতা-মাতার ভরণপোষণ", ["NID"]),
    mandatory("R16-PARTITION", ["PARTITION"], "Partition suit (Assistant Judge Court)", "Partition of property", "সম্পত্তি বণ্টন", ["LAND_DEED"]),
    rule({
      ruleId: "R20-LISTED-NOT-NOTIFIED",
      when: { subcategories: MANDATORY_SUBS, courtStatus: NO_COURT },
      result: "MEDIATION_AVAILABLE",
      title: { bn: "তালিকাভুক্ত বিরোধ — এই জেলায় বাধ্যতামূলক নয়", en: "Listed dispute — not mandatory in this district" },
      basis: { bn: "বিরোধটি বাধ্যতামূলক তালিকায় আছে, কিন্তু এই জেলায় এখনো চালু হয়নি — স্বেচ্ছায় মামলা-পূর্ব মধ্যস্থতা করা যায়।", en: "The dispute is on the mandatory list, but mandatory mediation is not in force in this district yet — voluntary pre-case mediation is available." },
      law: "Legal Aid Services Act 2000, s.21B (pre-case ADR)",
      track: "PRE_LITIGATION",
    }),
    rule({
      ruleId: "R21-VOLUNTARY-MEDIATION",
      when: { subcategories: ["MARITAL_RECONCILIATION", "BOUNDARY_NEIGHBOUR", "MONEY_CLAIM", "OTHER_FAMILY"], courtStatus: NO_COURT },
      result: "MEDIATION_AVAILABLE",
      title: { bn: "স্বেচ্ছায় মধ্যস্থতাযোগ্য বিরোধ", en: "Suitable for voluntary mediation" },
      basis: { bn: "আদালতে মামলা নেই; উভয় পক্ষ রাজি ও নিরাপদ হলে লিগ্যাল এইড অফিসে মধ্যস্থতা করা যায়।", en: "No court case; if both parties agree and it is safe, the legal aid office can mediate." },
      law: "Legal Aid Services Act 2000, s.21B (pre-case ADR)",
      track: "PRE_LITIGATION",
    }),
    rule({
      ruleId: "R22-CHEQUE",
      when: { subcategories: ["CHEQUE_DISHONOUR"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "চেক ডিজঅনার", en: "Cheque dishonour" },
      basis: { bn: "চেক ডিজঅনার মামলা বাধ্যতামূলক মধ্যস্থতার বাইরে; নির্দিষ্ট সময়ের মধ্যে অভিযোগ দায়ের করতে হয়।", en: "Cheque-dishonour cases were kept out of mandatory mediation; a complaint must be filed within the time limit." },
      law: "Negotiable Instruments Act 1881, s.138",
    }),
    rule({
      ruleId: "R23-SMALL-LOCAL",
      when: { subcategories: ["SMALL_LOCAL_DISPUTE"], courtStatus: NO_COURT },
      result: "OTHER_REFERRAL",
      title: { bn: "ছোট স্থানীয় বিরোধ", en: "Small local dispute" },
      basis: { bn: "ইউনিয়ন পর্যায়ের ছোট দেওয়ানি / ফৌজদারি বিরোধ গ্রাম আদালতে নিষ্পত্তি হতে পারে — আর্থিক সীমার মধ্যে কিনা কর্মকর্তা যাচাই করবেন।", en: "Small union-level civil / criminal disputes can go to the village court — the officer checks it is within that court's value limit." },
      law: "Village Courts Act 2006",
      referralTarget: "GRAM_ADALAT",
    }),
    rule({
      ruleId: "R24-LABOUR",
      when: { categories: ["LABOUR"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "শ্রম বিরোধ", en: "Labour dispute" },
      basis: { bn: "মজুরি, চাকরিচ্যুতি বা ক্ষতিপূরণের দাবি সাধারণত শ্রম আদালতে করতে হয়।", en: "Wage, termination or compensation claims usually go to the Labour Court." },
      law: "Bangladesh Labour Act 2006",
      expectedDocs: ["EMPLOYMENT_PROOF"],
    }),
    rule({
      ruleId: "R25-CYBER",
      when: { categories: ["CYBER_HARASSMENT"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "অনলাইন হয়রানি", en: "Online harassment" },
      basis: { bn: "অভিযোগ দায়ের ও প্রমাণ সংরক্ষণে আইনি সহায়তা প্রয়োজন।", en: "Needs legal help to file a complaint and preserve evidence." },
      expectedDocs: ["EVIDENCE_SCREENSHOT"],
    }),
    rule({
      ruleId: "R26-TITLE-EVICTION",
      when: { subcategories: ["TITLE", "EVICTION"] },
      result: "LAWYER_ASSISTANCE",
      title: { bn: "স্বত্ব / উচ্ছেদ", en: "Title / eviction" },
      basis: { bn: "স্বত্ব ঘোষণা বা উচ্ছেদ ঠেকাতে সাধারণত মামলা বা আদালতের আদেশ লাগে।", en: "Declaring title or stopping an eviction usually needs a suit or a court order." },
      expectedDocs: ["LAND_DEED"],
    }),
  ],
};

/** The rule table in force: the install's db.pathwayRules if set, otherwise the shipped defaults. */
export function pathwayRulesOf(db: Pick<DlasDb, "pathwayRules">): PathwayRuleset {
  return db.pathwayRules ?? DEFAULT_PATHWAY_RULES;
}

export function subcategoriesFor(rules: PathwayRuleset, c: MatterCategory | null) {
  return c ? (rules.subcategories[c] ?? []) : [];
}

export const EMPTY_PATHWAY_INPUTS: PathwayInputs = {
  subcategory: null,
  courtStatus: "UNKNOWN",
  mediationOrigin: null,
  courtName: null,
  courtLevel: null,
  courtCaseNo: null,
  referralDate: null,
  referralOrderReference: null,
  referringAuthority: null,
  currentLitigationStage: null,
  referralDeadline: null,
  setBy: null,
  setByName: null,
  setAt: null,
};

/* ------------------------------ classifier ------------------------------ */

export type PathwayAssessmentDraft = Omit<PathwayAssessment, "assessmentId" | "at"> & { rule: PathwayRule | null };

function mandatoryIn(rules: PathwayRuleset, d: DistrictCode | null) {
  return rules.mandatoryPreCaseDistricts === "ALL" || (!!d && rules.mandatoryPreCaseDistricts.includes(d));
}

/** Deterministic: first enabled rule whose every condition matches. Reads structured fields only. */
export function classifyPathway(a: ApplicationRecord, inputs: PathwayInputs, rules: PathwayRuleset): PathwayAssessmentDraft {
  const d = a.data;
  const category = d.matter.category;
  const district = d.applicant.district;
  const flags = [...d.urgency.flags] as UrgencyFlag[];
  const docs = d.documents.filter((x) => x.status === "ATTACHED").map((x) => x.type);
  const subs = subcategoriesFor(rules, category);
  const subcategory = inputs.subcategory && subs.some((s) => s.code === inputs.subcategory) ? inputs.subcategory : null;
  const otherPartyIdentified = !!d.matter.opposingParty?.trim();
  const snapshot: PathwayAssessment["inputs"] = { category, subcategory, courtStatus: inputs.courtStatus, district, urgencyFlags: flags, otherPartyIdentified, documents: docs };

  let hit: PathwayRule | null = null;
  let matched: string[] = [];
  for (const r of rules.rules) {
    if (!r.enabled) continue;
    const w = r.when;
    const m: string[] = [];
    if (w.categories) {
      if (!category || !w.categories.includes(category)) continue;
      m.push(`category = ${category}`);
    }
    if (w.subcategoryMissing) {
      if (subcategory) continue;
      m.push("subcategory not recorded");
    }
    if (w.subcategories) {
      if (!subcategory || !w.subcategories.includes(subcategory)) continue;
      m.push(`subcategory = ${subcategory}`);
    }
    if (w.urgencyAny) {
      const f = flags.filter((x) => w.urgencyAny!.includes(x));
      if (!f.length) continue;
      m.push(`urgency flag: ${f.join(", ")}`);
    }
    if (w.courtStatus) {
      if (!w.courtStatus.includes(inputs.courtStatus)) continue;
      m.push(`court status = ${inputs.courtStatus}`);
    }
    if (w.mandatoryDistrictOnly) {
      if (!mandatoryIn(rules, district)) continue;
      m.push(`district ${district ?? "—"} is notified for mandatory pre-case mediation${rules.mandatoryPreCaseDistricts === "ALL" ? " (prototype: all districts)" : ""}`);
    }
    hit = r;
    matched = m;
    break;
  }
  const result: PathwayStatus = hit?.result ?? "REQUIRES_OFFICER_REVIEW";
  if (!hit) matched = ["no rule matched these facts"];

  // Warnings never change the result — they tell the officer what to check.
  const warnings: L[] = [];
  const med = isMediationStatus(result);
  if (med && !otherPartyIdentified) warnings.push({ bn: "অপর পক্ষ চিহ্নিত নয় — মধ্যস্থতার জন্য অপর পক্ষ লাগে।", en: "The other party is not identified — mediation needs the other party." });
  if (med && flags.includes("CHILD_INVOLVED")) warnings.push({ bn: "শিশু জড়িত — শিশুর স্বার্থ ও নিরাপত্তা বিবেচনা করুন।", en: "A child is involved — weigh the child's interest and safety." });
  if (med && flags.includes("EVICTION")) warnings.push({ bn: "উচ্ছেদের ঝুঁকি — মধ্যস্থতার সময়ে জরুরি আদেশ দরকার হতে পারে।", en: "Eviction risk — an urgent order may be needed while mediation runs." });
  if (med && d.safeContact.neutralWordingRequired) warnings.push({ bn: "নিরাপদ-যোগাযোগ বিধিনিষেধ আছে — যোগাযোগে সতর্ক থাকুন।", en: "Safe-contact restrictions apply — take care contacting the parties." });
  if (result === "MANDATORY_PRE_CASE_MEDIATION" && rules.mandatoryPreCaseDistricts === "ALL") warnings.push(rules.mandatoryNote);
  if (inputs.courtStatus === "REFERRED_FOR_MEDIATION" && !inputs.courtCaseNo) warnings.push({ bn: "আদালতের মামলা নম্বর লেখা হয়নি।", en: "The court case number is not recorded." });

  const evidence = (hit?.expectedDocs ?? []).map((t) => ({ docType: t, present: docs.includes(t) }));
  for (const e of evidence) if (!e.present) warnings.push({ bn: `প্রত্যাশিত নথি নেই: ${e.docType}`, en: `Expected document missing: ${e.docType}` });

  return { rulesVersion: rules.version, result, ruleId: hit?.ruleId ?? null, rule: hit, matched, warnings, evidence, inputs: snapshot };
}

export function trackFor(status: PathwayStatus, rule: PathwayRule | null): MediationTrack | null {
  if (status === "COURT_REFERRED_MEDIATION") return "COURT_REFERRED";
  if (status === "MANDATORY_PRE_CASE_MEDIATION" || status === "MEDIATION_AVAILABLE") return "PRE_LITIGATION";
  return rule?.track ?? null;
}

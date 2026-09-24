/* ------------------------------------------------------------------ *
 *  Incident taxonomy + RULE-BASED red flag (replaces the citizen's
 *  "Is this urgent?" question).
 *
 *  classifyIncident() reads what the applicant already gave — the matter
 *  type and their own description — and matches fixed keyword rules
 *  (Bangla + English) to a CATEGORY › SUBCATEGORY. Four categories are
 *  RED: VIOLENT_CRIME, SEXUAL_OFFENCE, PERSONAL_SAFETY, DOMESTIC_VIOLENCE.
 *  A red case is flagged for the Legal Aid Officer (DLO) at once.
 *
 *  Advisory only: no AI, no scoring model — every flag lists the rule and
 *  the words that triggered it, and the officer can confirm it or clear it
 *  with a reason (IncidentFlagService in incident-flag.ts, audited). Pure.
 * ------------------------------------------------------------------ */

import type { ApplicationRecord, IncidentCategory, IncidentClassification, IncidentSubcategory, MatterCategory } from "./schema";

type Bi = { bn: string; en: string };
export const INCIDENT_RULES_VERSION = "incident-rules-2026.09";

export const RED_CATEGORIES: readonly IncidentCategory[] = ["VIOLENT_CRIME", "SEXUAL_OFFENCE", "PERSONAL_SAFETY", "DOMESTIC_VIOLENCE"];

/** The taxonomy, in priority order (red first). Keywords: lower-case English (word match) and Bangla (substring). */
export const INCIDENT_TAXONOMY: { code: IncidentCategory; label: Bi; subs: { code: IncidentSubcategory; label: Bi; keywords: string[] }[] }[] = [
  {
    code: "VIOLENT_CRIME",
    label: { bn: "সহিংস অপরাধ", en: "Violent crime" },
    subs: [
      { code: "MURDER", label: { bn: "হত্যা", en: "Murder" }, keywords: ["murder", "murdered", "killed", "homicide", "খুন হয়েছে", "খুন করেছে", "হত্যা করেছে", "মেরে ফেলেছে", "খুন", "হত্যা"] },
      { code: "ATTEMPTED_MURDER", label: { bn: "হত্যাচেষ্টা", en: "Attempted murder" }, keywords: ["attempted murder", "tried to kill", "try to kill", "trying to kill", "হত্যার চেষ্টা", "খুনের চেষ্টা", "মেরে ফেলার চেষ্টা"] },
      { code: "ASSAULT", label: { bn: "মারধর / হামলা", en: "Assault" }, keywords: ["assault", "assaulted", "beat me", "beaten", "beats me", "hit me", "attacked", "punched", "মারধর", "মারধোর", "পিটিয়েছে", "মেরেছে", "হামলা", "শারীরিক আঘাত"] },
      { code: "GRIEVOUS_BODILY_HARM", label: { bn: "গুরুতর জখম", en: "Grievous bodily harm" }, keywords: ["grievous", "serious injury", "seriously injured", "broken bone", "fracture", "stabbed", "acid", "burned me", "গুরুতর আহত", "গুরুতর জখম", "হাড় ভেঙে", "হাড় ভেঙ্গে", "এসিড", "ছুরি মেরেছে", "কুপিয়েছে", "পুড়িয়ে"] },
      { code: "TORTURE", label: { bn: "নির্যাতন (টর্চার)", en: "Torture" }, keywords: ["torture", "tortured", "torturing", "টর্চার", "অমানবিক নির্যাতন"] },
    ],
  },
  {
    code: "SEXUAL_OFFENCE",
    label: { bn: "যৌন অপরাধ", en: "Sexual offence" },
    subs: [
      { code: "CHILD_SEXUAL_ABUSE", label: { bn: "শিশু যৌন নির্যাতন", en: "Child sexual abuse" }, keywords: ["child sexual abuse", "child abuse", "abused my daughter", "abused my son", "শিশু ধর্ষণ", "শিশুকে ধর্ষণ", "শিশু যৌন", "মেয়েকে ধর্ষণ", "শিশুর সাথে যৌন"] },
      { code: "RAPE", label: { bn: "ধর্ষণ", en: "Rape" }, keywords: ["rape", "raped", "ধর্ষণ", "ধর্ষিত", "ধর্ষণের"] },
      { code: "SEXUAL_ASSAULT", label: { bn: "যৌন নিপীড়ন", en: "Sexual assault" }, keywords: ["sexual assault", "sexually assaulted", "molested", "molest", "groped", "যৌন নিপীড়ন", "শ্লীলতাহানি"] },
      { code: "SEXUAL_HARASSMENT", label: { bn: "যৌন হয়রানি", en: "Sexual harassment" }, keywords: ["sexual harassment", "sexually harassed", "eve teasing", "obscene", "যৌন হয়রানি", "ইভটিজিং", "কুপ্রস্তাব", "অশ্লীল"] },
    ],
  },
  {
    code: "PERSONAL_SAFETY",
    label: { bn: "ব্যক্তিগত নিরাপত্তা", en: "Personal safety" },
    subs: [
      { code: "KIDNAPPING", label: { bn: "অপহরণ", en: "Kidnapping" }, keywords: ["kidnap", "kidnapped", "abducted", "abduct", "অপহরণ", "তুলে নিয়ে গেছে", "তুলে নিয়ে যায়"] },
      { code: "HUMAN_TRAFFICKING", label: { bn: "মানব পাচার", en: "Human trafficking" }, keywords: ["trafficking", "trafficked", "sold abroad", "মানব পাচার", "পাচার", "বিক্রি করে দিয়েছে"] },
      { code: "DEATH_THREAT", label: { bn: "প্রাণনাশের হুমকি", en: "Death threat" }, keywords: ["death threat", "threatened to kill", "will kill me", "kill me", "প্রাণনাশের হুমকি", "মেরে ফেলার হুমকি", "খুনের হুমকি", "মেরে ফেলবে", "জানে মেরে"] },
      { code: "STALKING", label: { bn: "পিছু নেওয়া / উত্ত্যক্ত", en: "Stalking" }, keywords: ["stalking", "stalks me", "stalked", "following me", "পিছু নেয়", "পিছু নিচ্ছে", "উত্ত্যক্ত", "উত্যক্ত"] },
      { code: "MISSING_PERSON", label: { bn: "নিখোঁজ", en: "Missing person" }, keywords: ["missing person", "is missing", "went missing", "has been missing", "disappeared", "নিখোঁজ", "খুঁজে পাচ্ছি না"] },
    ],
  },
  {
    code: "DOMESTIC_VIOLENCE",
    label: { bn: "পারিবারিক সহিংসতা", en: "Domestic violence" },
    subs: [
      { code: "PHYSICAL_ABUSE", label: { bn: "শারীরিক নির্যাতন", en: "Physical abuse" }, keywords: ["domestic violence", "dowry", "husband beats", "husband hit", "যৌতুক", "পারিবারিক সহিংসতা", "নারী নির্যাতন", "শারীরিক নির্যাতন", "স্বামী মারধর", "নির্যাতন"] },
      { code: "PSYCHOLOGICAL_ABUSE", label: { bn: "মানসিক নির্যাতন", en: "Psychological abuse" }, keywords: ["mental torture", "psychological abuse", "emotional abuse", "মানসিক নির্যাতন", "মানসিক অত্যাচার"] },
      { code: "ECONOMIC_ABUSE", label: { bn: "আর্থিক নির্যাতন", en: "Economic abuse" }, keywords: ["economic abuse", "financial abuse", "took my salary", "controls my money", "আর্থিক নির্যাতন", "বেতন কেড়ে", "টাকা কেড়ে"] },
      { code: "THREAT", label: { bn: "হুমকি", en: "Threat" }, keywords: ["threat", "threatened", "threatening", "threatens", "হুমকি", "ভয় দেখায়", "ভয় দেখাচ্ছে"] },
    ],
  },
  {
    code: "PROPERTY",
    label: { bn: "সম্পত্তি", en: "Property" },
    subs: [
      { code: "LAND_DISPUTE", label: { bn: "জমি বিরোধ", en: "Land dispute" }, keywords: ["land", "plot", "boundary", "জমি", "দখল", "খতিয়ান", "সীমানা", "ভিটা"] },
      { code: "TENANCY", label: { bn: "ভাড়াটিয়া / বাড়িওয়ালা", en: "Tenancy" }, keywords: ["tenant", "landlord", "rent", "evicted", "eviction", "ভাড়া", "বাড়িওয়ালা", "উচ্ছেদ"] },
      { code: "INHERITANCE", label: { bn: "উত্তরাধিকার", en: "Inheritance" }, keywords: ["inheritance", "inherit", "heirs", "ওয়ারিশ", "উত্তরাধিকার", "বণ্টন", "বাটোয়ারা"] },
      { code: "PROPERTY_DAMAGE", label: { bn: "সম্পত্তির ক্ষতি", en: "Property damage" }, keywords: ["damaged", "destroyed", "vandal", "ভাঙচুর", "ক্ষতি করেছে", "নষ্ট করেছে"] },
    ],
  },
  {
    code: "FAMILY",
    label: { bn: "পারিবারিক", en: "Family" },
    subs: [
      { code: "DIVORCE", label: { bn: "তালাক", en: "Divorce" }, keywords: ["divorce", "talaq", "তালাক", "বিবাহবিচ্ছেদ"] },
      { code: "CHILD_CUSTODY", label: { bn: "সন্তানের হেফাজত", en: "Child custody" }, keywords: ["custody", "guardianship", "হেফাজত", "অভিভাবকত্ব", "সন্তান নিয়ে গেছে"] },
      { code: "MAINTENANCE", label: { bn: "ভরণপোষণ", en: "Maintenance" }, keywords: ["maintenance", "dower", "denmohor", "ভরণপোষণ", "খোরপোশ", "দেনমোহর", "মোহরানা"] },
      { code: "FAMILY_DISPUTE", label: { bn: "পারিবারিক বিরোধ", en: "Family dispute" }, keywords: ["family dispute", "in-laws", "পারিবারিক বিরোধ", "পারিবারিক কলহ"] },
    ],
  },
  {
    code: "LABOR",
    label: { bn: "শ্রম", en: "Labour" },
    subs: [
      { code: "UNPAID_WAGES", label: { bn: "বকেয়া মজুরি", en: "Unpaid wages" }, keywords: ["unpaid wages", "wages", "salary", "not paid", "বেতন", "মজুরি", "বকেয়া"] },
      { code: "WRONGFUL_TERMINATION", label: { bn: "অন্যায় ছাঁটাই", en: "Wrongful termination" }, keywords: ["fired", "dismissed", "terminated", "sacked", "চাকরিচ্যুত", "ছাঁটাই", "চাকরি থেকে বের"] },
      { code: "WORKPLACE_HARASSMENT", label: { bn: "কর্মস্থলে হয়রানি", en: "Workplace harassment" }, keywords: ["workplace harassment", "harassed at work", "কর্মস্থলে হয়রানি", "অফিসে হয়রানি"] },
    ],
  },
  {
    code: "CIVIL",
    label: { bn: "দেওয়ানি", en: "Civil" },
    subs: [
      { code: "CONTRACT", label: { bn: "চুক্তি", en: "Contract" }, keywords: ["contract", "agreement broken", "breach", "চুক্তি ভঙ্গ", "চুক্তি"] },
      { code: "DEBT", label: { bn: "ঋণ / পাওনা", en: "Debt" }, keywords: ["debt", "loan", "owes me", "borrowed", "ঋণ", "ধার", "পাওনা টাকা", "পাওনা"] },
      { code: "COMPENSATION", label: { bn: "ক্ষতিপূরণ", en: "Compensation" }, keywords: ["compensation", "ক্ষতিপূরণ"] },
      { code: "OTHER_CIVIL_DISPUTE", label: { bn: "অন্যান্য দেওয়ানি বিরোধ", en: "Other civil dispute" }, keywords: ["civil dispute", "দেওয়ানি"] },
    ],
  },
  {
    code: "ADMINISTRATIVE",
    label: { bn: "প্রশাসনিক", en: "Administrative" },
    subs: [
      { code: "DOCUMENTATION", label: { bn: "কাগজপত্র", en: "Documentation" }, keywords: ["birth certificate", "nid correction", "certificate", "জন্ম নিবন্ধন", "পরিচয়পত্র সংশোধন", "সনদ"] },
      { code: "GOVERNMENT_SERVICE", label: { bn: "সরকারি সেবা", en: "Government service" }, keywords: ["government office", "allowance", "bribe", "সরকারি অফিস", "ভাতা", "ঘুষ"] },
      { code: "OTHER_ADMINISTRATIVE", label: { bn: "অন্যান্য", en: "Other" }, keywords: [] },
    ],
  },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other" }, subs: [] },
];

/** When the description matches nothing, the matter type the applicant chose decides the category (no subcategory). */
const MATTER_FALLBACK: Record<MatterCategory, IncidentCategory> = {
  FAMILY: "FAMILY",
  VIOLENCE: "VIOLENT_CRIME",
  LAND: "PROPERTY",
  CYBER_HARASSMENT: "PERSONAL_SAFETY",
  LABOUR: "LABOR",
  CRIMINAL_DEFENCE: "OTHER",
  SEXUAL_HARASSMENT: "SEXUAL_OFFENCE",
  SECURITY: "PERSONAL_SAFETY",
  CIVIL_MONEY: "CIVIL",
  OTHER: "OTHER",
};

/** Matter types that are URGENT (red) as soon as the applicant picks them — whatever the description says. */
export const RED_MATTERS: readonly MatterCategory[] = ["CRIMINAL_DEFENCE", "SEXUAL_HARASSMENT", "SECURITY", "VIOLENCE"];
const MATTER_FALLBACK_SUB: Partial<Record<MatterCategory, IncidentSubcategory>> = { SEXUAL_HARASSMENT: "SEXUAL_HARASSMENT" };

/** Words that put a violence/threat into the family home → DOMESTIC_VIOLENCE. */
const DOMESTIC_CONTEXT = ["husband", "wife", "in-law", "in-laws", "mother-in-law", "father-in-law", "স্বামী", "স্ত্রী", "শ্বশুর", "শাশুড়ি", "শ্বশুরবাড়ি", "দেবর", "ননদ"];
const DOMESTIC_REMAP: Partial<Record<IncidentSubcategory, IncidentSubcategory>> = { ASSAULT: "PHYSICAL_ABUSE", GRIEVOUS_BODILY_HARM: "PHYSICAL_ABUSE", TORTURE: "PHYSICAL_ABUSE", DEATH_THREAT: "THREAT" };

const MATTER_NAME: Partial<Record<MatterCategory, string>> = { CRIMINAL_DEFENCE: "Criminal case", SEXUAL_HARASSMENT: "Sexual harassment", SECURITY: "Security / threats", VIOLENCE: "Violence / abuse" };

const isAscii = (k: string) => /^[\x00-\x7f]+$/.test(k);
const escapeRe = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const catOf = new Map<IncidentSubcategory, IncidentCategory>();
for (const c of INCIDENT_TAXONOMY) for (const s of c.subs) catOf.set(s.code, c.code);
const ORDER = INCIDENT_TAXONOMY.flatMap((c) => c.subs.map((s) => s.code));
/** Longest phrases first, so "খুনের হুমকি" (death threat) is consumed before "খুন" (murder). */
const KEYWORDS = INCIDENT_TAXONOMY.flatMap((c) => c.subs.flatMap((s) => s.keywords.map((k) => ({ k: k.toLowerCase(), sub: s.code })))).sort((x, y) => y.k.length - x.k.length);

export function incidentLabel(category: IncidentCategory, sub: IncidentSubcategory | null, lang: "bn" | "en") {
  const c = INCIDENT_TAXONOMY.find((x) => x.code === category);
  const s = c?.subs.find((x) => x.code === sub);
  return `${c?.label[lang] ?? category}${s ? ` › ${s.label[lang]}` : ""}`;
}

/** Pure, deterministic rule evaluation over the applicant's own words + matter type. */
export function classifyIncident(input: { matter: MatterCategory | null; summary: string | null }, at: string = new Date().toISOString()): IncidentClassification {
  let text = ` ${(input.summary ?? "").toLowerCase()} `;
  const hits: { sub: IncidentSubcategory; keyword: string }[] = [];
  for (const { k, sub } of KEYWORDS) {
    const re = isAscii(k) ? new RegExp(`(^|[^a-z])${escapeRe(k)}(?![a-z])`, "g") : new RegExp(escapeRe(k), "g");
    if (!re.test(text)) continue;
    hits.push({ sub, keyword: k });
    text = text.replace(re, (m, p1?: string) => (isAscii(k) ? `${p1 ?? ""}${" ".repeat(m.length - (p1?.length ?? 0))}` : " ".repeat(m.length)));
  }
  const domestic = DOMESTIC_CONTEXT.some((w) => (isAscii(w) ? new RegExp(`(^|[^a-z])${escapeRe(w)}(?![a-z])`).test(` ${(input.summary ?? "").toLowerCase()} `) : (input.summary ?? "").includes(w))) || input.matter === "FAMILY";
  const matched = hits.map((h) => {
    let sub = h.sub;
    if (domestic && DOMESTIC_REMAP[sub]) sub = DOMESTIC_REMAP[sub]!;
    return { category: catOf.get(sub)!, subcategory: sub, keyword: h.keyword, domesticContext: sub !== h.sub };
  });
  // a bare "threat" outside the home is still a safety matter
  for (const m of matched) if (m.subcategory === "THREAT" && !domestic) Object.assign(m, { category: "PERSONAL_SAFETY" as IncidentCategory, subcategory: null });
  const rank = (m: { category: IncidentCategory; subcategory: IncidentSubcategory | null }) => INCIDENT_TAXONOMY.findIndex((c) => c.code === m.category) * 1000 + (m.subcategory ? ORDER.indexOf(m.subcategory) : 999);
  matched.sort((x, y) => rank(x) - rank(y));
  const top = matched[0];
  const category: IncidentCategory = top ? top.category : input.matter ? MATTER_FALLBACK[input.matter] : "OTHER";
  const subcategory = top ? top.subcategory : input.matter ? MATTER_FALLBACK_SUB[input.matter] ?? null : null;
  const redByMatter = !!input.matter && RED_MATTERS.includes(input.matter);
  const red = RED_CATEGORIES.includes(category) || redByMatter;
  let rule = top ? `${category}${subcategory ? `/${subcategory}` : ""} ← “${top.keyword}”${top.domesticContext ? " (in the family home)" : ""}` : `${category} ← matter type ${input.matter ?? "not given"}`;
  if (redByMatter) rule = `URGENT: applicant chose “${MATTER_NAME[input.matter!]}” · ${rule}`;
  return {
    category,
    subcategory,
    red,
    matched: matched.map(({ category: c, subcategory: s, keyword }) => ({ category: c, subcategory: s, keyword })),
    basis: top && !redByMatter ? "DESCRIPTION_KEYWORDS" : "MATTER_TYPE",
    rule,
    rulesVersion: INCIDENT_RULES_VERSION,
    at,
    advisoryOnly: true,
    officerReview: null,
  };
}

/** The classification of a record (stored at submission; derived for older records). */
export function incidentOf(a: Pick<ApplicationRecord, "data" | "submittedAt"> & { incident?: IncidentClassification | null }): IncidentClassification {
  return a.incident ?? classifyIncident({ matter: a.data.matter.category, summary: a.data.matter.summary }, a.submittedAt);
}

/** Red flag shown to the DLO: a red category, unless an officer cleared it with a reason. */
export function isRedFlagged(a: Pick<ApplicationRecord, "data" | "submittedAt"> & { incident?: IncidentClassification | null }): boolean {
  const c = incidentOf(a);
  return c.red && c.officerReview?.decision !== "CLEARED";
}

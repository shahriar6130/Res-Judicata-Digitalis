/* ------------------------------------------------------------------ *
 *  Reference data shared by EVERY channel.
 *
 *  The order of each list is the keypad/menu order used by IVR and
 *  USSD (index + 1), and the option order in the Web and UDC forms.
 *  One list → one set of codes → identical JSON from every door.
 * ------------------------------------------------------------------ */

import type {
  AccessibilityNeed,
  DayCode,
  ContactMethod,
  DistrictCode,
  DocType,
  Gender,
  LanguageCode,
  MatterCategory,
  Relation,
  SafeTime,
  UrgencyFlag,
} from "./schema";

export type L = { bn: string; en: string };
export type Option<T extends string> = { code: T; label: L };

export const DISTRICTS: Option<DistrictCode>[] = [
  { code: "DHAKA", label: { bn: "ঢাকা", en: "Dhaka" } },
  { code: "JOYPURHAT", label: { bn: "জয়পুরহাট", en: "Joypurhat" } },
  { code: "JHENAIDAH", label: { bn: "ঝিনাইদহ", en: "Jhenaidah" } },
  { code: "KHAGRACHARI", label: { bn: "খাগড়াছড়ি", en: "Khagrachari" } },
  { code: "BARGUNA", label: { bn: "বরগুনা", en: "Barguna" } },
  { code: "CHATTOGRAM", label: { bn: "চট্টগ্রাম", en: "Chattogram" } },
  { code: "RAJSHAHI", label: { bn: "রাজশাহী", en: "Rajshahi" } },
  { code: "SYLHET", label: { bn: "সিলেট", en: "Sylhet" } },
];

export const MATTERS: Option<MatterCategory>[] = [
  { code: "FAMILY", label: { bn: "পারিবারিক / ভরণপোষণ", en: "Family / maintenance" } },
  { code: "VIOLENCE", label: { bn: "নির্যাতন / সহিংসতা", en: "Violence / abuse" } },
  { code: "LAND", label: { bn: "জমি / সম্পত্তি", en: "Land / property" } },
  { code: "CYBER_HARASSMENT", label: { bn: "অনলাইন হয়রানি", en: "Online harassment" } },
  { code: "LABOUR", label: { bn: "শ্রম / মজুরি", en: "Labour / wages" } },
  { code: "CRIMINAL_DEFENCE", label: { bn: "ফৌজদারি মামলা", en: "Criminal case" } },
  { code: "CIVIL_MONEY", label: { bn: "দেওয়ানি / টাকা-পয়সা", en: "Civil / money" } },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other" } },
];

export const GENDERS: Option<Gender>[] = [
  { code: "FEMALE", label: { bn: "নারী", en: "Female" } },
  { code: "MALE", label: { bn: "পুরুষ", en: "Male" } },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other" } },
  { code: "UNDISCLOSED", label: { bn: "বলতে চাই না", en: "Prefer not to say" } },
];

export const LANGUAGES: Option<LanguageCode>[] = [
  { code: "bn", label: { bn: "বাংলা", en: "Bangla" } },
  { code: "en", label: { bn: "ইংরেজি", en: "English" } },
  { code: "marma", label: { bn: "মারমা", en: "Marma" } },
  { code: "other", label: { bn: "অন্য ভাষা", en: "Other language" } },
];

export const ACCESS_NEEDS: Option<AccessibilityNeed>[] = [
  { code: "VISUAL", label: { bn: "দৃষ্টি প্রতিবন্ধিতা", en: "Visual impairment" } },
  { code: "HEARING", label: { bn: "শ্রবণ প্রতিবন্ধিতা", en: "Hearing impairment" } },
  { code: "LOW_LITERACY", label: { bn: "পড়তে অসুবিধা", en: "Difficulty reading" } },
  { code: "SPEECH", label: { bn: "কথা বলতে অসুবিধা", en: "Speech difficulty" } },
];

export const RELATIONS: Option<Relation>[] = [
  { code: "SIBLING", label: { bn: "ভাই / বোন", en: "Brother / sister" } },
  { code: "SPOUSE", label: { bn: "স্বামী / স্ত্রী", en: "Spouse" } },
  { code: "PARENT", label: { bn: "মা / বাবা", en: "Parent" } },
  { code: "CHILD", label: { bn: "সন্তান", en: "Child" } },
  { code: "OTHER_RELATIVE", label: { bn: "অন্য আত্মীয়", en: "Other relative" } },
  { code: "NEIGHBOUR", label: { bn: "প্রতিবেশী", en: "Neighbour" } },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other" } },
];

export const SAFE_TIMES: Option<SafeTime>[] = [
  { code: "MORNING", label: { bn: "সকাল (৯–১২টা)", en: "Morning (9–12)" } },
  { code: "AFTERNOON", label: { bn: "দুপুর (১২–৪টা)", en: "Afternoon (12–4)" } },
  { code: "EVENING", label: { bn: "সন্ধ্যা (৪–৮টা)", en: "Evening (4–8)" } },
  { code: "ANYTIME", label: { bn: "যেকোনো সময়", en: "Any time" } },
];

export const CONTACT_METHODS: Option<ContactMethod>[] = [
  { code: "CALL", label: { bn: "ফোন কল", en: "Phone call" } },
  { code: "SMS", label: { bn: "এসএমএস", en: "SMS" } },
  { code: "VIA_REPRESENTATIVE", label: { bn: "প্রতিনিধির মাধ্যমে", en: "Through my representative" } },
  { code: "VISIT_OFFICE", label: { bn: "অফিসে এসে জানব", en: "I will visit the office" } },
];

export const URGENCY_FLAGS: Option<UrgencyFlag>[] = [
  { code: "IMMEDIATE_DANGER", label: { bn: "এখনই বিপদে আছি", en: "In danger right now" } },
  { code: "VIOLENCE_OR_THREAT", label: { bn: "মারধর / হুমকি", en: "Violence or threats" } },
  { code: "ONLINE_HARASSMENT", label: { bn: "ছবি/তথ্য অনলাইনে ছড়ানো", en: "Images/info spread online" } },
  { code: "EVICTION", label: { bn: "বাড়ি থেকে উচ্ছেদ", en: "Being evicted" } },
  { code: "DETENTION", label: { bn: "আটক / গ্রেফতার", en: "Detained / arrested" } },
  { code: "CHILD_INVOLVED", label: { bn: "শিশু জড়িত", en: "A child is involved" } },
];

export const DOC_TYPES: Option<DocType>[] = [
  { code: "NID", label: { bn: "জাতীয় পরিচয়পত্র", en: "National ID" } },
  { code: "BIRTH_CERT", label: { bn: "জন্ম নিবন্ধন", en: "Birth certificate" } },
  { code: "MARRIAGE_CERT", label: { bn: "কাবিননামা / বিবাহ সনদ", en: "Marriage certificate" } },
  { code: "LAND_DEED", label: { bn: "জমির দলিল / খতিয়ান", en: "Land deed / record" } },
  { code: "POLICE_REPORT", label: { bn: "জিডি / এফআইআর", en: "GD / FIR copy" } },
  { code: "MEDICAL", label: { bn: "চিকিৎসা সনদ", en: "Medical report" } },
  { code: "EVIDENCE_SCREENSHOT", label: { bn: "স্ক্রিনশট / প্রমাণ", en: "Screenshots / evidence" } },
  { code: "EMPLOYMENT_PROOF", label: { bn: "চাকরির প্রমাণ", en: "Employment proof" } },
  { code: "OTHER", label: { bn: "অন্যান্য নথি", en: "Other document" } },
];

/** Document checklist per matter — used by every door (UDC shows it as a checklist, IVR/USSD read it out). */
export const REQUIRED_DOCS: Record<MatterCategory, DocType[]> = {
  FAMILY: ["NID", "MARRIAGE_CERT"],
  VIOLENCE: ["NID", "MEDICAL"],
  LAND: ["NID", "LAND_DEED"],
  CYBER_HARASSMENT: ["NID", "EVIDENCE_SCREENSHOT"],
  LABOUR: ["NID", "EMPLOYMENT_PROOF"],
  CRIMINAL_DEFENCE: ["NID", "POLICE_REPORT"],
  CIVIL_MONEY: ["NID"],
  OTHER: ["NID"],
};

/** Evidence types treated as sensitive (restricted access) by default. */
export const SENSITIVE_DOC_TYPES: DocType[] = ["EVIDENCE_SCREENSHOT", "MEDICAL"];

export function label<T extends string>(list: Option<T>[], code: T | null | undefined, lang: "bn" | "en"): string {
  if (!code) return "—";
  return list.find((o) => o.code === code)?.label[lang] ?? code;
}

export function byIndex<T extends string>(list: Option<T>[], digit: string): T | null {
  const i = Number(digit) - 1;
  return Number.isInteger(i) && i >= 0 && i < list.length ? list[i].code : null;
}

/** Normalise a Bangladeshi mobile number to 01XXXXXXXXX, or null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Bangla digits → ASCII, then strip everything but digits.
  let d = raw
    .replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)))
    .replace(/[^\d]/g, "");
  if (d.startsWith("880")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export function officeFor(district: DistrictCode | null): string {
  return district ? `DLAO-${district}` : "DLAO-UNROUTED";
}

export const DAYS: Option<DayCode>[] = [
  { code: "SAT", label: { bn: "শনিবার", en: "Saturday" } },
  { code: "SUN", label: { bn: "রবিবার", en: "Sunday" } },
  { code: "MON", label: { bn: "সোমবার", en: "Monday" } },
  { code: "TUE", label: { bn: "মঙ্গলবার", en: "Tuesday" } },
  { code: "WED", label: { bn: "বুধবার", en: "Wednesday" } },
  { code: "THU", label: { bn: "বৃহস্পতিবার", en: "Thursday" } },
  { code: "FRI", label: { bn: "শুক্রবার", en: "Friday" } },
];

/** "HH:MM" → the coarse SafeTime bucket used by every door. */
export function bucketForTime(time: string): SafeTime {
  const h = Number(time.split(":")[0]);
  if (!Number.isFinite(h)) return "ANYTIME";
  return h < 12 ? "MORNING" : h < 16 ? "AFTERNOON" : "EVENING";
}

/** Human label for a record's safe contact time (exact window wins). */
export function safeTimeLabel(sc: { safeTime: SafeTime | null; window?: { day: DayCode; time: string } | null }, lang: "bn" | "en"): string {
  if (sc.window) return `${label(DAYS, sc.window.day, lang)} ${sc.window.time}`;
  return label(SAFE_TIMES, sc.safeTime, lang);
}

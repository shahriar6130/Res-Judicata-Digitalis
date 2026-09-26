import type { MatterCategory } from "@/lib/intake-store";

export type IntakeIssueType = {
  id: string;
  matter: MatterCategory;
  label: { bn: string; en: string };
  keywords: readonly string[];
};

/**
 * Plain-language situations shown to citizens who want to choose for themselves.
 * The legal-facing broad category stays behind the scenes.
 */
export const INTAKE_ISSUE_TYPES: readonly IntakeIssueType[] = [
  { id: "maintenance", matter: "family", label: { bn: "ভরণপোষণ পাচ্ছি না", en: "Maintenance is not being paid" }, keywords: ["ভরণপোষণ", "খোরপোষ", "maintenance", "aliment"] },
  { id: "dower", matter: "family", label: { bn: "দেনমোহর বা কাবিনের টাকা", en: "Dower or marriage payment" }, keywords: ["দেনমোহর", "মোহরানা", "কাবিন", "dower", "mahr"] },
  { id: "divorce", matter: "family", label: { bn: "তালাক, বিচ্ছেদ বা বিবাহ", en: "Divorce, separation or marriage" }, keywords: ["তালাক", "ডিভোর্স", "বিচ্ছেদ", "বিয়ে", "বিবাহ", "divorce", "separation", "marriage"] },
  { id: "custody", matter: "family", label: { bn: "সন্তানের হেফাজত বা দেখা করা", en: "Child custody or visitation" }, keywords: ["সন্তানের হেফাজত", "বাচ্চার হেফাজত", "সন্তান দেখতে", "custody", "visitation"] },
  { id: "family_dispute", matter: "family", label: { bn: "অন্যান্য পারিবারিক বিরোধ", en: "Another family dispute" }, keywords: ["পারিবারিক", "শ্বশুরবাড়ি", "স্বামী", "স্ত্রী", "family dispute", "in-laws", "husband", "wife"] },

  { id: "land_boundary", matter: "land", label: { bn: "জমির সীমানা বা দখল", en: "Land boundary or possession" }, keywords: ["জমির সীমানা", "জমি দখল", "সীমানা", "boundary", "land possession", "occupied my land"] },
  { id: "land_deed", matter: "land", label: { bn: "দলিল, খতিয়ান বা মালিকানা", en: "Deed, record or ownership" }, keywords: ["দলিল", "খতিয়ান", "নামজারি", "মালিকানা", "deed", "record of rights", "ownership", "mutation"] },
  { id: "inheritance", matter: "land", label: { bn: "উত্তরাধিকারসূত্রে সম্পত্তি", en: "Inherited property" }, keywords: ["উত্তরাধিকার", "ওয়ারিশ", "পৈতৃক", "inheritance", "heir", "ancestral property"] },
  { id: "partition", matter: "land", label: { bn: "সম্পত্তি ভাগ বা বণ্টন", en: "Property partition" }, keywords: ["বাটোয়ারা", "সম্পত্তি ভাগ", "জমি ভাগ", "partition", "divide property"] },
  { id: "tenancy", matter: "land", label: { bn: "বাড়িভাড়া, ভাড়াটিয়া বা উচ্ছেদ", en: "Rent, tenancy or eviction" }, keywords: ["বাড়িভাড়া", "ভাড়াটিয়া", "উচ্ছেদ", "rent", "tenant", "tenancy", "eviction"] },

  { id: "debt", matter: "civil", label: { bn: "ঋণ বা ধার করা টাকা", en: "Debt or borrowed money" }, keywords: ["ঋণ", "ধার", "পাওনা টাকা", "debt", "loan", "borrowed money"] },
  { id: "contract", matter: "civil", label: { bn: "চুক্তি ভঙ্গ", en: "Broken contract" }, keywords: ["চুক্তি", "এগ্রিমেন্ট", "contract", "agreement", "breach"] },
  { id: "compensation", matter: "civil", label: { bn: "ক্ষতিপূরণ দাবি", en: "Compensation claim" }, keywords: ["ক্ষতিপূরণ", "লোকসান", "compensation", "damages", "loss"] },
  { id: "consumer", matter: "civil", label: { bn: "পণ্য বা সেবা নিয়ে বিরোধ", en: "Product or service dispute" }, keywords: ["পণ্য", "সেবা", "ক্রেতা", "ভোক্তা", "product", "service", "consumer"] },
  { id: "money_recovery", matter: "civil", label: { bn: "টাকা ফেরত পাচ্ছি না", en: "Money is not being returned" }, keywords: ["টাকা ফেরত", "পাওনা", "money back", "refund", "recover money"] },

  { id: "theft", matter: "criminal", label: { bn: "চুরি, ছিনতাই বা ডাকাতি", en: "Theft, snatching or robbery" }, keywords: ["চুরি", "ছিনতাই", "ডাকাতি", "theft", "stolen", "robbery", "snatching"] },
  { id: "fraud", matter: "criminal", label: { bn: "প্রতারণা, জালিয়াতি বা নকল কাগজ", en: "Fraud, forgery or false documents" }, keywords: ["প্রতারণা", "জালিয়াতি", "জাল দলিল", "fraud", "scam", "forgery", "fake document"] },
  { id: "assault", matter: "criminal", label: { bn: "মারধর বা শারীরিক আক্রমণ", en: "Assault or physical attack" }, keywords: ["মারধর", "মেরেছে", "আঘাত", "হামলা", "assault", "beaten", "attacked", "physical attack"] },
  { id: "arrest", matter: "criminal", label: { bn: "গ্রেপ্তার, আটক বা ফৌজদারি মামলা", en: "Arrest, detention or criminal case" }, keywords: ["গ্রেপ্তার", "আটক", "ফৌজদারি মামলা", "থানা", "arrest", "detained", "criminal case", "police case"] },

  { id: "sexual_harassment", matter: "sexual_harassment", label: { bn: "যৌন হয়রানি", en: "Sexual harassment" }, keywords: ["যৌন হয়রানি", "অশ্লীল স্পর্শ", "sexual harassment", "unwanted touching"] },
  { id: "sexual_assault", matter: "sexual_harassment", label: { bn: "ধর্ষণ বা যৌন নিপীড়ন", en: "Rape or sexual assault" }, keywords: ["ধর্ষণ", "যৌন নিপীড়ন", "rape", "sexual assault", "sexual abuse"] },
  { id: "child_sexual_abuse", matter: "sexual_harassment", label: { bn: "শিশুর প্রতি যৌন নির্যাতন", en: "Child sexual abuse" }, keywords: ["শিশু যৌন", "বাচ্চাকে যৌন", "child sexual", "child abuse"] },

  { id: "domestic_violence", matter: "security", label: { bn: "ঘরে নির্যাতন বা সহিংসতা", en: "Violence or abuse at home" }, keywords: ["ঘরে নির্যাতন", "পারিবারিক সহিংসতা", "স্বামী মার", "স্ত্রী মার", "domestic violence", "abuse at home"] },
  { id: "death_threat", matter: "security", label: { bn: "প্রাণনাশের হুমকি", en: "Threat to life" }, keywords: ["প্রাণনাশের হুমকি", "খুনের হুমকি", "মেরে ফেলবে", "death threat", "threat to kill", "kill me"] },
  { id: "kidnapping", matter: "security", label: { bn: "অপহরণ বা নিখোঁজ ব্যক্তি", en: "Kidnapping or missing person" }, keywords: ["অপহরণ", "নিখোঁজ", "kidnap", "abduct", "missing person"] },
  { id: "stalking", matter: "security", label: { bn: "পিছু নেওয়া বা বারবার হুমকি", en: "Stalking or repeated threats" }, keywords: ["পিছু নিচ্ছে", "অনুসরণ", "বারবার হুমকি", "stalking", "following me", "repeated threats"] },
  { id: "trafficking", matter: "security", label: { bn: "মানব পাচার", en: "Human trafficking" }, keywords: ["মানব পাচার", "পাচার", "human trafficking", "trafficked"] },

  { id: "unpaid_wages", matter: "labour", label: { bn: "বেতন বা মজুরি বকেয়া", en: "Unpaid salary or wages" }, keywords: ["বেতন বকেয়া", "মজুরি", "বেতন দেয়নি", "unpaid salary", "unpaid wages", "wage"] },
  { id: "dismissal", matter: "labour", label: { bn: "চাকরি থেকে অন্যায়ভাবে বাদ", en: "Unfair dismissal" }, keywords: ["চাকরি থেকে বাদ", "বরখাস্ত", "চাকরিচ্যুত", "dismissed", "fired", "termination"] },
  { id: "workplace_harassment", matter: "labour", label: { bn: "কর্মক্ষেত্রে হয়রানি", en: "Workplace harassment" }, keywords: ["কর্মক্ষেত্রে হয়রানি", "অফিসে হয়রানি", "workplace harassment", "harassed at work"] },
  { id: "workplace_benefits", matter: "labour", label: { bn: "কর্মস্থলে দুর্ঘটনা বা পাওনা সুবিধা", en: "Work injury or employment benefits" }, keywords: ["কর্মস্থলে দুর্ঘটনা", "শ্রমিক ক্ষতিপূরণ", "গ্র্যাচুইটি", "work injury", "employment benefit", "gratuity"] },

  { id: "government_service", matter: "other", label: { bn: "সরকারি কাগজ বা সেবা", en: "Government document or service" }, keywords: ["সরকারি সেবা", "জন্ম নিবন্ধন", "এনআইডি", "সনদ", "government service", "birth registration", "certificate"] },
  { id: "other", matter: "other", label: { bn: "অন্য কোনো সমস্যা", en: "Another kind of problem" }, keywords: [] },
] as const;

export type CategorySuggestion = {
  matter: MatterCategory;
  issue: IntakeIssueType;
};

/** Local, deterministic classifier used only to simulate the future AI experience. */
export function simulateIntakeCategory(text: string): CategorySuggestion | null {
  const normalized = text.trim().toLocaleLowerCase();
  if (normalized.length < 8) return null;

  let best: { issue: IntakeIssueType; score: number } | null = null;
  for (const issue of INTAKE_ISSUE_TYPES) {
    let score = 0;
    for (const keyword of issue.keywords) {
      if (normalized.includes(keyword.toLocaleLowerCase())) score += keyword.includes(" ") ? 3 : 1;
    }
    if (score > (best?.score ?? 0)) best = { issue, score };
  }

  const issue = best?.issue ?? INTAKE_ISSUE_TYPES[INTAKE_ISSUE_TYPES.length - 1];
  return { matter: issue.matter, issue };
}

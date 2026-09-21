"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Lang = "bn" | "en";

export const LANGS: readonly { id: Lang; label: string }[] = [
  { id: "bn", label: "বাংলা" },
  { id: "en", label: "English" },
];

const STORAGE_KEY = "shakkho.lang";

export type MessageKey =
  | "tagline"
  | "signInTitle"
  | "mobileNumber"
  | "mobilePlaceholder"
  | "passwordLabel"
  | "errorIdentifier"
  | "errorPassword"
  | "signingIn"
  | "signInAction"
  | "footer"
  | "workspacePlaceholder"
  | "backToSignIn"
  | "portalLinks"
  | "openMenu"
  | "closeMenu"
  | "simulated"
  | "simClock"
  | "simSms"
  | "simCourt"
  | "simScenario"
  | "simReset"
  | "navMyCases"
  | "navMessages"
  | "navProfile"
  | "navActionQueue"
  | "navCases"
  | "navAlerts"
  | "navAssignments"
  | "navTimeline"
  | "navAssignedCases"
  | "navHearingReports"
  | "navCalendar"
  | "navOverview"
  | "navUsers"
  | "navRules"
  | "navMetrics"
  | "navAudit"
  | "navFileComplaint"
  | "complaintTitle"
  | "complaintIntro"
  | "complaintReasonLabel"
  | "complaintReasonNotResponding"
  | "complaintReasonAskedPayment"
  | "complaintReasonOther"
  | "complaintOtherPlaceholder"
  | "complaintMessageLabel"
  | "complaintMessagePlaceholder"
  | "complaintSubmit"
  | "complaintClose"
  | "complaintSuccess"
  | "complaintReference"
  | "complaintAnonymous"
  | "complaintAnonymousHint"
  | "complaintContactLabel"
  | "complaintContact16699"
  | "complaintContactThisPhone"
  | "complaintContactNone"
  | "complaintWhenLabel"
  | "complaintLinkedCaseLabel"
  | "complaintWhoSees"
  | "complaintWhoSeesOfficer"
  | "complaintWhoSeesManager"
  | "complaintWhoSeesAnonymousPool"
  | "complaintConsent"
  | "complaintWhatNextTitle"
  | "complaintWhatNextCase"
  | "complaintWhatNextContact"
  | "complaintWhatNextDays"
  | "complaintLinkedTag"
  | "complaintAnonymousTag";

type Messages = Record<Lang, Record<MessageKey, string>>;

export const messages: Messages = {
  bn: {
    tagline: "বাংলাদেশের যাচাইকৃত আইনি সহায়তা কার্যপ্রণালী",
    signInTitle: "লগইন করুন",
    mobileNumber: "মোবাইল নম্বর",
    mobilePlaceholder: "01XXXXXXXXX",
    passwordLabel: "পাসওয়ার্ড",
    errorIdentifier: "মোবাইল নম্বর লিখুন।",
    errorPassword: "পাসওয়ার্ড লিখুন।",
    signingIn: "প্রবেশ করা হচ্ছে…",
    signInAction: "লগইন করুন",
    footer: "প্রোটোটাইপ · শুধুমাত্র সিমুলেটেড তথ্য",
    workspacePlaceholder:
      "এই ওয়ার্কস্পেসটি পরবর্তী ধাপে তৈরি হবে। লগইন প্রবাহটি সফল।",
    backToSignIn: "লগইন পৃষ্ঠায় ফিরুন",
    portalLinks: "অন্যান্য লগইন পোর্টাল",
    openMenu: "মেনু খুলুন",
    closeMenu: "মেনু বন্ধ করুন",
    simulated: "সিমুলেশন",
    simClock: "ঘড়ি",
    simSms: "এসএমএস",
    simCourt: "আদালত",
    simScenario: "পরিস্থিতি",
    simReset: "রিসেট",
    navMyCases: "আমার মামলা",
    navMessages: "বার্তা",
    navProfile: "প্রোফাইল",
    navActionQueue: "কার্যক্রম সারি",
    navCases: "মামলা",
    navAlerts: "সতর্কতা",
    navAssignments: "নিয়োগ",
    navTimeline: "সময়রেখা",
    navAssignedCases: "নিয়োগপ্রাপ্ত মামলা",
    navHearingReports: "শুনানির প্রতিবেদন",
    navCalendar: "ক্যালেন্ডার",
    navOverview: "সংক্ষেপ",
    navUsers: "ব্যবহারকারী",
    navRules: "নিয়ম ও থ্রেশহোল্ড",
    navMetrics: "মেট্রিক্স",
    navAudit: "নিবন্ধন",
    navFileComplaint: "অভিযোগ জানান",
    complaintTitle: "একটি অভিযোগ নথিভুক্ত করুন",
    complaintIntro:
      "আপনার আইনি সহায়তা প্রক্রিয়া নিয়ে কোনো সমস্যা হলে নিচের ফর্মটি পূরণ করুন। একজন কর্মকর্তা শীঘ্রই পর্যালোচনা করবেন।",
    complaintReasonLabel: "সমস্যার ধরন",
    complaintReasonNotResponding: "আইনজীবী যোগাযোগ করছেন না",
    complaintReasonAskedPayment: "আমার কাছে অর্থ চাওয়া হয়েছে",
    complaintReasonOther: "অন্য (নিচে লিখুন)",
    complaintOtherPlaceholder: "সংক্ষেপে লিখুন",
    complaintMessageLabel: "আপনার বার্তা (ঐচ্ছিক)",
    complaintMessagePlaceholder:
      "ঘটনা, তারিখ বা যা জানাতে চান তা এখানে লিখুন",
    complaintSubmit: "অভিযোগ জমা দিন",
    complaintClose: "বন্ধ করুন",
    complaintSuccess:
      "আপনার অভিযোগ নথিভুক্ত হয়েছে। একজন কর্মকর্তা শীঘ্রই পর্যালোচনা করবেন।",
    complaintReference: "রেফারেন্স নম্বর",
    complaintAnonymous: "বেনামে অভিযোগ করুন",
    complaintAnonymousHint:
      "আপনার নাম ও মামলার তথ্য এই অভিযোগের সাথে যুক্ত হবে না।",
    complaintContactLabel: "কীভাবে যোগাযোগ করবেন?",
    complaintContact16699: "১৬৬৯৯ নম্বরে কল ব্যাক",
    complaintContactThisPhone: "এই ফোন নম্বরে",
    complaintContactNone: "আমাকে যোগাযোগ করবেন না",
    complaintWhenLabel: "কখন ঘটেছে? (ঐচ্ছিক)",
    complaintLinkedCaseLabel: "কোন মামলা সম্পর্কে?",
    complaintWhoSees: "কে দেখবেন",
    complaintWhoSeesOfficer: "জেলা আইনি সহায়তা কর্মকর্তা",
    complaintWhoSeesManager: "প্যানেল আইনজীবী ব্যবস্থাপক",
    complaintWhoSeesAnonymousPool:
      "নাম প্রকাশ না করা অভিযোগ পর্যালোচনা প্যানেল",
    complaintConsent:
      "আমি নিশ্চিত করছি যে এই তথ্য আমার জানামতে সত্য।",
    complaintWhatNextTitle: "এরপর কী হবে",
    complaintWhatNextCase: "আপনার মামলা চলমান থাকবে।",
    complaintWhatNextContact:
      "আমরা শুধু আপনার বেছে নেওয়া মাধ্যমে যোগাযোগ করব।",
    complaintWhatNextDays: "৫ কর্মদিবসের মধ্যে আপনি জানতে পারবেন।",
    complaintLinkedTag: "মামলার সাথে যুক্ত",
    complaintAnonymousTag: "বেনামে",
  },
  en: {
    tagline: "Verified legal aid operations",
    signInTitle: "Sign in",
    mobileNumber: "Mobile number",
    mobilePlaceholder: "01XXXXXXXXX",
    passwordLabel: "Password",
    errorIdentifier: "Enter your mobile number.",
    errorPassword: "Enter your password.",
    signingIn: "Signing in…",
    signInAction: "Sign in",
    footer: "Prototype · simulated data only",
    workspacePlaceholder:
      "This workspace is built in a later step. The sign-in flow works.",
    backToSignIn: "Back to sign in",
    portalLinks: "Other sign-in portals",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    simulated: "Simulated",
    simClock: "Clock",
    simSms: "SMS",
    simCourt: "Court",
    simScenario: "Scenario",
    simReset: "Reset",
    navMyCases: "My Cases",
    navMessages: "Messages",
    navProfile: "Profile",
    navActionQueue: "Action Queue",
    navCases: "Cases",
    navAlerts: "Alerts",
    navAssignments: "Assignments",
    navTimeline: "Timeline",
    navAssignedCases: "Assigned Cases",
    navHearingReports: "Hearing Reports",
    navCalendar: "Calendar",
    navOverview: "Overview",
    navUsers: "Users",
    navRules: "Rules & Thresholds",
    navMetrics: "Metrics",
    navAudit: "Audit Log",
    navFileComplaint: "File a complaint",
    complaintTitle: "File a complaint",
    complaintIntro:
      "If something has gone wrong with your legal aid, use this form to tell the office. An officer will review it.",
    complaintReasonLabel: "Reason",
    complaintReasonNotResponding: "Lawyer is not responding",
    complaintReasonAskedPayment: "I have been asked to pay",
    complaintReasonOther: "Other (please describe)",
    complaintOtherPlaceholder: "Brief description",
    complaintMessageLabel: "Your message (optional)",
    complaintMessagePlaceholder: "What happened, when, or anything else",
    complaintSubmit: "Submit complaint",
    complaintClose: "Close",
    complaintSuccess:
      "Your complaint was recorded. An officer will review it soon.",
    complaintReference: "Reference number",
    complaintAnonymous: "File this complaint anonymously",
    complaintAnonymousHint:
      "Your name and case details will not be linked to this complaint.",
    complaintContactLabel: "How should we contact you?",
    complaintContact16699: "16699 call back",
    complaintContactThisPhone: "This phone number",
    complaintContactNone: "Do not contact me",
    complaintWhenLabel: "When did this happen? (optional)",
    complaintLinkedCaseLabel: "Which case is this about?",
    complaintWhoSees: "Who will see this",
    complaintWhoSeesOfficer: "District Legal Aid Officer",
    complaintWhoSeesManager: "Panel Lawyer Manager",
    complaintWhoSeesAnonymousPool: "Anonymous review panel",
    complaintConsent:
      "I confirm this information is true to the best of my knowledge.",
    complaintWhatNextTitle: "What happens next",
    complaintWhatNextCase: "Your case continues as normal.",
    complaintWhatNextContact:
      "We will contact you only through the channel you chose.",
    complaintWhatNextDays:
      "You will hear from us within 5 working days.",
    complaintLinkedTag: "Linked to case",
    complaintAnonymousTag: "Anonymous",
  },
};

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY_READ = STORAGE_KEY;
const listeners = new Set<() => void>();

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "bn";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_READ);
    return stored === "en" || stored === "bn" ? stored : "bn";
  } catch {
    return "bn";
  }
}

function subscribeToLang(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", onLangStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onLangStorage);
  };
}

function onLangStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY_READ) {
    listeners.forEach((listener) => listener());
  }
}

function persistLang(next: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY_READ, next);
  } catch {
    // storage unavailable — keep in-memory choice
  }
  listeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore<Lang>(
    subscribeToLang,
    readStoredLang,
    () => "bn",
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: persistLang,
      t: (key) => messages[lang][key],
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

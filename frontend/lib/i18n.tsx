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
  | "navAudit";

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
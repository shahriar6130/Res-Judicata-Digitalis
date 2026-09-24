export type RoleId =
  | "citizen"
  | "dlo"
  | "mediator"
  | "helpline"
  | "udc"
  | "lawyer"
  | "receiving-authority"
  | "case-support"
  | "supervisor"
  | "finance"
  | "appeal"
  | "committee"
  | "auditor"
  | "admin";

export type Localized = { bn: string; en: string };

export type Role = {
  id: RoleId;
  name: Localized;
  description: Localized;
  /** Sign-in portal route for this role. */
  path: string;
  /** Workspace route after sign-in. */
  home: string;
  provider: boolean;
};

export const ROLES: readonly Role[] = [
  {
    id: "citizen",
    name: { bn: "নাগরিক", en: "Citizen" },
    description: {
      bn: "মামলার অবস্থা দেখুন এবং পরবর্তী পদক্ষেপ যাচাই করুন।",
      en: "Check case status and verify the next step.",
    },
    path: "/",
    home: "/dashboard/citizen",
    provider: false,
  },
  {
    id: "dlo",
    name: {
      bn: "জেলা আইনি সহায়তা কর্মকর্তা",
      en: "District Legal Aid Officer",
    },
    description: {
      bn: "হস্তক্ষেপ কিউ সমাধান করুন এবং প্রমাণসহ সিদ্ধান্ত নিন।",
      en: "Clear the intervention queue and make evidence-cited decisions.",
    },
    path: "/dlo",
    home: "/dashboard/dlo",
    provider: true,
  },
  {
    id: "mediator",
    name: { bn: "মধ্যস্থতাকারী", en: "Mediator" },
    description: {
      bn: "নিয়োগকৃত মামলায় মধ্যস্থতা পরিচালনা করুন — সেশন, উপস্থিতি, আলোচনা ও ফলাফল।",
      en: "Conduct mediation on your assigned cases — sessions, attendance, discussion and outcome.",
    },
    path: "/mediator",
    home: "/dashboard/mediator",
    provider: true,
  },
  {
    id: "helpline",
    name: { bn: "১৬৬৯৯ সহায়তা এজেন্ট", en: "16699 helpline agent" },
    description: {
      bn: "নিরাপদ বাক্য যাচাই করে অনুমোদিত অবস্থা জানান বা সহায়তাপ্রাপ্ত আবেদন চালিয়ে নিন।",
      en: "Verify the safe phrase, disclose permitted status, or continue assisted intake.",
    },
    path: "/portal/helpline",
    home: "/dashboard/helpline",
    provider: true,
  },
  {
    id: "udc",
    name: { bn: "ইউডিসি উদ্যোক্তা", en: "UDC entrepreneur" },
    description: {
      bn: "সম্মতি, নথির মান এবং অফলাইন পুনরুদ্ধারসহ সীমিত সহায়তা দিন।",
      en: "Provide bounded assistance with consent, document quality, and offline recovery.",
    },
    path: "/udc",
    home: "/dashboard/udc",
    provider: true,
  },
  {
    id: "lawyer",
    name: { bn: "প্যানেল আইনজীবী", en: "Panel lawyer" },
    description: {
      bn: "শুনানির প্রতিবেদন ও সেবার প্রমাণ জমা দিন।",
      en: "Submit hearing reports and service evidence.",
    },
    path: "/lawyer",
    home: "/dashboard/lawyer",
    provider: true,
  },
  {
    id: "receiving-authority",
    name: { bn: "গ্রহণকারী ডিএলএও / কর্তৃপক্ষ", en: "Receiving DLAO / authority" },
    description: {
      bn: "ন্যূনতম প্যাকেজ যাচাই করে গ্রহণ করুন বা কাঠামোবদ্ধ কারণে ফেরত দিন।",
      en: "Validate the minimum package, then accept or return it with a structured reason.",
    },
    path: "/portal/receiving-authority",
    home: "/dashboard/receiving-authority",
    provider: true,
  },
  {
    id: "case-support",
    name: { bn: "প্রশাসনিক / মামলা সহায়তা কর্মী", en: "Administrative / case-support staff" },
    description: {
      bn: "রেকর্ড খুঁজুন, সংস্করণ ইতিহাস দেখুন এবং নিয়মিত প্রতিবেদন তৈরি করুন।",
      en: "Search records, inspect version history, and produce routine reports.",
    },
    path: "/portal/case-support",
    home: "/dashboard/case-support",
    provider: true,
  },
  {
    id: "supervisor",
    name: { bn: "তত্ত্বাবধায়ক / এসকেলেশন কর্তৃপক্ষ", en: "Supervisor / escalation authority" },
    description: {
      bn: "সম্পূর্ণ প্রতিশ্রুতি ইতিহাস দেখে বকেয়া বা বারবার ফেরত কাজ সমাধান করুন।",
      en: "Resolve overdue or repeatedly returned work from the complete promise history.",
    },
    path: "/portal/supervisor",
    home: "/dashboard/supervisor",
    provider: true,
  },
  {
    id: "finance",
    name: { bn: "অর্থ / হিসাব পর্যালোচক", en: "Finance / accounts reviewer" },
    description: {
      bn: "বন্ধ-পরবর্তী প্রমাণ ও উদাহরণভিত্তিক ধাপ সমন্বয় পর্যালোচনা করুন।",
      en: "Review post-closure evidence and illustrative stage reconciliation.",
    },
    path: "/portal/finance",
    home: "/dashboard/finance",
    provider: true,
  },
  {
    id: "appeal",
    name: { bn: "আপিল কর্তৃপক্ষ", en: "Appeal authority" },
    description: {
      bn: "মূল সিদ্ধান্ত, কারণ ও আপিল উপকরণ দেখে কারণসহ সিদ্ধান্ত নিন।",
      en: "Review the original decision, reasons, and appeal material before deciding.",
    },
    path: "/portal/appeal",
    home: "/dashboard/appeal",
    provider: true,
  },
  {
    id: "committee",
    name: { bn: "এলএলএসি / এসসিএলএসি কর্মকর্তা", en: "LLAC / SCLAC officer" },
    description: {
      bn: "নিজ কার্যালয়ের অনুমোদিত যাচাই, রেফারেল ও সেবা পদক্ষেপ সম্পন্ন করুন।",
      en: "Perform only the verification, referral, and service actions authorised for the office.",
    },
    path: "/portal/committee",
    home: "/dashboard/committee",
    provider: true,
  },
  {
    id: "auditor",
    name: { bn: "শুধু-পঠন নিরীক্ষক / জুরি পরিদর্শক", en: "Read-only auditor / jury inspector" },
    description: {
      bn: "কোনো কার্যক্রম পরিবর্তন না করে ঘটনা, চেকপয়েন্ট ও সিদ্ধান্তের কর্তৃত্ব পুনর্গঠন করুন।",
      en: "Reconstruct events, checkpoints, and decision authority without changing state.",
    },
    path: "/portal/auditor",
    home: "/dashboard/auditor",
    provider: true,
  },
  {
    id: "admin",
    name: { bn: "প্রশাসক", en: "Administrator" },
    description: {
      bn: "নিয়ম, থ্রেশহোল্ড ও প্রবেশাধিকার পরিচালনা করুন।",
      en: "Manage rules, thresholds, and programme measures.",
    },
    path: "/admin",
    home: "/dashboard/admin",
    provider: true,
  },
];

export function getRole(id: RoleId): Role {
  return ROLES.find((role) => role.id === id) ?? ROLES[0];
}

export function findRole(id: string): Role | undefined {
  return ROLES.find((role) => role.id === id);
}

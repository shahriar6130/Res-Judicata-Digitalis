export type RoleId = "citizen" | "dlo" | "lawyer" | "admin";

export type Localized = { bn: string; en: string };

export type Role = {
  id: RoleId;
  name: Localized;
  description: Localized;
  /** Sign-in portal route for this role. */
  path: string;
  /** Workspace route after sign-in. */
  home: string;
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
    home: "/citizen",
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
    home: "/dlo/home",
  },
  {
    id: "lawyer",
    name: { bn: "প্যানেল আইনজীবী", en: "Panel lawyer" },
    description: {
      bn: "শুনানির প্রতিবেদন ও সেবার প্রমাণ জমা দিন।",
      en: "Submit hearing reports and service evidence.",
    },
    path: "/lawyer",
    home: "/lawyer/home",
  },
  {
    id: "admin",
    name: { bn: "প্রশাসক", en: "Administrator" },
    description: {
      bn: "নিয়ম, থ্রেশহোল্ড ও প্রবেশাধিকার পরিচালনা করুন।",
      en: "Manage rules, thresholds, and programme measures.",
    },
    path: "/admin",
    home: "/admin/home",
  },
];

export function getRole(id: RoleId): Role {
  return ROLES.find((role) => role.id === id) ?? ROLES[0];
}
/* ------------------------------------------------------------------ *
 *  CachePolicyService — explicit list of safe / restricted / never.
 *
 *  Per Phase 5 §21: every cache decision is named in the UI so users
 *  know exactly what stays on their device.
 * ------------------------------------------------------------------ */

import type { CachePolicy } from "../types";

const POLICY: CachePolicy = {
  safeToCache: [
    "Application shell (HTML / CSS)",
    "Fonts and design tokens",
    "Icons and illustrations",
    "Universal translation glossary",
    "Static help and accessibility pages",
  ],
  restrictedLocal: [
    "Active assisted intake draft",
    "Read-back confirmations",
    "Document metadata (without binary)",
    "Consent receipts (temporary)",
    "Network condition profile",
  ],
  neverCached: [
    "National ID full numbers",
    "Permanent applicant addresses",
    "Case ID — never client-cached",
    "Biometric data",
    "DLAS server credentials",
  ],
  restrictedExpiryMs: 14 * 24 * 60 * 60 * 1000,
  notes: {
    bn:
      "অস্থায়ী সংস্করণ স্থানীয়ভাবে সংরক্ষিত থাকে; কনফ্লিক্ট হলে মানব পর্যালোচনায় যায়। কেস আইডি কখনো ক্লায়েন্টে ক্যাশ হয় না।",
    en:
      "Temporary drafts are stored locally; conflicts route to human review. Case IDs are never client-cached.",
  },
};

export const CachePolicyService = {
  policy(): CachePolicy {
    return POLICY;
  },
};

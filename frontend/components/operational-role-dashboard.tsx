"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { useI18n, type Lang } from "@/lib/i18n";
import { getRole, type Localized, type RoleId } from "@/lib/roles";
import { HelplineWorkspace } from "@/components/helpline/workspace";
import { UdcWorkspace } from "@/components/udc/workspace";
import { MediatorWorklist } from "@/components/mediation/worklist";
import styles from "./operational-role-dashboard.module.css";

type OperationalRoleId = Exclude<RoleId, "citizen" | "dlo" | "lawyer" | "admin">;
type Task = {
  reference: string;
  title: Localized;
  detail: Localized;
  state: "DUE" | "OVERDUE" | "REVIEW" | "READ ONLY";
  action: Localized;
  authority: Localized;
  readOnly?: boolean;
};
type Workspace = {
  title: Localized;
  intro: Localized;
  primary: Localized;
  metrics: readonly [string, Localized, string, Localized, string, Localized];
  tasks: readonly [Task, Task];
};

const workspaces: Record<OperationalRoleId, Workspace> = {
  mediator: {
    title: { bn: "মধ্যস্থতা কার্যক্ষেত্র", en: "Mediation workspace" },
    intro: { bn: "নিরাপত্তা যাচাই, নোটিশ, অংশগ্রহণ ও ফলাফল একই রেকর্ডে পরিচালনা করুন।", en: "Manage safety screening, notices, participation, and outcomes from one record." },
    primary: { bn: "নিরাপত্তা যাচাই শুরু করুন", en: "Start safety screen" },
    metrics: ["04", { bn: "সক্রিয় মধ্যস্থতা", en: "Active mediations" }, "02", { bn: "নোটিশ বাকি", en: "Notices due" }, "01", { bn: "ব্যক্তিগত বিকল্প প্রয়োজন", en: "Needs in-person fallback" }],
    tasks: [
      { reference: "DLAS-2026-00412", title: { bn: "পৃথক অংশগ্রহণের নিরাপত্তা পর্যালোচনা", en: "Safety review for separate participation" }, detail: { bn: "দুই পক্ষের অংশগ্রহণের ধরন আলাদাভাবে নিশ্চিত করতে হবে।", en: "Participation mode must be confirmed separately for each party." }, state: "DUE", action: { bn: "নিরাপত্তা সিদ্ধান্ত নথিভুক্ত করুন", en: "Record safety decision" }, authority: { bn: "মধ্যস্থতাকারী কারণ ও অংশগ্রহণের সক্ষমতা যাচাই করবেন।", en: "Mediator must record a reason and verify participation capability." } },
      { reference: "DLAS-2026-00388", title: { bn: "দূরবর্তী সেশন ব্যর্থ", en: "Remote session failed" }, detail: { bn: "বাস্তব ব্যক্তিগত সেশনের প্রতিশ্রুতি তৈরি করতে হবে।", en: "A real in-person fallback promise must be created." }, state: "OVERDUE", action: { bn: "ব্যক্তিগত সেশন নির্ধারণ করুন", en: "Schedule in-person session" }, authority: { bn: "ব্যর্থ সংযোগকে ব্যর্থ মধ্যস্থতা বলা যাবে না।", en: "A failed connection cannot be treated as failed mediation." } },
    ],
  },
  helpline: {
    title: { bn: "১৬৬৯৯ সহায়তা ডেস্ক", en: "16699 assistance desk" },
    intro: { bn: "নিরাপদ বাক্য যাচাই করে অনুমোদিত স্ট্যাটাস বাক্য পড়ুন বা একই আবেদন চালিয়ে নিন।", en: "Verify the safe phrase, read the permitted Status Sentence, or continue the same intake." },
    primary: { bn: "নিরাপদ বাক্য যাচাই করুন", en: "Verify safe phrase" },
    metrics: ["07", { bn: "অপেক্ষমাণ কল", en: "Waiting calls" }, "03", { bn: "স্ট্যাটাস অনুরোধ", en: "Status requests" }, "01", { bn: "মানব হস্তান্তর", en: "Human handoff" }],
    tasks: [
      { reference: "APP-2026-10482", title: { bn: "অনুমোদিত অবস্থা জানতে চাওয়া হয়েছে", en: "Permitted status requested" }, detail: { bn: "সংখ্যাগত রেফারেন্স ও নিরাপদ বাক্য মেলানোর পর শুধু নিরাপদ বাক্যটি পড়ুন।", en: "Match the numeric reference and safe phrase before reading only the safe Status Sentence." }, state: "DUE", action: { bn: "যাচাই ও স্ট্যাটাস দেখুন", en: "Verify and view status" }, authority: { bn: "এজেন্ট সীমাবদ্ধ প্রমাণ দেখতে বা সিদ্ধান্ত নিতে পারবেন না।", en: "The agent cannot view restricted evidence or make legal decisions." } },
      { reference: "TEMP-NCH-03", title: { bn: "আগের আবেদন চালিয়ে নিন", en: "Continue an existing intake" }, detail: { bn: "নতুন নকল রেকর্ড না খুলে অসম্পূর্ণ ক্ষেত্র থেকে শুরু করুন।", en: "Resume from the missing field without opening a duplicate record." }, state: "REVIEW", action: { bn: "সহায়তাপ্রাপ্ত আবেদন খুলুন", en: "Open assisted intake" }, authority: { bn: "আগের বক্তব্যের উৎস ও অনিশ্চয়তা অক্ষুণ্ণ থাকবে।", en: "Prior provenance and uncertainty must remain intact." } },
    ],
  },
  udc: {
    title: { bn: "ইউডিসি সহায়তা কেন্দ্র", en: "UDC assistance centre" },
    intro: { bn: "বিনামূল্যের নোটিশ, সম্মতি, নথির মান ও অফলাইন খসড়া পরিচালনা করুন।", en: "Handle the free-service notice, consent, document quality, and offline drafts." },
    primary: { bn: "সহায়তাপ্রাপ্ত আবেদন শুরু করুন", en: "Start assisted intake" },
    metrics: ["03", { bn: "খসড়া", en: "Drafts" }, "01", { bn: "অফলাইন", en: "Offline" }, "02", { bn: "নথি পুনরায় নিতে হবে", en: "Document retakes" }],
    tasks: [
      { reference: "TEMP-NCH-03", title: { bn: "অফলাইন খসড়া পুনরুদ্ধার", en: "Recover offline draft" }, detail: { bn: "অস্থায়ী রসিদ আছে; সংযোগ ফিরলে নকল ছাড়া সমন্বয় করতে হবে।", en: "A temporary receipt exists; reconnect must sync without duplication." }, state: "REVIEW", action: { bn: "খসড়া পুনরুদ্ধার করুন", en: "Recover draft" }, authority: { bn: "অপারেটরের ফোন আবেদনকারীর নম্বর হবে না এবং প্রবেশাধিকার মেয়াদ শেষ হবে।", en: "The operator phone must not become the applicant contact and access must expire." } },
      { reference: "DOC-NCH-06", title: { bn: "ঝাপসা পরিচয়পত্র", en: "Blurred identity document" }, detail: { bn: "পাঠ অযোগ্য; অনুমান না করে আবার ছবি নিতে হবে।", en: "The text is unreadable; retake the image without guessing." }, state: "OVERDUE", action: { bn: "নথি পুনরায় নিন", en: "Retake document" }, authority: { bn: "নথির মান ও মৌখিক সম্মতি আলাদা ঘটনায় নথিভুক্ত হবে।", en: "Document quality and verbal consent are recorded as separate events." } },
    ],
  },
  "receiving-authority": {
    title: { bn: "রেফারেল গ্রহণ ডেস্ক", en: "Referral receiving desk" },
    intro: { bn: "সম্পূর্ণ ন্যূনতম প্যাকেজ যাচাই করুন; গ্রহণ না হওয়া পর্যন্ত প্রেরকই মালিক থাকে।", en: "Validate the complete minimum package; the sender remains owner until acceptance." },
    primary: { bn: "প্যাকেজ যাচাই করুন", en: "Validate package" },
    metrics: ["05", { bn: "আগত প্যাকেজ", en: "Incoming packages" }, "02", { bn: "অসম্পূর্ণ", en: "Incomplete" }, "01", { bn: "এসএলএ বকেয়া", en: "SLA overdue" }],
    tasks: [
      { reference: "REF-2026-0021", title: { bn: "ন্যূনতম প্যাকেজ সম্পূর্ণ", en: "Minimum package complete" }, detail: { bn: "পরিচয়, এখতিয়ার কারণ এবং উৎস নথি উপস্থিত।", en: "Identity, jurisdiction reason, and source documents are present." }, state: "DUE", action: { bn: "গ্রহণ করুন", en: "Accept responsibility" }, authority: { bn: "গ্রহণের পরই দৃশ্যমান মালিকানা পরিবর্তন হবে।", en: "Visible ownership changes only after acceptance." } },
      { reference: "REF-2026-0018", title: { bn: "এখতিয়ার প্রমাণ অনুপস্থিত", en: "Jurisdiction evidence missing" }, detail: { bn: "অসম্পূর্ণ প্যাকেজ গ্রহণ করা যাবে না; কাঠামোবদ্ধ কারণ প্রয়োজন।", en: "An incomplete package cannot be accepted; a structured return reason is required." }, state: "OVERDUE", action: { bn: "কারণসহ ফেরত দিন", en: "Return with reason" }, authority: { bn: "ফেরত পাঠানো গ্রহণ নয় এবং প্রেরকের দায় শেষ করে না।", en: "Transmission back is not acceptance and does not end sender responsibility." } },
    ],
  },
  "case-support": {
    title: { bn: "মামলা সহায়তা ও প্রতিবেদন", en: "Case support and reporting" },
    intro: { bn: "বাংলা, ইংরেজি বা প্রতিবর্ণীকরণে খুঁজুন এবং ধরা তথ্য থেকেই প্রতিবেদন তৈরি করুন।", en: "Search Bangla, English, or transliteration and report only from captured records." },
    primary: { bn: "রেকর্ড খুঁজুন", en: "Search records" },
    metrics: ["30", { bn: "সক্রিয় রেকর্ড", en: "Active records" }, "08", { bn: "হস্তান্তর নোট", en: "Handover notes" }, "01", { bn: "প্রতিবেদন বাকি", en: "Report due" }],
    tasks: [
      { reference: "SEARCH-RHM", title: { bn: "রহিম / Rahim / Rohim", en: "Rahim / রহিম / Rohim" }, detail: { bn: "তিন ভাষার অনুসন্ধান একই অনুমোদিত রেকর্ডে পৌঁছায়।", en: "Three-script search reaches the same authorised record." }, state: "READ ONLY", action: { bn: "সংস্করণ ইতিহাস দেখুন", en: "View version history" }, authority: { bn: "কর্মী রেকর্ড পুনর্গঠন করতে পারেন, আইনগত সিদ্ধান্ত নয়।", en: "Staff may reconstruct records, not make legal decisions." }, readOnly: true },
      { reference: "REPORT-SEP-01", title: { bn: "মাসিক নিয়মিত প্রতিবেদন", en: "Monthly routine report" }, detail: { bn: "ইতিমধ্যে ধরা তথ্য থেকে CSV/PDF প্রস্তুত।", en: "CSV/PDF is ready from data already captured." }, state: "DUE", action: { bn: "প্রতিবেদন প্রিভিউ করুন", en: "Preview report" }, authority: { bn: "রপ্তানি নতুন সিদ্ধান্ত বা তথ্য তৈরি করবে না।", en: "Export must not create new facts or decisions." }, readOnly: true },
    ],
  },
  supervisor: {
    title: { bn: "এসকেলেশন তত্ত্বাবধান", en: "Escalation oversight" },
    intro: { bn: "সম্পূর্ণ প্রতিশ্রুতি ইতিহাস দেখে নতুন মালিক, সময়সীমা বা চলমান ব্যতিক্রম নথিভুক্ত করুন।", en: "Use the full promise history to record a new owner, due time, or continuing exception." },
    primary: { bn: "সবচেয়ে পুরোনো এসকেলেশন দেখুন", en: "Review oldest escalation" },
    metrics: ["04", { bn: "খোলা এসকেলেশন", en: "Open escalations" }, "02", { bn: "দুইবার ফেরত", en: "Returned twice" }, "01", { bn: "চূড়ান্ত ধাপ", en: "Final rung" }],
    tasks: [
      { reference: "REF-RAHIM-02", title: { bn: "রেফারেল দুইবার ফেরত", en: "Referral returned twice" }, detail: { bn: "প্রেরক মালিক; ৩৬ ঘণ্টা অনিশ্চয়তায়।", en: "Sender remains owner; 36 hours in limbo." }, state: "OVERDUE", action: { bn: "রুট সিদ্ধান্ত নিন", en: "Record route decision" }, authority: { bn: "কারণ, নতুন মালিক এবং সময়সীমা বাধ্যতামূলক।", en: "Reason, new owner, and due time are required." } },
      { reference: "ESC-MARZINA-03", title: { bn: "আইনজীবীর পুনরাবৃত্ত নিষ্ক্রিয়তা", en: "Repeated lawyer inactivity" }, detail: { bn: "তিন মামলা পর্যালোচনা প্রয়োজন; এটি অসদাচরণের সিদ্ধান্ত নয়।", en: "Three cases need review; this is not a misconduct finding." }, state: "REVIEW", action: { bn: "মানব পর্যালোচনা নথিভুক্ত করুন", en: "Record human review" }, authority: { bn: "পুনর্নিয়োগ ও জবাবদিহি অনুমোদিত কর্তৃপক্ষের সিদ্ধান্ত।", en: "Reassignment and accountability require authorised human judgment." } },
    ],
  },
  finance: {
    title: { bn: "বন্ধ-পরবর্তী অর্থ পর্যালোচনা", en: "Post-closure finance review" },
    intro: { bn: "সেবা প্রমাণ ও উদাহরণভিত্তিক ধাপ সমন্বয় দেখুন; প্রোটোটাইপ হার সরকারি নীতি নয়।", en: "Review service evidence and illustrative stage reconciliation; prototype rates are not policy." },
    primary: { bn: "পরবর্তী পেমেন্ট প্যাকেট দেখুন", en: "Review next payment packet" },
    metrics: ["06", { bn: "পর্যালোচনাধীন", en: "Under review" }, "02", { bn: "তথ্য ফেরত", en: "Returned" }, "01", { bn: "সিমুলেটেড বিতরণ", en: "Simulated disbursement" }],
    tasks: [
      { reference: "PAY-2026-0044", title: { bn: "সেবা প্রমাণ সম্পূর্ণ", en: "Service evidence complete" }, detail: { bn: "বন্ধের সিদ্ধান্ত আলাদা; ধাপভিত্তিক প্রমাণ ও নীতি সংস্করণ সংযুক্ত।", en: "Closure is separate; stage evidence and policy version are attached." }, state: "DUE", action: { bn: "অনুমোদন পর্যালোচনা করুন", en: "Review approval" }, authority: { bn: "শুধু অর্থ পর্যালোচক অনুমোদন, ফেরত বা সিমুলেটেড বিতরণ নথিভুক্ত করতে পারেন।", en: "Only finance may record approval, return, or simulated disbursement." } },
      { reference: "PAY-2026-0041", title: { bn: "হস্তান্তর পর্যায় বিরোধপূর্ণ", en: "Handover stage disputed" }, detail: { bn: "অর্জিত ও বিতর্কিত ধাপ পাশাপাশি রাখা হয়েছে।", en: "Earned and disputed stages remain visible side by side." }, state: "REVIEW", action: { bn: "তথ্যের জন্য ফেরত দিন", en: "Return for information" }, authority: { bn: "সিস্টেম স্বয়ংক্রিয়ভাবে আদায়যোগ্য অর্থ নির্ধারণ করবে না।", en: "The system must not determine a recoverable amount automatically." } },
    ],
  },
  appeal: {
    title: { bn: "আপিল পর্যালোচনা", en: "Appeal review" },
    intro: { bn: "মূল সিদ্ধান্ত, কারণ, প্রযোজ্য কর্তৃত্ব ও নতুন উপকরণ একসঙ্গে দেখুন।", en: "Review the original decision, reasons, applicable authority, and new material together." },
    primary: { bn: "পরবর্তী আপিল দেখুন", en: "Review next appeal" },
    metrics: ["03", { bn: "খোলা আপিল", en: "Open appeals" }, "01", { bn: "তথ্য বাকি", en: "Information due" }, "02", { bn: "সময়সীমার মধ্যে", en: "Within deadline" }],
    tasks: [
      { reference: "APL-2026-0012", title: { bn: "যোগ্যতা প্রত্যাখ্যানের আপিল", en: "Eligibility rejection appeal" }, detail: { bn: "মূল কারণ, আবেদনকারীর উপকরণ এবং নীতি-প্যাক সংস্করণ উপস্থিত।", en: "Original reason, applicant material, and policy-pack version are present." }, state: "DUE", action: { bn: "আপিল সিদ্ধান্ত নথিভুক্ত করুন", en: "Record appeal decision" }, authority: { bn: "সিদ্ধান্ত, কারণ ও নিরাপদ বিজ্ঞপ্তি বাধ্যতামূলক।", en: "Decision, reasons, and safe notification are required." } },
      { reference: "APL-2026-0010", title: { bn: "সহায়ক নথি অনুপস্থিত", en: "Supporting material missing" }, detail: { bn: "সিদ্ধান্তের আগে অতিরিক্ত তথ্য চাইতে হবে।", en: "Additional information is required before a decision." }, state: "REVIEW", action: { bn: "তথ্য অনুরোধ করুন", en: "Request information" }, authority: { bn: "অসম্পূর্ণ আপিল স্বয়ংক্রিয়ভাবে প্রত্যাখ্যাত হবে না।", en: "An incomplete appeal is not rejected automatically." } },
    ],
  },
  committee: {
    title: { bn: "কমিটি সেবা ডেস্ক", en: "Committee service desk" },
    intro: { bn: "শুধু নিজের কার্যালয়ের অনুমোদিত যাচাই, রেফারেল ও সেবা পদক্ষেপ দেখুন।", en: "See only verification, referral, and service actions authorised for this office." },
    primary: { bn: "আজকের অনুমোদিত কাজ দেখুন", en: "View today’s authorised work" },
    metrics: ["05", { bn: "আজকের কাজ", en: "Today’s work" }, "02", { bn: "রেফারেল", en: "Referrals" }, "00", { bn: "সীমার বাইরে", en: "Out of scope" }],
    tasks: [
      { reference: "VER-2026-0071", title: { bn: "কার্যালয়-সীমিত যাচাই", en: "Office-scoped verification" }, detail: { bn: "প্রয়োজনীয় পরিচয় ও নথির উৎস উপস্থিত।", en: "Required identity and document provenance are present." }, state: "DUE", action: { bn: "যাচাই নথিভুক্ত করুন", en: "Record verification" }, authority: { bn: "কার্যালয়ের ভূমিকা-অনুমোদনের বাইরে কোনো সিদ্ধান্ত দেখানো হবে না।", en: "No decision outside the office role grant is exposed." } },
      { reference: "REF-2026-0024", title: { bn: "পরবর্তী কর্তৃপক্ষের কাছে রেফারেল", en: "Referral to next authority" }, detail: { bn: "ন্যূনতম প্যাকেজ প্রিভিউ ও স্বীকৃতি সময়সীমা প্রস্তুত।", en: "Minimum-package preview and acknowledgement deadline are ready." }, state: "REVIEW", action: { bn: "রেফারেল প্রিভিউ করুন", en: "Preview referral" }, authority: { bn: "প্রেরণকে গ্রহণ হিসেবে দেখানো যাবে না।", en: "Transmission must not be shown as acceptance." } },
    ],
  },
  auditor: {
    title: { bn: "নিরীক্ষা ও জুরি পরিদর্শন", en: "Audit and jury inspection" },
    intro: { bn: "কার্যক্রম না বদলে লেজার ঘটনা, চেকপয়েন্ট, প্রবেশ ইতিহাস ও সিদ্ধান্ত কর্তৃত্ব পুনর্গঠন করুন।", en: "Reconstruct ledger events, checkpoints, access history, and decision authority without changing state." },
    primary: { bn: "লেজার যাচাই করুন", en: "Verify ledger" },
    metrics: ["128", { bn: "যাচাইকৃত ঘটনা", en: "Verified events" }, "08", { bn: "চেকপয়েন্ট", en: "Checkpoints" }, "00", { bn: "হ্যাশ ব্যর্থতা", en: "Hash failures" }],
    tasks: [
      { reference: "LEDGER-CP-08", title: { bn: "সর্বশেষ চেকপয়েন্ট", en: "Latest checkpoint" }, detail: { bn: "ঘটনা ১২১–১২৮ এবং পূর্ববর্তী হ্যাশ শৃঙ্খল উপলব্ধ।", en: "Events 121–128 and the previous hash chain are available." }, state: "READ ONLY", action: { bn: "স্বাধীনভাবে যাচাই করুন", en: "Verify independently" }, authority: { bn: "নিরীক্ষক কোনো কার্যক্রমের অবস্থা পরিবর্তন করতে পারবেন না।", en: "The auditor cannot change operational state." }, readOnly: true },
      { reference: "ACCESS-2026-09", title: { bn: "সীমিত প্রমাণ প্রবেশ ইতিহাস", en: "Restricted-evidence access history" }, detail: { bn: "কে, কখন, কোন কর্তৃত্বে দেখেছেন তার তালিকা।", en: "Who viewed it, when, and under which authority." }, state: "READ ONLY", action: { bn: "প্রবেশ ইতিহাস দেখুন", en: "View access history" }, authority: { bn: "সীমিত পেলোড বিশেষ অনুমতি ছাড়া খোলা হবে না।", en: "Restricted payloads stay hidden without specific permission." }, readOnly: true },
    ],
  },
};

const value = (copy: Localized, lang: Lang) => copy[lang];

export function OperationalRoleDashboard({ role }: { role: OperationalRoleId }) {
  const { lang } = useI18n();
  const [selected, setSelected] = useState<Task | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  /* The helpline role has its own dedicated workspace mounted at
     /dashboard/helpline/page.tsx. We delegate here as a safety net
     so any other route that still renders this component for helpline
     shows the new UI instead of the legacy stub. Hooks above must
     always run; the conditional return is the LAST line. */
  if (role === "helpline") {
    return <HelplineWorkspace />;
  }

  if (role === "udc") {
    return <UdcWorkspace role={role} />;
  }

  /* The mediator role's dashboard is its worklist — every mediation
     matter it's assigned to, each opening the real case workspace at
     /mediator/cases/[caseId] with the same Case ID as the DLAO and
     citizen pages. Same delegation pattern as helpline/udc above,
     instead of the static `workspaces.mediator` config below, which
     is now dead for this role but left in place since the
     `Record<OperationalRoleId, Workspace>` type still requires an
     entry for every non-delegated role. */
  if (role === "mediator") {
    return <MediatorWorklist />;
  }

  const config = workspaces[role];
  const roleMeta = getRole(role);

  function complete(reference: string) {
    setCompleted((items) => [...new Set([...items, reference])]);
    setSelected(null);
  }

  return (
    <div className={styles.page}>
      <p className={styles.prototype}><span>{lang === "bn" ? "সিমুলেটেড" : "Simulated"}</span>{lang === "bn" ? "স্থানীয় ভূমিকা প্রক্ষেপণ · কোনো বাহ্যিক সংযোগ সক্রিয় নয়" : "Local role projection · no external connection is active"}</p>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>{roleMeta.name[lang]}</p><h1>{value(config.title, lang)}</h1><p>{value(config.intro, lang)}</p></div>
        <Button onClick={() => document.getElementById("work")?.scrollIntoView()}>{value(config.primary, lang)}</Button>
      </header>
      <section id="today" className={styles.metrics}>
        <div><strong>{config.metrics[0]}</strong><span>{value(config.metrics[1], lang)}</span></div>
        <div><strong>{config.metrics[2]}</strong><span>{value(config.metrics[3], lang)}</span></div>
        <div><strong>{config.metrics[4]}</strong><span>{value(config.metrics[5], lang)}</span></div>
      </section>
      <section id="work" className={styles.work}>
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>{lang === "bn" ? "ভূমিকা-অনুমোদিত" : "Role authorised"}</p><h2>{lang === "bn" ? "আজকের কাজ" : "Today’s work"}</h2></div><span>{config.tasks.length}</span></div>
        {config.tasks.map((task) => (
          <button key={task.reference} className={styles.task} onClick={() => setSelected(task)}>
            <span className={styles.taskState}>{completed.includes(task.reference) ? (lang === "bn" ? "পর্যালোচিত" : "REVIEWED") : task.state}</span>
            <span><strong>{value(task.title, lang)}</strong><small>{value(task.detail, lang)}</small></span>
            <span className={styles.reference}>{task.reference}</span>
            <span className={styles.actionText}>{value(task.action, lang)} →</span>
          </button>
        ))}
      </section>
      <section id="history" className={styles.history}>
        <h2>{lang === "bn" ? "সাম্প্রতিক ভূমিকা ইতিহাস" : "Recent role history"}</h2>
        <div><time>09:42</time><span>{lang === "bn" ? "অনুমোদিত প্রক্ষেপণ খোলা হয়েছে" : "Authorised projection opened"}</span><span>{roleMeta.name[lang]}</span></div>
        <div><time>09:18</time><span>{lang === "bn" ? "প্রতিশ্রুতি কিউ পুনর্মূল্যায়ন" : "Promise queue re-evaluated"}</span><span>policy-pack/v4</span></div>
      </section>
      <section id="coverage" className={styles.coverage}>
        <div><p className={styles.eyebrow}>{lang === "bn" ? "জুরি নিয়ন্ত্রণ" : "Jury control"}</p><h2>{lang === "bn" ? "২৩/২৩ কভারেজ নেভিগেটর" : "23/23 Coverage Navigator"}</h2><p>{lang === "bn" ? "বর্তমান ভূমিকার দৃশ্য, গ্রহণযোগ্যতা শর্ত, অবস্থা পরিবর্তন ও সর্বশেষ লেজার ঘটনা দেখুন।" : "Open the current role scenario, acceptance condition, expected state change, and latest ledger event."}</p></div>
        <Link href="/sim/scenario" className={styles.coverageLink}>{lang === "bn" ? "পরিস্থিতি খুলুন" : "Open scenarios"}</Link>
      </section>
      {selected ? <div className={styles.backdrop} role="presentation"><section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="task-title"><div className={styles.drawerHead}><div><p className={styles.eyebrow}>{selected.reference} · {selected.state}</p><h2 id="task-title">{value(selected.title, lang)}</h2></div><button onClick={() => setSelected(null)}>{lang === "bn" ? "বন্ধ করুন" : "Close"}</button></div><p className={styles.detail}>{value(selected.detail, lang)}</p><div className={styles.authority}><strong>{lang === "bn" ? "কর্তৃত্ব সীমা" : "Authority boundary"}</strong><p>{value(selected.authority, lang)}</p></div>{selected.readOnly ? <div className={styles.drawerActions}><Button onClick={() => complete(selected.reference)}>{value(selected.action, lang)}</Button></div> : <form onSubmit={(event) => { event.preventDefault(); complete(selected.reference); }} className={styles.form}><label>{lang === "bn" ? "কারণ / নোট" : "Reason / note"}<textarea required placeholder={lang === "bn" ? "প্রমাণ দেখে কারণ লিখুন" : "Record the reason after reviewing evidence"} /></label><Button type="submit">{value(selected.action, lang)}</Button><p>{lang === "bn" ? "এই প্রোটোটাইপে ফলাফল শুধু স্থানীয় সেশনে নথিভুক্ত হবে।" : "This prototype records the result only in the local session."}</p></form>}</section></div> : null}
    </div>
  );
}

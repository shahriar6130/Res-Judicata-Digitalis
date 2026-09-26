import type { ApplicationRecord, MatterCategory } from "./schema";
import { incidentOf, isRedFlagged } from "./incident-taxonomy";

export type IncomingComplexityLevel = "PETTY" | "INTERMEDIATE" | "COMPLEX";
type Bi = { bn: string; en: string };

export type IncomingComplexityResult = {
  level: IncomingComplexityLevel;
  score: number;
  reasons: Bi[];
  engine: "SIMULATED_COMPLEXITY_V1";
  simulated: true;
  advisoryOnly: true;
};

const LEGALLY_SENSITIVE: readonly MatterCategory[] = ["VIOLENCE", "CRIMINAL_DEFENCE", "SEXUAL_HARASSMENT", "SECURITY"];

/**
 * A deterministic stand-in for future AI case-complexity triage.
 * It orders incoming work only; it never decides eligibility, urgency or outcome.
 */
export function classifyIncomingComplexity(a: ApplicationRecord): IncomingComplexityResult {
  const reasons: Bi[] = [];
  let score = 0;
  const add = (points: number, bn: string, en: string) => {
    score += points;
    reasons.push({ bn, en });
  };

  if (isRedFlagged(a)) add(5, "নিরাপত্তা বা সহিংসতার লাল পতাকা", "Safety or violence red flag");
  else if (a.routing.recommendedPriority === "URGENT") add(4, "জরুরি অগ্রাধিকার প্রস্তাব", "Urgent priority recommendation");
  else if (a.routing.recommendedPriority === "HIGH") add(2, "উচ্চ অগ্রাধিকার প্রস্তাব", "High priority recommendation");

  if (a.data.matter.category && LEGALLY_SENSITIVE.includes(a.data.matter.category)) {
    add(2, "সংবেদনশীল বা ফৌজদারি বিষয়", "Sensitive or criminal matter");
  } else if (a.data.matter.category === "LAND") {
    add(1, "ভূমি বা সম্পত্তির বিরোধ", "Land or property dispute");
  }

  if (a.data.urgency.flags.includes("CHILD_INVOLVED")) add(2, "শিশু জড়িত", "A child is involved");
  if (a.data.urgency.flags.length > 1) add(1, "একাধিক জরুরি সংকেত", "Multiple urgency signals");
  if (a.data.applicant.identityDocumentUnavailable) add(2, "স্থানীয় পরিচয় যাচাই অপেক্ষমাণ", "Local identity verification pending");
  if (a.data.filedBy.kind !== "SELF") add(1, "প্রতিনিধির মাধ্যমে আবেদন", "Filed through a representative");

  const pendingDocuments = a.data.documents.filter((document) => document.status !== "ATTACHED").length;
  if (pendingDocuments >= 2) add(1, `${pendingDocuments}টি নথি অপেক্ষমাণ`, `${pendingDocuments} documents pending`);

  const storyLength = a.data.matter.summary?.trim().length ?? 0;
  if (storyLength >= 350) add(1, "দীর্ঘ ঘটনার বিবরণ", "Long incident account");
  if (incidentOf(a).matched.length >= 2) add(1, "একাধিক ঘটনার সংকেত", "Multiple incident signals");

  const level: IncomingComplexityLevel = score >= 4 ? "COMPLEX" : score >= 2 ? "INTERMEDIATE" : "PETTY";
  if (!reasons.length) reasons.push({ bn: "একক, নিয়মিত যাচাইয়ের বিষয়", en: "Single issue with routine verification" });

  return { level, score, reasons, engine: "SIMULATED_COMPLEXITY_V1", simulated: true, advisoryOnly: true };
}

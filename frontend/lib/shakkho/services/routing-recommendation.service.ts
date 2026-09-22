/* ------------------------------------------------------------------ *
 *  RoutingRecommendationService — produces a recommendation for a
 *  receiving authority based on matter category, applicant location,
 *  current office, eligible directory entries, and active legal-basis
 *  entries. NEVER makes a routing decision. Always tagged with a
 *  rulesetVersion + confidence category.
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  AuthorityDirectoryEntry,
  LegalBasisEntry,
  RoutingRecommendation,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { AuthorityDirectoryService } from "./authority-directory.service";
import { LegalBasisRegistryService } from "./legal-basis-registry.service";
import { DemoTimeService } from "./demo-time.service";

const RULESET_VERSION = "R7-v0.1.0";

export const RoutingRecommendationService = {
  recommend(input: {
    applicationId: string;
    matter: string;
    district?: string;
    currentOffice?: string;
    actor: string;
  }): RoutingRecommendation {
    const envelope = read();
    const app = envelope.records.find((r) => r.applicationId === input.applicationId);
    const matter = (input.matter || app?.facts?.category?.value || "").toLowerCase();
    const district = (input.district || extractDistrict(app, envelope) || "").trim();

    const eligible = AuthorityDirectoryService.eligibleFor(envelope, matter, district);
    const activeBasis = LegalBasisRegistryService.active(envelope).filter(
      (b) => !matter || b.matterCategory.toLowerCase().includes(matter),
    );

    const reasons: { bn: string; en: string }[] = [];
    const sourceFields: string[] = [];
    const missing: { bn: string; en: string }[] = [];
    const conflicts: { bn: string; en: string }[] = [];

    sourceFields.push("matter_category", "applicant_district", "current_office");

    if (eligible.length === 0) {
      missing.push({
        bn: district ? `“${district}” জেলার জন্য যাচাইকৃত কোনো কর্তৃপক্ষ পাওয়া যায়নি।` : "প্রযোজ্য কোনো যাচাইকৃত কর্তৃপক্ষ নেই।",
        en: district ? `No verified authority found for "${district}".` : "No verified authority applies.",
      });
    }

    if (activeBasis.length === 0) {
      missing.push({
        bn: "কোনো যাচাইকৃত আইনি ভিত্তি পাওয়া যায়নি।",
        en: "No verified legal basis is available.",
      });
    }

    if (eligible.length > 1) {
      conflicts.push({
        bn: "একাধিক যাচাইকৃত কর্তৃপক্ষ প্রযোজ্য — মানব পর্যালোচনা প্রয়োজন।",
        en: "Multiple verified authorities apply — human review required.",
      });
    }

    let confidence: RoutingRecommendation["confidence"] = "sufficient_for_human_review";
    if (eligible.length === 0 || activeBasis.length === 0) confidence = "no_verified_route";
    else if (eligible.length > 1) confidence = "conflicting";
    else if (!matter || !district) confidence = "incomplete";

    const chosen: AuthorityDirectoryEntry | undefined = eligible[0];
    if (chosen) {
      reasons.push({
        bn: `বিষয় ক্যাটাগরি ও জেলার ভিত্তিতে “${chosen.displayNameBn}” প্রযোজ্য।`,
        en: `Based on matter category and district, "${chosen.displayNameEn}" applies.`,
      });
    }

    const rec: RoutingRecommendation = {
      recommendationId: "rec-" + Math.random().toString(36).slice(2, 10),
      applicationId: input.applicationId,
      generatedAt: DemoTimeService.iso(),
      recommendedDestination: chosen
        ? { entryId: chosen.entryId, displayName: chosen.displayNameEn, type: chosen.type }
        : { entryId: "none", displayName: "", type: "other_competent_authority" },
      confidence,
      reasons,
      sourceFields,
      missingOrUncertain: missing,
      conflicts,
      rulesetVersion: RULESET_VERSION,
    };

    write({
      ...envelope,
      routingRecommendations: [...(envelope.routingRecommendations ?? []), rec],
    });
    AuditTrailService.log(
      {
        subject: rec.recommendationId,
        subjectKind: "system",
        action: "routing.recommended",
        actor: input.actor,
        payload: { confidence, rulesetVersion: RULESET_VERSION },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return rec;
  },

  recordHumanDecision(input: {
    recommendationId: string;
    decidedBy: string;
    accepted: boolean;
    modifiedDestinationEntryId?: string;
    reason: string;
    authorityForDecision: string;
  }): RoutingRecommendation | undefined {
    const envelope = read();
    let updated: RoutingRecommendation | undefined;
    const list = (envelope.routingRecommendations ?? []).map((r) => {
      if (r.recommendationId !== input.recommendationId) return r;
      updated = {
        ...r,
        humanDecision: {
          decidedAt: DemoTimeService.iso(),
          decidedBy: input.decidedBy,
          accepted: input.accepted,
          modifiedDestinationEntryId: input.modifiedDestinationEntryId,
          reason: input.reason,
          authorityForDecision: input.authorityForDecision,
        },
      };
      return updated;
    });
    write({ ...envelope, routingRecommendations: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.recommendationId,
          subjectKind: "system",
          action: "routing.human_decision",
          actor: input.decidedBy,
          payload: { accepted: input.accepted, reason: input.reason },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};

function extractDistrict(app: ApplicationRecord | undefined, env: StoreEnvelope): string | undefined {
  if (!app) return undefined;
  return app.office?.replace(/\s*জেলা.*$/, "") || app.facts?.office?.value || undefined;
}
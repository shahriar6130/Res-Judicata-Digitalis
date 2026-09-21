/* ------------------------------------------------------------------ *
 *  UrgencyRulesService — deterministic, rule-based urgency
 *  evaluation.
 *
 *  The intake never decides urgency itself: it only emits indicators
 *  (e.g. caller self-reports). This service walks a small rule set,
 *  each with a stable `id`, and returns an explainable evaluation
 *  (`matchedRuleIds` + bilingual reasons).
 *
 *  Levels: `low | medium | high | urgent`. The maximum matched level
 *  wins. `urgent` always forces a human handoff + DLAO bridge task.
 *
 *  No LLM. Pure functions over the typed store envelope.
 * ------------------------------------------------------------------ */

import type {
  IntakeStatus,
  SlotKey,
  UrgencyContext,
  UrgencyEvaluation,
  UrgencyIndicator,
  UrgencyLevel,
  UrgencyRule,
  SlotValue,
} from "../types";

const norm = (s: string | undefined): string =>
  (s ?? "").toLowerCase().trim();

const hasFact = (ctx: UrgencyContext, slot: SlotKey): SlotValue | undefined =>
  ctx.facts[slot];

const anyIndicator = (ctx: UrgencyContext, code: UrgencyIndicator["code"]): boolean =>
  ctx.indicators.some((i) => i.code === code);

/** Each rule has a stable id used in audit and explanations. */
export const URGENCY_RULES: ReadonlyArray<UrgencyRule> = [
  {
    id: "UR-01-physical-safety",
    description: {
      bn: "শারীরিক নিরাপত্তা হুমকি — জরুরি মানব হস্তান্তর",
      en: "Physical safety at risk — urgent human handoff",
    },
    matches: (ctx) =>
      anyIndicator(ctx, "physical_safety_at_risk") ||
      anyIndicator(ctx, "caller_reports_violence") ||
      anyIndicator(ctx, "domestic_violence_disclosed") ||
      anyIndicator(ctx, "danger"),
    level: "urgent",
  },
  {
    id: "UR-02-child-safeguarding",
    description: {
      bn: "শিশু সুরক্ষা হুমকি — জরুরি",
      en: "Child safeguarding risk — urgent",
    },
    matches: (ctx) => anyIndicator(ctx, "child_safeguarding") || anyIndicator(ctx, "child_at_risk"),
    level: "urgent",
  },
  {
    id: "UR-03-court-deadline",
    description: {
      bn: "আসন্ন আদালতের সময়সীমা — উচ্চ",
      en: "Approaching court deadline — high",
    },
    matches: (ctx) => anyIndicator(ctx, "time_critical_court_date") || anyIndicator(ctx, "approaching_deadline"),
    level: "high",
  },
  {
    id: "UR-04-evidence-disappearing",
    description: {
      bn: "প্রমাণ হারানোর ঝুঁকি — উচ্চ",
      en: "Evidence at risk of disappearing — high",
    },
    matches: (ctx) => anyIndicator(ctx, "evidence_disappearing"),
    level: "high",
  },
  {
    id: "UR-05-threat-language",
    description: {
      bn: "হুমকিমূলক ভাষা — উচ্চ",
      en: "Threat language detected — high",
    },
    matches: (ctx) => anyIndicator(ctx, "threat_language"),
    level: "high",
  },
  {
    id: "UR-06-identity-mismatch",
    description: {
      bn: "পরিচয় অমিল — মাঝারি",
      en: "Identity mismatch — medium",
    },
    matches: (ctx) => anyIndicator(ctx, "identity_mismatch"),
    level: "medium",
  },
  {
    id: "UR-07-self-reported",
    description: {
      bn: "কলার নিজে জানিয়েছেন — নিম্ন",
      en: "Self-reported by caller — low",
    },
    matches: (ctx) => anyIndicator(ctx, "self_reported"),
    level: "low",
  },
  {
    id: "UR-08-safety-text-keyword",
    description: {
      bn: "সাক্ষাৎকারে নিরাপত্তা হুমকির শব্দ — জরুরি",
      en: "Safety-threat keyword in transcript — urgent",
    },
    matches: (ctx) =>
      ctx.turns.some((t) => {
        const txt = norm(t.text.en);
        return (
          txt.includes("threat") ||
          txt.includes("violence") ||
          txt.includes("সহিংস") ||
          txt.includes("মারধর") ||
          txt.includes("খুন")
        );
      }),
    level: "urgent",
  },
  {
    id: "UR-09-keyword-child",
    description: {
      bn: "সাক্ষাৎকারে শিশু সুরক্ষা শব্দ — জরুরি",
      en: "Child safeguarding keyword in transcript — urgent",
    },
    matches: (ctx) =>
      ctx.turns.some((t) => {
        const txt = norm(t.text.en);
        return txt.includes("child") || txt.includes("শিশু");
      }) && anyIndicator(ctx, "child_at_risk"),
    level: "urgent",
  },
  {
    id: "UR-10-civil-land-deadline",
    description: {
      bn: "ভূমি বিরোধ ও আদালতের তারিখ — উচ্চ",
      en: "Land dispute with court date — high",
    },
    matches: (ctx) => {
      const cat = norm(hasFact(ctx, "category")?.value);
      const date = norm(hasFact(ctx, "incident_date")?.value);
      return cat === "land" && /\d/.test(date);
    },
    level: "high",
  },
];

const LEVEL_ORDER: Record<UrgencyLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

function maxLevel(...levels: UrgencyLevel[]): UrgencyLevel {
  return levels.reduce((acc, cur) =>
    LEVEL_ORDER[cur] > LEVEL_ORDER[acc] ? cur : acc,
  );
}

function nextStatusFor(level: UrgencyLevel): IntakeStatus {
  if (level === "urgent") return "urgent_human_handoff_required";
  if (level === "high") return "urgency_rules_applied";
  if (level === "medium") return "clarification_required";
  return "facts_extracted";
}

export const UrgencyRulesService = {
  rules(): ReadonlyArray<UrgencyRule> {
    return URGENCY_RULES;
  },

  evaluate(ctx: UrgencyContext): UrgencyEvaluation {
    const matched = URGENCY_RULES.filter((r) => r.matches(ctx));
    const matchedRuleIds = matched.map((r) => r.id);
    const level = matched.length
      ? matched.reduce<UrgencyLevel>(
          (acc, r) => maxLevel(acc, r.level),
          "low",
        )
      : "low";
    const reasons = matched.length
      ? matched.map((r) => r.description)
      : [
          {
            bn: "নির্দিষ্ট নিয়ম ট্রিগার হয়নি — নিম্ন অগ্রাধিকার",
            en: "No urgency rule matched — low priority",
          },
        ];
    return {
      level,
      matchedRuleIds,
      reasons,
      recommendedNextStatus: nextStatusFor(level),
      evaluatedAt: new Date().toISOString(),
    };
  },

  /** Convenience: build a context from a record + session. */
  buildContext(input: {
    facts: Partial<Record<SlotKey, SlotValue>>;
    turns: UrgencyContext["turns"];
    indicators: UrgencyIndicator[];
  }): UrgencyContext {
    return {
      facts: input.facts,
      turns: input.turns,
      indicators: input.indicators,
    };
  },
};

export function maxUrgencyLevel(
  indicators: UrgencyIndicator[],
): UrgencyLevel {
  if (!indicators.length) return "low";
  return indicators.reduce<UrgencyLevel>(
    (acc, i) => maxLevel(acc, i.weight),
    "low",
  );
}

/* ------------------------------------------------------------------ *
 *  HelplineService — aggregate façade.
 *
 *  Panels call this for KPIs / queue counts; it reads the envelope
 *  in-memory via the persistence hook and computes derived counts.
 * ------------------------------------------------------------------ */

import type { StoreEnvelope } from "../types";

export interface HelplineKpis {
  waitingCalls: number;
  activeIntakes: number;
  handoffs: number;
  callbacks: number;
}

export const HelplineService = {
  kpis(envelope: StoreEnvelope): HelplineKpis {
    return {
      waitingCalls: envelope.sessions.filter((s) => s.status === "incoming").length,
      activeIntakes: envelope.sessions.filter(
        (s) =>
          s.status === "active" ||
          s.status === "in_progress" ||
          s.status === "ai_handled",
      ).length,
      handoffs: envelope.handoffs.filter((h) => h.status === "queued").length,
      callbacks: envelope.sessions.filter((s) => s.status === "waiting_for_caller")
        .length,
    };
  },

  recent(envelope: StoreEnvelope, limit = 6): StoreEnvelope["records"] {
    return [...envelope.records]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  },
};

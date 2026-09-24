"use client";

/* Officer review of the rule-based red flag (lib/dlas/incident-taxonomy.ts). */

import { useMemo } from "react";
import { mutate, useDlasDb } from "./store";
import { DlaoAuth, officerAuthorityRole, officerCanAccessApplication } from "./dlao";
import { incidentOf } from "./incident-taxonomy";
import type { ApplicationRecord, AuditEntry, DlasDb } from "./schema";

/* ------------------------------ officer review ------------------------------ */

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: new Date().toISOString(), ...e });
}

export const IncidentFlagService = {
  /** The DLO confirms the red flag, or clears it (with a reason) when the rule got it wrong. */
  review(applicationId: string, decision: "CONFIRMED" | "CLEARED", reason: string) {
    const o = DlaoAuth.current();
    if (!o) throw new Error("Legal Aid Officer login required");
    if (decision === "CLEARED" && reason.trim().length < 10) throw new Error("Say why the flag is wrong (at least 10 characters)");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanAccessApplication(a, o)) throw new Error("This case is not in your office");
      const c = { ...incidentOf(a) };
      c.officerReview = { decision, reason: reason.trim() || null, by: o.officerId, byName: o.name, at: new Date().toISOString() };
      a.incident = c;
      audit(db, a.audit, { actor: o.officerId, role: officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action: decision === "CONFIRMED" ? "incident.red_flag_confirmed" : "incident.red_flag_cleared", detail: { officer: o.name, category: c.category, subcategory: c.subcategory, reason: reason.trim() || null } });
      a.updatedAt = new Date().toISOString();
      a.version += 1;
      return c;
    });
  },
};

export function useIncident(a: ApplicationRecord) {
  const db = useDlasDb();
  return useMemo(() => incidentOf(db.applications.find((x) => x.applicationId === a.applicationId) ?? a), [db, a]);
}

/* ------------------------------------------------------------------ *
 *  PanelLawyerDirectoryService — approved-panel CRUD + filters.
 *
 *  Mirrors the field shapes defined in `types.ts` (PanelLawyer,
 *  LawyerAvailabilityStatus, etc.) rather than introducing new
 *  properties.
 * ------------------------------------------------------------------ */

import type { PanelLawyer, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

export const PanelLawyerDirectoryService = {
  list(envelope: StoreEnvelope): PanelLawyer[] {
    return envelope.panelLawyers ?? [];
  },

  find(envelope: StoreEnvelope, lawyerId: string): PanelLawyer | undefined {
    return (envelope.panelLawyers ?? []).find((l) => l.lawyerId === lawyerId);
  },

  eligibleFor(
    envelope: StoreEnvelope,
    input: {
      court?: string;
      matter?: string;
      language?: string;
      excludeLawyerIds?: string[];
      caseId?: string;
    },
  ): Array<{ lawyer: PanelLawyer; reasons: string[]; limitations: string[]; caseLoad: number }> {
    const out: Array<{ lawyer: PanelLawyer; reasons: string[]; limitations: string[]; caseLoad: number }> = [];
    const exclude = new Set(input.excludeLawyerIds ?? []);
    for (const l of envelope.panelLawyers ?? []) {
      if (exclude.has(l.lawyerId)) continue;
      const reasons: string[] = [];
      const limitations: string[] = [];
      if (l.panelStatus !== "approved") {
        limitations.push("Panel status: " + l.panelStatus);
        continue;
      }
      if (l.availability === "on_approved_leave") {
        limitations.push("On approved leave");
        continue;
      }
      if (l.availability === "not_accepting_new") {
        limitations.push("Not accepting new cases");
        continue;
      }
      if (input.court && !l.courtEligibility.some((c) => c.toLowerCase().includes(input.court!.toLowerCase()))) {
        limitations.push(`Court mismatch (needs ${input.court})`);
        continue;
      }
      if (input.matter && !l.matterCategories.includes(input.matter)) {
        limitations.push(`Matter type mismatch (needs ${input.matter})`);
        continue;
      }
      if (input.language && !l.languages.includes(input.language as "bn" | "en")) {
        limitations.push(`Language mismatch (needs ${input.language})`);
        continue;
      }
      const caseLoad = (envelope.lawyerAssignments ?? []).filter(
        (a) => a.lawyerId === l.lawyerId && a.state === "active",
      ).length;
      if (l.activeCaseCount >= 4) {
        limitations.push(`At capacity (${caseLoad})`);
        continue;
      }
      reasons.push(`Court eligibility: ${l.courtEligibility.join(", ")}`);
      reasons.push(`Matters: ${l.matterCategories.join(", ")}`);
      reasons.push(`Languages: ${l.languages.join(", ")}`);
      reasons.push(`Case load ${caseLoad}`);
      out.push({ lawyer: l, reasons, limitations, caseLoad });
    }
    out.sort((a, b) => a.caseLoad - b.caseLoad);
    return out;
  },

  markVerified(input: { lawyerId: string; actor: string }): PanelLawyer | undefined {
    const envelope = read();
    let updated: PanelLawyer | undefined;
    const list = (envelope.panelLawyers ?? []).map((l) => {
      if (l.lawyerId !== input.lawyerId) return l;
      updated = { ...l, panelStatus: "approved" };
      return updated;
    });
    write({ ...envelope, panelLawyers: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.lawyerId,
          subjectKind: "panel_lawyer",
          action: "panel_lawyer.verified",
          actor: input.actor,
          payload: { lawyerId: input.lawyerId },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  markLeave(input: { lawyerId: string; actor: string; reason: string; until?: string }): PanelLawyer | undefined {
    const envelope = read();
    let updated: PanelLawyer | undefined;
    const list = (envelope.panelLawyers ?? []).map((l) => {
      if (l.lawyerId !== input.lawyerId) return l;
      updated = { ...l, availability: "on_approved_leave", notes: input.reason };
      return updated;
    });
    write({ ...envelope, panelLawyers: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.lawyerId,
          subjectKind: "panel_lawyer",
          action: "panel_lawyer.leave_started",
          actor: input.actor,
          payload: { reason: input.reason, until: input.until },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  markReturn(input: { lawyerId: string; actor: string }): PanelLawyer | undefined {
    const envelope = read();
    let updated: PanelLawyer | undefined;
    const list = (envelope.panelLawyers ?? []).map((l) => {
      if (l.lawyerId !== input.lawyerId) return l;
      updated = { ...l, availability: "available", notes: undefined };
      return updated;
    });
    write({ ...envelope, panelLawyers: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.lawyerId,
          subjectKind: "panel_lawyer",
          action: "panel_lawyer.returned_from_leave",
          actor: input.actor,
          payload: { lawyerId: input.lawyerId },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};

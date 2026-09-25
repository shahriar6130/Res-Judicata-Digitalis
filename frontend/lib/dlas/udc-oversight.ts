"use client";

import { DlaoAuth, useCurrentOfficer } from "./dlao";
import { mutate, useDlasDb } from "./store";
import type { DlaoOfficerAccount, DlasDb, UdcOperatorAccount } from "./schema";

export type UdcApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export function udcApprovalStatus(operator: UdcOperatorAccount): UdcApprovalStatus {
  return operator.approval?.status ?? "PENDING";
}

/** UDC operators visible to this officer: exact district match only. */
export function useDistrictUdcOperators(): UdcOperatorAccount[] {
  const officer = useCurrentOfficer();
  const db = useDlasDb();
  if (!officer?.district) return [];
  return db.udcOperators
    .filter((operator) => operator.district === officer.district)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function currentOfficer() {
  const officer = DlaoAuth.current();
  if (!officer?.district) throw new Error("A district DLO login is required");
  return officer;
}

function recordDecision(
  db: DlasDb,
  operator: UdcOperatorAccount,
  officer: DlaoOfficerAccount,
  status: Exclude<UdcApprovalStatus, "PENDING">,
  reason: string | null,
) {
  if (operator.district !== officer.district) throw new Error("This UDC is outside your district");
  const at = new Date().toISOString();
  operator.approval = {
    status,
    by: officer.officerId,
    byName: officer.name,
    at,
    reason: reason?.trim() || null,
  };
  db.counters.auditSeq += 1;
  operator.audit.push({
    seq: db.counters.auditSeq,
    at,
    actor: officer.officerId,
    role: "dlao",
    action: status === "APPROVED" ? "udc.approved" : "udc.rejected",
    detail: { operatorId: operator.operatorId, district: operator.district, reason: reason?.trim() || null },
  });
}

export const UdcOversightService = {
  approve(operatorId: string) {
    const officer = currentOfficer();
    return mutate((db) => {
      const operator = db.udcOperators.find((item) => item.operatorId === operatorId);
      if (!operator) throw new Error("UDC operator not found");
      recordDecision(db, operator, officer, "APPROVED", null);
      return operator;
    });
  },

  reject(operatorId: string, reason: string) {
    if (!reason.trim()) throw new Error("A rejection reason is required");
    const officer = currentOfficer();
    return mutate((db) => {
      const operator = db.udcOperators.find((item) => item.operatorId === operatorId);
      if (!operator) throw new Error("UDC operator not found");
      recordDecision(db, operator, officer, "REJECTED", reason);
      return operator;
    });
  },

  approveAllPending(): number {
    const officer = currentOfficer();
    return mutate((db) => {
      const pending = db.udcOperators.filter(
        (operator) => operator.district === officer.district && udcApprovalStatus(operator) === "PENDING",
      );
      for (const operator of pending) recordDecision(db, operator, officer, "APPROVED", null);
      return pending.length;
    });
  },
};

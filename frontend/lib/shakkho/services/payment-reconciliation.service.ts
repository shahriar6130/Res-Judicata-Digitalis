/* ------------------------------------------------------------------ *
 *  PaymentReconciliationService — per-case reconciliation worksheet.
 *
 *  States (spec §30):
 *    not_started → worksheet_prepared → evidence_review →
 *    human_decision → {approved | adjusted | returned | rejected} →
 *    external_payment_pending → paid_or_closed
 *
 *  This is one of three separated decisions:
 *    - service continuity (LawyerChangeRequest)
 *    - payment reconciliation (this)
 *    - conduct / pattern review (InactivityPattern)
 *
 *  The prototype carries a disclaimer banner on every worksheet
 *  surface because the external payment system is simulated.
 * ------------------------------------------------------------------ */

import type {
  PaymentReconciliation,
  PaymentReconciliationState,
  PaymentStage,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "pmt-" + Math.random().toString(36).slice(2, 10);
}

export const PaymentReconciliationService = {
  list(envelope: StoreEnvelope): PaymentReconciliation[] {
    return envelope.paymentReconciliations ?? [];
  },

  find(envelope: StoreEnvelope, reconciliationId: string): PaymentReconciliation | undefined {
    return (envelope.paymentReconciliations ?? []).find((p) => p.reconciliationId === reconciliationId);
  },

  byCase(envelope: StoreEnvelope, caseId: string): PaymentReconciliation[] {
    return (envelope.paymentReconciliations ?? []).filter((p) => p.caseId === caseId);
  },

  prepareWorksheet(input: {
    caseId: string;
    triggeredBy: PaymentReconciliation["triggeredBy"];
    actor: string;
    note?: string;
  }): PaymentReconciliation {
    const envelope = read();
    const now = DemoTimeService.iso();
    const worksheet: PaymentReconciliation = {
      reconciliationId: makeId(),
      caseId: input.caseId,
      state: "worksheet_prepared",
      triggeredBy: input.triggeredBy,
      preparedAt: now,
      preparedBy: input.actor,
      evidence: [],
      history: [
        {
          at: now,
          actor: input.actor,
          fromState: "not_started",
          toState: "worksheet_prepared",
          reason: input.note,
        },
      ],
      auditEventIds: [],
      disclaimerShown: true,
    };
    write({
      ...envelope,
      paymentReconciliations: [...(envelope.paymentReconciliations ?? []), worksheet],
    });
    AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "payment_reconciliation",
        action: "payment_reconciliation.worksheet_prepared",
        actor: input.actor,
        payload: { reconciliationId: worksheet.reconciliationId, triggeredBy: input.triggeredBy },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    return worksheet;
  },

  addStage(input: {
    caseId: string;
    scheduleId: string;
    stage: string;
    claimedAmount: number;
    actor: string;
  }): PaymentStage {
    const envelope = read();
    const stage: PaymentStage = {
      stageId: makeId(),
      caseId: input.caseId,
      scheduleId: input.scheduleId,
      stage: input.stage,
      claimedAmount: input.claimedAmount,
      verifiedAmount: 0,
      approvedAmount: 0,
      paidAmount: 0,
      status: "draft_claim",
      notes: input.actor,
    };
    write({
      ...envelope,
      paymentStages: [...(envelope.paymentStages ?? []), stage],
    });
    AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "payment_reconciliation",
        action: "payment_reconciliation.stage_recorded",
        actor: input.actor,
        payload: { stageId: stage.stageId, stage: input.stage, claimedAmount: input.claimedAmount },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return stage;
  },

  transition(input: {
    reconciliationId: string;
    to: PaymentReconciliationState;
    actor: string;
    payload?: Record<string, unknown>;
  }): PaymentReconciliation | undefined {
    const envelope = read();
    let updated: PaymentReconciliation | undefined;
    const list = (envelope.paymentReconciliations ?? []).map((p) => {
      if (p.reconciliationId !== input.reconciliationId) return p;
      const history = [
        ...p.history,
        {
          at: DemoTimeService.iso(),
          actor: input.actor,
          fromState: p.state,
          toState: input.to,
          reason: (input.payload?.reason as string | undefined) ?? `Transition to ${input.to}`,
        },
      ];
      updated = { ...p, state: input.to, history };
      return updated;
    });
    write({ ...envelope, paymentReconciliations: list });
    if (updated) {
      const audit = AuditTrailService.log(
        {
          subject: input.reconciliationId,
          subjectKind: "payment_reconciliation",
          action: `payment_reconciliation.${input.to}`,
          actor: input.actor,
          payload: { from: updated.state, to: input.to, ...input.payload },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
      updated.auditEventIds = [...updated.auditEventIds, audit.id];
      write({ ...envelope, paymentReconciliations: list.map((p) => (p.reconciliationId === input.reconciliationId ? updated! : p)) });
    }
    return updated;
  },

  approve(input: { reconciliationId: string; actor: string; reason: string }): PaymentReconciliation | undefined {
    return this.transition({
      reconciliationId: input.reconciliationId,
      to: "approved",
      actor: input.actor,
      payload: {
        humanDecision: {
          decidedAt: DemoTimeService.iso(),
          decidedBy: input.actor,
          outcome: "approved",
          reason: input.reason,
          stageDecisions: [],
        },
        reason: input.reason,
      },
    });
  },

  adjust(input: { reconciliationId: string; actor: string; reason: string }): PaymentReconciliation | undefined {
    return this.transition({ reconciliationId: input.reconciliationId, to: "adjusted", actor: input.actor, payload: { reason: input.reason } });
  },

  markExternalPaymentPending(input: { reconciliationId: string; actor: string }): PaymentReconciliation | undefined {
    return this.transition({ reconciliationId: input.reconciliationId, to: "external_payment_pending", actor: input.actor, payload: { externalPaymentStatus: "sent" } });
  },

  markPaidOrClosed(input: { reconciliationId: string; actor: string }): PaymentReconciliation | undefined {
    return this.transition({ reconciliationId: input.reconciliationId, to: "paid_or_closed", actor: input.actor, payload: { externalPaymentStatus: "paid" } });
  },
};
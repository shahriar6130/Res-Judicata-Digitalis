/* ------------------------------------------------------------------ *
 *  ActiveCallBarService — small helper that lets every helpline
 *  page surface a single floating call bar showing the current call.
 *
 *  The bar lives in the envelope (`activeCallBar`); pages that mount
 *  read it via `useHelplineStore()` and render `<ActiveCallBar />`.
 * ------------------------------------------------------------------ */

import type { ActiveCallBarState, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

function makeId(): string {
  return "acb-" + Math.random().toString(36).slice(2, 10);
}

export const ActiveCallBarService = {
  start(input: {
    sessionId: string;
    callerName: string;
    applicantName?: string;
    urgent?: boolean;
    route?: ActiveCallBarState["route"];
    actor: string;
  }): ActiveCallBarState {
    const now = new Date().toISOString();
    const state: ActiveCallBarState = {
      sessionId: input.sessionId,
      callerName: input.callerName,
      applicantName: input.applicantName,
      channel: "voice",
      startedAt: now,
      muted: false,
      onHold: false,
      urgent: Boolean(input.urgent),
      status: "active",
      route: input.route ?? "ai",
    };
    const envelope = read();
    write({ ...envelope, activeCallBar: state });
    AuditTrailService.log(
      {
        subject: input.sessionId,
        subjectKind: "system",
        action: "call_bar.started",
        actor: input.actor,
        payload: { callerName: input.callerName, route: state.route },
      },
      { kind: "voice", simulatedAt: now },
    );
    return state;
  },

  toggleMute(): ActiveCallBarState | undefined {
    const envelope = read();
    if (!envelope.activeCallBar) return undefined;
    const next: ActiveCallBarState = { ...envelope.activeCallBar, muted: !envelope.activeCallBar.muted };
    write({ ...envelope, activeCallBar: next });
    return next;
  },

  toggleHold(): ActiveCallBarState | undefined {
    const envelope = read();
    if (!envelope.activeCallBar) return undefined;
    const next: ActiveCallBarState = {
      ...envelope.activeCallBar,
      onHold: !envelope.activeCallBar.onHold,
      status: envelope.activeCallBar.onHold ? "active" : "on_hold",
    };
    write({ ...envelope, activeCallBar: next });
    return next;
  },

  transfer(input: { actor: string; route: NonNullable<ActiveCallBarState["route"]> }): ActiveCallBarState | undefined {
    const envelope = read();
    if (!envelope.activeCallBar) return undefined;
    const next: ActiveCallBarState = {
      ...envelope.activeCallBar,
      route: input.route,
      status: "transferred",
    };
    write({ ...envelope, activeCallBar: next });
    AuditTrailService.log(
      {
        subject: envelope.activeCallBar.sessionId,
        subjectKind: "system",
        action: `call_bar.transferred.${input.route}`,
        actor: input.actor,
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
    return next;
  },

  end(): void {
    const envelope = read();
    if (!envelope.activeCallBar) return;
    write({ ...envelope, activeCallBar: undefined });
  },
};

export function pickActiveCallBar(envelope: StoreEnvelope): ActiveCallBarState | undefined {
  return envelope.activeCallBar;
}

void makeId;

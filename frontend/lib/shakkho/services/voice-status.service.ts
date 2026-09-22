/* ------------------------------------------------------------------ *
 *  VoiceStatusService — spoken / IVR status session.
 *
 *  Records the keypad navigation history (repeat / slower / back /
 *  human / exit / next / previous / play_*) and connection-loss
 *  recovery.  The text payload is produced by
 *  CitizenStatusService.safeForVoice and includes the travel-
 *  prevention advisory when relevant.
 * ------------------------------------------------------------------ */

import type { StoreEnvelope, VoiceStatusSession, VoiceStatusKey } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";
import { CitizenStatusService } from "./citizen-status.service";

function makeId(): string {
  return "vss-" + Math.random().toString(36).slice(2, 10);
}

export const VoiceStatusService = {
  list(envelope: StoreEnvelope): VoiceStatusSession[] {
    return envelope.voiceStatusSessions ?? [];
  },

  find(envelope: StoreEnvelope, sessionId: string): VoiceStatusSession | undefined {
    return (envelope.voiceStatusSessions ?? []).find((s) => s.sessionId === sessionId);
  },

  latestForCase(envelope: StoreEnvelope, caseId: string): VoiceStatusSession | undefined {
    const sessions = (envelope.voiceStatusSessions ?? []).filter((s) => s.caseId === caseId);
    if (sessions.length === 0) return undefined;
    return sessions[sessions.length - 1];
  },

  startSession(input: { caseId: string; actor: string; language: "bn" | "en"; channel?: VoiceStatusSession["channel"] }): VoiceStatusSession {
    const envelope = read();
    const summary = CitizenStatusService.safeForVoice(envelope, input.caseId);
    const now = DemoTimeService.iso();
    const playedText = input.language === "bn" ? summary.bn : summary.en;
    const session: VoiceStatusSession = {
      sessionId: makeId(),
      caseId: input.caseId,
      startedAt: now,
      channel: input.channel ?? "voice_ivr",
      language: input.language,
      promptsPlayed: [{ at: now, key: "play_status", playedText }],
      keysPressed: [],
      travelWarningPlayed: summary.travelAdvisory !== null,
    };
    write({
      ...envelope,
      voiceStatusSessions: [...(envelope.voiceStatusSessions ?? []), session],
    });
    AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "voice_session",
        action: "voice_session.started",
        actor: input.actor,
        payload: { sessionId: session.sessionId, language: input.language },
      },
      { kind: "voice", simulatedAt: now },
    );
    return session;
  },

  recordKey(input: { sessionId: string; key: VoiceStatusKey; actor: string }): VoiceStatusSession | undefined {
    const envelope = read();
    let updated: VoiceStatusSession | undefined;
    const list = (envelope.voiceStatusSessions ?? []).map((s) => {
      if (s.sessionId !== input.sessionId) return s;
      const now = DemoTimeService.iso();
      const summary = CitizenStatusService.safeForVoice(envelope, s.caseId);
      const playedText = s.language === "bn" ? summary.bn : summary.en;
      const promptsPlayed =
        input.key === "repeat" || input.key === "play_status" || input.key === "next"
          ? [...s.promptsPlayed, { at: now, key: input.key, playedText }]
          : s.promptsPlayed;
      updated = {
        ...s,
        keysPressed: [...s.keysPressed, { at: now, key: input.key }],
        promptsPlayed,
      };
      return updated;
    });
    write({ ...envelope, voiceStatusSessions: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.sessionId,
          subjectKind: "voice_session",
          action: `voice_session.key_${input.key}`,
          actor: input.actor,
          payload: { key: input.key },
        },
        { kind: "voice", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  endSession(input: { sessionId: string; actor: string; reason: VoiceStatusSession["endedReason"] }): VoiceStatusSession | undefined {
    const envelope = read();
    let updated: VoiceStatusSession | undefined;
    const list = (envelope.voiceStatusSessions ?? []).map((s) => {
      if (s.sessionId !== input.sessionId) return s;
      updated = { ...s, endedAt: DemoTimeService.iso(), endedReason: input.reason };
      return updated;
    });
    write({ ...envelope, voiceStatusSessions: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.sessionId,
          subjectKind: "voice_session",
          action: "voice_session.ended",
          actor: input.actor,
          payload: { reason: input.reason },
        },
        { kind: "voice", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};

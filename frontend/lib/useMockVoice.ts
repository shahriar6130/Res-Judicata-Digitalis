"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "listening" | "processing" | "completed";

export type UseMockVoice = {
  status: VoiceStatus;
  transcript: string;
  start: () => void;
};

type Options = {
  /** Listening duration in ms (default 1200). */
  listenMs?: number;
  /** Processing duration in ms (default 800). */
  processMs?: number;
  /** How long the "completed" state stays visible before reset. */
  completedHoldMs?: number;
  /**
   * Optional callback fired *from inside the timer* (i.e. from the
   * "external system" timer, not from inside a React effect) when the
   * mock STT completes. Use this to write the transcript into your
   * field's state without needing a separate effect.
   */
  onComplete?: (transcript: string) => void;
};

/**
 * Mock voice-input hook used by the citizen complaint wizard.
 *
 * On `start()` it transitions through:
 *   idle → listening (~1.2s) → processing (~0.8s) → completed
 * populates `transcript` with the filler's return value, then returns to
 * idle after a brief pause so the success state is visible.
 *
 * Replaces contract: real STT adapters should expose the same
 * `{ status, transcript, start }` shape so callers don't change.
 */
export function useMockVoice(
  filler: () => string,
  options: Options = {},
): UseMockVoice {
  const { listenMs = 1200, processMs = 800, completedHoldMs = 1800, onComplete } = options;

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => clear(), [clear]);

  const start = useCallback(() => {
    clear();
    setStatus("listening");

    timers.current.push(
      setTimeout(() => {
        setStatus("processing");
      }, listenMs),
    );

    timers.current.push(
      setTimeout(() => {
        const value = filler();
        setTranscript(value);
        setStatus("completed");
        onComplete?.(value);
      }, listenMs + processMs),
    );

    timers.current.push(
      setTimeout(() => {
        setStatus("idle");
      }, listenMs + processMs + completedHoldMs),
    );
  }, [clear, filler, listenMs, processMs, completedHoldMs, onComplete]);

  return { status, transcript, start };
}

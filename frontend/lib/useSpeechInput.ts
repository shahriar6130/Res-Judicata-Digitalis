"use client";

/* ------------------------------------------------------------------ *
 *  Real speech-to-text for the citizen wizard's microphone buttons,
 *  using the browser's Web Speech API (Chrome/Edge/Android; Bangla via
 *  "bn-BD"). No canned sample text: if the browser has no speech
 *  recognition, the status becomes "unsupported" and nothing is filled.
 *
 *  Same { status, transcript, start } shape as the old mock hook.
 * ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "listening" | "processing" | "completed" | "unsupported" | "error";

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function makeRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useSpeechInput(
  lang: "bn" | "en",
  options: { onComplete?: (transcript: string) => void } = {},
) {
  const { onComplete } = options;
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const rec = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      rec.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const settle = useCallback((next: VoiceStatus) => {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2500);
  }, []);

  const start = useCallback(() => {
    const r = makeRecognition();
    if (!r) {
      settle("unsupported");
      return;
    }
    rec.current?.abort();
    rec.current = r;
    let heard = "";
    r.lang = lang === "bn" ? "bn-BD" : "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      heard = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setStatus("processing");
    };
    r.onerror = () => settle("error");
    r.onend = () => {
      if (heard) {
        setTranscript(heard);
        onComplete?.(heard);
        settle("completed");
      } else {
        setStatus((s) => (s === "error" ? s : "idle"));
      }
    };
    setStatus("listening");
    try {
      r.start();
    } catch {
      settle("error");
    }
  }, [lang, onComplete, settle]);

  return { status, transcript, start };
}

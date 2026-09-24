"use client";

/* ------------------------------------------------------------------ *
 *  ScriptedPhone — the IVR 16699 and USSD *16699# simulators.
 *
 *  The telephone network is SIMULATED (caller-line id / MSISDN, voice
 *  recognition, the USSD gateway). Everything behind it is real: each
 *  keypress runs the shared flow in lib/dlas/scripted-flow.ts, which
 *  writes the same ApplicationRecord as every other door.
 * ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { IntakeGateway, useDlasDb, type IntakeSession } from "@/lib/dlas";
import { NODES, START_NODE, jumpTarget, type FlowCtx, type FlowMode } from "@/lib/dlas/scripted-flow";
import { IvrEscalation } from "@/lib/dlas/ivr-triage";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { styles, useDoorSession, useTx } from "./shared";
import ui from "./scripted-phone.module.css";

export function ScriptedPhone({ mode }: { mode: FlowMode }) {
  const { lang, tx } = useTx();
  const channel = mode === "IVR" ? "IVR_16699" : "USSD";
  const db = useDlasDb();
  const { sessionId, session, setSessionId } = useDoorSession(channel);
  // The caller's own SIM number — typed in, never pre-filled.
  const [sim, setSim] = useState("");
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [buffer, setBuffer] = useState("");
  const [speech, setSpeech] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tts, setTts] = useState(false);
  // Real browser speech-to-text fills the "voice answer" box; the caller can still edit it.
  const mic = useSpeechInput(lang, { onComplete: (heard) => setSpeech(heard) });

  const live = !!session && !!nodeId && session.step !== "ABANDONED";
  const node = nodeId ? NODES[nodeId] : null;
  const ctx: FlowCtx | null = sessionId ? { mode, lang, sessionId } : null;

  function goto(id: string) {
    setNodeId(id);
  }

  function promptText(n: (typeof NODES)[string], s: IntakeSession, c: FlowCtx) {
    const opts = n.options?.(c, s) ?? [];
    return [n.prompt(c, s), ...opts.map((o) => `${o.key}. ${o.label}`)].join("\n");
  }

  function say(text: string) {
    if (!tts || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/\n/g, ". "));
    u.lang = lang === "bn" ? "bn-BD" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  function announce(id: string, sid: string, c: FlowCtx) {
    const s = IntakeGateway.getSession(sid)!;
    const n = NODES[id];
    const text = promptText(n, s, c);
    say(text);
  }

  function startCall() {
    const s = IntakeGateway.startSession({
      channel,
      entryPoint: mode === "IVR" ? "tel:16699" : "*16699#",
      simulated: true,
      meta: mode === "IVR" ? { callerId: sim, lang } : { msisdn: sim, lang },
    });
    const r = IntakeGateway.verifyByNetwork(s.sessionId, sim, mode === "IVR" ? "CALLER_LINE_ID" : "NETWORK_MSISDN");
    if (!r.ok) {
      setError(tx("সিম নম্বরটি সঠিক নয় (01XXXXXXXXX)", "SIM number is not valid (01XXXXXXXXX)"));
      IntakeGateway.abandon(s.sessionId, "system");
      return;
    }
    setError(null);
    setSessionId(s.sessionId);
    goto(START_NODE);
    announce(START_NODE, s.sessionId, { mode, lang, sessionId: s.sessionId });
  }

  function hangUp() {
    const submitted = session?.step === "SUBMITTED";
    const withAgent = session?.agentHandoff?.status === "WAITING" || session?.agentHandoff?.status === "CONNECTED";
    // With an agent transfer open the session stays: the 16699 agent calls the caller back.
    if (sessionId && session && !submitted && !withAgent) IntakeGateway.abandon(sessionId);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    // Keep a submitted session selected so the handset can show its Application ID.
    if (!submitted) setSessionId(null);
    setNodeId(null);
    setBuffer("");
    setSpeech("");
    setError(null);
  }

  function answer(value: string) {
    if (!node || !sessionId || !ctx) return;
    const s = IntakeGateway.getSession(sessionId);
    if (!s) return;
    const r = node.handle(value, ctx, s);
    setBuffer("");
    setSpeech("");
    if ("error" in r) {
      const jump = jumpTarget(r.error);
      const msg = r.error.replace(/ → [A-Z_]+$/, "");
      setError(msg);
      say(msg);
      if (jump) {
        goto(jump);
        announce(jump, sessionId, ctx);
      }
      return;
    }
    setError(null);
    goto(r.next);
    announce(r.next, sessionId, ctx);
  }

  function press(k: string) {
    if (!node) return;
    if (node.input === "choice") return answer(k);
    if (node.input === "digits") {
      if (k === "#") return answer(buffer);
      if (k === "*") return setBuffer((b) => b.slice(0, -1));
      setBuffer((b) => (b + k).slice(0, 14));
    }
  }

  // "Processing" nodes (the simulated AI review) advance on their own.
  const autoMs = node?.auto ?? 0;
  const autoNode = node?.id ?? null;
  useEffect(() => {
    if (!autoMs || !live) return;
    const h = window.setTimeout(() => answer(""), autoMs);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNode, autoMs, live]);
  function emergency() {
    if (!sessionId || !ctx) return;
    try {
      IvrEscalation.emergency(sessionId, node?.id ?? "unknown");
      setError(null);
      goto("EMERGENCY");
      announce("EMERGENCY", sessionId, ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const opts = node && session && ctx ? node.options?.(ctx, session) ?? [] : [];
  const app = session?.applicationId ? db.applications.find((a) => a.applicationId === session.applicationId) : undefined;

  return (
    <div className={`${styles.work} ${ui.work}`}>
      <div className={ui.mainColumn}>
        <div className={`${styles.phoneWrap} ${ui.phoneWrap}`}>
          {/* ------------ the handset ------------ */}
          <div className={`${styles.phone} ${ui.phone}`} aria-label={mode === "IVR" ? tx("আইভিআর ফোন সিমুলেটর", "IVR phone simulator") : tx("ইউএসএসডি ফোন সিমুলেটর", "USSD feature-phone simulator")}>
            <div className={ui.phoneSpeaker} aria-hidden="true" />
            <div className={`${styles.phoneStatus} ${ui.phoneStatus}`}>
              <span>SIM {sim || "—"}</span>
              <span>{live ? (mode === "IVR" ? tx("কল চলছে", "In call") : "USSD") : tx("প্রস্তুত", "Idle")}</span>
            </div>
            <div className={`${styles.phoneScreen} ${ui.phoneScreen}`} aria-live="polite">
              {!live ? (
                <>
                  <strong>{mode === "IVR" ? tx("১৬৬৯৯-এ কল করুন", "Call 16699") : tx("*16699# ডায়াল করুন", "Dial *16699#")}</strong>
                  <label className={styles.field}>
                    <span className={styles.hint}>{tx("এই ফোনের সিম নম্বর (সিমুলেটেড)", "This phone's SIM number (simulated)")}</span>
                    <input className={styles.input} value={sim} onChange={(e) => setSim(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" />
                  </label>
                  {session?.step === "SUBMITTED" && app ? (
                    <p className={`${styles.notice} ${styles.noticeOk}`}>
                      {tx("শেষ আবেদন", "Last application")}: <strong>{app.applicationId}</strong>
                    </p>
                  ) : null}
                </>
              ) : mode === "USSD" ? (
                <div className={`${styles.ussdBox} ${ui.ussdBox}`}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{node && session && ctx ? node.prompt(ctx, session) : ""}</div>
                  {opts.length ? (
                    <ul className={styles.ussdOptions}>
                      {opts.map((o) => (
                        <li key={o.key}>
                          {o.key}. {o.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!node?.terminal ? (
                    <form className={ui.ussdReply}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (buffer.trim()) answer(buffer.trim());
                      }}
                    >
                      <input
                        className={styles.input}
                        aria-label={tx("উত্তর", "Reply")}
                        value={buffer}
                        maxLength={node?.input === "text" ? 160 : 14}
                        onChange={(e) => setBuffer(e.target.value)}
                        autoFocus
                      />
                      <Button type="submit">{tx("পাঠান", "Send")}</Button>
                    </form>
                  ) : null}
                  {error ? <span className={styles.errText}>{error}</span> : null}
                </div>
              ) : (
                <>
                  <span className={styles.eyebrow}>🔊 {tx("সিস্টেম বলছে", "System says")}</span>
                  {node?.auto ? <span className={ui.processing} role="status">🤖 {tx("সিমুলেটেড AI বিশ্লেষণ করছে…", "Simulated AI is processing…")}</span> : null}
                  <div style={{ whiteSpace: "pre-wrap" }}>{node && session && ctx ? promptText(node, session, ctx) : ""}</div>
                  {error ? <span className={styles.errText}>{error}</span> : null}
                  {live && node?.input === "text" && !node.terminal ? (
                    <div className={ui.voiceReply}>
                      <textarea className={styles.textarea} aria-label={tx("ভয়েস উত্তর", "Voice answer")} value={speech} onChange={(e) => setSpeech(e.target.value)} placeholder={tx("বলুন বা লিখুন", "Speak or type")} />
                      <div className={ui.voiceActions}>
                        <button type="button" className={styles.chip} onClick={mic.start} aria-pressed={mic.status === "listening"}>🎤 {mic.status === "listening" ? tx("শুনছি…", "Listening…") : tx("বলুন", "Speak")}</button>
                        <Button onClick={() => speech.trim() && answer(speech.trim())}>{tx("পাঠান", "Send")}</Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {mode === "IVR" && live ? <div className={styles.digitsEcho}>{node?.input === "digits" ? buffer || "…" : ""}</div> : null}

            {mode === "IVR" ? (
              <div className={`${styles.keypad} ${ui.keypad}`}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                  <button key={k} type="button" className={`${styles.key} ${ui.key}`} disabled={!live || !node || node.input === "text" || node.terminal} onClick={() => press(k)}>
                    {k}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={`${styles.callRow} ${ui.callRow}`}>
              <button type="button" className={`${styles.callBtn} ${ui.callBtn}`} onClick={startCall} disabled={live}>
                {mode === "IVR" ? tx("কল", "Call") : tx("ডায়াল", "Dial")}
              </button>
              <button type="button" className={`${styles.endBtn} ${ui.endBtn}`} onClick={hangUp} disabled={!live && !sessionId}>
                {mode === "IVR" ? tx("কল কাটুন", "Hang up") : tx("বাতিল", "Cancel")}
              </button>
            </div>
            {mode === "IVR" ? (
              <button type="button" className={ui.emergencyBtn} onClick={emergency} disabled={!live || session?.agentHandoff?.kind === "EMERGENCY"} aria-label={tx("জরুরি — এখনই এজেন্টের সাথে যুক্ত করুন", "Emergency — connect me to an agent now")}>
                🚨 {session?.agentHandoff?.kind === "EMERGENCY" ? tx("জরুরি সংযোগ চলছে", "Emergency transfer active") : tx("জরুরি", "EMERGENCY")}
              </button>
            ) : null}
            {mode === "IVR" ? (
              <label className={ui.voiceToggle}>
                <input type="checkbox" checked={tts} onChange={(e) => setTts(e.target.checked)} />
                {tx("প্রম্পট পড়ে শোনান", "Read prompts aloud")}
              </label>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

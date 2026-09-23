"use client";

/* ------------------------------------------------------------------ *
 *  ScriptedPhone — the IVR 16699 and USSD *16699# simulators.
 *
 *  The telephone network is SIMULATED (caller-line id / MSISDN, voice
 *  recognition, the USSD gateway). Everything behind it is real: each
 *  keypress runs the shared flow in lib/dlas/scripted-flow.ts, which
 *  writes the same ApplicationRecord as every other door.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { IntakeGateway, useDlasDb, type IntakeSession } from "@/lib/dlas";
import { NODES, START_NODE, jumpTarget, type FlowCtx, type FlowMode } from "@/lib/dlas/scripted-flow";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { LiveRecordPanel, SimSmsInbox, SimTag, StepTrail, styles, useDoorSession, useTx } from "./shared";


function nodeKey(sessionId: string) {
  return `dlas.node.${sessionId}`;
}

export function ScriptedPhone({ mode }: { mode: FlowMode }) {
  const { lang, tx } = useTx();
  const channel = mode === "IVR" ? "IVR_16699" : "USSD";
  const db = useDlasDb();
  const { sessionId, session, setSessionId } = useDoorSession(channel);
  // The caller's own SIM number — typed in, never pre-filled.
  const [sim, setSim] = useState("");
  const [nodeId, setNodeId] = useState<string | null>(() => {
    if (!sessionId || typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(nodeKey(sessionId));
    } catch {
      return null;
    }
  });
  const [buffer, setBuffer] = useState("");
  const [speech, setSpeech] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tts, setTts] = useState(false);
  const logRef = useRef<HTMLUListElement>(null);
  // Real browser speech-to-text fills the "voice answer" box; the caller can still edit it.
  const mic = useSpeechInput(lang, { onComplete: (heard) => setSpeech(heard) });

  const live = !!session && !!nodeId && session.step !== "ABANDONED";
  const node = nodeId ? NODES[nodeId] : null;
  const ctx: FlowCtx | null = sessionId ? { mode, lang, sessionId } : null;

  function goto(id: string, sid: string) {
    setNodeId(id);
    try {
      window.localStorage.setItem(nodeKey(sid), id);
    } catch {
      /* ignore */
    }
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
    IntakeGateway.transcript(sid, [{ from: "SYSTEM", text, nodeId: id }]);
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
    goto(START_NODE, s.sessionId);
    announce(START_NODE, s.sessionId, { mode, lang, sessionId: s.sessionId });
  }

  function hangUp() {
    const submitted = session?.step === "SUBMITTED";
    if (sessionId && session && !submitted) IntakeGateway.abandon(sessionId);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (sessionId) {
      try {
        window.localStorage.removeItem(nodeKey(sessionId));
      } catch {
        /* ignore */
      }
    }
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
    const shown = node.input === "text" && mode === "IVR" ? `🎙 “${value}”` : value;
    IntakeGateway.transcript(sessionId, [{ from: "USER", text: shown, nodeId: node.id }]);
    const r = node.handle(value, ctx, s);
    setBuffer("");
    setSpeech("");
    if ("error" in r) {
      const jump = jumpTarget(r.error);
      const msg = r.error.replace(/ → [A-Z_]+$/, "");
      setError(msg);
      IntakeGateway.transcript(sessionId, [{ from: "SYSTEM", text: `⚠ ${msg}`, nodeId: node.id }]);
      say(msg);
      if (jump) {
        goto(jump, sessionId);
        announce(jump, sessionId, ctx);
      }
      return;
    }
    setError(null);
    goto(r.next, sessionId);
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

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [session?.transcript.length]);

  const opts = node && session && ctx ? node.options?.(ctx, session) ?? [] : [];
  const title = mode === "IVR" ? "16699" : "*16699#";
  const app = session?.applicationId ? db.applications.find((a) => a.applicationId === session.applicationId) : undefined;

  return (
    <div className={styles.work}>
      <div>
        <StepTrail step={session?.step} />
        <div className={styles.phoneWrap}>
          {/* ------------ the handset ------------ */}
          <div className={styles.phone} aria-label={mode === "IVR" ? "IVR phone simulator" : "USSD feature-phone simulator"}>
            <div className={styles.phoneStatus}>
              <span>SIM {sim}</span>
              <span>{live ? (mode === "IVR" ? tx("কল চলছে", "In call") : "USSD") : tx("প্রস্তুত", "Idle")}</span>
            </div>
            <div className={styles.phoneScreen} aria-live="polite">
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
                <div className={styles.ussdBox}>
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
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (buffer.trim()) answer(buffer.trim());
                      }}
                      style={{ display: "flex", gap: "var(--s-2)" }}
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
                  <div style={{ whiteSpace: "pre-wrap" }}>{node && session && ctx ? promptText(node, session, ctx) : ""}</div>
                  {error ? <span className={styles.errText}>{error}</span> : null}
                </>
              )}
            </div>

            {mode === "IVR" && live ? <div className={styles.digitsEcho}>{node?.input === "digits" ? buffer || "…" : ""}</div> : null}

            {mode === "IVR" ? (
              <div className={styles.keypad}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                  <button key={k} type="button" className={styles.key} disabled={!live || !node || node.input === "text" || node.terminal} onClick={() => press(k)}>
                    {k}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.callRow}>
              <button type="button" className={styles.callBtn} onClick={startCall} disabled={live}>
                {mode === "IVR" ? tx("কল", "Call") : tx("ডায়াল", "Dial")}
              </button>
              <button type="button" className={styles.endBtn} onClick={hangUp} disabled={!live && !sessionId}>
                {mode === "IVR" ? tx("কল কাটুন", "Hang up") : tx("বাতিল", "Cancel")}
              </button>
            </div>
          </div>

          {/* ------------ controls & transcript ------------ */}
          <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
            {mode === "IVR" && live && node?.input === "text" ? (
              <div className={`${styles.card} ${styles.cardTight}`}>
                <p className={styles.eyebrow}>
                  {tx("ভয়েস উত্তর", "Voice answer")} · <SimTag>{tx("ব্রাউজারের স্পিচ রিকগনিশন", "Browser speech recognition")}</SimTag>
                </p>
                <p className={styles.hint}>{tx("মাইক্রোফোনে বলুন বা লিখুন। যন্ত্রের শোনা কথা 'AI_INFERRED' হিসেবে জমা হয়, পড়ে শোনানোর পর নিশ্চিত হয়।", "Speak into the microphone or type. What the machine heard is stored as AI_INFERRED until it is read back and confirmed.")}</p>
                <textarea className={styles.textarea} value={speech} onChange={(e) => setSpeech(e.target.value)} />
                <div className={styles.chips} style={{ marginTop: "var(--s-2)" }}>
                  <button type="button" className={styles.chip} onClick={mic.start} aria-pressed={mic.status === "listening"}>
                    🎤 {mic.status === "listening" ? tx("শুনছি…", "Listening…") : tx("মাইক্রোফোনে বলুন", "Speak into the microphone")}
                  </button>
                  {mic.status === "unsupported" ? (
                    <span className={styles.hint}>{tx("এই ব্রাউজারে ভয়েস ইনপুট নেই — লিখে দিন", "No voice input in this browser — type instead")}</span>
                  ) : mic.status === "error" ? (
                    <span className={styles.hint}>{tx("শোনা যায়নি — আবার চেষ্টা করুন বা লিখে দিন", "Couldn't hear — try again or type")}</span>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <Button onClick={() => speech.trim() && answer(speech.trim())}>🎙 {tx("বলুন (পাঠান)", "Speak (send)")}</Button>
                </div>
              </div>
            ) : null}

            {mode === "IVR" ? (
              <label className={styles.check}>
                <input type="checkbox" checked={tts} onChange={(e) => setTts(e.target.checked)} />
                {tx("প্রম্পট ব্রাউজারের কণ্ঠে পড়ে শোনান", "Read prompts aloud with the browser's voice")}
              </label>
            ) : null}

            <div className={`${styles.card} ${styles.cardTight}`}>
              <p className={styles.eyebrow}>
                {title} · {tx("কথোপকথন (রেকর্ডে সংরক্ষিত)", "Conversation (saved on the record)")}
              </p>
              <ul className={styles.transcript} ref={logRef}>
                {(session?.transcript ?? []).map((l, i) => (
                  <li key={i} className={l.from === "SYSTEM" ? styles.lineSys : styles.lineUser} style={{ whiteSpace: "pre-wrap" }}>
                    {l.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.side}>
        <SimSmsInbox phone={session?.identity.phone ?? null} />
        <LiveRecordPanel sessionId={sessionId} />
      </div>
    </div>
  );
}

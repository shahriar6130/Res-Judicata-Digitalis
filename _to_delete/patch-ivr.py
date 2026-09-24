import os, sys
ROOT = sys.argv[1]

def edit(p, pairs):
    p = os.path.join(ROOT, p)
    s = open(p).read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    open(p + '.new', 'w').write(s)
    os.replace(p + '.new', p)

# ---------------- lib/dlas/scripted-flow.ts ----------------
edit('lib/dlas/scripted-flow.ts', [
 ('import { IntakeGateway, type CaptureTag } from "./gateway";\n',
  'import { IntakeGateway, type CaptureTag } from "./gateway";\nimport { IvrEscalation } from "./ivr-triage";\n'),
 ('''  handle: (value: string, ctx: FlowCtx, s: IntakeSession) => { next: string } | { error: string };
  terminal?: boolean;
}''', '''  handle: (value: string, ctx: FlowCtx, s: IntakeSession) => { next: string } | { error: string };
  terminal?: boolean;
  /** Auto-advance after this many ms (the node "processes" — no caller input). */
  auto?: number;
}'''),
 # main menu: 9 = emergency (IVR)
 ('''      { key: "1", label: t(ctx, "আইনি সহায়তার আবেদন", "Apply for legal aid") },
      { key: "0", label: ctx.mode === "IVR" ? t(ctx, "একজন মানুষের সাথে কথা বলুন", "Talk to a person") : t(ctx, "কল-ব্যাক চাই", "Request a call-back") },
    ],
    handle: (v, ctx, s) => {
      if (v === "1") return { next: "WHO" };''', '''      { key: "1", label: t(ctx, "আইনি সহায়তার আবেদন", "Apply for legal aid") },
      { key: "0", label: ctx.mode === "IVR" ? t(ctx, "একজন মানুষের সাথে কথা বলুন", "Talk to a person") : t(ctx, "কল-ব্যাক চাই", "Request a call-back") },
      ...(ctx.mode === "IVR" ? [{ key: "9", label: t(ctx, "জরুরি — এখনই বিপদে আছি", "EMERGENCY — I am in danger now") }] : []),
    ],
    handle: (v, ctx, s) => {
      if (v === "1") return { next: "WHO" };
      if (v === "9" && ctx.mode === "IVR") {
        IvrEscalation.emergency(s.sessionId, "MAIN menu (9)");
        return { next: "EMERGENCY" };
      }'''),
 # after the story is read back → the simulated AI reviews it
 ('''      confirmReadBack(ctx, s, "matter.summary", s.draft.matter.summary ?? "");
      return { next: "DANGER" };''', '''      confirmReadBack(ctx, s, "matter.summary", s.draft.matter.summary ?? "");
      // IVR: the (simulated) AI assistant reviews the story before the call continues.
      return { next: ctx.mode === "IVR" ? "AI_TRIAGE" : "DANGER" };'''),
 # new nodes, before DANGER
 ('''  DANGER: {
    id: "DANGER",''', '''  AI_TRIAGE: {
    id: "AI_TRIAGE",
    input: "choice",
    auto: 2400,
    prompt: (ctx) => t(ctx, "অনুগ্রহ করে অপেক্ষা করুন — আমাদের সহকারী (সিমুলেটেড AI) আপনার কথা বুঝে দেখছে…", "Please hold — our assistant (simulated AI) is reviewing what you said…"),
    handle: (_v, ctx, s) => {
      const tr = IvrEscalation.triage(s.sessionId, ctx.lang);
      return { next: tr.decision === "ROUTE_TO_AGENT" ? "AGENT_TRANSFER" : "DANGER" };
    },
  },
  AGENT_TRANSFER: {
    id: "AGENT_TRANSFER",
    input: "choice",
    prompt: (ctx, s) => {
      const tr = s.aiTriage?.[s.aiTriage.length - 1];
      return tr?.severity === "CRITICAL"
        ? t(ctx, "আপনি যা বলেছেন তাতে এখনই একজন প্রশিক্ষিত মানুষের সাহায্য দরকার। আপনাকে ১৬৬৯৯-এর একজন এজেন্টের সাথে যুক্ত করা হচ্ছে — লাইনে থাকুন। জীবন ঝুঁকিতে থাকলে ৯৯৯-এ কল করুন।", "What you described needs a trained person now. We are connecting you to a 16699 agent — please stay on the line. If a life is in danger, call 999.")
        : t(ctx, "আপনার বিষয়টি একজন মানুষের দেখা ভালো। আপনাকে ১৬৬৯৯-এর একজন এজেন্টের সাথে যুক্ত করা হচ্ছে।", "Your situation is best handled by a person. We are connecting you to a 16699 agent.");
    },
    options: (ctx, s) => {
      const critical = s.aiTriage?.[s.aiTriage.length - 1]?.severity === "CRITICAL";
      return [
        { key: "1", label: t(ctx, "লাইনে থাকুন, এজেন্টের সাথে কথা বলব", "Stay on the line for the agent") },
        ...(critical ? [] : [{ key: "2", label: t(ctx, "না, স্বয়ংক্রিয় আবেদন চালিয়ে যাব", "No, continue the automated application") }]),
      ];
    },
    handle: (v, ctx, s) => {
      const critical = s.aiTriage?.[s.aiTriage.length - 1]?.severity === "CRITICAL";
      if (v === "1") return { next: "AGENT_WAIT" };
      if (v === "2" && !critical) {
        IvrEscalation.cancelHandoff(s.sessionId, "Caller chose to continue the automated application");
        return { next: "DANGER" };
      }
      return { error: critical ? "1" : "1 / 2" };
    },
  },
  AGENT_WAIT: {
    id: "AGENT_WAIT",
    input: "choice",
    terminal: true,
    prompt: (ctx, s) => {
      const h = s.agentHandoff;
      if (h?.status === "CONNECTED") return t(ctx, `এজেন্ট ${h.agentName ?? ""} কলে যুক্ত হয়েছেন। তিনি আপনার সাথে কথা বলে আবেদন সম্পূর্ণ করবেন।`, `Agent ${h.agentName ?? ""} has joined the call. They will complete your application with you.`);
      if (h?.status === "COMPLETED") return t(ctx, `এজেন্ট আপনার আবেদন জমা দিয়েছেন। আবেদন আইডি: ${s.applicationId ?? ""}`, `The agent submitted your application. Application ID: ${s.applicationId ?? ""}`);
      if (h?.status === "CLOSED") return t(ctx, `এজেন্ট কলটি শেষ করেছেন: ${h.outcome ?? ""}`, `The agent closed the call: ${h.outcome ?? ""}`);
      return t(ctx, "একজন এজেন্টের অপেক্ষায়… লাইনে থাকুন। কল কেটে গেলেও এজেন্ট আপনাকে ফোন করবেন।", "Waiting for an agent… please stay on the line. If the call drops, the agent will call you back.");
    },
    handle: () => ({ next: "AGENT_WAIT" }),
  },
  EMERGENCY: {
    id: "EMERGENCY",
    input: "choice",
    terminal: true,
    prompt: (ctx, s) => {
      const h = s.agentHandoff;
      const head = t(ctx, "জরুরি অবস্থা। কারও জীবন বিপদে থাকলে এখনই ৯৯৯-এ কল করুন।", "EMERGENCY. If anyone's life is in danger, call 999 now.");
      if (h?.status === "CONNECTED") return `${head}\n${t(ctx, `এজেন্ট ${h.agentName ?? ""} কলে যুক্ত হয়েছেন।`, `Agent ${h.agentName ?? ""} has joined the call.`)}`;
      if (h?.status === "COMPLETED") return `${head}\n${t(ctx, `এজেন্ট আবেদন জমা দিয়েছেন: ${s.applicationId ?? ""}`, `The agent submitted the application: ${s.applicationId ?? ""}`)}`;
      if (h?.status === "CLOSED") return `${head}\n${t(ctx, `এজেন্ট কল শেষ করেছেন: ${h.outcome ?? ""}`, `The agent closed the call: ${h.outcome ?? ""}`)}`;
      return `${head}\n${t(ctx, "আপনাকে এখনই ১৬৬৯৯-এর একজন এজেন্টের সাথে যুক্ত করা হচ্ছে (অগ্রাধিকার)। লাইনে থাকুন।", "Connecting you to a 16699 agent now (top priority). Please stay on the line.")}`;
    },
    handle: () => ({ next: "EMERGENCY" }),
  },
  DANGER: {
    id: "DANGER",'''),
])

# ---------------- components/dlas/scripted-phone.tsx ----------------
edit('components/dlas/scripted-phone.tsx', [
 ('import { NODES, START_NODE, jumpTarget, type FlowCtx, type FlowMode } from "@/lib/dlas/scripted-flow";\n',
  'import { NODES, START_NODE, jumpTarget, type FlowCtx, type FlowMode } from "@/lib/dlas/scripted-flow";\nimport { IvrEscalation } from "@/lib/dlas/ivr-triage";\nimport { IvrTriageCard } from "./ivr-triage-card";\n'),
 # hanging up while an agent transfer is open must not abandon the session: the agent calls back
 ('''    const submitted = session?.step === "SUBMITTED";
    if (sessionId && session && !submitted) IntakeGateway.abandon(sessionId);''', '''    const submitted = session?.step === "SUBMITTED";
    const withAgent = session?.agentHandoff?.status === "WAITING" || session?.agentHandoff?.status === "CONNECTED";
    // With an agent transfer open the session stays: the 16699 agent calls the caller back.
    if (sessionId && session && !submitted && !withAgent) IntakeGateway.abandon(sessionId);'''),
 ('''    const shown = node.input === "text" && mode === "IVR" ? `🎙 “${value}”` : value;
    IntakeGateway.transcript(sessionId, [{ from: "USER", text: shown, nodeId: node.id }]);''', '''    const shown = node.input === "text" && mode === "IVR" ? `🎙 “${value}”` : value;
    if (!node.auto) IntakeGateway.transcript(sessionId, [{ from: "USER", text: shown, nodeId: node.id }]);'''),
 ('''  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [session?.transcript.length]);''', '''  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [session?.transcript.length]);
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
      IntakeGateway.transcript(sessionId, [{ from: "USER", text: "🚨 EMERGENCY", nodeId: node?.id ?? "EMERGENCY" }]);
      setError(null);
      goto("EMERGENCY", sessionId);
      announce("EMERGENCY", sessionId, ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }'''),
 ('''                  <span className={styles.eyebrow}>🔊 {tx("সিস্টেম বলছে", "System says")}</span>
                  <div style={{ whiteSpace: "pre-wrap" }}>{node && session && ctx ? promptText(node, session, ctx) : ""}</div>''', '''                  <span className={styles.eyebrow}>🔊 {tx("সিস্টেম বলছে", "System says")}</span>
                  {node?.auto ? <span className={ui.processing} role="status">🤖 {tx("সিমুলেটেড AI বিশ্লেষণ করছে…", "Simulated AI is processing…")}</span> : null}
                  <div style={{ whiteSpace: "pre-wrap" }}>{node && session && ctx ? promptText(node, session, ctx) : ""}</div>'''),
 ('''              <button type="button" className={`${styles.endBtn} ${ui.endBtn}`} onClick={hangUp} disabled={!live && !sessionId}>
                {mode === "IVR" ? tx("কল কাটুন", "Hang up") : tx("বাতিল", "Cancel")}
              </button>
            </div>''', '''              <button type="button" className={`${styles.endBtn} ${ui.endBtn}`} onClick={hangUp} disabled={!live && !sessionId}>
                {mode === "IVR" ? tx("কল কাটুন", "Hang up") : tx("বাতিল", "Cancel")}
              </button>
            </div>
            {mode === "IVR" ? (
              <button type="button" className={ui.emergencyBtn} onClick={emergency} disabled={!live || session?.agentHandoff?.kind === "EMERGENCY"} aria-label={tx("জরুরি — এখনই এজেন্টের সাথে যুক্ত করুন", "Emergency — connect me to an agent now")}>
                🚨 {session?.agentHandoff?.kind === "EMERGENCY" ? tx("জরুরি সংযোগ চলছে", "Emergency transfer active") : tx("জরুরি", "EMERGENCY")}
              </button>
            ) : null}'''),
 ('''            {mode === "IVR" ? (
              <label className={styles.check}>''', '''            {mode === "IVR" && session ? <IvrTriageCard session={session} /> : null}
            {mode === "IVR" ? (
              <label className={styles.check}>'''),
])

css = os.path.join(ROOT, 'components/dlas/scripted-phone.module.css')
s = open(css).read()
if '.emergencyBtn' not in s:
    s = s.rstrip('\n') + '''

/* IVR emergency button + simulated-AI processing chip (IVR escalation) */
.emergencyBtn { display: block; width: 100%; margin-top: 10px; padding: 12px 14px; border: 0; border-radius: 12px; background: #b91c1c; color: #fff; font: inherit; font-weight: 800; letter-spacing: 0.06em; cursor: pointer; }
.emergencyBtn:disabled { opacity: 0.55; cursor: not-allowed; }
.emergencyBtn:not(:disabled):hover { background: #991b1b; }
.processing { display: inline-flex; align-items: center; gap: 6px; margin: 4px 0; padding: 3px 10px; border-radius: 999px; border: 1.5px dashed #7c3aed; color: #6d28d9; background: #f5f3ff; font-size: 0.8rem; font-weight: 700; animation: ivrPulse 1.2s ease-in-out infinite; }
@keyframes ivrPulse { 50% { opacity: 0.45; } }
'''
    open(css + '.new', 'w').write(s); os.replace(css + '.new', css)
# ---------------- helpline workspace + sidebar ----------------
edit('components/helpline/workspace.tsx', [
 ('import { HandoffsPanel } from "./panels/handoffs.panel";\n', 'import { HandoffsPanel } from "./panels/handoffs.panel";\nimport { IvrEscalationsPanel } from "./panels/ivr-escalations.panel";\n'),
 ('        {hash.route === "handoffs" ? <HandoffsPanel /> : null}\n', '        {hash.route === "handoffs" ? <HandoffsPanel /> : null}\n        {hash.route === "ivr-escalations" ? <IvrEscalationsPanel /> : null}\n'),
])
edit('components/sidebar.tsx', [
 ('    { href: "/dashboard/helpline#handoffs", label: "helplineNavHandoffs", key: "handoffs", Icon: AlertCircle },\n',
  '    { href: "/dashboard/helpline#ivr-escalations", label: "helplineNavIvrEscalations", key: "ivr-escalations", Icon: Phone },\n    { href: "/dashboard/helpline#handoffs", label: "helplineNavHandoffs", key: "handoffs", Icon: AlertCircle },\n'),
 ('  const urgentCases = useUrgentCases();\n', '  const urgentCases = useUrgentCases();\n  const agentQueue = useAgentQueue();\n'),
 ('        : role === "mediator"\n          ? { cases: mediations.active.length }\n          : undefined;',
  '        : role === "mediator"\n          ? { cases: mediations.active.length }\n          : role === "helpline"\n            ? { "ivr-escalations": agentQueue.open.filter((x) => x.handoff?.status === "WAITING").length }\n            : undefined;'),
 ('import { CitizenAuth,', 'import { useAgentQueue } from "@/lib/dlas/ivr-triage";\nimport { CitizenAuth,'),
])
s = open(os.path.join(ROOT, 'lib/i18n.tsx')).read()
a = '  | "helplineNavHandoffs"\n'
assert s.count(a) == 1
s = s.replace(a, a + '  | "helplineNavIvrEscalations"\n')
import re
idx = [m.start() for m in re.finditer(r'\n    helplineNavHandoffs: ', s)]
assert len(idx) == 2, idx
vals = ['    helplineNavIvrEscalations: "IVR থেকে আসা কল",', '    helplineNavIvrEscalations: "IVR escalations",']
out, last = [], 0
for i, pos in enumerate(idx):
    out.append(s[last:pos]); out.append('\n' + vals[i]); last = pos
out.append(s[last:])
p2 = os.path.join(ROOT, 'lib/i18n.tsx')
open(p2 + '.new', 'w').write(''.join(out)); os.replace(p2 + '.new', p2)
print("patched")

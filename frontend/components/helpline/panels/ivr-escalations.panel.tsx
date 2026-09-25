"use client";

/* ------------------------------------------------------------------ *
 *  16699 agent desk — IVR escalations (/dashboard/helpline#ivr-escalations).
 *  Calls the IVR routed to a person: the EMERGENCY button, or the
 *  simulated AI assistant finding the story critical or too complex.
 *  The agent signs in, takes the call, completes the missing fields on
 *  the SAME intake session and submits — an ApplicationRecord in
 *  dlas.db.v1 like every other door — or closes the call with an outcome.
 *  Data: lib/dlas/ivr-triage.ts
 * ------------------------------------------------------------------ */

import { useState, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { AgentDesk, HelplineAgentAuth, useAgentQueue, useCurrentAgent } from "@/lib/dlas/ivr-triage";
import { formatDateTime } from "@/lib/dlas";
import { DISTRICTS, MATTERS, SAFE_TIMES } from "@/lib/dlas/reference";
import type { AiTriage, DistrictCode, IntakeSession, MatterCategory, SafeTime, Task, UrgencyFlag } from "@/lib/dlas/schema";

type Lang = "bn" | "en";
type Item = ReturnType<typeof useAgentQueue>["open"][number];

const FINDING: Record<string, string> = {
  IMMEDIATE_DANGER: "Threat to life / danger now",
  SELF_HARM: "Self-harm risk",
  SEXUAL_VIOLENCE: "Sexual violence",
  PHYSICAL_VIOLENCE: "Physical violence",
  CHILD_AT_RISK: "Child at risk",
  DETENTION: "Detention / custody",
  TRAFFICKING: "Trafficking / forced labour",
  EVICTION_NOW: "Imminent eviction",
  COMPLEX_LEGAL: "Complex litigation",
  DISTRESS: "Caller in distress",
  UNCLEAR: "Unclear / too short",
};
/** What the agent may mark as the citizen's urgency, suggested from the AI findings (the agent decides). */
const SUGGEST_FLAG: Partial<Record<string, UrgencyFlag>> = {
  IMMEDIATE_DANGER: "IMMEDIATE_DANGER",
  PHYSICAL_VIOLENCE: "VIOLENCE_OR_THREAT",
  SEXUAL_VIOLENCE: "VIOLENCE_OR_THREAT",
  CHILD_AT_RISK: "CHILD_INVOLVED",
  DETENTION: "DETENTION",
  EVICTION_NOW: "EVICTION",
};
const SEV_COLOR: Record<string, string> = { ROUTINE: "#15803d", SENSITIVE: "#b45309", CRITICAL: "#b91c1c" };

const box: CSSProperties = { border: "1px solid var(--line)", borderRadius: 12, background: "var(--white)", padding: 16 };
const input: CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, font: "inherit", boxSizing: "border-box" };
const btn = (bg: string): CSSProperties => ({ padding: "9px 16px", borderRadius: 999, border: 0, background: bg, color: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" });

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

function AgentSignIn() {
  const { tx } = useTx();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const go = () => {
    const r = mode === "login" ? HelplineAgentAuth.login(phone) : HelplineAgentAuth.signUp(name, phone);
    setError(r.ok ? "" : r.error);
  };
  return (
    <div style={{ ...box, maxWidth: 420 }}>
      <h2 style={{ margin: "0 0 8px" }}>{mode === "login" ? tx("১৬৬৯৯ এজেন্ট সাইন-ইন", "16699 agent sign-in") : tx("১৬৬৯৯ এজেন্ট নিবন্ধন", "16699 agent sign-up")}</h2>
      {mode === "signup" ? (
        <label>
          {tx("নাম", "Name")}
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      ) : null}
      <label style={{ display: "block", marginTop: 8 }}>
        {tx("মোবাইল নম্বর", "Mobile number")}
        <input style={input} value={phone} inputMode="tel" placeholder="01XXXXXXXXX" onChange={(e) => setPhone(e.target.value)} />
      </label>
      {error ? <p style={{ color: "#b91c1c" }} role="alert">{error}</p> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <button type="button" style={btn("var(--ink)")} onClick={go}>
          {mode === "login" ? tx("সাইন ইন", "Sign in") : tx("নিবন্ধন", "Sign up")}
        </button>
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ background: "none", border: 0, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
          {mode === "login" ? tx("নতুন এজেন্ট? নিবন্ধন", "New agent? Sign up") : tx("আগে থেকে আছেন? সাইন ইন", "Already registered? Sign in")}
        </button>
      </div>
    </div>
  );
}

function TriageView({ tr }: { tr: AiTriage | null }) {
  const { tx } = useTx();
  if (!tr) return <p style={{ color: "var(--dlo-muted)", fontSize: 13 }}>{tx("AI পর্যালোচনা হয়নি (কলার জরুরি বোতাম চেপেছেন)।", "No AI review (the caller pressed the emergency button).")}</p>;
  return (
    <div style={{ fontSize: 13 }}>
      <span style={{ border: "1.5px dashed #7c3aed", color: "#6d28d9", borderRadius: 4, padding: "1px 6px", fontWeight: 800, fontSize: 11 }}>{tx("সিমুলেটেড AI · পরামর্শমূলক", "SIMULATED AI · ADVISORY")}</span>{" "}
      <strong style={{ color: SEV_COLOR[tr.severity] }}>{tr.severity}</strong> · {Math.round(tr.confidence * 100)}%
      <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
        {tr.findings.map((f, i) => (
          <li key={i}>
            <strong style={{ color: SEV_COLOR[f.severity] }}>{FINDING[f.code] ?? f.code}</strong> — “{f.evidence}”
          </li>
        ))}
      </ul>
    </div>
  );
}

function Draft({ s }: { s: IntakeSession | null }) {
  const { lang, tx } = useTx();
  if (!s) return null;
  const d = s.draft;
  const rows: [string, string | null][] = [
    [tx("কলার নম্বর", "Caller number"), s.identity.phone],
    [tx("ভাষা", "Language"), s.meta.lang ?? null],
    [tx("নাম", "Name"), d.applicant.fullName],
    [tx("জেলা", "District"), d.applicant.district ? DISTRICTS.find((x) => x.code === d.applicant.district)?.label[lang] ?? d.applicant.district : null],
    [tx("বিষয়", "Matter"), d.matter.category ? MATTERS.find((x) => x.code === d.matter.category)?.label[lang] ?? d.matter.category : null],
    [tx("গল্প", "Story"), d.matter.summary],
  ];
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "max-content minmax(0,1fr)", gap: "3px 12px", margin: 0, fontSize: 13 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ color: "var(--dlo-muted)" }}>{k}</dt>
          <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{v ?? <em style={{ color: "var(--dlo-muted)" }}>{tx("নেই", "not captured")}</em>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The agent's call form — only fields the IVR did not capture are needed; everything is editable. */
function CallForm({ t, s, tr }: { t: Task; s: IntakeSession; tr: AiTriage | null }) {
  const { lang, tx } = useTx();
  const d = s.draft;
  const suggested = Array.from(new Set((tr?.findings ?? []).map((f) => SUGGEST_FLAG[f.code]).filter((x): x is UrgencyFlag => !!x)));
  const [name, setName] = useState(d.applicant.fullName ?? "");
  const [district, setDistrict] = useState<string>(d.applicant.district ?? "");
  const [matter, setMatter] = useState<string>(d.matter.category ?? "");
  const [story, setStory] = useState(d.matter.summary ?? "");
  const [safePhone, setSafePhone] = useState(d.safeContact.phone ?? s.identity.phone ?? "");
  const [safeTime, setSafeTime] = useState<string>(d.safeContact.safeTime ?? "");
  const [sms, setSms] = useState(d.safeContact.smsAllowed ?? false);
  const [urgent, setUrgent] = useState(d.urgency.selfReportedUrgent || suggested.length > 0);
  const [flags, setFlags] = useState<UrgencyFlag[]>(d.urgency.flags.length ? d.urgency.flags : suggested);
  const [consent, setConsent] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const save = () => {
    AgentDesk.capture(t.taskId, {
      applicant: { fullName: name.trim() || null, district: (district || null) as DistrictCode | null },
      filedBy: d.filedBy.kind ? {} : { kind: "SELF", name: null, phone: null, relation: null },
      matter: { category: (matter || null) as MatterCategory | null, summary: story.trim() || null },
      safeContact: { method: "CALL", phone: safePhone.trim() || null, safeTime: (safeTime || null) as SafeTime | null, smsAllowed: sms, voicemailAllowed: false, neutralWordingRequired: true },
      urgency: { selfReportedUrgent: urgent, flags: urgent ? flags : [] },
    });
  };
  const submit = () => {
    try {
      save();
      if (!consent) throw new Error(tx("কলারের সম্মতি পড়ে শোনান ও চিহ্নিত করুন", "Read the consent notice to the caller and tick it"));
      AgentDesk.consent(t.taskId);
      const r = AgentDesk.submit(t.taskId);
      if (!r.ok) throw new Error(`${tx("তথ্য অসম্পূর্ণ", "Incomplete")}: ${r.validation.missing.join(", ")}`);
      setError("");
      setDone(`${tx("আবেদন জমা হয়েছে", "Application submitted")}: ${r.record.applicationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const close = () => {
    try {
      AgentDesk.close(t.taskId, outcome);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const lab: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 8 };
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{tx("কলে আবেদন সম্পূর্ণ করুন", "Complete the application on the call")}</h3>
      <p style={{ margin: 0, fontSize: 12, color: "var(--dlo-muted)" }}>{tx("একই ইনটেক সেশনে সংরক্ষিত হয় (উৎস: এজেন্ট লিখেছেন)। DLAO-র কাছে ওয়েব আবেদনের মতোই পৌঁছায়।", "Saved on the same intake session (source: entered by the agent). It reaches the DLAO exactly like a web application.")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 16px" }}>
        <label style={lab}>
          {tx("আবেদনকারীর নাম", "Applicant name")}
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={lab}>
          {tx("জেলা", "District")}
          <select style={input} value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">—</option>
            {DISTRICTS.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label[lang]}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          {tx("সমস্যার ধরন", "Type of problem")}
          <select style={input} value={matter} onChange={(e) => setMatter(e.target.value)}>
            <option value="">—</option>
            {MATTERS.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label[lang]}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          {tx("নিরাপদ নম্বর", "Safe number")}
          <input style={input} value={safePhone} inputMode="tel" onChange={(e) => setSafePhone(e.target.value)} />
        </label>
        <label style={lab}>
          {tx("নিরাপদ সময়", "Safe time")}
          <select style={input} value={safeTime} onChange={(e) => setSafeTime(e.target.value)}>
            <option value="">—</option>
            {SAFE_TIMES.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label[lang]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...lab, display: "flex", gap: 8, alignItems: "center", marginTop: 30 }}>
          <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> {tx("SMS পাঠানো যাবে", "SMS allowed")}
        </label>
      </div>
      <label style={lab}>
        {tx("গল্প (কলারের কথায়)", "Story (in the caller's words)")}
        <textarea style={{ ...input, minHeight: 70 }} value={story} onChange={(e) => setStory(e.target.value)} />
      </label>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: urgent ? "#fef2f2" : "var(--off-white)" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> {tx("জরুরি হিসেবে চিহ্নিত করুন (DLAO-র জরুরি তালিকায় যাবে)", "Mark urgent (goes to the DLAO's urgent list)")}
        </label>
        {urgent ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {(["IMMEDIATE_DANGER", "VIOLENCE_OR_THREAT", "EVICTION", "DETENTION", "CHILD_INVOLVED", "ONLINE_HARASSMENT"] as UrgencyFlag[]).map((f) => (
              <button key={f} type="button" aria-pressed={flags.includes(f)} onClick={() => setFlags(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f])} style={{ padding: "4px 10px", borderRadius: 999, border: `1.5px solid ${flags.includes(f) ? "#b91c1c" : "var(--line)"}`, background: flags.includes(f) ? "#fee2e2" : "#fff", cursor: "pointer", font: "inherit", fontSize: 12 }}>
                {flags.includes(f) ? "✓ " : ""}
                {f.replaceAll("_", " ").toLowerCase()}
                {suggested.includes(f) ? ` (${tx("AI পরামর্শ", "AI suggested")})` : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <label style={{ ...lab, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>{tx("কলারকে সম্মতির বিজ্ঞপ্তি পড়ে শুনিয়েছি; তিনি সম্মত (মৌখিক, পড়ে শোনানো)", "I read the consent notice to the caller and they agreed (verbal, read back)")}</span>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button type="button" style={btn("var(--green, #15803d)")} onClick={submit}>
          ✓ {tx("আবেদন জমা দিন", "Submit application")}
        </button>
        <button type="button" style={{ ...btn("#fff"), color: "var(--ink)", border: "1px solid var(--line)" }} onClick={() => { try { save(); setError(""); setDone(tx("খসড়া সংরক্ষিত", "Draft saved")); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}>
          {tx("খসড়া সংরক্ষণ", "Save draft")}
        </button>
      </div>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input style={{ ...input, marginTop: 0, maxWidth: 380 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={tx("আবেদন ছাড়া বন্ধ: কী হয়েছে (যেমন ৯৯৯-এ সংযুক্ত)", "Close without an application: what happened (e.g. connected to 999)")} />
        {["Connected to 999", "Caller hung up — will call back", "Referred to One-Stop Crisis Centre"].map((q) => (
          <button key={q} type="button" onClick={() => setOutcome(q)} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", font: "inherit", fontSize: 12 }}>
            {q}
          </button>
        ))}
        <button type="button" style={btn("#6b7280")} disabled={outcome.trim().length < 5} onClick={close}>
          {tx("কল বন্ধ করুন", "Close the call")}
        </button>
      </div>
      {error ? <p role="alert" style={{ color: "#b91c1c", fontWeight: 600 }}>⚠ {error}</p> : null}
      {done ? <p style={{ color: "#15803d", fontWeight: 700 }}>✓ {done}</p> : null}
    </div>
  );
}

function Card({ x }: { x: Item }) {
  const { lang, tx } = useTx();
  const me = useCurrentAgent();
  const [error, setError] = useState("");
  const emergency = x.t.type === "EMERGENCY_CALL";
  const h = x.handoff;
  const mine = h?.status === "CONNECTED" && h.agentId === me?.agentId;
  return (
    <article style={{ ...box, borderLeft: `6px solid ${emergency ? "#b91c1c" : "#d97706"}`, marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <strong style={{ color: emergency ? "#b91c1c" : "#b45309", letterSpacing: "0.05em" }}>{emergency ? `🚨 ${tx("জরুরি কল", "EMERGENCY CALL")}` : `🤖→☎ ${tx("AI এজেন্টের কাছে পাঠিয়েছে", "AI ESCALATION")}`}</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: "var(--dlo-muted)" }}>
            {x.t.taskId} · {formatDateTime(x.t.createdAt, lang)} · {tx("সময়সীমা", "due")} {formatDateTime(x.t.dueAt, lang)}
          </span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{h ? h.status : x.t.status}{h?.agentName ? ` · ${h.agentName}` : ""}</span>
      </div>
      <p style={{ margin: "6px 0", fontSize: 13 }}>{x.t.reason}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Draft s={x.s} />
        <TriageView tr={x.triage} />
      </div>
      {h?.status === "WAITING" ? (
        <button type="button" style={{ ...btn(emergency ? "#b91c1c" : "var(--ink)"), marginTop: 10 }} onClick={() => { try { AgentDesk.take(x.t.taskId); setError(""); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}>
          ☎ {tx("কল ধরুন", "Take the call")}
        </button>
      ) : null}
      {mine && x.s ? <CallForm t={x.t} s={x.s} tr={x.triage} /> : null}
      {h?.status === "CONNECTED" && !mine ? <p style={{ fontSize: 13 }}>{tx("অন্য এজেন্ট কলে আছেন।", "Another agent is on this call.")}</p> : null}
      {error ? <p role="alert" style={{ color: "#b91c1c" }}>⚠ {error}</p> : null}
    </article>
  );
}

export function IvrEscalationsPanel() {
  const { lang, tx } = useTx();
  const me = useCurrentAgent();
  const q = useAgentQueue();
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <p style={{ fontSize: 12, letterSpacing: "0.1em", fontWeight: 700, color: "var(--dlo-muted)", margin: 0 }}>{tx("১৬৬৯৯ কল সেন্টার", "16699 CALL CENTRE")}</p>
      <h1 style={{ fontFamily: "var(--font-serif)", margin: "4px 0 6px" }}>{tx("IVR থেকে আসা কল", "IVR escalations")}</h1>
      <p style={{ color: "var(--dlo-muted)", margin: "0 0 16px", maxWidth: "75ch" }}>
        {tx("কলার জরুরি বোতাম চাপলে, বা সিমুলেটেড AI সহকারী গল্পে গুরুতর বা জটিল কিছু পেলে, কলটি এখানে আসে। কল ধরে বাকি তথ্য নিন ও আবেদন জমা দিন — বা কী হয়েছে লিখে বন্ধ করুন।", "Calls arrive here when the caller presses the emergency button, or the simulated AI assistant finds something critical or complex in the story. Take the call, complete the rest and submit — or close it with what happened.")}
      </p>
      {!me ? (
        <AgentSignIn />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, fontSize: 14 }}>
            <span>
              {tx("এজেন্ট", "Agent")}: <strong>{me.name}</strong> ({me.agentId})
            </span>
            <button type="button" onClick={() => HelplineAgentAuth.logout()} style={{ background: "none", border: 0, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
              {tx("সাইন আউট", "Sign out")}
            </button>
          </div>
          <h2 style={{ fontSize: 16 }}>
            {tx("অপেক্ষমাণ ও চলমান", "Waiting & in progress")} ({q.open.length})
          </h2>
          {q.open.length === 0 ? <p style={{ color: "var(--dlo-muted)" }}>{tx("এখন কোনো কল অপেক্ষায় নেই।", "No calls waiting right now.")}</p> : q.open.map((x) => <Card key={x.t.taskId} x={x} />)}
          {q.done.length ? (
            <>
              <h2 style={{ fontSize: 16, marginTop: 24 }}>{tx("সম্পন্ন", "Completed")}</h2>
              <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                {q.done.map((x) => (
                  <li key={x.t.taskId}>
                    {x.t.type === "EMERGENCY_CALL" ? "🚨" : "🤖"} {x.t.taskId} · {x.handoff?.agentName ?? "—"} · {x.handoff?.outcome ?? x.t.status}
                    {x.t.applicationId ? ` · ${x.t.applicationId}` : ""} · {formatDateTime(x.handoff?.closedAt ?? x.t.createdAt, lang)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

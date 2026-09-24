"use client";

/* ------------------------------------------------------------------ *
 *  IVR side panel: what the SIMULATED AI assistant concluded about the
 *  caller's story, and where the hand-off to a 16699 agent stands.
 *  Advisory only — the AI never rejects or decides; it can only bring a
 *  person onto the call.
 * ------------------------------------------------------------------ */

import { formatDateTime, type IntakeSession } from "@/lib/dlas";
import { styles, useTx } from "./shared";

const FINDING: Record<string, { bn: string; en: string }> = {
  IMMEDIATE_DANGER: { bn: "জীবনের ঝুঁকি / এখন বিপদ", en: "Threat to life / danger now" },
  SELF_HARM: { bn: "আত্মক্ষতির ঝুঁকি", en: "Self-harm risk" },
  SEXUAL_VIOLENCE: { bn: "যৌন সহিংসতা", en: "Sexual violence" },
  PHYSICAL_VIOLENCE: { bn: "শারীরিক সহিংসতা", en: "Physical violence" },
  CHILD_AT_RISK: { bn: "শিশু ঝুঁকিতে", en: "Child at risk" },
  DETENTION: { bn: "আটক / হেফাজতে", en: "Detention / custody" },
  TRAFFICKING: { bn: "পাচার / জোরপূর্বক শ্রম", en: "Trafficking / forced labour" },
  EVICTION_NOW: { bn: "আসন্ন উচ্ছেদ", en: "Imminent eviction" },
  COMPLEX_LEGAL: { bn: "জটিল মামলা", en: "Complex litigation" },
  DISTRESS: { bn: "মানসিক চাপ", en: "Caller in distress" },
  UNCLEAR: { bn: "অস্পষ্ট / খুব ছোট", en: "Unclear / too short" },
};
const SEV: Record<string, { bn: string; en: string; color: string }> = {
  ROUTINE: { bn: "সাধারণ", en: "Routine", color: "#15803d" },
  SENSITIVE: { bn: "সংবেদনশীল / জটিল", en: "Sensitive / tough", color: "#b45309" },
  CRITICAL: { bn: "গুরুতর", en: "Critical", color: "#b91c1c" },
};
const HANDOFF: Record<string, { bn: string; en: string }> = {
  WAITING: { bn: "এজেন্টের অপেক্ষায়", en: "Waiting for an agent" },
  CONNECTED: { bn: "এজেন্ট যুক্ত", en: "Agent connected" },
  COMPLETED: { bn: "এজেন্ট আবেদন জমা দিয়েছেন", en: "Agent submitted the application" },
  CLOSED: { bn: "বন্ধ", en: "Closed" },
};

export function IvrTriageCard({ session }: { session: IntakeSession }) {
  const { lang, tx } = useTx();
  const L = lang === "bn" ? "bn" : "en";
  const tr = session.aiTriage?.[session.aiTriage.length - 1] ?? null;
  const h = session.agentHandoff ?? null;
  if (!tr && !h) return null;
  return (
    <div className={`${styles.card} ${styles.cardTight}`} aria-label={tx("AI পর্যালোচনা ও এজেন্ট হস্তান্তর", "AI review and agent hand-off")}>
      {tr ? (
        <>
          <p className={styles.eyebrow}>
            🤖 {tx("সহকারীর পর্যালোচনা", "Assistant review")} ·{" "}
            <span style={{ border: "1.5px dashed #7c3aed", color: "#6d28d9", borderRadius: 4, padding: "1px 6px", fontWeight: 800 }}>{tx("সিমুলেটেড AI · পরামর্শমূলক", "SIMULATED AI · ADVISORY")}</span>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "4px 0" }}>
            <strong style={{ color: SEV[tr.severity].color }}>{SEV[tr.severity][L]}</strong>
            <span>→ {tr.decision === "ROUTE_TO_AGENT" ? tx("একজন এজেন্টের কাছে পাঠানো হয়েছে", "Routed to a 16699 agent") : tx("স্বয়ংক্রিয় আবেদন চলবে", "Automated application continues")}</span>
            <span className={styles.hint}>
              {tx("আত্মবিশ্বাস", "confidence")} {Math.round(tr.confidence * 100)}%
            </span>
          </div>
          {tr.findings.length ? (
            <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: "0.85rem" }}>
              {tr.findings.map((f, i) => (
                <li key={i}>
                  <strong style={{ color: SEV[f.severity].color }}>{FINDING[f.code]?.[L] ?? f.code}</strong> — “{f.evidence}”
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>{tx("কোনো গুরুতর বা জটিল সংকেত পাওয়া যায়নি।", "No critical or complex signals found.")}</p>
          )}
          <p className={styles.hint}>{tx("নিয়মভিত্তিক সিমুলেশন (আসল AI নয়)। এটি কাউকে বাদ দেয় না বা যোগ্যতা ঠিক করে না — শুধু একজন মানুষকে কলে আনে।", "A rule-based simulation (not a real AI). It never rejects anyone or decides eligibility — it can only bring a person onto the call.")}</p>
        </>
      ) : null}
      {h ? (
        <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: h.kind === "EMERGENCY" ? "#fef2f2" : "#fffbeb", border: `1px solid ${h.kind === "EMERGENCY" ? "#fca5a5" : "#fcd34d"}` }}>
          <strong>{h.kind === "EMERGENCY" ? `🚨 ${tx("জরুরি হস্তান্তর", "Emergency transfer")}` : `☎ ${tx("এজেন্ট হস্তান্তর", "Agent transfer")}`}</strong> · {HANDOFF[h.status][L]}
          {h.agentName ? ` · ${h.agentName}` : ""}
          <div className={styles.hint}>
            {tx("অনুরোধ", "requested")} {formatDateTime(h.requestedAt, lang)} · {h.taskId}
            {h.outcome ? ` · ${h.outcome}` : ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}

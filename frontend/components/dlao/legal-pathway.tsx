"use client";

/* ------------------------------------------------------------------ *
 *  LEGAL PATHWAY — the Step-2 section of /dashboard/dlo#app/<id>.
 *
 *    ① Case category        structured facts (officer fills subcategory + court status)
 *    ↓
 *    ② Applicable rule      the first matching rule in the configurable table
 *    ↓
 *    ③ System assessment    SYSTEM SUGGESTION (dashed) — never final
 *    ↓
 *    ④ Officer decision     Confirm / Change / Request more information
 *                           → OFFICER CONFIRMED (solid green) is the only final state
 *
 *  Rules live in lib/dlas/pathway-rules.ts (DEFAULT_PATHWAY_RULES, overridable
 *  by db.pathwayRules); decisions in application.pathwayClassification.
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import {
  COURT_STATUSES,
  DISTRICTS,
  DOC_TYPES,
  EMPTY_PATHWAY_INPUTS,
  MATTERS,
  PATHWAY_STATUSES,
  PathwayService,
  REFERRAL_TARGETS,
  URGENCY_FLAGS,
  assessDraft,
  formatDateTime,
  isMediationStatus,
  label,
  statusLabel,
  subcategoriesFor,
  trackFor,
  useDlasDb,
  usePathwayRules,
  type ApplicationRecord,
  type CourtStatus,
  type CourtLevel,
  type LitigationStage,
  type MediationOrigin,
  type PathwayInputs,
  type PathwayStatus,
  type ReferralTarget,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";
type Lang = "bn" | "en";
type Run = (fn: () => void) => void;

function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`}>{children}</span>;
}

function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

function Step({ n, title, className, children }: { n: number; title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`${ui.flowStep} ${className ?? ""}`} aria-label={title}>
      <div className={ui.flowLabel}>
        <span className={ui.flowNum}>{n}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

const Arrow = () => (
  <div className={ui.flowArrow} aria-hidden>
    ↓
  </div>
);

const COURT_DETAIL: CourtStatus[] = ["FILED_PENDING", "REFERRED_FOR_MEDIATION", "DECIDED", "APPEAL"];
type Patch = Pick<PathwayInputs, "subcategory" | "courtStatus" | "mediationOrigin" | "courtName" | "courtLevel" | "courtCaseNo" | "referralDate" | "referralOrderReference" | "referringAuthority" | "currentLitigationStage" | "referralDeadline">;

const ORIGINS: { code: MediationOrigin; bn: string; en: string }[] = [
  { code: "PRE_LITIGATION", bn: "মামলা-পূর্ব", en: "Pre-Litigation" },
  { code: "MANDATORY_PRE_CASE", bn: "বাধ্যতামূলক প্রাক-মামলা", en: "Mandatory Pre-Case" },
  { code: "COURT_REFERRED", bn: "আদালত-প্রেরিত", en: "Court-Referred" },
  { code: "APPELLATE_REFERRAL", bn: "আপিল রেফারেল", en: "Appellate Referral" },
];
const COURT_LEVELS: CourtLevel[] = ["SUPREME_COURT", "DISTRICT_JUDGE", "ADDITIONAL_DISTRICT_JUDGE", "JOINT_DISTRICT_JUDGE", "SENIOR_ASSISTANT_JUDGE", "ASSISTANT_JUDGE", "MAGISTRATE", "TRIBUNAL", "OTHER"];
const LITIGATION_STAGES: LitigationStage[] = ["PLEADINGS", "PRE_TRIAL", "TRIAL", "ARGUMENT", "JUDGMENT_PENDING", "APPEAL", "OTHER"];

/* ================================================================== */

export function LegalPathway({ a, run }: { a: ApplicationRecord; run: Run }) {
  const { lang, tx } = useTx();
  const db = useDlasDb();
  const rules = usePathwayRules();
  const saved = a.pathwayClassification?.inputs ?? EMPTY_PATHWAY_INPUTS;
  const [draft, setDraft] = useState<Patch>({ subcategory: saved.subcategory, courtStatus: saved.courtStatus, mediationOrigin: saved.mediationOrigin, courtName: saved.courtName, courtLevel: saved.courtLevel, courtCaseNo: saved.courtCaseNo, referralDate: saved.referralDate, referralOrderReference: saved.referralOrderReference, referringAuthority: saved.referringAuthority, currentLitigationStage: saved.currentLitigationStage, referralDeadline: saved.referralDeadline });
  const inputs: PathwayInputs = { ...saved, ...draft };
  const s = assessDraft(a, inputs, db); // deterministic and cheap — recomputed from the draft on every render
  const dirty = (Object.keys(draft) as (keyof Patch)[]).some((k) => (draft[k] ?? null) !== (saved[k] ?? null));
  const subs = subcategoriesFor(rules, a.data.matter.category);
  const d = a.data;
  const docs = d.documents.filter((x) => x.status === "ATTACHED");
  const up = (p: Partial<Patch>) => setDraft((x) => ({ ...x, ...p }));

  return (
    <div className={ui.flow}>
      {/* ① CASE CATEGORY */}
      <Step n={1} title={tx("মামলার ধরন", "Case category")}>
        <div className={ui.rows}>
          <Row label={tx("বিরোধের ধরন", "Dispute category")}>
            {label(MATTERS, d.matter.category, lang)} <Tag>{a.provenance["matter.category"]?.source ?? "—"}</Tag>
          </Row>
          <Row label={tx("জেলা", "Location")}>{label(DISTRICTS, d.applicant.district, lang)}</Row>
          <Row label={tx("পক্ষসমূহ", "Parties")}>
            {d.applicant.fullName ?? "—"} ↔ {d.matter.opposingParty?.trim() ? d.matter.opposingParty : <Tag tone="warn">{tx("অপর পক্ষ চিহ্নিত নয়", "Other party not identified")}</Tag>}
          </Row>
          <Row label={tx("জরুরি সংকেত", "Urgency indicators")}>{d.urgency.flags.length ? d.urgency.flags.map((f) => <Tag key={f} tone="err">{label(URGENCY_FLAGS, f, lang)}</Tag>) : tx("নেই", "None")}</Row>
          <Row label={tx("সংযুক্ত নথি", "Documents available")}>{docs.length ? docs.map((x) => label(DOC_TYPES, x.type, lang)).join(", ") : tx("নেই", "None")}</Row>
        </div>
        <p className={styles.hint} style={{ margin: "var(--s-3) 0 var(--s-2)" }}>
          {tx("নিচের তথ্য আবেদনে থাকে না — কর্মকর্তা লিখবেন (OFFICER_ENTERED)।", "Intake does not capture the facts below — the officer records them (OFFICER_ENTERED).")}
        </p>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>{tx("উপ-ধরন", "Subcategory")}</span>
            <select className={styles.select} value={draft.subcategory ?? ""} onChange={(e) => up({ subcategory: e.target.value || null })}>
              <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
              {subs.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.label[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("মধ্যস্থতার উৎস", "Mediation origin")}</span>
            <select className={styles.select} value={draft.mediationOrigin ?? ""} onChange={(e) => up({ mediationOrigin: (e.target.value || null) as MediationOrigin | null })}>
              <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
              {ORIGINS.map((x) => <option key={x.code} value={x.code}>{x[lang]}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("আদালতের অবস্থা", "Existing court case / status")}</span>
            <select className={styles.select} value={draft.courtStatus} onChange={(e) => up({ courtStatus: e.target.value as CourtStatus })}>
              {COURT_STATUSES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label[lang]}
                </option>
              ))}
            </select>
          </label>
          {COURT_DETAIL.includes(draft.courtStatus) ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>{tx("আদালত", "Court")}</span>
                <input className={styles.input} value={draft.courtName ?? ""} onChange={(e) => up({ courtName: e.target.value })} placeholder={tx("যেমন: সহকারী জজ আদালত, সদর", "e.g. Assistant Judge Court, Sadar")} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{tx("আদালতের স্তর", "Court level")}</span>
                <select className={styles.select} value={draft.courtLevel ?? ""} onChange={(e) => up({ courtLevel: (e.target.value || null) as CourtLevel | null })}>
                  <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
                  {COURT_LEVELS.map((x) => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{tx("মামলা নম্বর", "Court case no.")}</span>
                <input className={styles.input} value={draft.courtCaseNo ?? ""} onChange={(e) => up({ courtCaseNo: e.target.value })} />
              </label>
              {draft.courtStatus === "REFERRED_FOR_MEDIATION" ? (
                <>
                  <label className={styles.field}><span className={styles.label}>{tx("রেফারেলের তারিখ", "Referral date")}</span><input type="date" className={styles.input} value={draft.referralDate ?? ""} onChange={(e) => up({ referralDate: e.target.value })} /></label>
                  <label className={styles.field}><span className={styles.label}>{tx("রেফারেল আদেশ / রেফারেন্স", "Referral order / reference")}</span><input className={styles.input} value={draft.referralOrderReference ?? ""} onChange={(e) => up({ referralOrderReference: e.target.value })} /></label>
                  <label className={styles.field}><span className={styles.label}>{tx("রেফারকারী কর্তৃপক্ষ", "Referring authority")}</span><input className={styles.input} value={draft.referringAuthority ?? ""} onChange={(e) => up({ referringAuthority: e.target.value })} /></label>
                  <label className={styles.field}><span className={styles.label}>{tx("বর্তমান মামলা পর্যায়", "Current litigation stage")}</span><select className={styles.select} value={draft.currentLitigationStage ?? ""} onChange={(e) => up({ currentLitigationStage: (e.target.value || null) as LitigationStage | null })}><option value="">{tx("— বেছে নিন —", "— choose —")}</option>{LITIGATION_STAGES.map((x) => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></label>
                  <label className={styles.field}><span className={styles.label}>{tx("রেফারেল সময়সীমা", "Referral deadline")}</span><input type="date" className={styles.input} value={draft.referralDeadline ?? ""} onChange={(e) => up({ referralDeadline: e.target.value })} /></label>
                </>
              ) : null}
            </>
          ) : null}
        </div>
        <div className={ui.bar} style={{ marginTop: "var(--s-3)" }}>
          <Button variant="secondary" disabled={!dirty} onClick={() => run(() => void PathwayService.saveInputs(a.applicationId, draft))}>
            {tx("তথ্য সংরক্ষণ", "Save facts")}
          </Button>
          {dirty ? <Tag tone="warn">{tx("সংরক্ষণ হয়নি — মূল্যায়ন খসড়া থেকে", "Not saved — assessment below uses the draft")}</Tag> : saved.setAt ? <span className={styles.hint}>{tx(`সংরক্ষিত · ${saved.setByName}`, `Saved · ${saved.setByName}`)}</span> : null}
        </div>
      </Step>

      <Arrow />

      {/* ② APPLICABLE RULE */}
      <Step n={2} title={tx("প্রযোজ্য নিয়ম / শ্রেণি", "Applicable rule / category")}>
        {s.rule ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <strong>{s.rule.title[lang]}</strong>
              <Tag>{s.rule.ruleId}</Tag>
            </div>
            {s.rule.law ? (
              <p style={{ margin: "6px 0" }}>
                <span className={styles.hint}>{tx("আইন (যাচাই করুন):", "Law (verify):")}</span> {s.rule.law}
              </p>
            ) : null}
            <p style={{ margin: "6px 0" }}>{s.rule.basis[lang]}</p>
          </>
        ) : (
          <p style={{ margin: 0 }}>{tx("কোনো নিয়ম মেলেনি।", "No rule matched these facts.")}</p>
        )}
        <div className={styles.hint}>
          {tx("মিলেছে:", "Matched:")} {s.matched.join(" · ")}
        </div>
        <div className={styles.hint}>
          {tx("নিয়ম সংস্করণ", "Rule table")} {s.rulesVersion} · {tx("নির্ধারিত নিয়ম — AI নয়, আইনি পরামর্শ নয়", "deterministic rules — not AI, not legal advice")}
        </div>
      </Step>

      <Arrow />

      {/* ③ SYSTEM ASSESSMENT */}
      <Step n={3} title={tx("সিস্টেমের মূল্যায়ন", "System assessment")} className={ui.suggest}>
        <span className={ui.suggestBadge}>{tx("সিস্টেমের প্রস্তাব · চূড়ান্ত নয়", "SYSTEM SUGGESTION · NOT FINAL")}</span>
        <div className={ui.bigPathway}>
          {tx("সম্ভাব্য পথ:", "Possible pathway:")} {statusLabel(s.result, lang)}
        </div>
        <div className={styles.hint}>{PATHWAY_STATUSES.find((x) => x.code === s.result)?.help[lang]}</div>
        {trackFor(s.result, s.rule) ? <div className={styles.hint}>{trackFor(s.result, s.rule) === "COURT_REFERRED" ? tx("ধারা: আদালত-প্রেরিত", "Track: court-referred") : tx("ধারা: মামলা-পূর্ব", "Track: pre-litigation")}</div> : null}
        {s.evidence.length ? (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {s.evidence.map((e) => (
              <Tag key={e.docType} tone={e.present ? "ok" : "warn"}>
                {e.present ? "✓" : "✗"} {label(DOC_TYPES, e.docType, lang)}
              </Tag>
            ))}
          </div>
        ) : null}
        {s.warnings.length ? (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {s.warnings.map((w) => (
              <li key={w.en} style={{ color: "var(--dlo-warning-ink)" }}>
                {w[lang]}
              </li>
            ))}
          </ul>
        ) : null}
      </Step>

      <Arrow />

      {/* ④ OFFICER DECISION */}
      <Step n={4} title={tx("লিগ্যাল এইড অফিসারের পর্যালোচনা", "Legal Aid Officer review")}>
        <OfficerReview a={a} run={run} draft={draft} system={s.result} ruleTarget={s.rule?.referralTarget ?? null} />
        <DecisionLog a={a} />
      </Step>

      <RuleTable />
    </div>
  );
}

/* ------------------------------ officer review → send the case to ------------------------------ */

type Dest = "GRAM_ADALAT" | "MEDIATION" | "LAWYER";

const DESTS: { code: Dest; icon: string; title: { bn: string; en: string }; text: { bn: string; en: string }; next: { bn: string; en: string } }[] = [
  {
    code: "GRAM_ADALAT",
    icon: "🏛",
    title: { bn: "গ্রাম আদালত", en: "Gram Adalat" },
    text: { bn: "ইউনিয়ন পর্যায়ের ছোট স্থানীয় বিরোধ, গ্রাম আদালতের এখতিয়ারে।", en: "Small local disputes within the village court's jurisdiction, at union level." },
    next: { bn: "পরবর্তী: গ্রাম আদালতে রেফারেল কাজ খুলবে ও আবেদনকারীকে জানানো হবে।", en: "Next: a Gram Adalat referral task opens and the applicant is told." },
  },
  {
    code: "MEDIATION",
    icon: "🤝",
    title: { bn: "মধ্যস্থতা", en: "Mediation" },
    text: { bn: "মামলা-পূর্ব বা আদালত-প্রেরিত মধ্যস্থতা — উভয় পক্ষ নিরাপদে বসতে পারলে।", en: "Pre-case or court-referred mediation — when both parties can safely sit together." },
    next: { bn: "পরবর্তী: মধ্যস্থতাকারী নিয়োগ — যোগ্যতা যাচাই, প্রস্তাব, নিশ্চিতকরণ।", en: "Next: mediator assignment — eligibility check, recommend, confirm." },
  },
  {
    code: "LAWYER",
    icon: "⚖",
    title: { bn: "প্যানেল আইনজীবী নিয়োগ", en: "Lawyer assignment" },
    text: { bn: "আদালতে প্রতিনিধিত্ব, মামলা দায়ের বা সুরক্ষা আদেশ।", en: "Court representation, filing a claim or seeking protection." },
    next: { bn: "পরবর্তী: প্যানেল আইনজীবী শর্টলিস্ট ও প্রস্তাব।", en: "Next: panel lawyer shortlist and offer." },
  },
];

const MEDIATION_KINDS: PathwayStatus[] = ["MANDATORY_PRE_CASE_MEDIATION", "MEDIATION_AVAILABLE", "COURT_REFERRED_MEDIATION"];

/** Which of the three destinations a pathway status belongs to (null = outside them, e.g. police referral). */
function destOf(status: PathwayStatus, target: ReferralTarget | null): Dest | null {
  if (isMediationStatus(status)) return "MEDIATION";
  if (status === "LAWYER_ASSISTANCE" || status === "URGENT_ESCALATION") return "LAWYER";
  if (status === "OTHER_REFERRAL" && target === "GRAM_ADALAT") return "GRAM_ADALAT";
  return null;
}

function OfficerReview({ a, run, draft, system, ruleTarget }: { a: ApplicationRecord; run: Run; draft: Patch; system: PathwayStatus; ruleTarget: ReferralTarget | null }) {
  const { lang, tx } = useTx();
  const suggested = destOf(system, ruleTarget);
  const [dest, setDest] = useState<Dest | "OTHER" | "INFO" | null>(null);
  const [kind, setKind] = useState<PathwayStatus>(isMediationStatus(system) ? system : draft.courtStatus === "REFERRED_FOR_MEDIATION" ? "COURT_REFERRED_MEDIATION" : "MEDIATION_AVAILABLE");
  const [other, setOther] = useState<ReferralTarget | null>(ruleTarget && ruleTarget !== "GRAM_ADALAT" ? ruleTarget : null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const violence = a.data.urgency.flags.length > 0 || a.data.matter.category === "VIOLENCE";

  // The pathway status (and referral target) the officer's choice records.
  const chosen: { status: PathwayStatus; target: ReferralTarget | null } | null =
    dest === "GRAM_ADALAT" ? { status: "OTHER_REFERRAL", target: "GRAM_ADALAT" }
    : dest === "MEDIATION" ? { status: kind, target: null }
    : dest === "LAWYER" ? { status: system === "URGENT_ESCALATION" ? "URGENT_ESCALATION" : "LAWYER_ASSISTANCE", target: null }
    : dest === "OTHER" && other ? { status: "OTHER_REFERRAL", target: other }
    : null;
  const followsSystem = !!chosen && chosen.status === system;
  const send = () => {
    if (!chosen) return;
    run(() => void (followsSystem ? PathwayService.confirm(a.applicationId, draft, reason, chosen.target) : PathwayService.change(a.applicationId, draft, chosen.status, chosen.target, reason)));
  };
  const pick = (d: typeof dest) => {
    setDest(d);
    setReason("");
  };
  const title = dest && dest !== "OTHER" && dest !== "INFO" ? DESTS.find((x) => x.code === dest)!.title[lang] : dest === "OTHER" ? tx("অন্য সেবা", "another service") : "";

  return (
    <>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        {tx("সিস্টেম পথ চূড়ান্ত করে না। কেস কোথায় যাবে তা আপনি বেছে নিন — আপনার পরিচয়, সময় ও কারণ রেকর্ড হবে।", "The system never finalises the pathway. You choose where the case goes — your identity, time and reason are recorded.")}
      </p>
      <p style={{ margin: "0 0 var(--s-3)" }}>
        <span className={ui.suggestBadge}>{tx("সিস্টেমের প্রস্তাব", "SYSTEM SUGGESTION")}</span> {statusLabel(system, lang)}
        {suggested ? ` → ${DESTS.find((x) => x.code === suggested)!.title[lang]}` : system === "REQUIRES_OFFICER_REVIEW" ? ` — ${tx("নিয়মে মেলেনি, আপনি বেছে নিন", "no rule fits, you choose")}` : ` — ${tx("তিনটি পথের বাইরে", "outside the three pathways")}`}
      </p>

      <div className={ui.sectionHead} style={{ marginBottom: 8 }}>
        {tx("কেসটি কোথায় যাবে?", "Send the case to")}
      </div>
      <div role="radiogroup" aria-label={tx("কেসটি কোথায় যাবে", "Send the case to")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: "var(--s-3)" }}>
        {DESTS.map((d) => {
          const on = dest === d.code;
          return (
            <button key={d.code} type="button" role="radio" aria-checked={on} onClick={() => pick(d.code)} className={ui.option} style={{ alignItems: "flex-start", textAlign: "left", padding: "14px 16px", borderWidth: on ? 2 : 1, borderColor: on ? "var(--ink)" : undefined, background: on ? "var(--white)" : undefined, boxShadow: on ? "0 2px 10px rgba(0,0,0,0.08)" : undefined }}>
              <span style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 26 }} aria-hidden>
                  {d.icon}
                </span>
                {suggested === d.code ? <span className={ui.suggestBadge}>{tx("প্রস্তাবিত", "SUGGESTED")}</span> : null}
              </span>
              <span className={ui.optionTitle} style={{ fontSize: "1.05rem", marginTop: 6 }}>
                {on ? "● " : "○ "}
                {d.title[lang]}
              </span>
              <span className={ui.optionText}>{d.text[lang]}</span>
              <span className={ui.optionText} style={{ marginTop: 6, fontWeight: 600 }}>
                {d.next[lang]}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: "var(--s-3)", fontSize: "var(--t-small)" }}>
        <button type="button" onClick={() => pick(dest === "INFO" ? null : "INFO")} aria-pressed={dest === "INFO"} style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer", font: "inherit", fontWeight: dest === "INFO" ? 700 : 400 }}>
          ? {tx("সিদ্ধান্তের আগে আরও তথ্য চাই", "Request more information before deciding")}
        </button>
        <button type="button" onClick={() => pick(dest === "OTHER" ? null : "OTHER")} aria-pressed={dest === "OTHER"} style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer", font: "inherit", color: "var(--dlo-muted)", fontWeight: dest === "OTHER" ? 700 : 400 }}>
          {tx("অন্য সেবায় রেফার (পুলিশ, ওসিসি, শ্রম, সমাজসেবা)", "Refer to another service (police, OCC, labour, social services)")}
        </button>
      </div>

      {dest === "MEDIATION" ? (
        <div style={{ marginBottom: "var(--s-3)" }}>
          <span className={styles.label}>{tx("মধ্যস্থতার ধরন", "Type of mediation")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {MEDIATION_KINDS.map((k) => (
              <label key={k} className={styles.check} style={{ border: `1px solid ${kind === k ? "var(--ink)" : "var(--line)"}`, borderRadius: 8, padding: "6px 10px" }}>
                <input type="radio" name="mediation-kind" checked={kind === k} onChange={() => setKind(k)} />
                <span>
                  {statusLabel(k, lang)}
                  {k === system ? ` · ${tx("প্রস্তাবিত", "suggested")}` : ""}
                </span>
              </label>
            ))}
          </div>
          {violence ? (
            <p style={{ color: "var(--red)", margin: "8px 0 0" }}>
              ! {tx("জরুরি/সহিংসতার সংকেত আছে — অপর পক্ষের সাথে মধ্যস্থতা আবেদনকারীর জন্য অনিরাপদ হতে পারে। কারণে নিরাপত্তা বিবেচনা লিখুন।", "Urgency / violence signals on record — mediation with the other party may be unsafe. Record your safety reasoning.")}
            </p>
          ) : null}
        </div>
      ) : null}

      {dest === "OTHER" ? (
        <label className={styles.field} style={{ maxWidth: 360, marginBottom: "var(--s-3)" }}>
          <span className={styles.label}>{tx("কোথায় রেফার", "Refer to")}</span>
          <select className={styles.select} value={other ?? ""} onChange={(e) => setOther((e.target.value || null) as ReferralTarget | null)}>
            <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
            {REFERRAL_TARGETS.filter((t) => t.code !== "GRAM_ADALAT").map((t) => (
              <option key={t.code} value={t.code}>
                {t.label[lang]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {dest ? (
        <>
          <label className={styles.field}>
            <span className={styles.label}>
              {dest === "INFO" ? tx("কী তথ্য দরকার (কমপক্ষে ১০ অক্ষর)", "What information is needed (at least 10 characters)") : followsSystem ? tx("কারণ — সিস্টেমের প্রস্তাব নিশ্চিত করছেন (কমপক্ষে ১০ অক্ষর)", "Reason — you are confirming the system's suggestion (at least 10 characters)") : tx("কারণ — সিস্টেমের প্রস্তাব থেকে ভিন্ন (কমপক্ষে ১০ অক্ষর)", "Reason — you are choosing differently from the system (at least 10 characters)")}
            </span>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {dest === "INFO" ? (
            <label className={styles.check} style={{ marginTop: 8 }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>{tx("আবেদনকারীকে নিরাপদ এসএমএস পাঠান (সিমুলেটেড)", "Tell the applicant by safe SMS (simulated)")}</span>
            </label>
          ) : null}
          <div className={ui.bar}>
            {dest === "INFO" ? (
              <Button variant="secondary" disabled={reason.trim().length < 10} onClick={() => run(() => void PathwayService.requestInfo(a.applicationId, draft, reason, notify))}>
                {tx("তথ্য চান ও কাজ খুলুন", "Request information & open task")}
              </Button>
            ) : (
              <Button disabled={!chosen || reason.trim().length < 10} onClick={send}>
                {tx(`${title}-এ পাঠান →`, `Send to ${title} →`)}
              </Button>
            )}
            <span className={styles.hint}>{reason.trim().length}/10</span>
            {chosen && dest !== "INFO" ? <span className={styles.hint}>{followsSystem ? tx("রেকর্ড: প্রস্তাব নিশ্চিত", "Recorded as: suggestion confirmed") : tx("রেকর্ড: কর্মকর্তা পরিবর্তন করেছেন", "Recorded as: changed by the officer")}</span> : null}
          </div>
        </>
      ) : null}
    </>
  );
}

function DecisionLog({ a }: { a: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const list = a.pathwayClassification?.decisions ?? [];
  if (!list.length) return null;
  return (
    <div style={{ marginTop: "var(--s-4)" }}>
      <div className={ui.sectionHead}>{tx("সিদ্ধান্তের ইতিহাস", "Decision history")}</div>
      <div className={ui.rows}>
        {[...list].reverse().map((x) => (
          <Row key={x.decisionId} label={formatDateTime(x.at, lang)}>
            <Tag tone={x.action === "INFO_REQUESTED" ? "warn" : "ok"}>{x.action === "CONFIRMED" ? tx("নিশ্চিত", "Confirmed") : x.action === "CHANGED" ? tx("পরিবর্তিত", "Changed") : tx("তথ্য চাওয়া হয়েছে", "Information requested")}</Tag>{" "}
            {tx("সিস্টেম:", "System:")} {statusLabel(x.systemClassification, lang)}
            {x.finalPathway ? ` → ${tx("চূড়ান্ত:", "Final:")} ${statusLabel(x.finalPathway, lang)}` : ""} · {x.byName}
            <span className={styles.hint} style={{ display: "block" }}>
              “{x.reason}”
            </span>
          </Row>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ after the decision ------------------------------ */

/** Side by side: what the system suggested vs what the officer confirmed. */
export function PathwayDecisionRecord({ a }: { a: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const c = a.pathwayClassification;
  const final = c?.final;
  if (!c || !final) return null;
  const decision = c.decisions.find((x) => x.decisionId === final.decisionId)!;
  const assessment = c.assessments.find((x) => x.assessmentId === decision.assessmentId);
  const target = final.referralTarget ? REFERRAL_TARGETS.find((x) => x.code === final.referralTarget)?.label[lang] : null;
  return (
    <div style={{ marginBottom: "var(--s-4)" }}>
      <div className={ui.pair}>
        <section className={`${ui.flowStep} ${ui.suggest}`}>
          <span className={ui.suggestBadge}>{tx("সিস্টেমের প্রস্তাব", "SYSTEM SUGGESTION")}</span>
          <div className={ui.bigPathway} style={{ fontSize: "var(--t-sub)", color: "var(--dlo-muted)" }}>
            {statusLabel(decision.systemClassification, lang)}
          </div>
          <div className={styles.hint}>
            {tx("নিয়ম", "Rule")} {assessment?.ruleId ?? "—"} · {assessment?.rulesVersion}
          </div>
          {assessment ? <div className={styles.hint}>{assessment.matched.join(" · ")}</div> : null}
          {decision.previousSystemClassification ? (
            <div className={styles.hint}>
              {tx("আগের মূল্যায়ন:", "Previous classification:")} {statusLabel(decision.previousSystemClassification, lang)}
            </div>
          ) : null}
        </section>
        <section className={`${ui.flowStep} ${ui.confirmed}`}>
          <span className={ui.confirmedBadge}>✓ {tx("কর্মকর্তা নিশ্চিত করেছেন", "OFFICER CONFIRMED")}</span>
          <div className={ui.bigPathway} style={{ fontSize: "var(--t-sub)" }}>
            {statusLabel(final.status, lang)}
            {target ? ` — ${target}` : ""}
          </div>
          <div className={ui.rows}>
            <Row label={tx("সিদ্ধান্ত", "Decision")}>{decision.action === "CONFIRMED" ? tx("প্রস্তাব নিশ্চিত", "Suggestion confirmed") : tx("প্রস্তাব পরিবর্তন করে", "Changed from the suggestion")}</Row>
            <Row label={tx("কর্মকর্তা", "Officer")}>
              {final.byName} · {formatDateTime(final.at, lang)}
            </Row>
            <Row label={tx("কারণ", "Reason")}>{decision.reason}</Row>
          </div>
        </section>
      </div>
      <DecisionLog a={a} />
    </div>
  );
}

/* ------------------------------ rule table (read-only) ------------------------------ */

function RuleTable() {
  const { lang, tx } = useTx();
  const rules = usePathwayRules();
  return (
    <details style={{ marginTop: "var(--s-4)" }}>
      <summary className={styles.hint} style={{ cursor: "pointer" }}>
        {tx(`নিয়মের তালিকা দেখুন (${rules.version}, ${rules.rules.length}টি নিয়ম) — কনফিগারযোগ্য`, `View the rule table (${rules.version}, ${rules.rules.length} rules) — configurable`)}
      </summary>
      <p className={styles.hint}>{rules.mandatoryNote[lang]}</p>
      <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>{tx("শর্ত", "When")}</th>
              <th>{tx("ফল", "Result")}</th>
              <th>{tx("আইন", "Law")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.rules.map((r) => (
              <tr key={r.ruleId} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                <td>{r.ruleId}</td>
                <td>
                  {r.title[lang]}
                  <div className={styles.hint}>
                    {[
                      r.when.categories && `category ∈ ${r.when.categories.join("/")}`,
                      r.when.subcategories && `sub ∈ ${r.when.subcategories.join("/")}`,
                      r.when.subcategoryMissing && "subcategory missing",
                      r.when.urgencyAny && `flag ∈ ${r.when.urgencyAny.join("/")}`,
                      r.when.courtStatus && `court = ${r.when.courtStatus.join("/")}`,
                      r.when.mandatoryDistrictOnly && "notified district",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td>{statusLabel(r.result, lang)}</td>
                <td className={styles.hint}>{r.law ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

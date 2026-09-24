"use client";

/* ------------------------------------------------------------------ *
 *  T4 — Duplicate / fraud-risk check (/dashboard/dlo#duplicates).
 *  "✨ AI scan" (SIMULATED — deterministic fuzzy matching, see
 *  lib/dlas/duplicate-check.ts) → confidence + evidence → side-by-side
 *  human review → decision. Never auto-rejects, auto-merges or labels
 *  anyone fraudulent.
 * ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { DuplicateReviewService, MATTERS, formatDateTime, label, loadDuplicateDemo, useDuplicateCheck, type ApplicationRecord, type PairResult } from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Lang = "bn" | "en";
const STEPS = [
  { bn: "রেকর্ড পড়ছে…", en: "Reading the office's records…" },
  { bn: "নাম ও বানান মিলিয়ে দেখছে (আক্তার/আকতার…)…", en: "Normalising names and spellings (Akter/Aktar, Md./Mohammad)…" },
  { bn: "ফোন, NID, প্রতিপক্ষ ও বর্ণনা তুলনা করছে…", en: "Comparing phone, NID, other party and story wording…" },
  { bn: "আস্থা-স্কোর ও প্রমাণ সাজাচ্ছে…", en: "Scoring confidence and collecting evidence for and against…" },
];
const KIND = {
  POSSIBLE_DUPLICATE: { bn: "সম্ভাব্য একই আবেদন", en: "Possible duplicates", tone: "#b45309" },
  RISK_SIGNAL: { bn: "ঝুঁকির সংকেত — যাচাই করুন, অভিযোগ নয়", en: "Risk signals — verify, not accusations", tone: "#b91c1c" },
  SIMILAR_BUT_DIFFERENT: { bn: "একই রকম নাম — যাচাই করে আলাদা রাখা", en: "Similar names — checked and kept apart", tone: "#15803d" },
} as const;
const OUTCOME = {
  SAME_PERSON: { bn: "একই ব্যক্তি — দ্বৈত আবেদন", en: "Same person — duplicate filing" },
  DIFFERENT_PEOPLE: { bn: "ভিন্ন ব্যক্তি", en: "Different people" },
  NEEDS_VERIFICATION: { bn: "পরিচয় যাচাই দরকার", en: "Needs identity verification" },
} as const;

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

function Meter({ score, color }: { score: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label={`confidence ${score} of 100`}>
      <span aria-hidden style={{ width: 90, height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", height: "100%", width: `${score}%`, background: color }} />
      </span>
      <strong>{score}</strong>
      <span className={styles.hint}>/100</span>
    </span>
  );
}

function SideBySide({ a, b }: { a: ApplicationRecord; b: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const rows: [string, string | null | undefined, string | null | undefined][] = [
    [tx("নাম", "Name"), a.data.applicant.fullName, b.data.applicant.fullName],
    [tx("ফোন", "Phone"), a.data.applicant.phone, b.data.applicant.phone],
    ["NID", a.data.applicant.nidNumber, b.data.applicant.nidNumber],
    [tx("জেলা", "District"), a.data.applicant.district, b.data.applicant.district],
    [tx("বিষয়", "Matter"), label(MATTERS, a.data.matter.category, lang), label(MATTERS, b.data.matter.category, lang)],
    [tx("প্রতিপক্ষ", "Other party"), a.data.matter.opposingParty, b.data.matter.opposingParty],
    [tx("মাধ্যম", "Channel"), a.channel.code, b.channel.code],
    [tx("দাখিল", "Filed"), formatDateTime(a.submittedAt, lang), formatDateTime(b.submittedAt, lang)],
    [tx("অবস্থা", "Status"), a.status, b.status],
    [tx("বর্ণনা", "Story"), a.data.matter.summary, b.data.matter.summary],
  ];
  const same = (x?: string | null, y?: string | null) => !!x && !!y && x.trim().toLowerCase() === y.trim().toLowerCase();
  return (
    <div className={styles.tableWrap} style={{ marginTop: 8 }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th />
            <th>
              <a href={`#app/${encodeURIComponent(a.applicationId)}`}>{a.caseId ?? a.applicationId}</a>
            </th>
            <th>
              <a href={`#app/${encodeURIComponent(b.applicationId)}`}>{b.caseId ?? b.applicationId}</a>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, x, y]) => {
            const eq = same(x, y);
            const bg = eq ? "rgba(21,128,61,.08)" : x && y ? "rgba(180,83,9,.08)" : undefined;
            return (
              <tr key={k}>
                <th style={{ whiteSpace: "nowrap" }}>
                  {k} {eq ? <span style={{ color: "var(--green)" }}>=</span> : x && y ? <span style={{ color: "#b45309" }}>≠</span> : null}
                </th>
                <td style={{ background: bg }}>{x || <span className={styles.hint}>—</span>}</td>
                <td style={{ background: bg }}>{y || <span className={styles.hint}>—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PairCard({ r, apps, decided }: { r: PairResult; apps: ApplicationRecord[]; decided: { outcome: keyof typeof OUTCOME; note: string; byName: string; at: string } | null }) {
  const { lang, tx } = useTx();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<keyof typeof OUTCOME>(r.kind === "RISK_SIGNAL" ? "NEEDS_VERIFICATION" : "SAME_PERSON");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const a = apps.find((x) => x.applicationId === r.aId)!;
  const b = apps.find((x) => x.applicationId === r.bId)!;
  const k = KIND[r.kind];
  return (
    <article className={ui.flowStep} style={{ borderLeft: `4px solid ${k.tone}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <strong>
          {a.data.applicant.fullName} ↔ {b.data.applicant.fullName}
        </strong>
        <Meter score={r.score} color={k.tone} />
      </div>
      <div style={{ margin: "4px 0" }}>{r.headline}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {r.evidence.map((e) => (
          <span key={e.text} className={ui.tag} style={{ borderColor: e.kind === "FOR" ? "#b45309" : e.kind === "AGAINST" ? "var(--green)" : "var(--line)", color: e.kind === "FOR" ? "#92400e" : e.kind === "AGAINST" ? "#166534" : undefined }}>
            {e.kind === "FOR" ? "▲" : e.kind === "AGAINST" ? "▼" : "·"} {e.text}
          </span>
        ))}
      </div>
      {decided ? (
        <div className={`${ui.banner} ${ui.bannerOk}`} style={{ marginTop: 8 }}>
          ✓ {OUTCOME[decided.outcome][lang]} — “{decided.note}” · {decided.byName} · {formatDateTime(decided.at, lang)}
        </div>
      ) : null}
      <div className={styles.actions} style={{ marginTop: 8 }}>
        <button type="button" className={ui.textBtn} onClick={() => setOpen(!open)}>
          {open ? tx("বন্ধ করুন", "Close") : tx("পাশাপাশি তুলনা করুন →", "Compare side by side →")}
        </button>
      </div>
      {open ? (
        <>
          <SideBySide a={a} b={b} />
          {r.kind !== "SIMILAR_BUT_DIFFERENT" ? (
            <div style={{ marginTop: 8 }}>
              <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(Object.keys(OUTCOME) as (keyof typeof OUTCOME)[]).map((o) => (
                  <label key={o} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="radio" checked={outcome === o} onChange={() => setOutcome(o)} /> {OUTCOME[o][lang]}
                  </label>
                ))}
              </div>
              <label className={styles.field} style={{ marginTop: 6 }}>
                <span className={styles.label}>{tx("আপনি কী যাচাই করেছেন (কমপক্ষে ১০ অক্ষর)", "What you checked (at least 10 characters)")}</span>
                <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx("যেমন: ফোন করে নিশ্চিত — একই ব্যক্তি আবার জমা দিয়েছেন", "e.g. Called her — same person, filed again after no reply")} />
              </label>
              {err ? <div style={{ color: "var(--red)" }}>{err}</div> : null}
              <div className={styles.actions} style={{ marginTop: 6 }}>
                <Button
                  disabled={note.trim().length < 10}
                  onClick={() => {
                    try {
                      DuplicateReviewService.decide(r.pairKey, outcome, note);
                      setErr(null);
                      setOpen(false);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  {tx("সিদ্ধান্ত সংরক্ষণ", "Save decision")}
                </Button>
                <span className={styles.hint}>{tx("কোনো কেস বাতিল বা একীভূত হবে না।", "No case is rejected or merged by this.")}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

export function DuplicateCheck() {
  const { lang, tx } = useTx();
  const v = useDuplicateCheck();
  const [step, setStep] = useState<number | null>(null);
  const [scanned, setScanned] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const hasDemo = v.apps.some((a) => (a.data.applicant.fullName ?? "").endsWith("(demo)") && a.data.applicant.phone?.startsWith("0171200"));
  const show = scanned || v.reviews.length > 0;

  const run = () => {
    setScanned(false);
    setStep(0);
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setStep(i), i * 800)));
    timers.current.push(
      setTimeout(() => {
        setStep(null);
        try {
          const n = DuplicateReviewService.recordScan(v.results);
          setMsg(tx(`${v.apps.length}টি রেকর্ড যাচাই · ${n}টি নতুন জোড়া পর্যালোচনার জন্য চিহ্নিত।`, `${v.apps.length} records checked · ${n} new pair(s) flagged for review.`));
        } catch (e) {
          setMsg(e instanceof Error ? e.message : String(e));
        }
        setScanned(true);
      }, STEPS.length * 800),
    );
  };

  if (!v.officer) return <div className={ui.banner}>{tx("প্রথমে লগইন করুন।", "Please log in first.")}</div>;
  const decidedFor = (key: string) => v.reviews.find((x) => x.pairKey === key)?.decision ?? null;
  const groups = (["POSSIBLE_DUPLICATE", "RISK_SIGNAL", "SIMILAR_BUT_DIFFERENT"] as const).map((k) => ({ k, list: v.results.filter((r) => r.kind === k) }));

  return (
    <div className={ui.readable}>
      <div className={ui.queuePlainHead}>
        <span className={ui.heroKicker}>T4 · {tx("দ্বৈত আবেদন / প্রতারণা-ঝুঁকি", "Duplicate / fraud-risk check")}</span>
        <h1 className={ui.queueTitle}>{tx("দ্বৈত আবেদন যাচাই", "Duplicate check")}</h1>
        <p className={styles.lead}>{tx("AI একাধিক তথ্য (নাম, ফোন, NID, প্রতিপক্ষ, বর্ণনা) মিলিয়ে সম্ভাব্য দ্বৈত আবেদন ও ঝুঁকির সংকেত দেখায়। সিদ্ধান্ত আপনার।", "AI compares several details (name, phone, NID, other party, story) and shows possible duplicates and risk signals. You decide.")}</p>
      </div>
      <div className={`${ui.banner} ${ui.bannerWarn}`} style={{ marginBottom: "var(--s-4)" }}>
        <span className={ui.bannerIcon} aria-hidden>
          ⚖
        </span>
        <div>
          <strong>{tx("পরামর্শমূলক — কোনো স্বয়ংক্রিয় ব্যবস্থা নয়।", "Advisory — no automatic action.")}</strong> {tx("সিস্টেম কোনো আবেদন বাতিল বা একীভূত করে না এবং কাউকে প্রতারক বলে না। একই রকম দেখতে দুজন আলাদা মানুষ হতে পারেন; পাশাপাশি তুলনা করে আপনি সিদ্ধান্ত নিন।", "The system never rejects or merges an application and never calls anyone a fraud. Two real people can look alike; compare them side by side and decide.")}
        </div>
      </div>

      <div className={styles.actions} style={{ marginBottom: 12 }}>
        <Button disabled={step !== null} onClick={run}>
          ✨ {tx("AI দিয়ে দ্বৈত ও ঝুঁকি যাচাই চালান", "Run AI duplicate & fraud-risk scan")}
        </Button>
        <span className={`${ui.tag} ${ui.ink}`}>{tx("সিমুলেটেড AI", "SIMULATED AI")}</span>
        {!hasDemo ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const n = await loadDuplicateDemo(v.officer!.district ?? "");
                setMsg(tx(`${n}টি ডেমো রেকর্ড (কাল্পনিক) জমা হয়েছে — আসল দ্বৈত ও ২টি একই-নাম-ভিন্ন-মানুষ সহ।`, `${n} demo records (fictional) filed — including real duplicates and two same-name-different-people traps.`));
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {tx("১৩টি ডেমো রেকর্ড লোড করুন", "Load 13 demo records")}
          </Button>
        ) : null}
      </div>

      {step !== null ? (
        <div className={ui.flowStep} role="status" aria-live="polite" style={{ display: "grid", gap: 6 }}>
          <style>{"@keyframes dup-spin{to{transform:rotate(360deg)}}"}</style>
          {STEPS.map((s, i) => (
            <div key={s.en} style={{ display: "flex", gap: 8, alignItems: "center", opacity: i <= step ? 1 : 0.35 }}>
              {i < step ? <span style={{ color: "var(--green)", fontWeight: 700, width: 14 }}>✓</span> : i === step ? <span aria-hidden style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--ink)", animation: "dup-spin .8s linear infinite" }} /> : <span style={{ width: 14 }} />}
              {s[lang]}
            </div>
          ))}
          <div className={styles.hint}>
            {tx(`${v.apps.length}টি রেকর্ড · ${(v.apps.length * (v.apps.length - 1)) / 2}টি জোড়া`, `${v.apps.length} records · ${(v.apps.length * (v.apps.length - 1)) / 2} pairs`)}
          </div>
        </div>
      ) : null}

      {msg ? (
        <div className={`${ui.banner} ${ui.bannerOk}`} role="status">
          {msg}
        </div>
      ) : null}

      {show && step === null
        ? groups.map(({ k, list }) => (
            <section key={k} style={{ marginTop: 12 }}>
              <div className={ui.sectionHead} style={{ color: KIND[k].tone }}>
                {KIND[k][lang]} ({list.length})
              </div>
              {!list.length ? <p className={styles.hint}>{tx("কিছু পাওয়া যায়নি।", "None found.")}</p> : null}
              <div style={{ display: "grid", gap: 8 }}>
                {list.map((r) => (
                  <PairCard key={r.pairKey} r={r} apps={v.apps} decided={decidedFor(r.pairKey)} />
                ))}
              </div>
            </section>
          ))
        : null}
      <p className={styles.hint} style={{ marginTop: 12 }}>
        {tx("নিয়ম", "Rules")}: dup-scan-sim-2026.09 · {tx("ওজন: NID +৪৫ / ভিন্ন −৩৫ · ফোন +২৫ · নাম +১২–২০ · প্রতিপক্ষ +১০ · বর্ণনা +৮–১৫ · বিষয় +৫ / ভিন্ন −৮", "weights: NID +45 / different −35 · phone +25 · name +12–20 · other party +10 · story +8–15 · matter +5 / different −8")}
      </p>
    </div>
  );
}

/** Case-page banner when this case has an undecided duplicate / risk flag. */
export function DuplicateBanner({ flag }: { flag: { kind: string; score: number; headline: string } | null }) {
  const { tx } = useTx();
  if (!flag) return null;
  return (
    <div className={`${ui.banner} ${ui.bannerWarn}`} style={{ marginBottom: "var(--s-4)" }}>
      <span className={ui.bannerIcon} aria-hidden>
        ⧉
      </span>
      <div>
        <strong>{flag.kind === "RISK_SIGNAL" ? tx("ঝুঁকির সংকেত — যাচাই দরকার", "Risk signal — needs a check") : tx("সম্ভাব্য দ্বৈত আবেদন", "Possible duplicate")}</strong> · {flag.score}/100 — {flag.headline}{" "}
        <a className={ui.textBtn} href="#duplicates">
          {tx("তুলনা করুন →", "Compare →")}
        </a>
      </div>
    </div>
  );
}

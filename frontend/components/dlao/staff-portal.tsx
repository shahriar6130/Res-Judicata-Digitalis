"use client";

/* ------------------------------------------------------------------ *
 *  /dlo-stuff — DLO office staff portal.
 *  Sign up / log in (name, mobile, office district) → the office's
 *  incoming cases → read the applicant's story and check it.
 *  No documents, NID, contact details, identity checks or decisions
 *  (those stay with the officer at /dashboard/dlo).
 * ------------------------------------------------------------------ */

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/button";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import {
  DISTRICTS,
  MATTERS,
  STORY_CHECKS,
  StaffAuth,
  StaffService,
  URGENCY_FLAGS,
  formatDateTime,
  label,
  useStaffQueue,
  type StaffCaseView,
  type StoryCheckKey,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";

function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`}>{children}</span>;
}

function Banner({ tone, icon, children }: { tone: "ok" | "warn" | "err"; icon: string; children: ReactNode }) {
  const cls = tone === "ok" ? ui.bannerOk : tone === "err" ? ui.bannerErr : ui.bannerWarn;
  return (
    <div className={`${ui.banner} ${cls}`} role={tone === "err" ? "alert" : undefined}>
      <span className={ui.bannerIcon} aria-hidden>
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
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
  return { lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

const noop = () => () => {};

function useHash(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash.replace(/^#/, ""),
    () => "",
  );
}

/* ================================================================== */

export function StaffPortal() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { tx } = useTx();
  const q = useStaffQueue();
  const hash = useHash();
  if (!mounted) return null;
  const d = q.me ? DISTRICTS.find((x) => x.code === q.me!.district) : null;
  const open = hash.startsWith("case/") ? decodeURIComponent(hash.slice(5)) : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--off-white)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 24px", background: "var(--ink)", color: "var(--white)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75 }}>{tx("জেলা লিগ্যাল এইড অফিস", "District Legal Aid Office")}</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {tx("অফিস কর্মী", "Office staff")}
            {d ? ` · ${d.label.en === d.label.bn ? d.label.en : tx(d.label.bn, d.label.en)}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LanguageToggle onDark />
          {q.me ? (
            <>
              <span style={{ fontSize: 14 }}>{q.me.name}</span>
              <Button variant="secondary" onClick={() => StaffAuth.logout()}>
                {tx("লগআউট", "Log out")}
              </Button>
            </>
          ) : null}
        </div>
      </header>
      <main className={`${styles.shell} ${ui.readable}`}>{q.me ? open ? <CaseCheck key={open} id={open} /> : <Incoming /> : <StaffAuthForm />}</main>
    </div>
  );
}

/* ------------------------------ sign up / log in ------------------------------ */

function StaffAuthForm() {
  const { lang, tx } = useTx();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messages: Record<string, string> = {
    INVALID_NAME: tx("আপনার নাম লিখুন।", "Enter your name."),
    INVALID_PHONE: tx("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন (01XXXXXXXXX)।", "Enter a valid 11-digit mobile number (01XXXXXXXXX)."),
    INVALID_DISTRICT: tx("আপনার অফিসের জেলা বাছাই করুন।", "Choose your office district."),
    PHONE_TAKEN: tx("এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This number already has an account — log in instead."),
    NOT_FOUND: tx("এই নম্বরে কোনো অ্যাকাউন্ট নেই — সাইন আপ করুন।", "No account for this number — sign up first."),
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = mode === "login" ? StaffAuth.login(phone) : StaffAuth.signUp({ name, phone, district });
    if (!r.ok) {
      setError(messages[r.error]);
      if (r.error === "PHONE_TAKEN") setMode("login");
      if (r.error === "NOT_FOUND") setMode("signup");
    }
  };
  return (
    <section className={ui.main} style={{ maxWidth: 460, margin: "40px auto" }}>
      <h1 className={ui.stepTitle}>{tx("অফিস কর্মী প্রবেশ", "Office staff access")}</h1>
      <p className={ui.stepLead}>{tx("অফিসে আসা নতুন মামলা দেখুন এবং আবেদনকারীর বিবরণ যাচাই করুন।", "See the office's incoming cases and check the applicant's story.")}</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }} noValidate>
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="button" variant={mode === "login" ? "primary" : "secondary"} onClick={() => { setMode("login"); setError(null); }}>
            {tx("লগইন", "Log in")}
          </Button>
          <Button type="button" variant={mode === "signup" ? "primary" : "secondary"} onClick={() => { setMode("signup"); setError(null); }}>
            {tx("সাইন আপ", "Sign up")}
          </Button>
        </div>
        {mode === "signup" ? (
          <label className={styles.field}>
            <span className={styles.label}>{tx("আপনার নাম", "Your name")}</span>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>{tx("মোবাইল নম্বর", "Mobile number")}</span>
          <input className={styles.input} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {mode === "signup" ? (
          <label className={styles.field}>
            <span className={styles.label}>{tx("অফিসের জেলা", "Office district")}</span>
            <select className={styles.select} value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">{tx("বাছাই করুন", "Select")}</option>
              {DISTRICTS.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.label[lang]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? (
          <Banner tone="err" icon="!">
            {error}
          </Banner>
        ) : null}
        <Button type="submit">{mode === "login" ? tx("লগইন", "Log in") : tx("অ্যাকাউন্ট খুলুন", "Create account")}</Button>
      </form>
    </section>
  );
}

/* ------------------------------ incoming list ------------------------------ */

function CheckTag({ v }: { v: StaffCaseView }) {
  const { tx } = useTx();
  if (!v.staffCheck) return <Tag tone="warn">{tx("যাচাই বাকি", "To check")}</Tag>;
  return v.staffCheck.outcome === "STORY_VERIFIED" ? <Tag tone="ok">✓ {tx("বিবরণ যাচাইকৃত", "Story verified")}</Tag> : <Tag tone="err">{tx("স্পষ্টতা দরকার", "Needs clarification")}</Tag>;
}

function Incoming() {
  const { lang, tx } = useTx();
  const q = useStaffQueue();
  const [filter, setFilter] = useState<"toCheck" | "needsClarification" | "verified" | "all">("toCheck");
  const rows = q[filter];
  return (
    <>
      <h1 className={styles.title}>{tx("আসা মামলা", "Incoming cases")}</h1>
      <p className={styles.lead}>
        {tx(
          "আবেদনকারীর বিবরণ পড়ে যাচাই করুন। নথি, এনআইডি, যোগাযোগ ও সিদ্ধান্ত কর্মকর্তার কাছে থাকে।",
          "Read each applicant's story and check it. Documents, NID, contact details and decisions stay with the officer.",
        )}
      </p>
      <div className={styles.stats}>
        {(
          [
            ["toCheck", q.toCheck.length, tx("যাচাই বাকি", "To check"), "warn"],
            ["needsClarification", q.needsClarification.length, tx("স্পষ্টতা দরকার", "Needs clarification"), "err"],
            ["verified", q.verified.length, tx("যাচাইকৃত", "Story verified"), "ok"],
            ["all", q.all.length, tx("সব আসা মামলা", "All incoming"), "neutral"],
          ] as const
        ).map(([k, n, l, tone]) => (
          <button
            key={k}
            type="button"
            className={styles.stat}
            onClick={() => setFilter(k)}
            style={{ textAlign: "left", cursor: "pointer", ...(filter === k ? { borderColor: "var(--ink)", boxShadow: "0 0 0 1px var(--ink)" } : {}) }}
          >
            <div className={styles.statNum} style={n && tone === "err" ? { color: "var(--red)" } : n && tone === "ok" ? { color: "var(--green)" } : undefined}>
              {n}
            </div>
            <div className={styles.statLabel}>{l}</div>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Banner tone="ok" icon="✓">
          {tx("এই তালিকায় কোনো মামলা নেই।", "No cases in this list.")}
        </Banner>
      ) : (
        <section className={ui.main}>
          <div className={ui.rows}>
            {rows.map((v) => (
              <a key={v.applicationId} href={`#case/${v.applicationId}`} className={ui.row} style={{ textDecoration: "none", color: "inherit" }}>
                <div className={ui.rowLabel}>
                  <span className={styles.mono}>{v.applicationId}</span>
                  <div>{formatDateTime(v.submittedAt, lang)}</div>
                </div>
                <div className={ui.rowValue}>
                  <strong>{v.applicantName ?? "—"}</strong>
                  <Tag>{label(MATTERS, v.category, lang)}</Tag>
                  <CheckTag v={v} />
                  {v.urgencyFlags.length ? <Tag tone="err">{tx("জরুরি", "Urgent")}</Tag> : null}
                  <Tag>{v.officeStage === "NEW" ? tx("নতুন", "New") : tx("কর্মকর্তার কাছে", "With officer")}</Tag>
                  <span className={ui.sub}>{(v.summary ?? "—").slice(0, 160)}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ------------------------------ one case: story check ------------------------------ */

function CaseCheck({ id }: { id: string }) {
  const { lang, tx } = useTx();
  const q = useStaffQueue();
  const v = q.all.find((x) => x.applicationId === id);
  const [answers, setAnswers] = useState<Record<StoryCheckKey, "YES" | "NO" | "UNSURE" | null>>(() => {
    const init = { STORY_CLEAR: null, CATEGORY_MATCHES: null, OTHER_PARTY: null, URGENCY_CONSISTENT: null } as Record<StoryCheckKey, "YES" | "NO" | "UNSURE" | null>;
    for (const i of v?.staffCheck?.items ?? []) init[i.key] = i.answer;
    return init;
  });
  const [note, setNote] = useState(v?.staffCheck?.note ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  if (!v) {
    return (
      <>
        <a className={styles.crumb} href="#">
          ← {tx("আসা মামলা", "Incoming cases")}
        </a>
        <Banner tone="err" icon="!">
          {tx("এই মামলাটি আপনার অফিসের আসা তালিকায় নেই (হয়তো কর্মকর্তা সিদ্ধান্ত দিয়েছেন)।", "This case is not in your office's incoming list (the officer may have decided it).")}
        </Banner>
      </>
    );
  }
  const complete = STORY_CHECKS.every((c) => answers[c.key]);
  const allYes = STORY_CHECKS.every((c) => answers[c.key] === "YES");

  return (
    <>
      <a className={styles.crumb} href="#">
        ← {tx("আসা মামলা", "Incoming cases")}
      </a>
      <div className={ui.head}>
        <span className={ui.headId}>{v.applicationId}</span>
        <CheckTag v={v} />
        <Tag>{label(MATTERS, v.category, lang)}</Tag>
      </div>
      <div className={ui.meta}>
        <span>
          <strong>{v.applicantName ?? "—"}</strong>
        </span>
        <span>{label(DISTRICTS, v.district, lang)}</span>
        <span>{v.channel}</span>
        <span>{formatDateTime(v.submittedAt, lang)}</span>
      </div>

      {msg ? (
        <Banner tone={msg.tone} icon={msg.tone === "ok" ? "✓" : "!"}>
          {msg.text}
        </Banner>
      ) : null}

      <section className={ui.main}>
        <div className={ui.sectionHead}>{tx("আবেদনকারীর বিবরণ", "The applicant's story")}</div>
        <div className={ui.rows}>
          <Row label={tx("কী হয়েছে", "What happened")}>
            <span style={{ whiteSpace: "pre-wrap" }}>{v.summary ?? "—"}</span>
            {v.summaryOriginal && v.summaryOriginal !== v.summary ? <span className={ui.sub}>{tx("মূল ভাষায়", "Original words")}: {v.summaryOriginal}</span> : null}
          </Row>
          <Row label={tx("সমস্যার ধরন", "Problem type")}>{label(MATTERS, v.category, lang)}</Row>
          <Row label={tx("অপর পক্ষ", "Other party")}>{v.opposingParty ?? "—"}</Row>
          <Row label={tx("ঘটনার তারিখ", "When it happened")}>{v.incidentDate ?? "—"}</Row>
          <Row label={tx("জরুরি সংকেত", "Urgency")}>
            {v.urgencyFlags.length ? v.urgencyFlags.map((f) => <Tag key={f} tone="err">{label(URGENCY_FLAGS, f, lang)}</Tag>) : <Tag>{tx("নেই", "None")}</Tag>}
            {v.selfReportedUrgent ? <Tag tone="warn">{tx("আবেদনকারী জরুরি বলেছেন", "Applicant said it is urgent")}</Tag> : null}
          </Row>
          <Row label={tx("কে জমা দিয়েছেন", "Filed by")}>{v.filedBy}</Row>
        </div>
        <p className={styles.hint} style={{ marginTop: 8 }}>
          🔒 {tx("নথি, এনআইডি ও যোগাযোগের তথ্য শুধু কর্মকর্তা দেখেন।", "Documents, NID and contact details are visible to the officer only.")}
        </p>

        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("বিবরণ যাচাই", "Check the story")}</div>
          <div className={ui.rows}>
            {STORY_CHECKS.map((c) => (
              <Row key={c.key} label={c.label[lang]}>
                {(["YES", "NO", "UNSURE"] as const).map((ans) => (
                  <button
                    key={ans}
                    type="button"
                    className={`${ui.tag} ${answers[c.key] === ans ? (ans === "YES" ? ui.ok : ans === "NO" ? ui.err : ui.warn) : ""}`}
                    aria-pressed={answers[c.key] === ans}
                    style={{ cursor: "pointer", font: "inherit", fontSize: 13 }}
                    onClick={() => setAnswers({ ...answers, [c.key]: ans })}
                  >
                    {ans === "YES" ? `✓ ${tx("হ্যাঁ", "Yes")}` : ans === "NO" ? `✗ ${tx("না", "No")}` : tx("নিশ্চিত নই", "Not sure")}
                  </button>
                ))}
              </Row>
            ))}
          </div>
          <label className={styles.field} style={{ marginTop: "var(--s-4)" }}>
            <span className={styles.label}>{allYes ? tx("নোট (ঐচ্ছিক)", "Note (optional)") : tx("কী অস্পষ্ট — কর্মকর্তার জন্য (কমপক্ষে ১০ অক্ষর)", "What is unclear — for the officer (at least 10 characters)")}</span>
            <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className={ui.bar}>
            <Button
              disabled={!complete}
              onClick={() => {
                try {
                  const r = StaffService.checkStory(v.applicationId, { items: STORY_CHECKS.map((c) => ({ key: c.key, answer: answers[c.key] ?? "UNSURE" })), note });
                  setMsg({ tone: "ok", text: r.outcome === "STORY_VERIFIED" ? tx("বিবরণ যাচাইকৃত — কর্মকর্তা দেখতে পাবেন।", "Story verified — the officer will see it.") : tx("স্পষ্টতা দরকার — কর্মকর্তা দেখতে পাবেন।", "Marked as needing clarification — the officer will see it.") });
                } catch (e) {
                  setMsg({ tone: "err", text: e instanceof Error ? e.message : String(e) });
                }
              }}
            >
              {complete ? (allYes ? tx("বিবরণ যাচাই করুন", "Verify story") : tx("স্পষ্টতা দরকার হিসেবে জানান", "Flag: needs clarification")) : tx("সব প্রশ্নের উত্তর দিন", "Answer every question")}
            </Button>
            <span className={styles.hint}>{tx("এটি পরামর্শমূলক — চূড়ান্ত যাচাই ও সিদ্ধান্ত কর্মকর্তার।", "Advisory — the officer does the final verification and decision.")}</span>
          </div>
        </div>

        {v.staffCheck ? (
          <div className={ui.section}>
            <div className={ui.sectionHead}>{tx("আগের যাচাই", "Previous checks")}</div>
            <div className={ui.rows}>
              {[{ outcome: v.staffCheck.outcome, note: v.staffCheck.note, byName: v.staffCheck.byName, at: v.staffCheck.at }, ...[...v.staffCheck.history].reverse()].map((h, i) => (
                <Row key={`${h.at}-${i}`} label={formatDateTime(h.at, lang)}>
                  <Tag tone={h.outcome === "STORY_VERIFIED" ? "ok" : "err"}>{h.outcome === "STORY_VERIFIED" ? tx("যাচাইকৃত", "Verified") : tx("স্পষ্টতা দরকার", "Needs clarification")}</Tag>
                  <span>{h.byName}</span>
                  {h.note ? <span className={ui.sub}>“{h.note}”</span> : null}
                </Row>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import {
  INTAKE_STEPS,
  IntakeGateway,
  useDlasDb,
  type ChannelCode,
  type IntakeSession,
} from "@/lib/dlas";
import styles from "./dlas.module.css";

export { styles };

export function useTx() {
  const { lang } = useI18n();
  const tx = useCallback((bn: string, en: string) => (lang === "bn" ? bn : en), [lang]);
  return { lang, tx };
}

export function ApplyHeader() {
  const { tx } = useTx();
  return (
    <header className={styles.header}>
      <Wordmark />
      <nav className={styles.headerLinks} aria-label={tx("দরজা", "Doors")}>
        <Link href="/dashboard/citizen#intake">{tx("নাগরিক", "Citizen")}</Link>
        <Link href="/dashboard/udc/intake/new">{tx("ইউডিসি", "UDC")}</Link>
        <Link href="/device/ivr">IVR</Link>
        <Link href="/device/ussd">USSD</Link>
        <Link href="/debug">{tx("ডিবাগ", "Debug")}</Link>
        <LanguageToggle />
      </nav>
    </header>
  );
}

export function SimTag({ children }: { children?: React.ReactNode }) {
  const { tx } = useTx();
  return <span className={styles.simTag}>{children ?? tx("সিমুলেটেড", "Simulated")}</span>;
}

const STEP_LABEL: Record<string, { bn: string; en: string }> = {
  STARTED: { bn: "শুরু", en: "Started" },
  IDENTITY_VERIFIED: { bn: "পরিচয় যাচাই", en: "Identity verified" },
  DETAILS_CAPTURED: { bn: "তথ্য", en: "Details" },
  DOCUMENTS_ATTACHED: { bn: "নথি", en: "Documents" },
  REVIEWED: { bn: "পর্যালোচনা", en: "Reviewed" },
  SUBMITTED: { bn: "জমা · আইডি", en: "Submitted · ID" },
  ABANDONED: { bn: "বাতিল", en: "Abandoned" },
};

export function StepTrail({ step }: { step: IntakeSession["step"] | undefined }) {
  const { lang } = useTx();
  const idx = step ? INTAKE_STEPS.indexOf(step) : -1;
  return (
    <ol className={styles.stepper} aria-label="Intake progress">
      {INTAKE_STEPS.map((s, i) => (
        <li
          key={s}
          className={i === idx ? styles.stepActive : i < idx ? styles.stepDone : ""}
          aria-current={i === idx ? "step" : undefined}
        >
          {i < idx ? "✓ " : ""}
          {STEP_LABEL[s][lang]}
        </li>
      ))}
      {step === "ABANDONED" ? <li className={styles.stepActive}>{STEP_LABEL.ABANDONED[lang]}</li> : null}
    </ol>
  );
}

/** Right-hand panel: the live JSON this door is writing, straight from localStorage. */
export function LiveRecordPanel({ sessionId }: { sessionId: string | null }) {
  const db = useDlasDb();
  const { tx } = useTx();
  const session = sessionId ? db.sessions.find((s) => s.sessionId === sessionId) : undefined;
  const app = session?.applicationId ? db.applications.find((a) => a.applicationId === session.applicationId) : undefined;
  const [view, setView] = useState<"draft" | "provenance" | "audit">("draft");
  if (!session) {
    return (
      <aside className={`${styles.card} ${styles.cardTight}`}>
        <p className={styles.eyebrow}>{tx("লাইভ রেকর্ড", "Live record")}</p>
        <p className={styles.hint}>{tx("সেশন শুরু হলে এখানে JSON দেখা যাবে।", "JSON appears here once a session starts.")}</p>
      </aside>
    );
  }
  const body =
    view === "draft"
      ? app ?? { sessionId: session.sessionId, step: session.step, identity: session.identity, draft: session.draft }
      : view === "provenance"
        ? app?.provenance ?? session.provenance
        : app?.audit ?? session.audit;
  const debugId = app?.applicationId ?? session.sessionId;
  return (
    <aside className={`${styles.card} ${styles.cardTight}`} aria-label={tx("লাইভ রেকর্ড", "Live record")}>
      <p className={styles.eyebrow}>{tx("লাইভ রেকর্ড · localStorage", "Live record · localStorage")}</p>
      <p className={styles.mono}>
        {session.sessionId}
        {app ? ` → ${app.applicationId}` : ""}
      </p>
      <p className={styles.hint}>
        {tx("ধাপ", "Step")}: <strong>{session.step}</strong> · {tx("ফিল্ড", "fields")}: {Object.keys(session.provenance).length} ·{" "}
        {tx("অডিট", "audit")}: {(app?.audit ?? session.audit).length}
      </p>
      <div className={styles.tabs} role="tablist">
        {(["draft", "provenance", "audit"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={styles.tab} onClick={() => setView(v)}>
            {v === "draft" ? (app ? "record" : "draft") : v}
          </button>
        ))}
      </div>
      <pre className={styles.json}>{JSON.stringify(body, null, 2)}</pre>
      <Link className={styles.crumb} href={`/debug?id=${encodeURIComponent(debugId)}`}>
        {tx("ডিবাগ কনসোলে খুলুন →", "Open in debug console →")}
      </Link>
    </aside>
  );
}

/** Simulated SMS inbox for a phone number (OTP + confirmations). Clearly labelled. */
export function SimSmsInbox({ phone }: { phone: string | null }) {
  const db = useDlasDb();
  const { tx } = useTx();
  if (!phone) return null;
  const msgs = db.outbox.filter((m) => m.to === phone).slice(-3).reverse();
  return (
    <div className={`${styles.card} ${styles.cardTight}`}>
      <p className={styles.eyebrow}>
        <SimTag>{tx("সিমুলেটেড এসএমএস গেটওয়ে", "Simulated SMS gateway")}</SimTag> {phone}
      </p>
      {msgs.length === 0 ? (
        <p className={styles.hint}>{tx("কোনো বার্তা নেই", "No messages yet")}</p>
      ) : (
        <ul className={styles.transcript}>
          {msgs.map((m) => (
            <li key={m.msgId} className={styles.lineSys}>
              <span className={styles.badge}>{m.kind}</span>
              <span className={styles.badge}>{m.status}</span>
              <div>{m.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Remember one in-progress session per door so a reload resumes it (save/resume). */
export function useDoorSession(channel: ChannelCode) {
  const key = `dlas.active.${channel}`;
  const db = useDlasDb();
  const [sessionId, setSessionIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  });
  const setSessionId = useCallback(
    (id: string | null) => {
      try {
        if (id) window.localStorage.setItem(key, id);
        else window.localStorage.removeItem(key);
      } catch {
        /* storage unavailable — session still works in memory */
      }
      setSessionIdState(id);
    },
    [key],
  );
  const session = sessionId ? db.sessions.find((s) => s.sessionId === sessionId) : undefined;
  return { sessionId: session ? sessionId : null, session, setSessionId };
}

export function ValidationNotice({ sessionId }: { sessionId: string | null }) {
  const db = useDlasDb();
  const { tx } = useTx();
  const s = sessionId ? db.sessions.find((x) => x.sessionId === sessionId) : undefined;
  const v = s?.lastValidation;
  if (!v || (v.valid && v.warnings.length === 0) || s?.step === "SUBMITTED") return null;
  return (
    <div className={`${styles.notice} ${v.valid ? styles.noticeWarn : styles.noticeErr}`} role="alert">
      <strong>{v.valid ? tx("সতর্কতা", "Warnings") : tx("জমা হয়নি — তথ্য অসম্পূর্ণ", "Not submitted — information missing")}</strong>
      <ul>
        {v.errors.map((e) => (
          <li key={e.path}>
            <span className={styles.mono}>{e.path}</span> — {e.message}
          </li>
        ))}
        {v.warnings.map((w) => (
          <li key={w.path + w.code}>
            <span className={styles.mono}>{w.path}</span> — {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

const noopSubscribe = () => () => {};
/** Render children only in the browser (they read localStorage during first render). */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return mounted ? <>{children}</> : null;
}

export function startFresh(channel: ChannelCode, entryPoint: string, meta?: IntakeSession["meta"], simulated = false) {
  return IntakeGateway.startSession({ channel, entryPoint, meta, simulated });
}

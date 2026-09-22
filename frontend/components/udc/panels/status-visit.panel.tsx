"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  StatusVisitService,
  LetterAccessService,
  type StatusVisitSession,
  type StatusVisitToken,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useNetwork } from "../primitives/use-network";
import styles from "../udc.module.css";

interface Props {
  sessionId?: string;
  role?: string;
}

export function UdcStatusVisitPanel({ sessionId, role = "udc" }: Props) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const net = useNetwork();

  useEffect(() => {
    ensureSeeded();
  }, []);

  // Pre-seeded list of applications this UDC assisted with.
  const assistedApps = envelope.assistedIntakes ?? [];

  const [session, setSession] = useState<StatusVisitSession | undefined>(sessionId ? StatusVisitService.getSession(sessionId) : undefined);
  const [token, setToken] = useState<StatusVisitToken | undefined>(undefined);
  const [appId, setAppId] = useState<string>("");

  // Real PIN that the applicant enters via DTMF — NOT stored, NOT logged.
  // This is the prototype's expected PIN for the simulation.
  const PROTOTYPE_PIN = "4729";

  function startSession() {
    if (!appId) return;
    const intake = assistedApps.find((a) => a.temporaryId === appId);
    const displayName = intake?.applicantName ?? "—";
    const s = StatusVisitService.beginSession({
      applicationId: appId,
      udcEntrepreneurId: "udc-001",
      applicantDisplayName: displayName,
    });
    setSession(s);
    setToken(undefined);
  }

  function simulateAuth() {
    if (!session) return;
    // In real life the applicant would enter a PIN via IVR/DTMF on
    // their own device. The UDC does not see or type it. The
    // prototype asks for it on the same screen so the demo is
    // visible, but logs ONLY the result + identifier hash, never
    // the PIN itself.
    const t = StatusVisitService.issueAssistedToken({
      sessionId: session.id,
      applicantIdentifier: PROTOTYPE_PIN,
      authorizationMethod: "applicant_pin_ivr",
      purpose: "status_check",
    });
    if ("token" in (t as unknown as { token: StatusVisitToken })) {
      setToken((t as unknown as { token: StatusVisitToken }).token);
    } else {
      alert((t as unknown as { error: string }).error);
    }
  }

  function endSession() {
    if (!session) return;
    StatusVisitService.endSession(session.id);
    setSession(undefined);
    setToken(undefined);
  }

  function proceedToLetter() {
    if (!session) return;
    window.location.href = `/dashboard/${role}/letter-access/${session.id}`;
  }

  const remainingMs = session ? Math.max(0, new Date(session.expiresAt).getTime() - Date.now()) : 0;
  const remainingMin = Math.ceil(remainingMs / 60_000);

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · নির্ধারিত ৪:০০ অবস্থা পরিদর্শন" : "UDC · scheduled 4 PM status visit"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "আবেদনকারীর উপস্থিতিতে সহায়-দেখা" : "Applicant-assisted view (Nuching present)"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "এই দেখা শুধুমাত্র নির্দিষ্ট সেশনের জন্য। অভ্যন্তরীণ DLAO নোট, আইনি দলিল বা অন্য নাগরিকের তথ্য দেখা যাবে না।"
              : "This view is scoped to a single session. Internal DLAO notes, evidence, and other citizens' information remain hidden."}
          </p>

          <div className={styles.intakeBanner} style={{ background: net.kind === "offline" ? "var(--gray)" : "var(--ink)" }}>
            <strong>●</strong>
            <span>
              {lang === "bn" ? "টোকেন স্কোপ:" : "Token scope:"}{" "}
              <span className={`${styles.tokenScopePill} ${session ? styles.tokenScopeAssisted : styles.tokenScopeMinimal}`}>
                {session
                  ? (token ? "APPLICANT_ASSISTED_VIEW" : (session.state === "awaiting_applicant_auth" ? "awaiting auth" : session.state))
                  : "MINIMAL_STATUS"}
              </span>
              {token && (
                <>
                  {" · "}
                  <strong style={{ color: "var(--yellow)" }}>{token.id}</strong>
                  {" · "}
                  {lang === "bn" ? "মেয়াদ" : "expires in"} {remainingMin}m
                </>
              )}
            </span>
          </div>
        </header>

        {/* ===== Step 1: Select application + start session ===== */}
        {!session && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "১. আবেদন নির্বাচন করুন" : "1. Pick the application"}</h2>
            </div>
            <div className={styles.fieldGrid}>
              <label>{lang === "bn" ? "আবেদন" : "Application"}</label>
              <select value={appId} onChange={(e) => setAppId(e.target.value)}>
                <option value="">—</option>
                {assistedApps.map((a) => (
                  <option key={a.temporaryId} value={a.temporaryId}>
                    {a.applicantName} · {a.temporaryId}
                  </option>
                ))}
              </select>
              <span></span>
            </div>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={startSession}
                disabled={!appId}
              >
                {lang === "bn" ? "সেশন শুরু করুন (আবেদনকারী উপস্থিত)" : "Begin visit (applicant present)"}
              </button>
            </div>
          </section>
        )}

        {/* ===== Step 2: Applicant authenticates via IVR/PIN ===== */}
        {session && !token && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "২. আবেদনকারীর নতুন প্রমাণীকরণ" : "2. Fresh applicant authentication"}</h2>
            </div>
            <p className={styles.bannerInfo}>
              {lang === "bn"
                ? "PIN কেবল আবেদনকারী নিজের ফোনে DTMF-এ প্রবেশ করান। UDC দেখবে না, জানবে না, টাইপ করবে না।"
                : "The PIN is entered by the applicant on their own phone via DTMF. The UDC never sees, knows, or types it."}
            </p>
            <div className={styles.dialPad}>
              {Array.from({ length: 9 }).map((_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => {
                    // In real life this would not be triggered by the UDC — the
                    // IVR bridge listens on its own channel. For the prototype
                    // we let the demo progress so the audience can see the flow.
                    void i;
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" aria-label="star">∗</button>
              <button type="button" aria-label="zero">0</button>
              <button type="button" aria-label="hash">#</button>
            </div>
            <div className={styles.dialDisplay}>●●●●</div>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={simulateAuth}
              >
                {lang === "bn"
                  ? "IVR ব্রিজ সিমুলেট করুন (প্রোটোটাইপ)"
                  : "Simulate IVR bridge (prototype)"}
              </button>
            </div>
            <p className={styles.bannerInfo}>
              <small>
                {lang === "bn"
                  ? "নিরাপত্তা নোট: PIN শুধু প্রোটোটাইপের expected মানের সাথে মিলেছে কিনা যাচাই করা হয় — সংরক্ষণ, প্রদর্শন বা লগ করা হয় না।"
                  : "Security note: the PIN is verified against the prototype's expected value only — never stored, displayed, or logged."}
              </small>
            </p>
          </section>
        )}

        {/* ===== Step 3: Applicant-facing view ===== */}
        {session && token && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "৩. আবেদনকারী-মুখী দেখা" : "3. Applicant-facing view"}</h2>
              <span className={`${styles.tokenScopePill} ${styles.tokenScopeAssisted}`}>
                {token.scope}
              </span>
            </div>
            <p className={styles.bannerInfo}>
              {lang === "bn"
                ? "UDC শুধু নিচের তথ্য দেখতে পারে। অভ্যন্তরীণ নোট, প্রমাণ, অন্যের তথ্য লুকানো।"
                : "Only the applicant-facing fields below are visible. Internal notes, evidence, and other-people information remain hidden."}
            </p>

            <ul className={styles.queueList}>
              <li className={styles.queueRow} style={{ background: "#f0fdf4" }}>
                <strong>{lang === "bn" ? "বর্তমান অবস্থা" : "Current status"}</strong>
                <span>in_review · {lang === "bn" ? "DLAO পর্যালোচনা চলছে" : "DLAO review in progress"}</span>
                <span className={`${styles.statusPill} ${styles.statusPillSynced}`}>in_review</span>
                <span>{lang === "bn" ? "প্রকাশ্য" : "public"}</span>
              </li>
              <li className={styles.queueRow}>
                <strong>{lang === "bn" ? "পরবর্তী পদক্ষেপ" : "Next step"}</strong>
                <span>{lang === "bn" ? "আগামীকাল বিকাল ৩টায় আবার আসুন" : "Come again tomorrow at 3 PM"}</span>
                <span className={`${styles.statusPill} ${styles.statusPillQueued}`}>scheduled</span>
                <span>—</span>
              </li>
              <li className={styles.queueRow}>
                <strong>{lang === "bn" ? "জমা দেওয়া তথ্য" : "Submitted information"}</strong>
                <span>{lang === "bn" ? "আবেদনকারীর নাম, জেলা, মামলার ধরন, ভাষা" : "Name, district, matter type, language"}</span>
                <span className={`${styles.statusPill} ${styles.statusPillSynced}`}>visible</span>
                <Link href={`/dashboard/${role}/intake/${session.applicationId}`}>open →</Link>
              </li>
              <li className={styles.queueRow}>
                <strong>{lang === "bn" ? "নথি" : "Documents"}</strong>
                <span>{lang === "bn" ? "৩টি দলিল (আবেদনকারী-দৃশ্য)" : "3 documents (applicant-visible)"}</span>
                <span className={`${styles.statusPill} ${styles.statusPillSynced}`}>visible</span>
                <span>—</span>
              </li>
              <li className={styles.queueRow} style={{ background: "#fef2f2" }}>
                <strong>{lang === "bn" ? "সুরক্ষিত চিঠি" : "Protected letter"}</strong>
                <span>
                  {lang === "bn"
                    ? "এই টোকেন দিয়ে দেখা যাবে না — আলাদা LETTER_ACCESS প্রয়োজন"
                    : "Not openable with this token — separate LETTER_ACCESS required"}
                </span>
                <span className={`${styles.statusPill} ${styles.statusPillIntegrity}`}>locked</span>
                <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={proceedToLetter}>
                  {lang === "bn" ? "চিঠি অনুমতি →" : "Letter auth →"}
                </button>
              </li>
            </ul>

            <div className={styles.btnRow}>
              <button type="button" className={styles.btn} onClick={endSession}>
                {lang === "bn" ? "সেশন শেষ করুন" : "End session"}
              </button>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <Link href={`/dashboard/${role}`} className={styles.btn}>
            ← {lang === "bn" ? "ড্যাশবোর্ডে ফিরে যান" : "Back to dashboard"}
          </Link>
        </section>
      </main>
    </>
  );
}
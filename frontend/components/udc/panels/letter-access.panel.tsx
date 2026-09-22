"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  StatusVisitService,
  LetterAccessService,
  type LetterAccessToken,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useNetwork } from "../primitives/use-network";
import styles from "../udc.module.css";

interface Props {
  sessionId: string;
  role?: string;
}

export function UdcLetterAccessPanel({ sessionId, role = "udc" }: Props) {
  const { lang } = useI18n();
  const net = useNetwork();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const session = StatusVisitService.getSession(sessionId);
  const [letterToken, setLetterToken] = useState<LetterAccessToken | undefined>(undefined);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>("");

  const PROTOTYPE_PIN = "4729";
  const IVR_CALL_ID = `IVR-${Date.now().toString(36).toUpperCase()}`;

  if (!session) {
    return (
      <main id="udc-main" className={styles.page}>
        <SkipLink targetId="udc-main" />
        <h1 className={styles.pageTitle}>{lang === "bn" ? "সেশন পাওয়া যায়নি" : "Session not found"}</h1>
        <Link href={`/dashboard/${role}/status-visit`}>
          {lang === "bn" ? "পরিদর্শনে ফিরে যান →" : "Back to visit →"}
        </Link>
      </main>
    );
  }

  function attemptVerify() {
    setError("");
    if (!session) return;
    if (pin.length < 4) {
      setError(lang === "bn" ? "PIN কমপক্ষে ৪ সংখ্যার হতে হবে" : "PIN must be at least 4 digits");
      return;
    }

    // Begin an attempt. The IVR call ID is the only thing the UDC
    // supplies — the PIN is entered by the applicant on their device.
    LetterAccessService.beginAttempt({
      applicationId: session.applicationId,
      letterId: `LETTER-${session.applicationId}`,
      ivrCallId: IVR_CALL_ID,
    });

    // Verify against prototype expected PIN. The PIN itself is NEVER
    // persisted — it lives only in the local component state and is
    // cleared immediately after the verify call.
    const result = LetterAccessService.verifyPin({
      applicationId: session.applicationId,
      letterId: `LETTER-${session.applicationId}`,
      ivrCallId: IVR_CALL_ID,
      pinEnteredByApplicant: pin,
      expectedPin: PROTOTYPE_PIN,
      onMismatch: "lockout_after_three",
    });

    // Critical: clear the PIN from component state right now.
    setPin("");

    if (result.ok) {
      setLetterToken(result.token);
    } else if (result.reason === "locked_out") {
      setError(
        lang === "bn"
          ? "অতিরিক্ত ব্যর্থ প্রচেষ্টা — লক-আউট। কর্তৃপক্ষের সাথে যোগাযোগ করুন।"
          : "Too many failed attempts — locked out. Contact authorized staff.",
      );
    } else {
      setError(
        lang === "bn"
          ? "PIN মেলেনি। আবার চেষ্টা করুন।"
          : "PIN did not match. Try again.",
      );
    }
  }

  function pressKey(digit: string) {
    if (digit === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (digit === "clear") {
      setPin("");
      return;
    }
    setPin((p) => p + digit);
  }

  function revoke() {
    if (letterToken) LetterAccessService.revoke(letterToken.id);
    setLetterToken(undefined);
  }

  const attempts = LetterAccessService.attemptsFor(session.applicationId);

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · চিঠি অ্যাক্সেস" : "UDC · letter access"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "PIN/IVR-নিয়ন্ত্রিত চিঠি অনুমতি" : "PIN/IVR-controlled letter access"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "PIN শুধু আবেদনকারী নিজের ফোনে DTMF-এ প্রবেশ করান। UDC PIN দেখবে না, জানবে না, সংরক্ষণ করবে না।"
              : "The PIN is entered by the applicant on their own phone via DTMF. The UDC never sees, knows, or stores it."}
          </p>

          <div className={styles.intakeBanner} style={{ background: letterToken ? "#7f1d1d" : "var(--ink)" }}>
            <strong style={{ color: "var(--yellow)" }}>●</strong>
            <span>
              {lang === "bn" ? "টোকেন স্কোপ:" : "Token scope:"}{" "}
              <span className={`${styles.tokenScopePill} ${letterToken ? styles.tokenScopeLetter : styles.tokenScopeMinimal}`}>
                {letterToken ? "LETTER_ACCESS" : "MINIMAL_STATUS"}
              </span>
              {letterToken && (
                <>
                  {" · "}
                  <strong>{letterToken.id}</strong>
                  {" · "}
                  {lang === "bn" ? "শুধু এই চিঠি" : "letter only"}
                </>
              )}
            </span>
          </div>
        </header>

        <section className={styles.section}>
          <div className={styles.safetyBanner}>
            <strong>{lang === "bn" ? "সুরক্ষা সীমানা" : "Security boundary"}</strong>
            <p>
              {lang === "bn"
                ? "এই স্ক্রিনে PIN প্রবেশ করানো হলে তা শুধু এই ব্রাউজার-সেশনে প্রবেশ করা হচ্ছে বলে ধরে নেওয়া হচ্ছে — UDC কখনো এই PIN দেখবে না, বলবে না, টাইপ করবে না, সংরক্ষণ করবে না। IndexedDB, audit, notification, বা screenshot-এ PIN কখনো সংরক্ষিত হয় না।"
                : "The PIN entered on this screen is treated as if entered by the applicant themselves on their own device — the UDC never sees, speaks, types, or stores it. It is never saved in IndexedDB, audit, notifications, or screenshots."}
            </p>
          </div>
        </section>

        {!letterToken && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "আবেদনকারী IVR-এ PIN প্রবেশ করান" : "Applicant enters PIN via IVR"}</h2>
              <span>
                {lang === "bn" ? `${attempts}টি প্রচেষ্টা` : `${attempts} attempts`}
              </span>
            </div>

            <div className={styles.dialDisplay}>{pin ? "•".repeat(pin.length) : "____"}</div>

            <div className={styles.dialPad}>
              {Array.from({ length: 9 }).map((_, i) => (
                <button key={i + 1} type="button" onClick={() => pressKey(String(i + 1))}>
                  {i + 1}
                </button>
              ))}
              <button type="button" onClick={() => pressKey("clear")} aria-label="clear">
                C
              </button>
              <button type="button" onClick={() => pressKey("0")}>0</button>
              <button type="button" onClick={() => pressKey("back")} aria-label="back">
                ←
              </button>
            </div>

            {error && (
              <p className={styles.safetyBanner} role="alert">
                {error}
              </p>
            )}

            <div className={styles.btnRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={attemptVerify}
                disabled={pin.length < 4}
              >
                {lang === "bn" ? "যাচাই করুন" : "Verify"}
              </button>
              <button type="button" className={styles.btn} onClick={() => setPin("")}>
                {lang === "bn" ? "মুছুন" : "Clear"}
              </button>
            </div>
          </section>
        )}

        {letterToken && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "সুরক্ষিত চিঠি" : "Protected letter"}</h2>
              <span className={`${styles.tokenScopePill} ${styles.tokenScopeLetter}`}>LETTER_ACCESS</span>
            </div>
            <div
              style={{
                position: "relative",
                padding: "var(--s-4)",
                background: "#fff8dc",
                border: "1px solid var(--line)",
                fontFamily: "serif",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, color: "rgba(0,0,0,0.07)",
                  pointerEvents: "none",
                  letterSpacing: 6,
                }}
              >
                PROTOTYPE · {letterToken.id}
              </div>
              <p style={{ margin: 0 }}>
                {lang === "bn"
                  ? "সম্মানিত আবেদনকারী, আপনার আবেদন গৃহীত হয়েছে। পরবর্তী শুনানি ২০২৬-১০-০৫ তারিখে সকাল ১০:৩০টায়।"
                  : "Dear applicant, your application has been accepted. The next hearing is scheduled for 2026-10-05 at 10:30 AM."}
              </p>
            </div>

            <p className={styles.bannerInfo}>
              <small>
                {lang === "bn"
                  ? "এই টোকেন শুধু এই চিঠি খুলতে পারে — অন্য কোনো আবেদন বা অভ্যন্তরীণ নোট নয়।"
                  : "This token can open only this letter — not other applications or internal notes."}
              </small>
            </p>

            <div className={styles.btnRow}>
              <button type="button" className={styles.btn} onClick={revoke}>
                {lang === "bn" ? "টোকেন বাতিল ও বন্ধ করুন" : "Revoke token & close"}
              </button>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <Link href={`/dashboard/${role}/status-visit/${session.id}`} className={styles.btn}>
            ← {lang === "bn" ? "পরিদর্শনে ফিরে যান" : "Back to visit"}
          </Link>
        </section>
      </main>
    </>
  );
}
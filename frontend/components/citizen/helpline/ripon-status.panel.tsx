"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore } from "@/lib/shakkho";
import { Phone, Moon, Play, AlertCircle } from "@/components/icons";
import { IconButton } from "@/components/helpline/primitives/icon-button";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import helplineStyles from "@/components/helpline/helpline.module.css";
import styles from "./ripon-status.module.css";

const SAFE_PHRASE = "সবুজ পাতা";
const SAFE_NUMBER = "১৯৪-৪৪৭-১২";

export function RiponStatusPanel() {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const record = envelope.records.find((r) => r.applicationId === "TEMP-MOY-01");
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    ensureSeeded();
  }, []);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const v = input.trim();
    if (v === SAFE_PHRASE && /194[-\s]?447/.test(SAFE_NUMBER)) {
      setFeedback({ ok: true, msg: lang === "bn" ? "✅ বৈধ — আপনার আবেদন এখনও পর্যালোচনাধীন।" : "✅ Verified — your application is still under review." });
    } else if (/^\d+$/.test(v) && v.length === 3) {
      setFeedback({ ok: false, msg: lang === "bn" ? "দয়া করে সংখ্যাসহ নিরাপদ বাক্যটি পুরো লিখুন।" : "Please include the safe phrase as well as the digits." });
    } else {
      setFeedback({ ok: false, msg: lang === "bn" ? "তথ্য মেলেনি — আবার চেষ্টা করুন।" : "Could not match — please retry." });
    }
  }

  function speak() {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      setVoice(true);
      return;
    }
    const utter = new SpeechSynthesisUtterance(
      lang === "bn"
        ? "আপনার আবেদন এখনও পর্যালোচনাধীন।"
        : "Your application is still under review.",
    );
    utter.lang = lang === "bn" ? "bn-BD" : "en-US";
    window.speechSynthesis.speak(utter);
    setVoice(true);
  }

  return (
    <>
      <SkipLink targetId="ripon-main" />
      <main
        id="ripon-main"
        className={`${helplineStyles.page} ${reducedMotion ? styles.reducedMotion : ""}`}
      >
        <header className={helplineStyles.pageHeader}>
          <span className={helplineStyles.pageEyebrow}>
            {lang === "bn" ? "প্রবেশাধিকারযোগ্য স্ট্যাটাস পেজ · ১৬৬৯৯" : "Accessible status · 16699"}
          </span>
          <h1 className={helplineStyles.pageTitle}>
            {lang === "bn" ? "আমার আবেদনের অবস্থা" : "My application status"}
          </h1>
          <p className={helplineStyles.pageIntro}>
            {lang === "bn"
              ? "স্ক্রিন-রিডার, কী-প্যাড, কম-গতির এবং কম-রঙের ব্যবহারকারীদের জন্য।"
              : "Built for screen readers, keypads, low-motion, and low-color users."}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <IconButton
              Icon={reducedMotion ? Play : Moon}
              onClick={() => setReducedMotion((r) => !r)}
            >
              {reducedMotion
                ? lang === "bn" ? "স্বাভাবিক গতি" : "Normal motion"
                : lang === "bn" ? "কম গতি" : "Reduce motion"}
            </IconButton>
            <IconButton Icon={Play} onClick={speak}>
              {lang === "bn" ? "পড়ে শোনান" : "Read aloud"}
            </IconButton>
          </div>
        </header>

        <section className={helplineStyles.callColumn}>
          <h2>{lang === "bn" ? "নিরাপদ যাচাই" : "Safe verification"}</h2>
          <p>
            {lang === "bn"
              ? "আপনার ৩-সংখ্যার রেফারেন্স এবং নিরাপদ বাক্য দিন।"
              : "Provide your 3-digit reference and the safe phrase."}
          </p>
          <p style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
            {lang === "bn" ? "রেফারেন্স" : "Reference"}: <strong>194-447-12</strong> · {lang === "bn" ? "নিরাপদ বাক্য" : "Safe phrase"}: <strong>{SAFE_PHRASE}</strong>
          </p>
          <form onSubmit={submit} className={styles.form}>
            <input
              type="text"
              inputMode="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === "bn" ? "রেফারেন্স ও নিরাপদ বাক্য লিখুন…" : "Type reference and safe phrase…"}
              aria-label={lang === "bn" ? "রেফারেন্স ও নিরাপদ বাক্য" : "Reference and safe phrase"}
              className={helplineStyles.callerInput}
            />
            <IconButton Icon={Phone} onClick={() => submit()}>
              {lang === "bn" ? "যাচাই করুন" : "Verify"}
            </IconButton>
          </form>
          {feedback ? (
            <p role="alert" className={feedback.ok ? styles.ok : styles.bad}>
              {feedback.msg}
            </p>
          ) : null}

          <h2 style={{ marginTop: 24 }}>{lang === "bn" ? "বর্তমান অবস্থা" : "Current status"}</h2>
          <p>
            {record?.status === "in_review"
              ? lang === "bn" ? "পর্যালোচনাধীন" : "Under review"
              : lang === "bn" ? "জমা হয়নি" : "Not submitted"}
          </p>
          <p>
            {lang === "bn"
              ? "আপনার রেফারেন্স APP-2026-10482 এই পর্যালোচনায় আছে।"
              : "Your reference APP-2026-10482 is in this review."}
          </p>
        </section>

        <section className={helplineStyles.callColumn}>
          <h2>{lang === "bn" ? "কী-প্যাড ইনপুট" : "Keypad input"}</h2>
          <p>
            {lang === "bn"
              ? "ফোন কী-প্যাড থেকেও সংখ্যা লিখুন।"
              : "Type numbers from your phone keypad."}
          </p>
          <div className={helplineStyles.dialpad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setInput((v) => v + k)}
                aria-label={`Key ${k}`}
              >
                {k}
              </button>
            ))}
          </div>
        </section>

        <section className={helplineStyles.callColumn}>
          <h2>{lang === "bn" ? "সহায়তা" : "Help"}</h2>
          <p>
            {lang === "bn"
              ? "আপনার রেফারেন্স নম্বর হারিয়ে গেলে ১৬৬৯৯ নম্বরে কল করুন এবং এই নিরাপদ বাক্যটি বলুন।"
              : "If you lose your reference, call 16699 and provide this safe phrase."}
          </p>
          <p style={{ color: "var(--gray)" }}>
            {lang === "bn" ? "নিরাপদ বাক্য" : "Safe phrase"}: {SAFE_PHRASE}
          </p>
          <p style={{ color: "var(--gray)" }}>
            {lang === "bn" ? "রেফারেন্স" : "Reference"}: 194-447-12
          </p>
        </section>
      </main>
      <p className="visually-hidden" aria-live="polite">{voice ? (lang === "bn" ? "পড়া শুরু হয়েছে" : "Reading aloud") : ""}</p>
    </>
  );
}

void AlertCircle;

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/button";
import { LanguageToggle } from "@/components/language-toggle";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import styles from "./simulator-panel.module.css";

type SimulatorPanelProps = { tool?: string };

export function SimulatorPanel({ tool = "scenario" }: SimulatorPanelProps) {
  const { lang } = useI18n();
  const [hours, setHours] = useState(0);
  const [failed, setFailed] = useState(false);
  const [courtPublished, setCourtPublished] = useState(false);
  const [step, setStep] = useState(1);
  const [reset, setReset] = useState(false);
  const clockText = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 8, 21, 9 + hours)));
  const title = {
    clock: lang === "bn" ? "সিমুলেটেড ঘড়ি" : "Simulated clock",
    sms: lang === "bn" ? "এসএমএস সিমুলেটর" : "SMS simulator",
    court: lang === "bn" ? "আদালত সংকেত" : "Court signal",
    scenario: lang === "bn" ? "পরিস্থিতি চালক" : "Scenario runner",
    reset: lang === "bn" ? "ডেমো রিসেট" : "Reset demo",
  }[tool] ?? (lang === "bn" ? "ডেমো নিয়ন্ত্রণ" : "Demo controls");

  return (
    <main className={styles.page}>
      <header className={styles.header}><Wordmark /><LanguageToggle /></header>
      <div className={styles.shell}>
        <Link href="/dashboard/dlo" className={styles.back}>{lang === "bn" ? "← ড্যাশবোর্ডে ফিরুন" : "← Back to dashboard"}</Link>
        <p className={styles.tag}>{lang === "bn" ? "সিমুলেটেড" : "Simulated"}</p>
        <h1>{title}</h1>
        <p className={styles.intro}>{lang === "bn" ? "এই নিয়ন্ত্রণগুলো শুধু স্থানীয় প্রোটোটাইপের দৃশ্যমান অবস্থা বদলায়। কোনো বাস্তব বার্তা পাঠানো হয় না।" : "These controls only change the visible local prototype state. No real message is sent."}</p>
        <nav className={styles.tabs} aria-label={lang === "bn" ? "সিমুলেটর" : "Simulator"}>
          {[["clock", "Clock", "ঘড়ি"], ["sms", "SMS", "এসএমএস"], ["court", "Court", "আদালত"], ["scenario", "Scenario", "পরিস্থিতি"], ["reset", "Reset", "রিসেট"]].map(([id, en, bn]) => <Link className={tool === id ? styles.active : ""} href={`/sim/${id}`} key={id}>{lang === "bn" ? bn : en}</Link>)}
        </nav>

        {tool === "clock" ? <section className={styles.panel}><p className={styles.label}>{lang === "bn" ? "বর্তমান ডেমো সময়" : "Current demo time"}</p><strong className={styles.display}>{clockText}</strong><div className={styles.actions}><Button onClick={() => setHours(hours + 1)}>+1h</Button><Button variant="secondary" onClick={() => setHours(hours + 24)}>+24h</Button><Button variant="secondary" onClick={() => setHours(hours + 48)}>+48h</Button></div></section> : null}
        {tool === "sms" ? <section className={styles.panel}><p className={styles.label}>{lang === "bn" ? "নাগরিক ফোন · SHK-DEMO-007" : "Citizen phone · SHK-DEMO-007"}</p><div className={styles.message}>{lang === "bn" ? "আপনার যাচাইকৃত শুনানির তারিখ ৩০ সেপ্টেম্বর ২০২৬।" : "Your verified hearing date is 30 September 2026."}</div><p className={failed ? styles.failure : styles.status}>{failed ? "FAILED" : "DELIVERED"}</p><Button variant="secondary" onClick={() => setFailed(!failed)}>{failed ? (lang === "bn" ? "ডেলিভারি পুনরুদ্ধার" : "Restore delivery") : (lang === "bn" ? "ডেলিভারি ব্যর্থ করুন" : "Force delivery failure")}</Button></section> : null}
        {tool === "court" ? <section className={styles.panel}><p className={styles.label}>{lang === "bn" ? "সিমুলেটেড কজ লিস্ট" : "Simulated cause list"}</p><strong className={styles.display}>SHK-DEMO-007 · 30 Sep 2026</strong><p className={styles.detail}>{lang === "bn" ? "এই উৎস শুধু শুনানির তারিখ যাচাই করতে পারে; উপস্থিতি নয়।" : "This source can verify the hearing date, not attendance."}</p>{courtPublished ? <p role="status" className={styles.status}>{lang === "bn" ? "আদালতের পর্যবেক্ষণ প্রকাশিত হয়েছে।" : "Court observation published."}</p> : <Button onClick={() => setCourtPublished(true)}>{lang === "bn" ? "আদালতের তারিখ প্রকাশ করুন" : "Publish court date"}</Button>}</section> : null}
        {tool === "scenario" || !["clock", "sms", "court", "reset"].includes(tool) ? <section className={styles.panel}><p className={styles.label}>{lang === "bn" ? "স্বাক্ষর দৃশ্য · ধাপ" : "Signature scenario · step"} {step}/5</p><h2>{lang === "bn" ? "বিরোধপূর্ণ পরবর্তী তারিখ" : "Conflicting next hearing date"}</h2><p className={styles.detail}>{lang === "bn" ? "প্রতিবেদন অনুপস্থিত → আইনজীবীর তথ্য → আদালতের ভিন্ন তারিখ → কর্মকর্তার সিদ্ধান্ত → ডেলিভারি নিশ্চিতকরণ" : "Missing report → lawyer update → conflicting court date → officer resolution → delivery confirmation"}</p><Button onClick={() => setStep(step === 5 ? 1 : step + 1)}>{step === 5 ? (lang === "bn" ? "আবার শুরু করুন" : "Start again") : (lang === "bn" ? "পরবর্তী ধাপ" : "Next step")}</Button></section> : null}
        {tool === "reset" ? <section className={styles.panel}><p className={styles.label}>{lang === "bn" ? "ডেমো ডেটা" : "Demo data"}</p><h2>{lang === "bn" ? "শুরুর অবস্থায় ফিরুন" : "Return to the starting state"}</h2><p className={styles.detail}>{lang === "bn" ? "স্থানীয় দৃশ্যমান নিয়ন্ত্রণগুলো রিসেট হবে। সংরক্ষিত ব্যাকএন্ড ডেটা পরিবর্তন করা হবে না।" : "Local visible controls will reset. Persisted backend data will not be changed."}</p>{reset ? <p role="status" className={styles.status}>{lang === "bn" ? "ডেমো প্রস্তুত।" : "Demo ready."}</p> : <Button variant="destructive" onClick={() => setReset(true)}>{lang === "bn" ? "স্থানীয় ডেমো রিসেট করুন" : "Reset local demo"}</Button>}</section> : null}
      </div>
    </main>
  );
}

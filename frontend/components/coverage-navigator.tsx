"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import styles from "./coverage-navigator.module.css";

export function CoverageNavigator() {
  const { lang } = useI18n();
  return (
    <section id="coverage" className={styles.coverage}>
      <div>
        <p>{lang === "bn" ? "জুরি নিয়ন্ত্রণ" : "Jury control"}</p>
        <h2>{lang === "bn" ? "২৩/২৩ কভারেজ নেভিগেটর" : "23/23 Coverage Navigator"}</h2>
        <span>{lang === "bn" ? "দৃশ্য, গ্রহণযোগ্যতা শর্ত, প্রত্যাশিত পরিবর্তন ও সর্বশেষ লেজার ঘটনা।" : "Scenario, acceptance condition, expected change, and latest ledger event."}</span>
      </div>
      <Link href="/sim/scenario">{lang === "bn" ? "পরিস্থিতি খুলুন" : "Open scenarios"}</Link>
    </section>
  );
}

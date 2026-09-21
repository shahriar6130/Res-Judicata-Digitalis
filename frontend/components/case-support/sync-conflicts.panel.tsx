"use client";

import Link from "next/link";
import { ensureSeeded, useHelplineStore } from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "./case-support.module.css";

export function CaseSupportSyncConflictsPanel() {
  const { lang } = useI18n();
  const envelope = useHelplineStore();

  if (typeof window !== "undefined") {
    ensureSeeded();
  }

  const conflicts = envelope.syncConflicts ?? [];
  const integrity = envelope.integrityVerifications ?? [];

  return (
    <>
      <SkipLink targetId="case-support-main" />
      <main id="case-support-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "কেস সাপোর্ট · সিঙ্ক কনফ্লিক্ট" : "Case support · sync conflicts"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "কনফ্লিক্ট ও অখণ্ডতা পর্যালোচনা" : "Conflict + integrity review"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "UDC-র সিঙ্ক ব্যর্থ হলে কনফ্লিক্ট বা অখণ্ডতা ত্রুটি এখানে আসে। মানব সিদ্ধান্ত ছাড়া DLAS রেকর্ড পরিবর্তন হয় না।"
              : "Sync failures from UDCs route here. DLAS records never change without a human decision."}
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "কনফ্লিক্ট" : "Conflicts"}</h2>
          </div>
          <ul className={styles.queueList}>
            {conflicts.map((c) => (
              <li key={c.id} className={styles.queueRow}>
                <strong>{c.id}</strong>
                <span>
                  {c.fieldOrObject} · {c.kind} · DLAS: {c.authoritativeValue} · offline: {c.offlineValue}
                </span>
                <span
                  className={`${styles.statusPill} ${
                    c.resolution ? styles.statusPillSynced : styles.statusPillConflict
                  }`}
                >
                  {c.resolution ? "resolved" : "pending"}
                </span>
                <Link href={`/dashboard/udc/sync-centre/conflicts/${c.id}`}>
                  {lang === "bn" ? "সিদ্ধান্ত" : "Decide"}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অখণ্ডতা যাচাই" : "Integrity verifications"}</h2>
          </div>
          <ul className={styles.queueList}>
            {integrity.map((i) => (
              <li key={i.id} className={styles.queueRow}>
                <strong>{i.temporaryId}</strong>
                <span>
                  submitted {i.submittedDigest.slice(0, 16)}… · ack {i.acknowledgedDigest.slice(0, 16)}…
                </span>
                <span
                  className={`${styles.statusPill} ${
                    i.result === "pass" ? styles.statusPillSynced : styles.statusPillConflict
                  }`}
                >
                  {i.result}
                </span>
                <Link href="/dashboard/udc/sync-centre">{lang === "bn" ? "সিঙ্ক সেন্টার" : "Sync centre"}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

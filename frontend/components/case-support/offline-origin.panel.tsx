"use client";

import Link from "next/link";
import { ensureSeeded, useHelplineStore } from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "./case-support.module.css";

export function CaseSupportOfflineOriginPanel() {
  const { lang } = useI18n();
  const envelope = useHelplineStore();

  if (typeof window !== "undefined") {
    ensureSeeded();
  }

  const drafts = envelope.offlineDrafts ?? [];
  const idMappings = envelope.idMappings ?? [];

  return (
    <>
      <SkipLink targetId="case-support-main" />
      <main id="case-support-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "কেস সাপোর্ট · অফলাইন উৎস" : "Case support · offline origin"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "অফলাইন উৎসের আবেদন" : "Applications originating offline"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "UDC থেকে আসা আবেদনগুলোতে সম্পূর্ণ প্রোভেন্যান্স, সম্মতি ও অনুবাদ চেইন সংরক্ষিত আছে।"
              : "Applications from UDCs preserve the full provenance, consent, and translation chain."}
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অফলাইন উৎসের খসড়া" : "Offline-origin drafts"}</h2>
          </div>
          <ul className={styles.queueList}>
            {drafts.map((d) => (
              <li key={d.temporaryId} className={styles.queueRow}>
                <strong>{d.temporaryId}</strong>
                <span>
                  {d.confirmedFields.length} fields · {d.provenance?.length ?? 0} provenance · {d.consent.length} consents
                </span>
                <span
                  className={`${styles.statusPill} ${
                    d.syncStatus === "synced"
                      ? styles.statusPillSynced
                      : d.syncStatus === "queued_offline"
                      ? styles.statusPillOffline
                      : styles.statusPillConflict
                  }`}
                >
                  {d.syncStatus}
                </span>
                <Link href={`/dashboard/udc/intake/${d.temporaryId}`}>
                  {lang === "bn" ? "খুলুন" : "Open"}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অস্থায়ী UUID → আবেদন আইডি" : "Temporary UUID → Application ID"}</h2>
          </div>
          <ul className={styles.provenanceList}>
            {idMappings.map((m) => (
              <li key={m.temporaryId}>
                <span>{m.temporaryId}</span>
                <span>
                  <strong>{m.authoritativeApplicationId}</strong> · synced {m.syncedAt.split("T")[0]} · actor {m.actor}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

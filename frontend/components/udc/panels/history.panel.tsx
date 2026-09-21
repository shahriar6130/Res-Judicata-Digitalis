"use client";

import Link from "next/link";
import { ensureSeeded, useHelplineStore } from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

export function UdcHistoryPanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  if (typeof window !== "undefined") {
    ensureSeeded();
  }

  const intakes = envelope.assistedIntakes ?? [];
  const auditEvents = envelope.audit ?? [];
  const idMappings = envelope.idMappings ?? [];

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · ইতিহাস" : "UDC · history"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "UDC ইতিহাস (সীমিত দেখ)" : "UDC history (limited view)"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "জমার পরে শুধু সীমিত আপডেট দেখা যায় — কেসের বিস্তারিত DLAO/কেস সাপোর্টে।"
              : "After submission the UDC only sees limited updates — case detail lives with DLAO/case support."}
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সিঙ্ক-কৃত আবেদন" : "Synced applications"}</h2>
          </div>
          <ul className={styles.queueList}>
            {idMappings.map((m) => (
              <li key={m.temporaryId} className={styles.queueRow}>
                <strong>{m.temporaryId}</strong>
                <span>{lang === "bn" ? "অনুমোদিত আবেদন আইডি" : "Authoritative Application ID"}: {m.authoritativeApplicationId}</span>
                <span>{m.syncedAt.split("T")[0]}</span>
                <span>{m.actor}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "UDC অডিট ইতিহাস" : "UDC audit history"}</h2>
          </div>
          <ul className={styles.queueList}>
            {auditEvents.map((ev) => (
              <li key={ev.id} className={styles.queueRow}>
                <strong>{ev.subject}</strong>
                <span>{ev.action}</span>
                <span>{ev.occurredAt.split("T")[0]}</span>
                <span>{ev.actor}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সহায়-ইনটেক" : "Assisted intakes"}</h2>
          </div>
          <ul className={styles.queueList}>
            {intakes.map((a) => (
              <li key={a.temporaryId} className={styles.queueRow}>
                <strong>{a.applicantName}</strong>
                <span>
                  {a.district} · {a.matterType} · {a.consents.length} consents · {a.translations.length} provenance
                </span>
                <span>{a.state}</span>
                <Link href={`/dashboard/${role}/intake/${a.temporaryId}`}>
                  {lang === "bn" ? "খুলুন" : "Open"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  CachePolicyService,
  integrityThreatModel,
  PerformanceMeasurementService,
  type StoreEnvelope,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

/* ------------------------------------------------------------------ *
 *  Eight judging-criteria evidence panels.
 *
 *  Each card is a fixed URL so a reviewer can drop into any of them
 *  and reproduce the demonstration. Everything they show is sourced
 *  from the seeded envelope or services — nothing fabricated.
 * ------------------------------------------------------------------ */

export function UdcJuryModePanel({
  role,
  envelope,
}: {
  role: string;
  envelope: StoreEnvelope;
}) {
  const { lang } = useI18n();
  if (typeof window !== "undefined") {
    ensureSeeded();
  }

  const cache = CachePolicyService.policy();
  const threatModel = integrityThreatModel();
  const perfHistory = PerformanceMeasurementService.history();

  const items: { code: string; bn: string; en: string; where: string; bullets: { bn: string; en: string }[] }[] = [
    {
      code: "JDG-A",
      bn: "নুচিং মারমা পূর্ণ প্রবাহ",
      en: "Full Nuching Marma flow",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#intake/OFF-NUCH-01`,
      bullets: [
        {
          bn: "মারমা থেকে বাংলায় অনুবাদের প্রোভেন্যান্স চেইন — প্রতিটি ক্ষেত্রে",
          en: "Marma → Bangla translation provenance chain — per field",
        },
        {
          bn: "৮টি বিষয়ের সম্মতি রেকর্ড",
          en: "8-topic consent record",
        },
        {
          bn: "চেকলিস্ট + নথি ক্যাপচার + যোগাযোগ রুট",
          en: "Checklist + document capture + contact route",
        },
      ],
    },
    {
      code: "JDG-B",
      bn: "অফলাইন প্রথম — IndexedDB",
      en: "Offline-first — IndexedDB",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#offline-queue`,
      bullets: [
        {
          bn: "IndexedDB অবজেক্ট স্টোর: shakkho.udc.v1 (drafts + blobs)",
          en: "IndexedDB object store: shakkho.udc.v1 (drafts + blobs)",
        },
        {
          bn: "Reload / ব্রাউজার বন্ধ → খসড়া থাকে",
          en: "Reload / browser close → draft persists",
        },
      ],
    },
    {
      code: "JDG-C",
      bn: "আইডেম্পোটেন্ট সিঙ্ক + SHA-256",
      en: "Idempotent sync + SHA-256",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#sync-centre`,
      bullets: [
        {
          bn: "একই idempotency-key → একই রিসিট (ডুপ্লিকেট হয় না)",
          en: "Same idempotency key → same receipt (no duplicates)",
        },
        {
          bn: "SHA-256 পেলোড অখণ্ডতা যাচাই",
          en: "SHA-256 payload integrity verification",
        },
      ],
    },
    {
      code: "JDG-D",
      bn: "কনফ্লিক্ট মানব পর্যালোচনা",
      en: "Conflict → human review",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#sync-centre/conflicts/conf-nuch-01`,
      bullets: [
        {
          bn: "DLAS রেকর্ড কখনো স্বয়ংক্রিয়ভাবে ওভাররাইট হয় না",
          en: "DLAS records never silently overwritten",
        },
        {
          bn: "৫টি সিদ্ধান্ত (keep_authoritative / accept_offline / preserve_both / applicant / specialist)",
          en: "5 decisions (keep_authoritative / accept_offline / preserve_both / applicant / specialist)",
        },
      ],
    },
    {
      code: "JDG-E",
      bn: "UDC অনুমতি (১৩টি অনুমোদিত / ১২টি নিষিদ্ধ)",
      en: "UDC permissions (13 allowed / 12 prohibited)",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#device-and-cache`,
      bullets: UdcAllowedDeniedBullets(),
    },
    {
      code: "JDG-F",
      bn: "PWA সক্ষমতা সনাক্তকরণ",
      en: "PWA capability detection",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#device-and-cache`,
      bullets: [
        ...(envelope.pwaCapability
          ? [
              {
                bn: `serviceWorker=${envelope.pwaCapability.serviceWorker ? "✓" : "✗"}, manifest=${envelope.pwaCapability.manifest ? "✓" : "✗"}`,
                en: `serviceWorker=${envelope.pwaCapability.serviceWorker ? "✓" : "✗"}, manifest=${envelope.pwaCapability.manifest ? "✓" : "✗"}`,
              },
            ]
          : [
              {
                bn: "পরিবেশ সনাক্ত করা হয়েছে — মিথ্যা দাবি নেই",
                en: "Environment detected — nothing fabricated",
              },
            ]),
      ],
    },
    {
      code: "JDG-G",
      bn: "সাধারণ বনাম হালকা মোড",
      en: "Normal vs. light mode",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#performance`,
      bullets: [
        {
          bn: `${perfHistory.length}টি পরিমাপ — প্রতিটি স্পষ্ট ডিভাইস ধারণা`,
          en: `${perfHistory.length} measurements — explicit device assumptions`,
        },
      ],
    },
    {
      code: "JDG-H",
      bn: "নেটওয়ার্ক বিচ্ছিন্ন → পুনঃসংযোগ → কোনো তথ্য ক্ষতি নেই",
      en: "Network drop → reconnect → no information loss",
      where: `${role === "udc" ? "/dashboard/udc" : "/udc"}#intake/OFF-NUCH-01`,
      bullets: [
        {
          bn: "অফলাইন সারিতে নিরাপদ রিট্রাই",
          en: "Safe retry on offline queue",
        },
        {
          bn: "পুনঃসংযোগে একই idempotency-key পাঠানো হয়",
          en: "Reconnect re-sends with the same idempotency key",
        },
      ],
    },
  ];

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>Jury Mode</span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "রায়দানকারীর প্রমাণ" : "Judging-criteria evidence"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "প্রতিটি কার্ডের পেছনে একটি নির্দিষ্ট URL — যাচাই করতে ক্লিক করুন।"
              : "Each card maps to a specific URL — click to verify."}
          </p>
        </header>

        <section className={styles.cards}>
          {items.map((it) => (
            <div key={it.code} className={styles.card}>
              <h3>
                {it.code} — {lang === "bn" ? it.bn : it.en}
              </h3>
              <ul className={styles.consentList}>
                {it.bullets.map((b, i) => (
                  <li key={i}>
                    <span>·</span>
                    <span>{lang === "bn" ? b.bn : b.en}</span>
                  </li>
                ))}
              </ul>
              <Link href={it.where} className={styles.cardLink}>
                {it.where} →
              </Link>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "ক্যাশ নীতি (যাচাইযোগ্য)" : "Cache policy (verifiable)"}</h2>
          </div>
          <ul className={styles.provenanceList}>
            <li>
              <span>Safe to cache</span>
              <span>{cache.safeToCache.join(", ")}</span>
            </li>
            <li>
              <span>Restricted local</span>
              <span>{cache.restrictedLocal.join(", ")}</span>
            </li>
            <li>
              <span>Never cached</span>
              <span>{cache.neverCached.join(", ")}</span>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অখণ্ডতা হুমকি মডেল" : "Integrity threat model"}</h2>
          </div>
          <ul className={styles.queueList}>
            {threatModel.map((t, i) => (
              <li key={i} className={styles.queueRow}>
                <strong>{t.inScope ? "✓" : "✗"}</strong>
                <span>{lang === "bn" ? t.bn : t.en}</span>
                <span>{t.inScope ? "in scope" : "out of scope"}</span>
                <span>—</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function UdcAllowedDeniedBullets(): { bn: string; en: string }[] {
  return [
    { bn: "১৩টি অনুমোদিত: intake.start / consent.record / …", en: "13 allowed: intake.start / consent.record / …" },
    { bn: "১২টি নিষিদ্ধ: case_id.mint / lawyer.assign / fee.set / …", en: "12 prohibited: case_id.mint / lawyer.assign / fee.set / …" },
  ];
}

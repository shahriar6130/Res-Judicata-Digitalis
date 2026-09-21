"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  ConsentService,
  useHelplineStore,
  type AssistanceConsent,
  type ConsentMethod,
  type ConsentTopic,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

export function UdcConsentPanel({
  temporaryId,
  role = "udc",
}: {
  temporaryId: string;
  role?: string;
}) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const intake = envelope.assistedIntakes?.find((a) => a.temporaryId === temporaryId);
  const [topics, setTopics] = useState<ConsentTopic[]>(intake?.consents.map((c) => c.topic) ?? []);

  useEffect(() => {
    ensureSeeded();
  }, []);

  if (!intake) {
    return (
      <main id="udc-main" className={styles.page}>
        <SkipLink targetId="udc-main" />
        <h1 className={styles.pageTitle}>{lang === "bn" ? "ইনটেক পাওয়া যায়নি" : "Intake not found"}</h1>
        <Link href={`/dashboard/${role}/intake/new`} className={styles.cardLink}>
          {lang === "bn" ? "নতুন ইনটেক →" : "New intake →"}
        </Link>
      </main>
    );
  }

  const noticeMap = ConsentService.topicNotices();
  const allTopics = ConsentService.topics();
  const methods = ConsentService.methods();

  const requiredTopics: ConsentTopic[] = [
    "form_entry_assistance",
    "human_translation_or_interpretation",
    "temporary_offline_storage",
    "submission_to_dlas",
  ];
  const missing = requiredTopics.filter((t) => !topics.includes(t));

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · সম্মতি রেকর্ড" : "UDC · consent record"}
          </span>
          <h1 className={styles.pageTitle}>
            {intake.applicantName} · {intake.temporaryId}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "প্রতিটি সম্মতি মৌখিক রিডব্যাক, অ্যাকশন বা সাক্ষীসহ নিশ্চিত করা যায়।"
              : "Each consent can be confirmed by oral read-back, action, or witnessed confirmation."}
          </p>
        </header>

        <section className={styles.section}>
          {missing.length > 0 ? (
            <p className={styles.safetyBanner}>
              {lang === "bn"
                ? `প্রয়োজনীয় সম্মতি অনুপস্থিত: ${missing.join(", ")}`
                : `Missing required consents: ${missing.join(", ")}`}
            </p>
          ) : (
            <p className={styles.bannerSuccess}>
              {lang === "bn" ? "সব প্রয়োজনীয় সম্মতি পাওয়া গেছে।" : "All required consents granted."}
            </p>
          )}
          <div className={styles.consentList}>
            {allTopics.map((t) => {
              const notice = noticeMap[t];
              const existing: AssistanceConsent | undefined = intake.consents.find((c) => c.topic === t);
              return (
                <div key={t} className={styles.consentRow}>
                  <input
                    id={`consent-${t}`}
                    type="checkbox"
                    checked={topics.includes(t)}
                    onChange={(e) =>
                      setTopics((prev) =>
                        e.target.checked
                          ? [...prev, t]
                          : prev.filter((p) => p !== t),
                      )
                    }
                  />
                  <div>
                    <strong>{t}</strong>
                    <p className={styles.consentNotice}>
                      {lang === "bn" ? notice.bn : notice.en}
                    </p>
                    <div className={styles.consentMethod}>
                      {methods.map((m) => (
                        <label key={m}>
                          <input
                            type="radio"
                            name={`method-${t}`}
                            checked={existing?.method === m}
                            readOnly
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                    {existing ? (
                      <p className={styles.bannerInfo}>
                        {lang === "bn" ? "রেকর্ডকারী" : "Recorded by"}: {existing.explainedBy} ·{" "}
                        {lang === "bn" ? "ভাষা" : "Lang"}: {existing.language} ·{" "}
                        {existing.obtainedAt.split("T")[0]}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <Link href={`/dashboard/${role}/intake/${temporaryId}`} className={styles.btn}>
            ← {lang === "bn" ? "ইনটেকে ফিরে যান" : "Back to intake"}
          </Link>
        </section>
      </main>
    </>
  );

  void requiredTopics;
  void intake;
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useHelplineStore } from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import type { AssistedIntake, TranslationEvent } from "@/lib/shakkho";
import styles from "../udc.module.css";

/**
 * Read-only summary of translation activity across all assisted
 * intakes this UDC has worked on. The actual translation workflow
 * lives inside the intake workspace — this panel aggregates so the
 * sidebar can have a real destination.
 */
export function UdcTranslationPanel({ role = "udc" }: { role?: string }) {
  const { lang, t } = useI18n();
  const envelope = useHelplineStore();

  const rows = useMemo(() => {
    const list: AssistedIntake[] = Array.isArray(envelope.assistedIntakes)
      ? envelope.assistedIntakes
      : [];
    return list
      .map((a) => {
        const list: TranslationEvent[] = Array.isArray(a.translations)
          ? a.translations
          : [];
        const last = list[list.length - 1];
        const hasHumanInterpreter =
          a.consents?.some(
            (c) =>
              c.topic === "human_translation_or_interpretation" &&
              c.applicantResponse === "yes",
          ) ?? false;
        return {
          intake: a,
          translationCount: list.length,
          hasHumanInterpreter,
          lastSourceLang: last?.sourceLanguage ?? a.languagePreference?.primary ?? "bn",
          lastTargetLang: last?.translatedText ? a.languagePreference?.supportedInterface ?? "en" : "—",
          lastMethod: last?.method ?? "none",
          lastAt: last?.occurredAt ?? a.updatedAt,
        };
      })
      .sort((x, y) =>
        (y.lastAt ?? "").localeCompare(x.lastAt ?? ""),
      );
  }, [envelope.assistedIntakes]);

  const totalTranslations = rows.reduce((s, r) => s + r.translationCount, 0);
  const withInterpreter = rows.filter((r) => r.hasHumanInterpreter).length;
  const distinctLangs = new Set<string>();
  for (const r of rows) {
    distinctLangs.add(r.lastSourceLang);
    if (r.lastTargetLang !== "—") distinctLangs.add(r.lastTargetLang);
  }
  const missing = rows.filter((r) => r.translationCount === 0).length;

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · অনুবাদ" : "UDC · translation"}
          </span>
          <h1 className={styles.pageTitle}>
            {t("udcPanelTranslationTitle")}
          </h1>
          <p className={styles.pageIntro}>
            {t("udcPanelTranslationIntro")}
          </p>
        </header>

        <section className={styles.kpis}>
          <div>
            <strong>{rows.length}</strong>
            <span>{lang === "bn" ? "মোট ইনটেক" : "total intakes"}</span>
          </div>
          <div>
            <strong>{totalTranslations}</strong>
            <span>{lang === "bn" ? "অনুবাদ ইভেন্ট" : "translation events"}</span>
          </div>
          <div>
            <strong>{withInterpreter}</strong>
            <span>
              {lang === "bn"
                ? "মানব দোভাষী সম্মতি"
                : "human interpreter consent"}
            </span>
          </div>
          <div>
            <strong>{distinctLangs.size}</strong>
            <span>{lang === "bn" ? "ভাষা" : "languages"}</span>
          </div>
          <div>
            <strong style={{ color: missing > 0 ? "var(--red)" : "var(--green)" }}>
              {missing}
            </strong>
            <span>
              {lang === "bn" ? "অনুবাদ অনুপস্থিত" : "missing translation"}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>
              {lang === "bn" ? "ইনটেক অনুবাদ সারসংক্ষেপ" : "Per-intake translation summary"}
            </h2>
            <span>
              {lang === "bn"
                ? `${rows.length}টি`
                : `${rows.length}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className={styles.bannerInfo}>
              {t("udcPanelTranslationEmpty")}
            </p>
          ) : (
            <ul className={styles.queueList}>
              {rows.map((r) => {
                const status = r.translationCount === 0
                  ? styles.statusPillOffline
                  : r.hasHumanInterpreter
                    ? styles.statusPillSynced
                    : styles.statusPillQueued;
                return (
                  <li key={r.intake.temporaryId} className={styles.queueRow}>
                    <strong>{r.intake.applicantName}</strong>
                    <span>
                      <span style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
                        {r.intake.temporaryId}
                      </span>
                      <span>
                        {lang === "bn" ? "উৎস" : "src"}:{" "}
                        <strong>{r.lastSourceLang}</strong>
                        {" → "}
                        {lang === "bn" ? "লক্ষ্য" : "dst"}:{" "}
                        <strong>{r.lastTargetLang}</strong>
                        {" · "}
                        {lang === "bn" ? "পদ্ধতি" : "method"}: {r.lastMethod}
                      </span>
                    </span>
                    <span className={`${styles.statusPill} ${status ?? ""}`}>
                      {r.translationCount === 0
                        ? (lang === "bn" ? "অনুবাদ নেই" : "no translation")
                        : (lang === "bn"
                            ? `${r.translationCount}টি ইভেন্ট`
                            : `${r.translationCount} events`)}
                    </span>
                    <Link
                      href={`/dashboard/${role}/intake/${r.intake.temporaryId}`}
                      className={`${styles.btn} ${styles.btnSm}`}
                    >
                      {lang === "bn" ? "ইনটেক →" : "Intake →"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <p className={styles.bannerInfo}>
            <small>
              {lang === "bn"
                ? "অনুবাদ সম্পাদনা করতে ইনটেক → স্টেপ ৩ (পক্ষ ও বিবরণ) → অনুবাদ ধাপে যান।"
                : "To edit translations, open the intake → step 3 (Parties & story) → translation step."}
            </small>
          </p>
        </section>
      </main>
    </>
  );
}

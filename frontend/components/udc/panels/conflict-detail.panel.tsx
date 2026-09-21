"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  ConflictResolutionService,
  type ConflictDecision,
  type SyncConflict,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

const DECISIONS: { value: ConflictDecision; bn: string; en: string }[] = [
  { value: "keep_authoritative_value", bn: "DLAS-এর মান রাখুন", en: "Keep authoritative value" },
  { value: "accept_offline_value", bn: "অফলাইন মান গ্রহণ", en: "Accept offline value" },
  { value: "preserve_both_as_separate_facts", bn: "উভয় আলাদা তথ্য হিসেবে রাখুন", en: "Preserve both as separate facts" },
  { value: "request_applicant_confirmation", bn: "আবেদনকারীর নিশ্চিতকরণ চান", en: "Request applicant confirmation" },
  { value: "defer_for_specialist_review", bn: "বিশেষজ্ঞ পর্যালোচনা", en: "Defer for specialist review" },
];

export function UdcConflictDetailPanel({
  conflictId,
  role = "udc",
}: {
  conflictId: string;
  role?: string;
}) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const conflict: SyncConflict | undefined = envelope.syncConflicts?.find((c) => c.id === conflictId);
  const [decision, setDecision] = useState<ConflictDecision>("defer_for_specialist_review");
  const [reason, setReason] = useState("");
  const [resulting, setResulting] = useState("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  if (!conflict) {
    return (
      <main id="udc-main" className={styles.page}>
        <SkipLink targetId="udc-main" />
        <h1 className={styles.pageTitle}>{lang === "bn" ? "কনফ্লিক্ট পাওয়া যায়নি" : "Conflict not found"}</h1>
        <p className={styles.bannerInfo}>
          <Link href={`/dashboard/${role}/sync-centre`}>
            {lang === "bn" ? "← সিঙ্ক সেন্টারে ফিরে যান" : "← Back to sync centre"}
          </Link>
        </p>
      </main>
    );
  }

  function apply() {
    ConflictResolutionService.applyResolution({
      conflictId: conflict!.id,
      reviewer: "case_support",
      decision,
      reason: { bn: reason, en: reason },
      resultingValue: resulting || undefined,
    });
  }

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · কনফ্লিক্ট পর্যালোচনা" : "UDC · conflict review"}
          </span>
          <h1 className={styles.pageTitle}>{conflict.id}</h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "এই সিদ্ধান্তটি সরাসরি DLAS রেকর্ডে প্রয়োগ হবে — UDC নিজে সিদ্ধান্ত নিতে পারে না।"
              : "This decision applies to the DLAS record — the UDC cannot decide unilaterally."}
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "কনফ্লিক্টের বিবরণ" : "Conflict detail"}</h2>
          </div>
          <ul className={styles.provenanceList}>
            <li>
              <span>temporaryId</span>
              <span>{conflict.temporaryId}</span>
            </li>
            <li>
              <span>kind</span>
              <span>{conflict.kind}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "ক্ষেত্র" : "field"}</span>
              <span>{conflict.fieldOrObject}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "সার্ভার সংস্করণ" : "base version"}</span>
              <span>{conflict.baseVersion}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "DLAS মান" : "DLAS value"}</span>
              <span>{conflict.authoritativeValue}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "DLAS উৎস" : "DLAS actor"}</span>
              <span>{conflict.authoritativeActor}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "অফলাইন মান" : "Offline value"}</span>
              <span>{conflict.offlineValue}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "অফলাইন উৎস" : "Offline actor"}</span>
              <span>{conflict.offlineActor}</span>
            </li>
          </ul>
          {conflict.safetyImplications ? (
            <p className={styles.safetyBanner}>
              <strong>{lang === "bn" ? "নিরাপত্তা প্রভাব:" : "Safety implications:"}</strong>{" "}
              {lang === "bn" ? conflict.safetyImplications.bn : conflict.safetyImplications.en}
            </p>
          ) : null}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "পর্যালোচকের সিদ্ধান্ত" : "Reviewer decision"}</h2>
            <span className={styles.statusPill}>
              {conflict.resolution ? "resolved" : "pending"}
            </span>
          </div>
          <div className={styles.fieldGrid}>
            <label htmlFor="conf-decision">{lang === "bn" ? "সিদ্ধান্ত" : "Decision"}</label>
            <select
              id="conf-decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value as ConflictDecision)}
            >
              {DECISIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {lang === "bn" ? d.bn : d.en}
                </option>
              ))}
            </select>
            <span></span>

            <label htmlFor="conf-resulting">{lang === "bn" ? "ফলাফল মান" : "Resulting value"}</label>
            <input
              id="conf-resulting"
              type="text"
              value={resulting}
              onChange={(e) => setResulting(e.target.value)}
            />
            <span></span>

            <label htmlFor="conf-reason">{lang === "bn" ? "কারণ" : "Reason"}</label>
            <textarea
              id="conf-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <span></span>
          </div>
          <div className={styles.btnRow}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={apply}>
              {lang === "bn" ? "সিদ্ধান্ত প্রয়োগ করুন" : "Apply decision"}
            </button>
            <Link href={`/dashboard/${role}/sync-centre`} className={styles.btn}>
              {lang === "bn" ? "ফিরে যান" : "Back"}
            </Link>
          </div>
          {conflict.resolution ? (
            <p className={styles.bannerSuccess}>
              {lang === "bn" ? "সিদ্ধান্ত:" : "Decision:"} {conflict.resolution.decision} ·{" "}
              {lang === "bn"
                ? conflict.resolution.reason.bn
                : conflict.resolution.reason.en}
            </p>
          ) : null}
        </section>
      </main>
    </>
  );
}

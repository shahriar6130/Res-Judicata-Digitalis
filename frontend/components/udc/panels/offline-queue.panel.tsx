"use client";

import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  useOfflineStore,
  SyncQueueService,
  NetworkConditionService,
  CachePolicyService,
  type OfflineDraft,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

const STATUS_PILL: Record<OfflineDraft["syncStatus"], string> = {
  local_draft: styles.statusPillOffline,
  ready_to_submit: styles.statusPillQueued,
  queued_offline: styles.statusPillQueued,
  synchronizing: styles.statusPillSynced,
  synced: styles.statusPillSynced,
  retry_scheduled: styles.statusPillQueued,
  conflict_detected: styles.statusPillConflict,
  manual_review_required: styles.statusPillConflict,
  integrity_review_required: styles.statusPillIntegrity,
  sync_failed_safely: styles.statusPillIntegrity,
};

export function UdcOfflineQueuePanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const offline = useOfflineStore();
  const drafts: OfflineDraft[] = (Array.isArray(offline.drafts) && offline.drafts.length)
    ? offline.drafts
    : (Array.isArray(envelope.offlineDrafts) ? envelope.offlineDrafts : []);
  const policy = CachePolicyService.policy();

  if (typeof window !== "undefined") {
    ensureSeeded();
  }

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · অফলাইন সারি" : "UDC · offline queue"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "স্থানীয় খসড়া" : "Local drafts"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "IndexedDB-তে সংরক্ষিত খসড়া — ব্রাউজার বন্ধ হলেও থাকবে।"
              : "Drafts live in IndexedDB — they survive browser restarts."}
          </p>
        </header>

        <section className={styles.section}>
          <ul className={styles.queueList}>
            {drafts.map((d) => (
              <li key={d.temporaryId} className={styles.queueRow}>
                <strong>{d.temporaryId}</strong>
                <span>
                  {d.confirmedFields.length} fields · idempotency {d.idempotencyKey.slice(0, 18)}…
                </span>
                <span className={`${styles.statusPill} ${STATUS_PILL[d.syncStatus] ?? ""}`}>
                  {d.syncStatus}
                </span>
                <Link href={`/dashboard/${role}/intake/${d.temporaryId}`}>
                  {lang === "bn" ? "খুলুন" : "Open"}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সিঙ্ক ম্যানুয়াল ট্রিগার" : "Manual sync trigger"}</h2>
          </div>
          <div className={styles.btnRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                const list = Array.isArray(drafts) ? drafts : [];
                for (const d of list) {
                  void SyncQueueService.tryDrain(d.temporaryId);
                }
              }}
            >
              {lang === "bn" ? "সব ড্রেইন করুন" : "Drain all"}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => NetworkConditionService.setProfile("offline")}
            >
              {lang === "bn" ? "অফলাইন সেট করুন" : "Set offline"}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => NetworkConditionService.setProfile("normal")}
            >
              {lang === "bn" ? "সাধারণ সেট করুন" : "Set normal"}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "ক্যাশ নীতি (সারসংক্ষেপ)" : "Cache policy (summary)"}</h2>
          </div>
          <ul className={styles.provenanceList}>
            <li>
              <span>{lang === "bn" ? "নিরাপদে ক্যাশযোগ্য" : "Safe to cache"}</span>
              <span>{policy.safeToCache.join(" · ")}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "স্থানীয় সীমিত" : "Restricted local"}</span>
              <span>{policy.restrictedLocal.join(" · ")}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "কখনো ক্যাশ হবে না" : "Never cached"}</span>
              <span>{policy.neverCached.join(" · ")}</span>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  useOfflineStore,
  OfflineStore,
  SyncQueueService,
  SimulatedDlasServer,
  ConflictResolutionService,
  NetworkConditionService,
  type OfflineDraft,
  type SyncConflict,
  type IntegrityVerification,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { NetworkBar } from "../primitives/network-bar";
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

export function UdcSyncCentrePanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const offline = useOfflineStore();
  const drafts: OfflineDraft[] = offline.drafts?.length
    ? offline.drafts
    : envelope.offlineDrafts ?? [];
  const conflicts: SyncConflict[] = envelope.syncConflicts ?? [];
  const integrity: IntegrityVerification[] = envelope.integrityVerifications ?? [];

  const [filter, setFilter] = useState<"all" | "queued" | "synced" | "conflict">("all");
  const [draftsState, setDraftsState] = useState(drafts);

  useEffect(() => {
    setDraftsState(drafts);
  }, [drafts]);

  useEffect(() => {
    ensureSeeded();
  }, []);

  async function refresh() {
    const list = await OfflineStore.list();
    setDraftsState(list);
  }

  async function drain(temporaryId: string) {
    await SyncQueueService.tryDrain(temporaryId);
    await refresh();
  }

  async function seedAndDetect(temporaryId: string) {
    SimulatedDlasServer.__seedConflict(temporaryId, "২০২৬-০৭-১২", "dlao_field_verification");
    const draft = await OfflineStore.get(temporaryId);
    if (draft) {
      ConflictResolutionService.detectForDraft(draft);
    }
  }

  const visibleDrafts = draftsState.filter((d) => {
    if (filter === "all") return true;
    if (filter === "queued") return d.syncStatus === "queued_offline" || d.syncStatus === "retry_scheduled";
    if (filter === "synced") return d.syncStatus === "synced";
    if (filter === "conflict") return d.syncStatus === "conflict_detected";
    return true;
  });

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · সিঙ্ক সেন্টার" : "UDC · sync centre"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "আইডেম্পোটেন্ট সিঙ্ক সারি" : "Idempotent sync queue"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "প্রতিটি খসড়ায় একটি স্থিতিশীল idempotency-key; SHA-256 দিয়ে পেলোড অখণ্ডতা যাচাই।"
              : "Every draft carries a stable idempotency key; SHA-256 verifies payload integrity."}
          </p>
          <NetworkBar lang={lang} />
          <div className={styles.tabs}>
            {(["all", "queued", "synced", "conflict"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? styles.active : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            <button type="button" onClick={refresh}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </button>
          </div>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সারি" : "Queue"}</h2>
            <span>
              {lang === "bn" ? `${visibleDrafts.length}টি দৃশ্যমান` : `${visibleDrafts.length} visible`}
            </span>
          </div>
          <ul className={styles.queueList}>
            {visibleDrafts.map((d) => (
              <li key={d.temporaryId} className={styles.queueRow}>
                <strong>{d.temporaryId}</strong>
                <span>
                  {d.confirmedFields.length} fields · idempotency: {d.idempotencyKey.slice(0, 18)}…
                </span>
                <span className={`${styles.statusPill} ${STATUS_PILL[d.syncStatus] ?? ""}`}>
                  {d.syncStatus}
                </span>
                <span>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSm}`}
                    onClick={() => drain(d.temporaryId)}
                  >
                    {lang === "bn" ? "ড্রেইন" : "Drain"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "কনফ্লিক্ট" : "Conflicts"}</h2>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() => seedAndDetect("OFF-NUCH-01")}
            >
              {lang === "bn" ? "Nuching কনফ্লিক্ট সিমুলেট করুন" : "Simulate Nuching conflict"}
            </button>
          </div>
          <ul className={styles.queueList}>
            {conflicts.map((c) => (
              <li key={c.id} className={styles.queueRow}>
                <strong>{c.id}</strong>
                <span>
                  {c.fieldOrObject} · authoritative: <em>{c.authoritativeValue}</em> · offline:{" "}
                  <em>{c.offlineValue}</em>
                </span>
                <span className={`${styles.statusPill} ${c.resolution ? styles.statusPillSynced : styles.statusPillConflict}`}>
                  {c.resolution ? c.resolution.decision : "needs review"}
                </span>
                <Link href={`/dashboard/${role}/sync-centre/conflicts/${c.id}`}>
                  {lang === "bn" ? "খুলুন" : "Open"}
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.bannerInfo}>
            {lang === "bn"
              ? "কনফ্লিক্ট থাকলে DLAS রেকর্ড পরিবর্তন হয় না — মানব পর্যালোচনা ছাড়া।"
              : "When a conflict is detected, the DLAS record is never overwritten without human review."}
          </p>
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
                  {i.submittedDigest.slice(0, 18)}… → {i.acknowledgedDigest.slice(0, 18)}…
                </span>
                <span
                  className={`${styles.statusPill} ${
                    i.result === "pass" ? styles.statusPillSynced : styles.statusPillIntegrity
                  }`}
                >
                  {i.result}
                </span>
                <span>
                  {i.result === "pass"
                    ? lang === "bn" ? "অক্ষত" : "intact"
                    : lang === "bn" ? "পর্যালোচনা" : "review"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

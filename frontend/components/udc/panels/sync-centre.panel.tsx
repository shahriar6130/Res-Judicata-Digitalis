"use client";

import { useEffect, useMemo, useState } from "react";
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
  IntegrityVerificationService,
  type OfflineDraft,
  type SyncConflict,
  type IntegrityVerification,
  type NetworkProfile,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useNetwork, networkRowClass } from "../primitives/use-network";
import styles from "../udc.module.css";

/** Visual classification for the row background — driven by syncStatus *and* network. */
function rowStateClass(d: OfflineDraft, net: NetworkProfile): string {
  const ns = networkRowClass(net.kind);
  switch (d.syncStatus) {
    case "synchronizing":            return styles.queueRowSyncing!;
    case "synced":                   return styles.queueRowSynced!;
    case "conflict_detected":        return styles.queueRowConflict!;
    case "integrity_review_required":
    case "sync_failed_safely":       return styles.queueRowIntegrity!;
    case "queued_offline":
    case "ready_to_submit":
    case "retry_scheduled":          return styles.queueRowQueued!;
    default:                         return ns;
  }
}

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso.slice(11, 19);
  }
}

export function UdcSyncCentrePanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const offline = useOfflineStore();
  const net = useNetwork();
  const drafts: OfflineDraft[] = (Array.isArray(offline.drafts) && offline.drafts.length)
    ? offline.drafts
    : (Array.isArray(envelope.offlineDrafts) ? envelope.offlineDrafts : []);
  const conflicts: SyncConflict[] = envelope.syncConflicts ?? [];
  const integrity: IntegrityVerification[] = envelope.integrityVerifications ?? [];

  const [filter, setFilter] = useState<"all" | "queued" | "synced" | "conflict">("all");
  const [draftsState, setDraftsState] = useState<OfflineDraft[]>(drafts);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string>("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  // Sync draftsState from upstream store only when the actual content
  // changes (length or any temp id differs) — comparing the array
  // reference would loop, since `drafts` is rebuilt every render.
  useEffect(() => {
    setDraftsState((prev) => (sameDrafts(prev, drafts) ? prev : drafts));
  }, [drafts]);

  // Subscribe to live sync events to refresh the table.
  useEffect(() => {
    return SyncQueueService.subscribe(() => {
      void refresh();
    });
  }, []);

  async function refresh() {
    const list = await OfflineStore.list();
    setDraftsState(list);
  }

  async function drain(temporaryId: string) {
    setBusy(temporaryId);
    setLastEvent(`drain → ${temporaryId}`);
    try {
      await SyncQueueService.tryDrain(temporaryId);
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  async function drainAll() {
    setBusy("__all__");
    const list = Array.isArray(draftsState) ? draftsState : [];
    for (const d of list) {
      if (d.syncStatus !== "synced" && d.syncStatus !== "conflict_detected") {
        setLastEvent(`drainAll → ${d.temporaryId}`);
        await SyncQueueService.tryDrain(d.temporaryId);
      }
    }
    await refresh();
    setBusy(null);
  }

  async function seedAndDetect(temporaryId: string) {
    // SIMULATED: a DLAO field visit recorded a different incident date on the server.
    SimulatedDlasServer.__seedConflict(temporaryId, new Date().toISOString().slice(0, 10), "dlao_field_verification");
    const draft = await OfflineStore.get(temporaryId);
    if (draft) {
      ConflictResolutionService.detectForDraft(draft);
    }
    await refresh();
    setLastEvent(`conflict seeded → ${temporaryId}`);
  }

  async function runIntegrityCheck(temporaryId: string) {
    const draft = await OfflineStore.get(temporaryId);
    if (!draft) return;
    const d = await IntegrityVerificationService.digestDraft(draft);
    setLastEvent(`integrity digest → ${d.hex.slice(0, 18)}…`);
  }

  // Latest real draft (not a keystroke auto-save scratch copy) to run the conflict simulator on.
  const latestRealDraft = (Array.isArray(draftsState) ? draftsState : [])
    .filter((d) => !d.temporaryId.startsWith("OFF-NEW-"))
    .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""))[0]?.temporaryId;

  const counts = useMemo(() => {
    const list = Array.isArray(draftsState) ? draftsState : [];
    const c = { total: list.length, synced: 0, syncing: 0, queued: 0, conflict: 0, retry: 0 };
    for (const d of list) {
      if (d.syncStatus === "synced") c.synced += 1;
      else if (d.syncStatus === "synchronizing") c.syncing += 1;
      else if (d.syncStatus === "queued_offline" || d.syncStatus === "ready_to_submit") c.queued += 1;
      else if (d.syncStatus === "conflict_detected" || d.syncStatus === "manual_review_required") c.conflict += 1;
      else if (d.syncStatus === "retry_scheduled") c.retry += 1;
    }
    return c;
  }, [draftsState]);

  const visibleDrafts = draftsState.filter((d) => {
    if (filter === "all") return true;
    if (filter === "queued") return d.syncStatus === "queued_offline" || d.syncStatus === "retry_scheduled" || d.syncStatus === "ready_to_submit";
    if (filter === "synced") return d.syncStatus === "synced";
    if (filter === "conflict") return d.syncStatus === "conflict_detected" || d.syncStatus === "manual_review_required";
    return true;
  });

  // Build a banner summarizing the live network effect.
  const netEffect = (() => {
    if (net.kind === "offline")       return lang === "bn" ? "নেটওয়ার্ক বন্ধ — সারি আটকে আছে" : "Network offline — queue is held";
    if (net.kind === "intermittent")  return lang === "bn" ? "বিচ্ছিন্ন — পুনরায় চেষ্টা চলছে"  : "Intermittent — retrying";
    if (net.kind === "slow")          return lang === "bn" ? "ধীর নেটওয়ার্ক — উচ্চ লেটেন্সি" : "Slow network — high latency";
    if (net.kind === "reconnected")   return lang === "bn" ? "পুনঃসংযুক্ত — সারি ড্রেইন হচ্ছে" : "Reconnected — draining";
    return lang === "bn" ? "সাধারণ নেটওয়ার্ক" : "Normal network";
  })();

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

          <div className={styles.intakeBanner}>
            <strong>●</strong>
            <span>
              {lang === "bn" ? "লাইভ নেটওয়ার্ক প্রভাব:" : "Live network effect:"}{" "}
              <strong>{netEffect}</strong>
              {" · "}
              {lang === "bn" ? "লেটেন্সি" : "latency"} {net.latencyMs}ms
              {" · "}
              {lang === "bn" ? "প্যাকেট-লস" : "packet-loss"} {Math.round(net.packetLoss * 100)}%
              {" · "}
              {lang === "bn" ? "ব্যান্ডউইথ" : "bandwidth"} {Math.round(net.bandwidthBps / 1000)}kbps
            </span>
          </div>

          <div className={styles.tabs}>
            {(["all", "queued", "synced", "conflict"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? styles.active : ""}
                onClick={() => setFilter(f)}
              >
                {f} {f === "all" ? `(${counts.total})` : f === "queued" ? `(${counts.queued + counts.retry})` : f === "synced" ? `(${counts.synced})` : `(${counts.conflict})`}
              </button>
            ))}
            <button type="button" onClick={refresh}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={drainAll}
              disabled={busy !== null || counts.queued + counts.retry === 0}
            >
              {busy === "__all__"
                ? lang === "bn" ? "ড্রেইন হচ্ছে…" : "Draining…"
                : lang === "bn" ? "সব ড্রেইন করুন" : "Drain all"}
            </button>
          </div>

          {lastEvent && (
            <p className={styles.bannerInfo}>
              <small>{lang === "bn" ? "শেষ ঘটনা:" : "Last event:"} {lastEvent}</small>
            </p>
          )}
        </header>

        {/* Live summary tiles */}
        <section className={styles.kpis}>
          <div>
            <strong>{counts.total}</strong>
            <span>{lang === "bn" ? "মোট খসড়া" : "total drafts"}</span>
          </div>
          <div>
            <strong style={{ color: "var(--green)" }}>{counts.synced}</strong>
            <span>{lang === "bn" ? "সিঙ্ক হয়েছে" : "synced"}</span>
          </div>
          <div>
            <strong style={{ color: "#b8830b" }}>{counts.syncing}</strong>
            <span>{lang === "bn" ? "সিঙ্ক হচ্ছে" : "syncing"}</span>
          </div>
          <div>
            <strong style={{ color: "#3b82f6" }}>{counts.queued}</strong>
            <span>{lang === "bn" ? "সারিতে" : "queued"}</span>
          </div>
          <div>
            <strong style={{ color: "var(--red)" }}>{counts.conflict}</strong>
            <span>{lang === "bn" ? "কনফ্লিক্ট" : "conflict"}</span>
          </div>
          <div>
            <strong style={{ color: "var(--gray)" }}>{counts.retry}</strong>
            <span>{lang === "bn" ? "পুনঃচেষ্টা" : "retry"}</span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সারি" : "Queue"}</h2>
            <span>
              {lang === "bn" ? `${visibleDrafts.length}টি দৃশ্যমান` : `${visibleDrafts.length} visible`}
            </span>
          </div>
          <ul className={styles.queueList}>
            {visibleDrafts.map((d) => {
              const rowClass = rowStateClass(d, net);
              const progress =
                d.syncStatus === "synced" ? 100
                : d.syncStatus === "synchronizing" ? 60
                : d.syncStatus === "ready_to_submit" ? 20
                : d.syncStatus === "queued_offline" ? 10
                : d.syncStatus === "retry_scheduled" ? 30
                : d.syncStatus === "conflict_detected" ? 100
                : d.syncStatus === "integrity_review_required" ? 100
                : 0;
              return (
                <li key={d.temporaryId} className={`${styles.queueRow} ${rowClass}`}>
                  <strong>{d.temporaryId}</strong>
                  <span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>
                        {d.confirmedFields.length} {lang === "bn" ? "ক্ষেত্র নিশ্চিত" : "fields confirmed"} ·
                        {" "}
                        {lang === "bn" ? "idempotency" : "idempotency"}: {d.idempotencyKey.slice(0, 18)}…
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: "var(--t-label)", color: "var(--gray)" }}>
                        {lang === "bn" ? "ডাইজেস্ট" : "digest"}: {d.integrityDigest.slice(0, 24)}…
                        {d.authoritativeApplicationId && (
                          <>
                            {" · "}
                            <strong style={{ color: "var(--green)" }}>→ {d.authoritativeApplicationId}</strong>
                          </>
                        )}
                      </span>
                      {d.lastError && (
                        <span style={{ color: "var(--red)", fontSize: "var(--t-label)" }}>
                          {lang === "bn" ? "ত্রুটি" : "error"}: {d.lastError}
                        </span>
                      )}
                      <span style={{ fontFamily: "monospace", fontSize: "var(--t-label)" }}>
                        {fmtTime(d.lastModified)} · {lang === "bn" ? "পুনঃচেষ্টা" : "retries"}: {d.retryCount}
                      </span>
                      {/* Mini progress bar */}
                      <div style={{ position: "relative", height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          position: "absolute", left: 0, top: 0, bottom: 0,
                          width: `${progress}%`,
                          background: d.syncStatus === "synced" ? "var(--green)"
                                    : d.syncStatus === "conflict_detected" ? "var(--red)"
                                    : "#b8830b",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                    </div>
                  </span>
                  <span className={`${styles.statusPill} ${
                    d.syncStatus === "synced" ? styles.statusPillSynced :
                    d.syncStatus === "synchronizing" ? styles.statusPillUrgent :
                    d.syncStatus === "queued_offline" || d.syncStatus === "retry_scheduled" ? styles.statusPillQueued :
                    d.syncStatus === "conflict_detected" || d.syncStatus === "manual_review_required" ? styles.statusPillConflict :
                    d.syncStatus === "integrity_review_required" || d.syncStatus === "sync_failed_safely" ? styles.statusPillIntegrity :
                    styles.statusPillOffline
                  }`}>
                    {d.syncStatus}
                  </span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm}`}
                      onClick={() => drain(d.temporaryId)}
                      disabled={busy === d.temporaryId || d.syncStatus === "synced" || d.syncStatus === "synchronizing"}
                    >
                      {busy === d.temporaryId
                        ? (lang === "bn" ? "চলছে…" : "Working…")
                        : (lang === "bn" ? "ড্রেইন" : "Drain")}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm}`}
                      onClick={() => seedAndDetect(d.temporaryId)}
                      title={lang === "bn" ? "কনফ্লিক্ট সিমুলেট" : "Simulate conflict"}
                    >
                      ⚡
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm}`}
                      onClick={() => runIntegrityCheck(d.temporaryId)}
                      title={lang === "bn" ? "অখণ্ডতা যাচাই" : "Verify integrity"}
                    >
                      🔒
                    </button>
                  </span>
                </li>
              );
            })}
            {visibleDrafts.length === 0 && (
              <li className={styles.queueRow}>
                <span style={{ gridColumn: "1 / -1", color: "var(--gray)" }}>
                  {lang === "bn" ? "এই ফিল্টারে কোনো খসড়া নেই।" : "No drafts match this filter."}
                </span>
              </li>
            )}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "কনফ্লিক্ট" : "Conflicts"}</h2>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              disabled={!latestRealDraft}
              onClick={() => latestRealDraft && seedAndDetect(latestRealDraft)}
              title={latestRealDraft ?? ""}
            >
              {lang === "bn" ? "সর্বশেষ খসড়ায় কনফ্লিক্ট সিমুলেট করুন" : "Simulate a conflict on the latest draft"}
            </button>
          </div>
          <ul className={styles.queueList}>
            {conflicts.map((c) => (
              <li key={c.id} className={`${styles.queueRow} ${c.resolution ? styles.queueRowSynced : styles.queueRowConflict}`}>
                <strong>{c.id}</strong>
                <span>
                  {c.fieldOrObject} · {lang === "bn" ? "DLAS" : "DLAS"}: <em>{c.authoritativeValue}</em> · {lang === "bn" ? "অফলাইন" : "offline"}:{" "}
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
              <li key={i.id} className={`${styles.queueRow} ${i.result === "pass" ? styles.queueRowSynced : styles.queueRowIntegrity}`}>
                <strong>{i.temporaryId}</strong>
                <span style={{ fontFamily: "monospace", fontSize: "var(--t-label)" }}>
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

/** Cheap content equality check on OfflineDraft lists — compares
 *  length and a fingerprint per item (id + syncStatus + modified).
 *  Avoids the "new array every render" loop that breaks useEffect. */
function sameDrafts(a: OfflineDraft[], b: OfflineDraft[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.temporaryId !== y.temporaryId) return false;
    if (x.syncStatus !== y.syncStatus) return false;
    if (x.lastModified !== y.lastModified) return false;
  }
  return true;
}
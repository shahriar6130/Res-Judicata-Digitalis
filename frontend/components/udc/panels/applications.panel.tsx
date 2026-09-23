"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useOfflineStore,
  OfflineStore,
  type OfflineDraft,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useNetwork, networkRowClass } from "../primitives/use-network";
import styles from "../udc.module.css";
import { DISTRICTS, label, useCurrentUdcOperator, useDlasDb } from "@/lib/dlas";

interface Props {
  role?: string;
}

export function UdcApplicationsPanel({ role = "udc" }: Props) {
  const { lang } = useI18n();
  const offline = useOfflineStore();
  const net = useNetwork();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "synced" | "pending" | "conflict">("all");
  const [drafts, setDrafts] = useState<OfflineDraft[]>(
    Array.isArray(offline.drafts) ? offline.drafts : [],
  );

  useEffect(() => {
    ensureSeeded();
    void refresh();
  }, []);

  async function refresh() {
    try {
      const list = await OfflineStore.list();
      setDrafts(Array.isArray(list) ? list : []);
    } catch {
      setDrafts([]);
    }
  }

  const me = useCurrentUdcOperator();
  const db = useDlasDb();

  // Server-authorized search: case-insensitive match on tempId, appId, name,
  // but scoped to THIS UDC's assisted set.
  const rows = useMemo(() => {
    const map = new Map<string, {
      tempId: string;
      appId?: string;
      applicantName: string;
      status: string;
      syncStatus: OfflineDraft["syncStatus"];
      needsVerification: boolean;
      nextStep: string;
      district: string;
    }>();

    // Source of truth: this operator's sessions/applications in dlas.db.v1.
    // The offline store only contributes the live sync status of each draft.
    const draftList: OfflineDraft[] = Array.isArray(drafts) ? drafts : [];
    for (const sess of db.sessions) {
      if (sess.channel !== "UDC_ASSISTED" || sess.meta.operatorId !== me?.operatorId) continue;
      const tempId = sess.meta.clientRef ?? sess.sessionId;
      const draft = draftList.find((d) => d.temporaryId === tempId);
      const app = sess.applicationId ? db.applications.find((x) => x.applicationId === sess.applicationId) : undefined;
      const submitted = !!app;
      map.set(tempId, {
        tempId,
        appId: app?.applicationId,
        applicantName: sess.draft.applicant.fullName ?? "—",
        status: draft?.syncStatus === "conflict_detected" ? "conflict" : submitted ? "synced" : "pending",
        syncStatus: draft?.syncStatus ?? (submitted ? "synced" : "local_draft"),
        needsVerification: submitted,
        nextStep: submitted
          ? app!.validation.valid
            ? lang === "bn" ? "DLAO পর্যালোচনার অপেক্ষায়" : "awaiting DLAO review"
            : lang === "bn" ? "তথ্য অসম্পূর্ণ — DLAO ফলো-আপ" : "info missing — DLAO follow-up"
          : lang === "bn" ? "ইনটেক চলছে" : "intake in progress",
        district: label(DISTRICTS, sess.draft.applicant.district, lang),
      });
    }
    let list = [...map.values()];
    if (filter === "synced")   list = list.filter((r) => r.status === "synced");
    if (filter === "pending")  list = list.filter((r) => r.status === "pending");
    if (filter === "conflict") list = list.filter((r) => r.syncStatus === "conflict_detected");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        r.tempId.toLowerCase().includes(q) ||
        (r.appId ?? "").toLowerCase().includes(q) ||
        r.applicantName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [drafts, db, me, filter, search, lang]);

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · আবেদনসমূহ" : "UDC · applications"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "আপনার সহায়তা করা আবেদনগুলো" : "Applications you have assisted"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "শুধু এই UDC অ্যাকাউন্টে সহায়তা করা আবেদন দেখানো হয়। অন্য নাগরিকের আবেদন দেখা যাবে না।"
              : "Only applications assisted by this UDC account are shown. Other citizens' applications remain hidden."}
          </p>

          <div className={styles.fieldGrid}>
            <label htmlFor="app-search">{lang === "bn" ? "খুঁজুন" : "Search"}</label>
            <input
              id="app-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "bn" ? "আবেদন আইডি, অফলাইন রেফারেন্স, নাম" : "Application ID, offline ref, name"}
              className={search ? styles.fieldSaved : ""}
            />
            <small style={{ color: "var(--gray)" }}>
              {lang === "bn" ? "সার্ভার-অনুমোদিত, স্কোপ-ফিল্টার করা" : "Server-authorized, scope-filtered"}
            </small>
          </div>

          <div className={styles.tabs}>
            {(["all", "synced", "pending", "conflict"] as const).map((f) => (
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
            <h2>{lang === "bn" ? "ফলাফল" : "Results"}</h2>
            <span>
              {lang === "bn" ? `${rows.length}টি` : `${rows.length}`}
            </span>
          </div>
          <ul className={styles.queueList}>
            {rows.length === 0 && (
              <li className={styles.queueRow}>
                <span style={{ gridColumn: "1 / -1", color: "var(--gray)" }}>
                  {lang === "bn" ? "কোনো আবেদন পাওয়া যায়নি।" : "No applications match."}
                </span>
              </li>
            )}
            {rows.map((r) => {
              const isSynced = r.status === "synced";
              const isConflict = r.syncStatus === "conflict_detected";
              const rowState = isConflict
                ? styles.queueRowConflict
                : isSynced
                  ? styles.queueRowSynced
                  : `${styles.queueRowQueued} ${networkRowClass(net.kind)}`;
              return (
                <li key={r.tempId} className={`${styles.queueRow} ${rowState}`}>
                  <strong>
                    {r.appId ?? r.tempId}
                  </strong>
                  <span>
                    {r.applicantName} · {r.district} ·{" "}
                    <span style={{ color: "var(--gray)", fontSize: "var(--t-label)" }}>
                      {r.tempId}
                    </span>
                  </span>
                  <span className={`${styles.statusPill} ${
                    isConflict ? styles.statusPillConflict
                    : isSynced ? styles.statusPillSynced
                    : styles.statusPillQueued
                  }`}>
                    {r.status}
                  </span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {r.needsVerification && (
                      <em style={{ color: "var(--gray)", fontSize: "var(--t-label)" }}>
                        {lang === "bn" ? "যাচাই প্রয়োজন" : "verification required"}
                      </em>
                    )}
                    <Link href={`/dashboard/${role}/status-visit`} className={`${styles.btn} ${styles.btnSm}`}>
                      {lang === "bn" ? "পরিদর্শন →" : "Visit →"}
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.bannerInfo}>
            <small>
              {lang === "bn"
                ? "প্রতিটি সারি শুধু নিরাপদ শনাক্তকারী, বর্তমান অবস্থা ও পরবর্তী পদক্ষেপ দেখায়। বিস্তারিত দেখতে আবেদনকারীর নতুন প্রমাণীকরণ প্রয়োজন।"
                : "Each row shows only the safe identifier, current status, and next step. Detail view requires fresh applicant verification."}
            </small>
          </p>
        </section>
      </main>
    </>
  );
}
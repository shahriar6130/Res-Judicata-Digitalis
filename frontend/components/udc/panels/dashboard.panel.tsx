"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ensureSeeded,
  useHelplineStore,
  useOfflineStore,
  NetworkConditionService,
  PwaCapabilityService,
  CachePolicyService,
  type OfflineDraft,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";
import { useCurrentUdcOperator, useDlasDb, label, MATTERS } from "@/lib/dlas";

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

export function UdcDashboardPanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const offline = useOfflineStore();
  const me = useCurrentUdcOperator();
  const db = useDlasDb();
  // Everything below is this operator's own work in the shared record.
  const mySessions = db.sessions.filter((s) => s.channel === "UDC_ASSISTED" && s.meta.operatorId === me?.operatorId);
  const myApps = db.applications.filter((a) => a.channel.code === "UDC_ASSISTED" && a.data.filedBy.operatorId === me?.operatorId);
  const myOpenTasks = db.tasks.filter((t) => t.status !== "DONE" && myApps.some((a) => a.applicationId === t.applicationId));
  const latestTemp = [...mySessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.meta.clientRef;

  useEffect(() => {
    ensureSeeded();
    void PwaCapabilityService.refresh();
  }, []);

  const drafts: OfflineDraft[] = (Array.isArray(offline.drafts) && offline.drafts.length)
    ? offline.drafts
    : (Array.isArray(envelope.offlineDrafts) ? envelope.offlineDrafts : []);

  const conflicts = envelope.syncConflicts ?? [];
  const integrity = envelope.integrityVerifications ?? [];
  const intakes = envelope.assistedIntakes ?? [];
  const perf = envelope.performanceMeasurements ?? [];

  const counts = {
    local: drafts.filter((d) => d.syncStatus === "local_draft").length,
    queued: drafts.filter((d) => d.syncStatus === "queued_offline").length,
    synced: drafts.filter((d) => d.syncStatus === "synced").length,
    conflict: drafts.filter((d) => d.syncStatus === "conflict_detected").length,
  };

  const pwa = envelope.pwaCapability ?? PwaCapabilityService.snapshot();
  const cachePolicy = CachePolicyService.policy();
  const capabilitiesList = [
    { ok: pwa.serviceWorker, en: "Service worker", bn: "সার্ভিস ওয়ার্কার" },
    { ok: pwa.manifest, en: "Web app manifest", bn: "ম্যানিফেস্ট" },
    { ok: pwa.installPrompt, en: "Install prompt", bn: "ইনস্টল প্রম্পট" },
    { ok: pwa.standaloneDisplay, en: "Standalone display", bn: "স্ট্যান্ডঅ্যালোন মোড" },
  ];

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn"
              ? "ইউনিফাইড ডিজিটাল সেন্টার · উদ্যোক্তা"
              : "Unified Digital Centre · entrepreneur"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "UDC অপারেশন ড্যাশবোর্ড" : "UDC operations dashboard"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? `${me ? `${me.name} · ${me.centre}` : "লগইন করা হয়নি"} — সহায়-গ্রহণযোগ্য অন-অফলাইন আবেদন, সবকিছু একই DLAS রেকর্ডে।`
              : `${me ? `${me.name} · ${me.centre}` : "Not logged in"} — assisted applications on- and offline, all in the same DLAS record.`}
          </p>
        </header>

        {/* KPI strip */}
        <section className={styles.kpis}>
          <div>
            <strong>{counts.local}</strong>
            <span>{lang === "bn" ? "স্থানীয় খসড়া" : "Local drafts"}</span>
          </div>
          <div>
            <strong>{counts.queued}</strong>
            <span>{lang === "bn" ? "অপেক্ষমাণ সিঙ্ক" : "Queued sync"}</span>
          </div>
          <div>
            <strong>{counts.synced}</strong>
            <span>{lang === "bn" ? "সিঙ্ক সম্পন্ন" : "Synced"}</span>
          </div>
          <div>
            <strong>{counts.conflict + conflicts.filter((c) => !c.resolution).length}</strong>
            <span>{lang === "bn" ? "পর্যালোচনা প্রয়োজন" : "Needs review"}</span>
          </div>
          <div>
            <strong>{myApps.length}</strong>
            <span>{lang === "bn" ? "জমা দেওয়া আবেদন" : "Applications submitted"}</span>
          </div>
          <div>
            <strong>{myOpenTasks.length}</strong>
            <span>{lang === "bn" ? "চলমান কাজ (DLAO)" : "Open follow-ups (DLAO)"}</span>
          </div>
        </section>

        {/* This operator's applications in the shared record */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "আমার জমা দেওয়া আবেদন" : "My submitted applications"}</h2>
            <Link href="/debug" className={styles.cardLink}>/debug →</Link>
          </div>
          {myApps.length === 0 ? (
            <p className={styles.bannerInfo}>{lang === "bn" ? "এখনো কোনো আবেদন জমা হয়নি।" : "No applications submitted yet."}</p>
          ) : (
            <ul className={styles.queueList}>
              {[...myApps].reverse().map((a) => (
                <li key={a.applicationId} className={styles.queueRow}>
                  <strong>{a.applicationId}</strong>
                  <span>
                    {a.data.applicant.fullName ?? "—"} · {label(MATTERS, a.data.matter.category, lang)}
                    {a.validation.valid ? "" : lang === "bn" ? " · তথ্য অসম্পূর্ণ" : " · info missing"}
                  </span>
                  <span className={`${styles.statusPill} ${styles.statusPillSynced}`}>{a.status}</span>
                  <Link href={`/debug?id=${a.applicationId}`}>Open</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 9 operational cards */}
        <section className={styles.cards}>
          <Card
            title={lang === "bn" ? "নতুন সহায়-গ্রহণযোগ্য ইনটেক শুরু" : "Start new assisted intake"}
            desc={
              lang === "bn"
                ? "নতুন অফলাইন খসড়া শুরু করুন — প্রতিটি ধাপে প্রোভেন্যান্স ও সম্মতি সংরক্ষিত হবে।"
                : "Begin a new offline draft — every step records provenance and consent."
            }
            href={`/dashboard/${role}/intake/new`}
          />
          <Card
            title={lang === "bn" ? "চলমান খসড়া পুনরায় চালু" : "Resume an in-progress draft"}
            desc={
              lang === "bn"
                ? "স্থানীয়ভাবে সংরক্ষিত খসড়া পুনরায় খুলুন — স্বয়ংক্রিয়ভাবে সংরক্ষিত অবস্থায়।"
                : "Reopen a locally stored draft — state is auto-restored from IndexedDB."
            }
            href={`/dashboard/${role}/offline-queue`}
          />
          <Card
            title={lang === "bn" ? "সম্মতি রেকর্ড" : "Consent record"}
            desc={
              lang === "bn"
                ? "৮টি বিষয়ের সম্মতি — মৌখিক রিডব্যাক, প্রত্যক্ষ অ্যাকশন, বা সাক্ষীসহ নিশ্চিত।"
                : "8 consent topics — oral read-back, direct action, or witnessed confirmation."
            }
            href={latestTemp ? `/dashboard/${role}/intake/${latestTemp}/consent` : `/dashboard/${role}/intake/new`}
          />
          <Card
            title={lang === "bn" ? "নথি ক্যাপচার ও মান পরীক্ষা" : "Document capture + quality"}
            desc={
              lang === "bn"
                ? "১০টি মান-পরীক্ষা কোড — ব্লকিং সমস্যা হলে আবার তোলা আবশ্যক।"
                : "10 quality codes — blocking issues must be retaken before upload."
            }
            href={latestTemp ? `/dashboard/${role}/intake/${latestTemp}/documents` : `/dashboard/${role}/intake/new`}
          />
          <Card
            title={lang === "bn" ? "অনুবাদ প্রোভেন্যান্স" : "Translation provenance"}
            desc={
              lang === "bn"
                ? "প্রতিটি ক্ষেত্রে বক্তা, অনুবাদক, টাইপকারী ও নিশ্চিতকারীর চেইন।"
                : "Chain of speaker, interpreter, typist, and confirmer for every field."
            }
            href={latestTemp ? `/dashboard/${role}/intake/${latestTemp}` : `/dashboard/${role}/intake/new`}
          />
          <Card
            title={lang === "bn" ? "সিঙ্ক সেন্টার" : "Sync centre"}
            desc={
              lang === "bn"
                ? `${counts.queued}টি সারি — আইডেম্পোটেন্সি-কী দিয়ে নিরাপদ রিট্রাই।`
                : `${counts.queued} queued — safe retries via idempotency key.`
            }
            href={`/dashboard/${role}/sync-centre`}
          />
          <Card
            title={lang === "bn" ? "কনফ্লিক্ট পর্যালোচনা" : "Conflict review"}
            desc={
              conflicts.filter((c) => !c.resolution).length === 0
                ? lang === "bn"
                  ? "কোনো অমীমাংসিত কনফ্লিক্ট নেই।"
                  : "No unresolved conflicts."
                : lang === "bn"
                  ? `${conflicts.filter((c) => !c.resolution).length}টি কনফ্লিক্ট পর্যালোচনার অপেক্ষায়।`
                  : `${conflicts.filter((c) => !c.resolution).length} conflicts awaiting review.`
            }
            href={`/dashboard/${role}/sync-centre`}
          />
          <Card
            title={lang === "bn" ? "আবেদন তালিকা" : "Applications list"}
            desc={
              lang === "bn"
                ? "এই UDC-এর সহায়তা করা আবেদনগুলো — সার্ভার-অনুমোদিত, স্কোপ-ফিল্টার করা।"
                : "Applications this UDC assisted — server-authorized, scope-filtered."
            }
            href={`/dashboard/${role}/applications`}
          />
          <Card
            title={lang === "bn" ? "আবেদনকারীর অবস্থা-জানার পরিদর্শন" : "Applicant status visit"}
            desc={
              lang === "bn"
                ? "আবেদনকারী উপস্থিতিতে APPLICANT_ASSISTED_VIEW সেশন শুরু করুন।"
                : "Start an APPLICANT_ASSISTED_VIEW session while the applicant is present."
            }
            href={`/dashboard/${role}/status-visit`}
          />
          <Card
            title={lang === "bn" ? "স্পষ্টীকরণ কার্যসূচি" : "Clarification tasks"}
            desc={
              lang === "bn"
                ? "DLAO / কেস সাপোর্ট থেকে আসা স্পষ্টীকরণ অনুরোধ।"
                : "Clarification requests arriving from DLAO / case support."
            }
            href={`/dashboard/${role}/clarification-tasks`}
          />
          <Card
            title={lang === "bn" ? "UDC ইতিহাস" : "UDC history"}
            desc={
              lang === "bn"
                ? `${intakes.length}টি সহায়-ইনটেক — সিঙ্ক, কনফ্লিক্ট, যাচাই-সব।`
                : `${intakes.length} assisted intakes — sync, conflict, verification trail.`
            }
            href={`/dashboard/${role}/history`}
          />
        </section>

        {/* PWA + cache policy strip */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "PWA ও ক্যাশ নীতি" : "PWA + cache policy"}</h2>
          </div>
          <ul className={styles.provenanceList}>
            {capabilitiesList.map((c) => (
              <li key={c.en}>
                <span>{lang === "bn" ? c.bn : c.en}</span>
                <span>
                  <strong>{c.ok ? "✓" : "✗"}</strong>{" "}
                  {c.ok
                    ? lang === "bn" ? "উপলব্ধ" : "available"
                    : lang === "bn" ? "অনুপলব্ধ" : "not available"}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.bannerInfo}>
            <strong>{lang === "bn" ? "ক্যাশ নীতি —" : "Cache policy —"}</strong>{" "}
            {lang === "bn" ? cachePolicy.notes.bn : cachePolicy.notes.en}
          </p>
          <p className={styles.bannerInfo}>
            <strong>{lang === "bn" ? "কখনো ক্যাশ হয় না —" : "Never cached —"}</strong>{" "}
            {cachePolicy.neverCached.join(" · ")}
          </p>
          <p className={styles.bannerInfo}>
            <strong>{lang === "bn" ? "শুধু স্থানীয় সীমিত —" : "Restricted local —"}</strong>{" "}
            {cachePolicy.restrictedLocal.join(" · ")}
          </p>
        </section>

        {/* Offline queue */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অফলাইন সারি" : "Offline queue"}</h2>
            <Link href={`/dashboard/${role}/offline-queue`} className={styles.cardLink}>
              {lang === "bn" ? "সম্পূর্ণ সারি →" : "Full queue →"}
            </Link>
          </div>
          <ul className={styles.queueList}>
            {drafts.slice(0, 5).map((d) => (
              <li key={d.temporaryId} className={styles.queueRow}>
                <strong>{d.temporaryId}</strong>
                <span>{d.confirmedFields.length} fields confirmed · {(d.provenance?.length ?? 0)} provenance</span>
                <span className={`${styles.statusPill} ${STATUS_PILL[d.syncStatus] ?? ""}`}>
                  {d.syncStatus}
                </span>
                <Link href={`/dashboard/${role}#intake/${d.temporaryId}`}>Open</Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Sync conflicts + integrity */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "কনফ্লিক্ট ও অখণ্ডতা" : "Sync conflicts + integrity"}</h2>
          </div>
          <ul className={styles.queueList}>
            {conflicts.map((c) => (
              <li key={c.id} className={styles.queueRow}>
                <strong>{c.id}</strong>
                <span>{c.fieldOrObject} · {c.kind}</span>
                <span className={`${styles.statusPill} ${styles.statusPillConflict}`}>
                  {c.resolution ? "resolved" : "needs review"}
                </span>
                <Link href={`/dashboard/${role}#conflict/${c.id}`}>Open</Link>
              </li>
            ))}
            {integrity.map((i) => (
              <li key={i.id} className={styles.queueRow}>
                <strong>{i.id}</strong>
                <span>{i.temporaryId} · {i.result}</span>
                <span className={`${styles.statusPill} ${i.result === "pass" ? styles.statusPillSynced : styles.statusPillIntegrity}`}>
                  {i.result}
                </span>
                <Link href={`/dashboard/${role}#sync-centre`}>Open</Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Performance comparison summary */}
        {perf.length >= 2 ? (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "পারফরম্যান্স তুলনা" : "Performance comparison"}</h2>
            </div>
            <ul className={styles.provenanceList}>
              <li>
                <span>{lang === "bn" ? "সাধারণ মোড — শেল লোড" : "Normal — shell load"}</span>
                <span>{perf.find((p) => p.mode === "normal")?.measurements.appShellLoadMs} ms</span>
              </li>
              <li>
                <span>{lang === "bn" ? "হালকা মোড — শেল লোড" : "Light — shell load"}</span>
                <span>{perf.find((p) => p.mode === "light")?.measurements.appShellLoadMs} ms</span>
              </li>
              <li>
                <span>{lang === "bn" ? "সাধারণ — খসড়া সংরক্ষণ" : "Normal — save draft"}</span>
                <span>{perf.find((p) => p.mode === "normal")?.measurements.saveDraftMs} ms</span>
              </li>
              <li>
                <span>{lang === "bn" ? "হালকা — খসড়া সংরক্ষণ" : "Light — save draft"}</span>
                <span>{perf.find((p) => p.mode === "light")?.measurements.saveDraftMs} ms</span>
              </li>
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <div className={styles.card}>
      <h3>{title}</h3>
      <p>{desc}</p>
      <Link href={href} className={styles.cardLink}>
        Open →
      </Link>
    </div>
  );
}

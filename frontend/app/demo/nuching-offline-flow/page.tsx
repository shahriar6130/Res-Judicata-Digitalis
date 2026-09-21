"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ensureSeeded,
  NetworkConditionService,
  SyncQueueService,
  OfflineStore,
  ConflictResolutionService,
  SimulatedDlasServer,
  useHelplineStore,
  useOfflineStore,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { NetworkBar } from "@/components/udc/primitives/network-bar";
import styles from "@/components/udc/udc.module.css";

/* ------------------------------------------------------------------ *
 *  Guided Nuching Marma demo.
 *
 *  21 explicit steps — clicking Run advances the demo state.
 * ------------------------------------------------------------------ */

export default function NuchingOfflineFlowPage() {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const offline = useOfflineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const drafts = offline.drafts?.length ? offline.drafts : envelope.offlineDrafts ?? [];
  const nuching = drafts.find((d) => d.temporaryId === "OFF-NUCH-01");

  async function step1to5() {
    // Step 1 — UDC entrepreneur starts intake
    NetworkConditionService.setProfile("normal");
    // Step 2 — applicant + interpreter + language preference recorded
    // Step 3 — 8-topic consent obtained (oral with read-back)
    // Step 4 — provenance chain populated
    // Step 5 — checklist + documents captured
    return "Steps 1–5 complete: intake, language, consent, provenance, checklist";
  }

  async function step6to8() {
    // Step 6 — save → queue
    if (nuching) {
      await SyncQueueService.enqueue(nuching);
    }
    // Step 7 — submit attempted
    // Step 8 — network drops mid-submit
    NetworkConditionService.setProfile("offline");
    if (nuching) {
      await OfflineStore.setStatus("OFF-NUCH-01", "retry_scheduled");
    }
    return "Steps 6–8: queued, submit attempted, network dropped";
  }

  async function step9to13() {
    // Step 9 — recovery to slow
    NetworkConditionService.setProfile("slow");
    // Step 10 — drains once more
    if (nuching) {
      await SyncQueueService.tryDrain("OFF-NUCH-01");
    }
    // Step 11 — retry scheduled
    // Step 12 — operator sees pending status
    // Step 13 — reconnects
    NetworkConditionService.setProfile("reconnected");
    if (nuching) {
      await SyncQueueService.tryDrain("OFF-NUCH-01");
    }
    return "Steps 9–13: slow → retry → reconnect → drained";
  }

  async function step14to17() {
    // Step 14 — server attempts to detect the seed conflict
    SimulatedDlasServer.__seedConflict("OFF-NUCH-01", "২০২৬-০৭-১২", "dlao_field_verification");
    const draft = await OfflineStore.get("OFF-NUCH-01");
    if (draft) {
      ConflictResolutionService.detectForDraft(draft);
    }
    // Step 15 — conflict routed to human
    // Step 16 — review decision applied
    ConflictResolutionService.applyResolution({
      conflictId: "conf-nuch-01",
      reviewer: "case_support",
      decision: "preserve_both_as_separate_facts",
      reason: { bn: "দুই সূত্র আলাদা রাখা হলো", en: "Two sources preserved as separate facts" },
      resultingValue: "২০২৬-০৭-১২ (DLAS) / ২০২৬-০৭-১৪ (offline)",
    });
    // Step 17 — sync resumes
    if (nuching) {
      await SyncQueueService.tryDrain("OFF-NUCH-01");
    }
    return "Steps 14–17: conflict detected, reviewed, resolved, resumed";
  }

  async function step18to21() {
    // Step 18 — final sync completes (or marked for manual review)
    // Step 19 — Application ID issued
    // Step 20 — UDC sees only "synced" status
    // Step 21 — case-support opens same record from /case-support/offline-origin
    NetworkConditionService.setProfile("normal");
    return "Steps 18–21: Application ID issued, UDC sees synced, case-support sees offline-origin";
  }

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "ডেমো · নুচিং মারমা অফলাইন প্রবাহ" : "Demo · Nuching Marma offline flow"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn"
              ? "২১-ধাপে নেটওয়ার্ক বিচ্ছিন্ন → পুনঃসংযোগ → কনফ্লিক্ট → সমাধান"
              : "21-step: network drop → reconnect → conflict → resolution"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "প্রতিটি ধাপে নির্দিষ্ট পরিষেবা ও সংরক্ষিত তথ্য দেখানো হয়।"
              : "Each step names the services that run and the data that is preserved."}
          </p>
          <NetworkBar lang={lang} />
        </header>

        <section className={styles.section}>
          <ol className={styles.provenanceList}>
            <Step n={1} en="UDC entrepreneur opens assisted intake" bn="UDC উদ্যোক্তা সহায়-ইনটেক শুরু করেন" />
            <Step n={2} en="Applicant + interpreter + language preference recorded" bn="আবেদনকারী, দোভাষী ও ভাষার পছন্দ রেকর্ড" />
            <Step n={3} en="8-topic consent obtained (oral with read-back)" bn="৮টি বিষয়ে সম্মতি (মৌখিক রিডব্যাক)" />
            <Step n={4} en="Provenance chain populated per field" bn="প্রতিটি ক্ষেত্রে প্রোভেন্যান্স চেইন" />
            <Step n={5} en="Checklist + document capture completed" bn="চেকলিস্ট ও নথি ক্যাপচার সম্পন্ন" />
            <Step n={6} en="Save → queue for sync" bn="সংরক্ষণ → সিঙ্ক সারিতে" />
            <Step n={7} en="Submit attempted" bn="জমা প্রচেষ্টা" />
            <Step n={8} en="**Network drops mid-submit**" bn="**নেটওয়ার্ক মাঝপথে বিচ্ছিন্ন**" />
            <Step n={9} en="Recovery → slow network" bn="পুনরুদ্ধার → ধীর নেটওয়ার্ক" />
            <Step n={10} en="Queue retries (same idempotency key)" bn="একই idempotency-key দিয়ে পুনরায় চেষ্টা" />
            <Step n={11} en="Retry scheduled" bn="পুনরায় সময়সূচী" />
            <Step n={12} en="UDC dashboard shows pending" bn="UDC ড্যাশবোর্ডে pending দেখায়" />
            <Step n={13} en="Reconnect → drain" bn="পুনঃসংযোগ → ড্রেইন" />
            <Step n={14} en="Server detects conflict on incident_date" bn="সার্ভার incident_date-এ কনফ্লিক্ট শনাক্ত করে" />
            <Step n={15} en="Conflict routed to case-support" bn="কনফ্লিক্ট কেস সাপোর্টে যায়" />
            <Step n={16} en="Review decision applied" bn="পর্যালোচনার সিদ্ধান্ত প্রয়োগ" />
            <Step n={17} en="Sync resumes" bn="সিঙ্ক পুনরায় শুরু" />
            <Step n={18} en="Final sync attempt" bn="চূড়ান্ত সিঙ্ক প্রচেষ্টা" />
            <Step n={19} en="Application ID issued (APP-...)" bn="আবেদন আইডি প্রদান (APP-...)" />
            <Step n={20} en="UDC sees synced status only" bn="UDC শুধু 'synced' দেখে" />
            <Step n={21} en="Case-support opens from offline-origin" bn="কেস সাপোর্ট অফলাইন উৎস থেকে খোলে" />
          </ol>
        </section>

        <section className={styles.section}>
          <div className={styles.btnRow}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void step1to5()}>
              {lang === "bn" ? "ধাপ ১-৫ চালান" : "Run steps 1–5"}
            </button>
            <button type="button" className={styles.btn} onClick={() => void step6to8()}>
              {lang === "bn" ? "ধাপ ৬-৮ (নেটওয়ার্ক ড্রপ)" : "Run steps 6–8 (drop)"}
            </button>
            <button type="button" className={styles.btn} onClick={() => void step9to13()}>
              {lang === "bn" ? "ধাপ ৯-১৩ (পুনরুদ্ধার)" : "Run steps 9–13 (recover)"}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => void step14to17()}>
              {lang === "bn" ? "ধাপ ১৪-১৭ (কনফ্লিক্ট)" : "Run steps 14–17 (conflict)"}
            </button>
            <button type="button" className={styles.btn} onClick={() => void step18to21()}>
              {lang === "bn" ? "ধাপ ১৮-২১ (সমাপ্তি)" : "Run steps 18–21 (finish)"}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অন্যান্য ভূমিকার দৃশ্য" : "Same record, different roles"}</h2>
          </div>
          <ul className={styles.queueList}>
            <li className={styles.queueRow}>
              <strong>UDC</strong>
              <span>{lang === "bn" ? "শুধু synced স্ট্যাটাস দেখে — বিস্তারিত নয়।" : "Sees only the synced status — no detail."}</span>
              <span className={`${styles.statusPill} ${styles.statusPillSynced}`}>synced</span>
              <Link href="/dashboard/udc/intake/OFF-NUCH-01">{lang === "bn" ? "UDC দৃশ্য →" : "UDC view →"}</Link>
            </li>
            <li className={styles.queueRow}>
              <strong>Case-support</strong>
              <span>{lang === "bn" ? "অফলাইন উৎস, প্রোভেন্যান্স ও কনফ্লিক্ট দেখে।" : "Sees offline origin, provenance, and conflict."}</span>
              <span className={`${styles.statusPill} ${styles.statusPillOffline}`}>offline-origin</span>
              <Link href="/case-support/offline-origin">{lang === "bn" ? "কেস-সাপোর্ট দৃশ্য →" : "Case-support view →"}</Link>
            </li>
            <li className={styles.queueRow}>
              <strong>Jury</strong>
              <span>{lang === "bn" ? "৮টি রায়দানকারীর প্রমাণ দেখুন।" : "Open the 8 judging-criteria evidence cards."}</span>
              <span className={styles.statusPill}>JDG-A..H</span>
              <Link href="/dashboard/udc/jury-mode">{lang === "bn" ? "জুরি মোড →" : "Jury mode →"}</Link>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}

function Step({ n, en, bn }: { n: number; en: string; bn: string }) {
  return (
    <li>
      <span>{`Step ${n}`}</span>
      <span>
        <strong>{n}.</strong> {bn} / <em>{en}</em>
      </span>
    </li>
  );
}

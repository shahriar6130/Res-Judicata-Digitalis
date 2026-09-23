"use client";

import NextLink from "next/link";
import { useEffect, type ComponentProps, type MouseEvent } from "react";
import { ensureSeeded, useOfflineStore, type OfflineDraft } from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useCurrentUdcOperator, useDlasDb, label, MATTERS } from "@/lib/dlas";
import styles from "../udc.module.css";
import ui from "./dashboard.module.css";

function Link({ href, onClick, ...props }: ComponentProps<typeof NextLink>) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof href !== "string" || !href.includes("#")) return;
    event.preventDefault();
    const next = href.split("#")[1];
    if (window.location.hash === `#${next}`) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else window.location.hash = next;
  }
  return <NextLink {...props} href={href} onClick={navigate} />;
}

export function UdcDashboardPanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const me = useCurrentUdcOperator();
  const db = useDlasDb();
  const offline = useOfflineStore();
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const base = `/dashboard/${role}`;

  useEffect(() => { ensureSeeded(); }, []);

  const sessions = db.sessions
    .filter((s) => s.channel === "UDC_ASSISTED" && s.meta.operatorId === me?.operatorId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const apps = db.applications.filter((a) => a.channel.code === "UDC_ASSISTED" && a.data.filedBy.operatorId === me?.operatorId);
  const openTasks = db.tasks.filter((t) => t.status !== "DONE" && apps.some((a) => a.applicationId === t.applicationId));
  const drafts: OfflineDraft[] = Array.isArray(offline.drafts) ? offline.drafts : [];
  const mine = drafts.filter((d) => sessions.some((s) => s.meta.clientRef === d.temporaryId));
  const pending = mine.filter((d) => d.syncStatus !== "synced");
  const latest = sessions.find((s) => !s.applicationId)?.meta.clientRef;

  return <>
    <SkipLink targetId="udc-main" />
    <main id="udc-main" className={`${styles.page} ${ui.home}`}>
      <header className={ui.hero}>
        <div className={ui.heroCopy}>
          <span className={ui.eyebrow}>{tx("ইউনিয়ন ডিজিটাল সেন্টার · কর্মক্ষেত্র", "UNION DIGITAL CENTRE · WORKSPACE")}</span>
          <h1>{tx("সেবা শুরু করুন, কাজ এগিয়ে নিন।", "Start service. Keep work moving.")}</h1>
          <p>{tx(`${me?.name ?? "উদ্যোক্তা"} · ${me?.centre ?? "ইউডিসি"} — আপনার সহায়তায় করা আবেদন ও চলমান কাজ এক জায়গায়।`, `${me?.name ?? "Operator"} · ${me?.centre ?? "UDC"} — your assisted applications and ongoing work in one place.`)}</p>
          <div className={ui.heroActions}>
            <Link className={ui.primaryAction} href={`${base}#intake-new`}>{tx("নতুন আবেদন শুরু করুন", "Start an application")} <span aria-hidden>↗</span></Link>
            <Link className={ui.secondaryAction} href={latest ? `${base}#intake/${latest}` : `${base}#offline-queue`}>{tx("চলমান কাজ দেখুন", "View in-progress work")} <span aria-hidden>→</span></Link>
          </div>
        </div>
        <div className={ui.heroAside}>
          <span>{tx("আজকের কাজের পথ", "YOUR WORKFLOW")}</span>
          <ol><li><b>01</b> {tx("আবেদনকারীর তথ্য", "Applicant details")}</li><li><b>02</b> {tx("সম্মতি ও নথি", "Consent and documents")}</li><li><b>03</b> {tx("সংরক্ষণ ও সিঙ্ক", "Save and sync")}</li></ol>
        </div>
      </header>

      <section className={ui.metrics} aria-label={tx("কাজের সংখ্যা", "Work counts")}>
        <Link href={`${base}#offline-queue`}><strong>{sessions.filter((s) => !s.applicationId).length}</strong><span>{tx("চলমান ইনটেক", "In-progress intakes")}</span><small>{tx("কাজে ফিরে যান →", "Resume work →")}</small></Link>
        <Link href={`${base}#sync-centre`}><strong>{pending.length}</strong><span>{tx("সিঙ্ক অপেক্ষায় / যাচাই", "Pending sync / review")}</span><small>{tx("সিঙ্ক সেন্টার →", "Sync centre →")}</small></Link>
        <Link href={`${base}#applications`}><strong>{apps.length}</strong><span>{tx("জমা দেওয়া আবেদন", "Applications submitted")}</span><small>{tx("আবেদন তালিকা →", "Application list →")}</small></Link>
        <Link href={`${base}#clarification-tasks`}><strong>{openTasks.length}</strong><span>{tx("চলমান ফলো-আপ", "Open follow-ups")}</span><small>{tx("কাজগুলো দেখুন →", "View tasks →")}</small></Link>
      </section>

      <div className={ui.columns}>
        <section className={ui.workSection}>
          <div className={ui.sectionHeading}><div><span>{tx("আপনার কাজ", "YOUR WORK")}</span><h2>{tx("সাম্প্রতিক ইনটেক", "Recent intakes")}</h2></div><Link href={`${base}#applications`}>{tx("সব আবেদন", "All applications")} →</Link></div>
          {sessions.length ? <ul className={ui.recordList}>{sessions.slice(0, 4).map((s) => {
            const app = s.applicationId ? apps.find((a) => a.applicationId === s.applicationId) : undefined;
            const ref = s.meta.clientRef ?? s.sessionId;
            return <li key={s.sessionId}>
              <div className={ui.recordLead}><span className={ui.recordMark} aria-hidden>↗</span><div><strong>{s.draft.applicant.fullName || tx("নাম যোগ করা হয়নি", "Name not added")}</strong><small>{app?.applicationId ?? ref} · {app ? label(MATTERS, app.data.matter.category, lang) : tx("খসড়া", "Draft")}</small></div></div>
              <span className={ui.recordState}>{app ? tx("জমা হয়েছে", "Submitted") : tx("চলমান", "In progress")}</span>
              <Link href={app ? `${base}#applications` : `${base}#intake/${ref}`}>{tx("খুলুন", "Open")} <span aria-hidden>→</span></Link>
            </li>;
          })}</ul> : <div className={ui.empty}><strong>{tx("এখনো কোনো ইনটেক নেই", "No intakes yet")}</strong><p>{tx("প্রথম আবেদনকারীর জন্য নতুন সহায়তাপ্রাপ্ত ইনটেক শুরু করুন।", "Start a new assisted intake for your first applicant.")}</p><Link href={`${base}#intake-new`}>{tx("ইনটেক শুরু করুন", "Start intake")} →</Link></div>}
        </section>

        <section className={ui.toolsSection}>
          <div className={ui.sectionHeading}><div><span>{tx("দ্রুত প্রবেশ", "QUICK ACCESS")}</span><h2>{tx("সেবার সরঞ্জাম", "Service tools")}</h2></div></div>
          <div className={ui.toolList}>
            <Link href={latest ? `${base}#intake/${latest}/consent` : `${base}#intake-new`}><b>01</b><span><strong>{tx("সম্মতি রেকর্ড", "Consent record")}</strong><small>{tx("আবেদনকারীর সম্মতি নিশ্চিত করুন", "Confirm applicant consent")}</small></span><i aria-hidden>↗</i></Link>
            <Link href={latest ? `${base}#intake/${latest}/documents` : `${base}#intake-new`}><b>02</b><span><strong>{tx("নথি ক্যাপচার", "Document capture")}</strong><small>{tx("নথি সংগ্রহ ও মান পরীক্ষা", "Collect and check documents")}</small></span><i aria-hidden>↗</i></Link>
            <Link href={`${base}#status-visit`}><b>03</b><span><strong>{tx("অবস্থা জানার পরিদর্শন", "Status visit")}</strong><small>{tx("আবেদনকারী উপস্থিত থাকলে দেখুন", "View with the applicant present")}</small></span><i aria-hidden>↗</i></Link>
            <Link href={`${base}#sync-centre`}><b>04</b><span><strong>{tx("সিঙ্ক সেন্টার", "Sync centre")}</strong><small>{tx("অফলাইন কাজ ও সমস্যা দেখুন", "Check offline work and issues")}</small></span><i aria-hidden>↗</i></Link>
          </div>
        </section>
      </div>
      <section className={ui.footerTools}><span>{tx("আরও কাজ", "MORE TOOLS")}</span><Link href={`${base}#clarification-tasks`}>{tx("স্পষ্টীকরণ কাজ", "Clarification tasks")} →</Link><Link href={`${base}#history`}>{tx("ইতিহাস", "History")} →</Link><Link href={`${base}#translation`}>{tx("অনুবাদ", "Translation")} →</Link></section>
    </main>
  </>;
}

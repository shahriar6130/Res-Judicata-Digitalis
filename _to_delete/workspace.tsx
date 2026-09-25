"use client";

import { useEffect, useState } from "react";
import { NetworkBar } from "./primitives/network-bar";
import { useI18n } from "@/lib/i18n";
import { UdcDashboardPanel } from "./panels/dashboard.panel";
import { UdcNewIntakePanel } from "./panels/new-intake.panel";
import { UdcIntakeWorkspacePanel } from "./panels/intake-workspace.panel";
import { UdcDocumentsPanel } from "./panels/documents.panel";
import { UdcConsentPanel } from "./panels/consent.panel";
import { UdcOfflineQueuePanel } from "./panels/offline-queue.panel";
import { UdcSyncCentrePanel } from "./panels/sync-centre.panel";
import { UdcConflictDetailPanel } from "./panels/conflict-detail.panel";
import { UdcClarificationTasksPanel } from "./panels/clarification-tasks.panel";
import { UdcHistoryPanel } from "./panels/history.panel";
import { UdcDeviceAndCachePanel } from "./panels/device-and-cache.panel";
import { UdcPerformancePanel } from "./panels/performance.panel";
import { UdcApplicationsPanel } from "./panels/applications.panel";
import { UdcStatusVisitPanel } from "./panels/status-visit.panel";
import { UdcLetterAccessPanel } from "./panels/letter-access.panel";
import { UdcTranslationPanel } from "./panels/translation.panel";
import styles from "./udc.module.css";
import Link from "next/link";
import { useCurrentUdcOperator } from "@/lib/dlas";

export function UdcWorkspace({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const [view, setView] = useState(() => parseView(typeof window !== "undefined" ? window.location.hash : ""));
  const [params, setParams] = useState<Record<string, string>>(() =>
    parseParams(typeof window !== "undefined" ? window.location.hash : ""),
  );

  useEffect(() => {
    // Translate a legacy /dashboard/udc/<view> pathname into the matching
    // hash view so all existing Link targets keep working.
    function pathToHash(p: string): string {
      const segments = p.split("/").filter(Boolean);
      // segments[0] === "dashboard", [1] === "udc", [2+] === view parts
      const parts = segments.slice(2);
      if (parts.length === 0) return "";
      if (parts[0] === "intake" && parts[1] === "new") return "#intake-new";
      if (parts[0] === "intake" && parts[2] === "documents") return `#intake/${parts[1]}/documents`;
      if (parts[0] === "intake" && parts[2] === "consent")   return `#intake/${parts[1]}/consent`;
      if (parts[0] === "intake")                              return `#intake/${parts[1]}`;
      if (parts[0] === "sync-centre" && parts[1] === "conflicts" && parts[2]) {
        return `#conflict/${parts[2]}`;
      }
      if (parts[0] === "sync-centre") return "#sync-centre";
      if (parts[0] === "offline-queue") return "#offline-queue";
      if (parts[0] === "applications") return "#applications";
      if (parts[0] === "clarification-tasks") return "#clarification-tasks";
      if (parts[0] === "history") return "#history";
      if (parts[0] === "device-and-cache") return "#device-and-cache";
      if (parts[0] === "status-visit") return parts[1] ? `#status-visit/${parts[1]}` : "#status-visit";
      if (parts[0] === "letter-access") return parts[1] ? `#letter-access/${parts[1]}` : "#letter-access";
      if (parts[0] === "translation") return "#translation";
      return "";
    }

    function syncFromUrl() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        setView(parseView("#" + hash));
        setParams(parseParams("#" + hash));
        return;
      }
      const translated = pathToHash(window.location.pathname);
      if (translated) {
        // Update the URL to the hash form so subsequent nav uses the
        // canonical route, but don't trigger a full reload.
        window.history.replaceState(null, "", translated);
        setView(parseView(translated));
        setParams(parseParams(translated));
      }
    }

    syncFromUrl();
    window.addEventListener("hashchange", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  const operator = useCurrentUdcOperator();

  function renderPanel() {
    // Every UDC screen works for the logged-in operator only.
    if (!operator) {
      return (
        <main id="udc-main" className={styles.page}>
          <h1 className={styles.pageTitle}>{lang === "bn" ? "ইউডিসি লগইন প্রয়োজন" : "UDC login required"}</h1>
          <p className={styles.bannerInfo}>
            {lang === "bn" ? "সহায়তাপ্রাপ্ত আবেদন শুরু করতে আগে লগইন বা সাইন আপ করুন।" : "Log in or sign up before starting assisted applications."}{" "}
            <Link href="/udc" className={styles.cardLink}>
              {lang === "bn" ? "লগইন / সাইন আপ →" : "Log in / sign up →"}
            </Link>
          </p>
        </main>
      );
    }
    if (view === "intake-new") {
      return <UdcNewIntakePanel role={role} />;
    }
    if (view === "intake" && params.section === "documents" && params.temporaryId) {
      return <UdcDocumentsPanel temporaryId={params.temporaryId} role={role} />;
    }
    if (view === "intake" && params.section === "consent" && params.temporaryId) {
      return <UdcConsentPanel temporaryId={params.temporaryId} role={role} />;
    }
    if (view === "intake" && params.temporaryId) {
      return <UdcIntakeWorkspacePanel temporaryId={params.temporaryId} role={role} />;
    }
    if (view === "offline-queue") {
      return <UdcOfflineQueuePanel role={role} />;
    }
    if (view === "sync-centre") {
      return <UdcSyncCentrePanel role={role} />;
    }
    if (view === "conflict" && params.conflictId) {
      return <UdcConflictDetailPanel conflictId={params.conflictId} role={role} />;
    }
    if (view === "clarification-tasks") {
      return <UdcClarificationTasksPanel role={role} />;
    }
    if (view === "history") {
      return <UdcHistoryPanel role={role} />;
    }
    if (view === "device-and-cache") {
      return <UdcDeviceAndCachePanel />;
    }
    if (view === "performance") {
      return <UdcPerformancePanel />;
    }
    if (view === "applications") {
      return <UdcApplicationsPanel role={role} />;
    }
    if (view === "status-visit") {
      return <UdcStatusVisitPanel sessionId={params.sessionId} role={role} />;
    }
    if (view === "letter-access") {
      if (!params.sessionId) {
        return (
          <main id="udc-main" className={styles.page}>
            <p>{lang === "bn" ? "সেশন আইডি দরকার" : "Session id required"}</p>
          </main>
        );
      }
      return <UdcLetterAccessPanel sessionId={params.sessionId} role={role} />;
    }
    if (view === "translation") {
      return <UdcTranslationPanel role={role} />;
    }
    return <UdcDashboardPanel role={role} />;
  }

  return (
    <div className={styles.udcShell}>
      <div className={styles.udcStickyTop}>
        <NetworkBar lang={lang} />
      </div>
      <div className={styles.udcShellBody}>
        {renderPanel()}
      </div>
    </div>
  );
}

function parseView(hash: string): string {
  const clean = (hash || "").replace(/^#/, "").split("/")[0];
  if (!clean) return "dashboard";
  if (clean === "intake") return "intake";
  if (clean === "intake-new") return "intake-new";
  if (clean === "translation") return "translation";
  return clean;
}

function parseParams(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = (hash || "").replace(/^#/, "");
  if (clean.startsWith("intake/")) {
    const rest = clean.slice("intake/".length);
    const parts = rest.split("/");
    if (parts[0]) out.temporaryId = parts[0];
    if (parts[1]) out.section = parts[1];
  } else if (clean.startsWith("sync-centre/conflicts/")) {
    const parts = clean.split("/");
    if (parts[2]) out.conflictId = parts[2];
  } else if (clean.startsWith("status-visit/")) {
    out.sessionId = clean.slice("status-visit/".length);
  } else if (clean.startsWith("letter-access/")) {
    out.sessionId = clean.slice("letter-access/".length);
  } else if (clean.startsWith("conflict/")) {
    out.conflictId = clean.slice("conflict/".length);
  }
  return out;
}

"use client";

import { useEffect, useState } from "react";
import { useHelplineStore } from "@/lib/shakkho";
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
import { UdcJuryModePanel } from "./panels/jury-mode.panel";

export function UdcWorkspace({ role = "udc" }: { role?: string }) {
  const envelope = useHelplineStore();
  const [view, setView] = useState(() => parseView(typeof window !== "undefined" ? window.location.hash : ""));
  const [params, setParams] = useState<Record<string, string>>(() =>
    parseParams(typeof window !== "undefined" ? window.location.hash : ""),
  );

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace(/^#/, "");
      setView(parseView(hash));
      setParams(parseParams(hash));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  if (view === "intake-new") {
    return <UdcNewIntakePanel role={role} />;
  }
  if (view === "intake" && params.temporaryId) {
    return <UdcIntakeWorkspacePanel temporaryId={params.temporaryId} role={role} />;
  }
  if (view === "intake" && params.section === "documents" && params.temporaryId) {
    return <UdcDocumentsPanel temporaryId={params.temporaryId} role={role} />;
  }
  if (view === "intake" && params.section === "consent" && params.temporaryId) {
    return <UdcConsentPanel temporaryId={params.temporaryId} role={role} />;
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
  if (view === "jury-mode") {
    return <UdcJuryModePanel role={role} envelope={envelope} />;
  }
  return <UdcDashboardPanel role={role} />;
}

function parseView(hash: string): string {
  const clean = (hash || "").replace(/^#/, "").split("/")[0];
  if (!clean) return "dashboard";
  if (clean === "intake") return "intake";
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
  }
  return out;
}

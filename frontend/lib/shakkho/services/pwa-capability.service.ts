/* ------------------------------------------------------------------ *
 *  PwaCapabilityService — honest capability detection.
 *
 *  Per Phase 5 §20: capability is DETECTED, never fabricated. If the
 *  browser does not expose a service worker, the install banner
 *  shows a note explaining why.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { isBrowser } from "./_internal/async-helpers";
import type { PwaCapability } from "../types";

export const PWA_EVENT = "shakkho:pwa";

const listeners = new Set<(p: PwaCapability) => void>();

let snapshot: PwaCapability = {
  serviceWorker: false,
  manifest: false,
  installPrompt: false,
  standaloneDisplay: false,
  notes: [{ bn: "পরিবেশ শনাক্ত হচ্ছে…", en: "Detecting environment…" }],
  capturedAt: new Date().toISOString(),
};

function emit(p: PwaCapability): void {
  snapshot = p;
  publish(PWA_EVENT, p);
  listeners.forEach((cb) => cb(p));
}

async function detect(): Promise<PwaCapability> {
  if (!isBrowser()) {
    return {
      serviceWorker: false,
      manifest: false,
      installPrompt: false,
      standaloneDisplay: false,
      notes: [
        {
          bn: "সার্ভার-সাইড রেন্ডার — ব্রাউজার শনাক্ত হয়নি",
          en: "Server-side render — browser features not detected",
        },
      ],
      capturedAt: new Date().toISOString(),
    };
  }
  const notes: { bn: string; en: string }[] = [];
  const serviceWorker = "serviceWorker" in navigator;
  if (!serviceWorker) {
    notes.push({
      bn: "এই ব্রাউজারে সার্ভিস ওয়ার্কার নেই — অফলাইন ক্যাশিং সীমিত",
      en: "Service worker not available — offline caching limited",
    });
  }
  let manifest = false;
  try {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    manifest = Boolean(link && link.href);
  } catch {
    manifest = false;
  }
  if (!manifest) {
    notes.push({
      bn: "ম্যানিফেস্ট লিংক পাওয়া যায়নি",
      en: "Web app manifest link not present",
    });
  }
  const installPrompt = Boolean((window as unknown as { __pwaBeforeInstall?: unknown }).__pwaBeforeInstall);
  const standaloneDisplay =
    typeof window !== "undefined" &&
    Boolean((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return {
    serviceWorker,
    manifest,
    installPrompt,
    standaloneDisplay,
    notes,
    capturedAt: new Date().toISOString(),
  };
}

export const PwaCapabilityService = {
  async refresh(): Promise<PwaCapability> {
    const p = await detect();
    emit(p);
    return p;
  },

  snapshot(): PwaCapability {
    return snapshot;
  },

  subscribe(cb: (p: PwaCapability) => void): () => void {
    listeners.add(cb);
    cb(snapshot);
    return () => {
      listeners.delete(cb);
    };
  },
};

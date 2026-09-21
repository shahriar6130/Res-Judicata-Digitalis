"use client";

import { useEffect, useState } from "react";
import {
  ensureSeeded,
  PwaCapabilityService,
  CachePolicyService,
  offlineCapabilities,
  type PwaCapability,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

export function UdcDeviceAndCachePanel() {
  const { lang } = useI18n();
  const [cap, setCap] = useState<PwaCapability>(() => PwaCapabilityService.snapshot());
  const caps = offlineCapabilities();
  const policy = CachePolicyService.policy();

  useEffect(() => {
    ensureSeeded();
    void PwaCapabilityService.refresh();
    return PwaCapabilityService.subscribe(setCap);
  }, []);

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · ডিভাইস ও ক্যাশ" : "UDC · device & cache"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "এই ডিভাইসে কী সংরক্ষিত হয়?" : "What is stored on this device?"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "PWA সক্ষমতা সনাক্ত করা হয় — মিথ্যা দাবি করা হয় না।"
              : "PWA capability is detected — nothing is fabricated."}
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "ব্রাউজার সক্ষমতা" : "Browser capabilities"}</h2>
          </div>
          <ul className={styles.provenanceList}>
            <li>
              <span>IndexedDB</span>
              <span><strong>{caps.indexedDb ? "✓" : "✗"}</strong> {caps.indexedDb ? (lang === "bn" ? "উপলব্ধ" : "available") : (lang === "bn" ? "অনুপলব্ধ" : "not available")}</span>
            </li>
            <li>
              <span>Blob store</span>
              <span><strong>{caps.blobStore ? "✓" : "✗"}</strong> {caps.blobStore ? "available" : "not available"}</span>
            </li>
            <li>
              <span>Web Crypto</span>
              <span><strong>{caps.webCrypto ? "✓" : "✗"}</strong> {caps.webCrypto ? "SHA-256 available" : "fallback FNV-1a"}</span>
            </li>
            <li>
              <span>Service worker</span>
              <span><strong>{caps.serviceWorker ? "✓" : "✗"}</strong> {caps.serviceWorker ? "yes" : "no"}</span>
            </li>
            <li>
              <span>Install prompt</span>
              <span><strong>{cap.installPrompt ? "✓" : "✗"}</strong> {cap.installPrompt ? (lang === "bn" ? "উপলব্ধ" : "available") : (lang === "bn" ? "প্রম্পট আসেনি" : "no prompt fired")}</span>
            </li>
            <li>
              <span>Standalone display</span>
              <span><strong>{cap.standaloneDisplay ? "✓" : "✗"}</strong> {cap.standaloneDisplay ? "yes" : "no"}</span>
            </li>
          </ul>
          {cap.notes.length > 0 ? (
            <div className={styles.bannerInfo}>
              <strong>{lang === "bn" ? "নোট:" : "Notes:"}</strong>
              <ul>
                {cap.notes.map((n, i) => (
                  <li key={i}>{lang === "bn" ? n.bn : n.en}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "ক্যাশ নীতি" : "Cache policy"}</h2>
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
            <li>
              <span>{lang === "bn" ? "মেয়াদ" : "Restricted expiry"}</span>
              <span>{Math.round(policy.restrictedExpiryMs / (24 * 60 * 60 * 1000))} days</span>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}

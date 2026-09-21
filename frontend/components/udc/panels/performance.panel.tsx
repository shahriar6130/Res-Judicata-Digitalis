"use client";

import { useEffect, useState } from "react";
import {
  ensureSeeded,
  PerformanceMeasurementService,
  NetworkConditionService,
  type PerformanceMeasurement,
  type NetworkProfile,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { NetworkBar } from "../primitives/network-bar";
import styles from "../udc.module.css";

export function UdcPerformancePanel() {
  const { lang } = useI18n();
  const [history, setHistory] = useState<PerformanceMeasurement[]>([]);
  const [network, setNetwork] = useState<NetworkProfile | null>(null);

  useEffect(() => {
    ensureSeeded();
    return NetworkConditionService.subscribe((p) => setNetwork(p));
  }, []);

  async function run(mode: PerformanceMeasurement["mode"]) {
    const m = await PerformanceMeasurementService.measure(
      mode,
      network?.kind ?? "normal",
    );
    setHistory(PerformanceMeasurementService.history());
    void m;
  }

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · পারফরম্যান্স" : "UDC · performance"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "সাধারণ বনাম হালকা মোড" : "Normal vs. light mode"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "একই থ্রটলড প্রোফাইলে দুটি মোডের তুলনা। সব সংখ্যা এই ডিভাইসে পরিমাপিত।"
              : "Two modes compared under the same throttled profile. All numbers measured on this device."}
          </p>
          <NetworkBar lang={lang} />
        </header>

        <section className={styles.section}>
          <div className={styles.btnRow}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => run("normal")}>
              {lang === "bn" ? "সাধারণ মোড পরিমাপ" : "Measure normal"}
            </button>
            <button type="button" className={styles.btn} onClick={() => run("light")}>
              {lang === "bn" ? "হালকা মোড পরিমাপ" : "Measure light"}
            </button>
          </div>
          {history.length > 0 ? (
            <ul className={styles.provenanceList}>
              {history.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.mode} · {m.networkProfile} · {m.measuredAt.split("T")[1]?.slice(0, 8) ?? ""}
                  </span>
                  <span>
                    {Object.entries(m.measurements)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অনুমান ও ডিভাইস ধারণা" : "Estimates + device assumptions"}</h2>
          </div>
          {history.length > 0 ? (
            <ul className={styles.provenanceList}>
              {history[history.length - 1].estimates.map((e, i) => (
                <li key={i}>
                  <span>{lang === "bn" ? "অনুমান" : "Estimate"}</span>
                  <span>{e}</span>
                </li>
              ))}
              {history[history.length - 1].deviceAssumptions.map((d, i) => (
                <li key={`d-${i}`}>
                  <span>{lang === "bn" ? "ধারণা" : "Assumption"}</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.bannerInfo}>
              {lang === "bn"
                ? "পরিমাপ শুরু করতে উপরের বোতাম চাপুন।"
                : "Press a button above to run a measurement."}
            </p>
          )}
        </section>
      </main>
    </>
  );
}

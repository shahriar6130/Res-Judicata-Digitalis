"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AssistedIntakeService,
  ensureSeeded,
  OfflineStore,
  NetworkConditionService,
  SyncQueueService,
  type LanguageCode,
  type ApplicantContactRouteKind,
  type OfflineDraft,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useNetwork } from "../primitives/use-network";
import styles from "../udc.module.css";

export function UdcNewIntakePanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const router = useRouter();
  const net = useNetwork();

  const [applicantName, setApplicantName] = useState("");
  const [district, setDistrict] = useState("খাগড়াছড়ি");
  const [matterType, setMatterType] = useState("land");
  const [primary, setPrimary] = useState<LanguageCode>("marma");
  const [interpreterName, setInterpreterName] = useState("উচাই মারমা");
  const [contactKind, setContactKind] = useState<ApplicantContactRouteKind>("trusted_contact");
  const [contactValue, setContactValue] = useState("+8801XXXXXXXXX");
  const [freeNoticeAck, setFreeNoticeAck] = useState(false);

  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "queued" | "syncing" | "synced" | "error">("idle");
  const [autoSaveAt, setAutoSaveAt] = useState<string>("");
  const [autoSaveAppId, setAutoSaveAppId] = useState<string>("");
  const [draftCount, setDraftCount] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    ensureSeeded();
    void refreshDrafts();
  }, []);

  useEffect(() => {
    // Subscribe to live sync events so the indicator flips to "synced".
    return SyncQueueService.subscribe(() => {
      void refreshDrafts();
    });
  }, []);

  // Live network effect: when offline, every keystroke is queued, not synced.
  const netBannerStyle = useMemo(() => {
    if (net.kind === "offline") return { background: "#f5f5f5", color: "var(--gray)" };
    if (net.kind === "intermittent") return { background: "#fff3cd", color: "#b8830b" };
    if (net.kind === "slow") return { background: "#fff8e1", color: "#b8830b" };
    if (net.kind === "reconnected") return { background: "#f0fdf4", color: "var(--green)" };
    return { background: "var(--ink)", color: "var(--white)" };
  }, [net.kind]);

  async function refreshDrafts() {
    try {
      const drafts = await OfflineStore.list();
      const pending = Array.isArray(drafts)
        ? drafts.filter((d) => d.syncStatus !== "synced").length
        : 0;
      setDraftCount(pending);
    } catch {
      setDraftCount(0);
    }
  }

  // Live auto-save: every change writes a temp draft (so reloading / losing focus preserves work).
  async function autoSaveField(updates: Record<string, unknown>) {
    if (!applicantName.trim()) return;
    const tempId = `OFF-NEW-${applicantName.replace(/\s+/g, "-").toUpperCase()}`;
    const payload = {
      applicant_name: applicantName,
      district,
      matter_type: matterType,
      primary_language: primary,
      interpreter_name: interpreterName,
      contact_kind: contactKind,
      contact_value: contactValue,
      free_notice_acknowledged: freeNoticeAck,
      ...updates,
    };

    setAutoSaveState("saving");
    try {
      // Compute a deterministic idempotency key tied to (tempId + payload snapshot).
      const key = await computeIdempotencyKey(tempId, payload);
      setIdempotencyKey(key);
      const draft: OfflineDraft = {
        id: tempId,
        temporaryId: tempId,
        payload,
        confirmedFields: Object.keys(payload).filter((k) => Boolean((payload as Record<string, unknown>)[k])),
        provenance: [],
        consent: [],
        documentMetadata: [],
        blobKeys: [],
        syncStatus: net.kind === "offline" ? "queued_offline" : "ready_to_submit",
        idempotencyKey: key,
        localVersion: Date.now(),
        lastModified: new Date().toISOString(),
        integrityDigest: "",
        chainDigest: "",
        retryCount: 0,
        networkProfile: net,
      };
      await OfflineStore.upsert(draft);
      setAutoSaveAt(new Date().toLocaleTimeString());

      if (net.kind === "offline") {
        setAutoSaveState("queued");
        await refreshDrafts();
        return;
      }

      setAutoSaveState("syncing");
      const status = await SyncQueueService.tryDrain(tempId);
      const fresh = await OfflineStore.get(tempId);
      if (fresh?.authoritativeApplicationId) setAutoSaveAppId(fresh.authoritativeApplicationId);
      if (status === "synced") setAutoSaveState("synced");
      else if (status === "queued_offline" || status === "retry_scheduled") setAutoSaveState("queued");
      else setAutoSaveState("saved");
      await refreshDrafts();
    } catch {
      setAutoSaveState("error");
    }
  }

  async function start() {
    if (!applicantName.trim()) return;
    const intake = AssistedIntakeService.start({
      udcEntrepreneurId: "udc-001",
      applicantName,
      district,
      matterType,
      languagePreference: {
        primary,
        supportedInterface: "bn",
        interpreterName,
        interpreterLanguage: primary,
      },
      applicantContact: {
        kind: contactKind,
        value: contactValue,
        safeWindow: { bn: "বিকাল ৩-৫টা", en: "3-5 PM" },
      },
    });
    router.push(`/dashboard/${role}/intake/${intake.temporaryId}`);
  }

  // Indicator colour + label
  const indicator = (() => {
    if (autoSaveState === "saving") return { colour: "#b8830b", label: lang === "bn" ? "সংরক্ষণ হচ্ছে…" : "Saving…" };
    if (autoSaveState === "syncing") return { colour: "#b8830b", label: lang === "bn" ? "সিঙ্ক হচ্ছে…" : "Syncing…" };
    if (autoSaveState === "synced")  return { colour: "var(--green)", label: lang === "bn" ? "সিঙ্ক সম্পন্ন" : "Synced" };
    if (autoSaveState === "queued")  return { colour: "#3b82f6", label: lang === "bn" ? "সারিতে আছে" : "Queued (offline)" };
    if (autoSaveState === "saved")   return { colour: "var(--green)", label: lang === "bn" ? "সংরক্ষিত" : "Saved" };
    if (autoSaveState === "error")   return { colour: "var(--red)", label: lang === "bn" ? "ত্রুটি" : "Error" };
    return { colour: "var(--gray)", label: lang === "bn" ? "অপেক্ষা" : "Idle" };
  })();

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · নতুন ইনটেক" : "UDC · new intake"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "নতুন সহায়-ইনটেক শুরু করুন" : "Start a new assisted intake"}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "এই ধাপে কোনো কেস আইডি তৈরি হয় না। স্থানীয় খসড়া হিসেবে সংরক্ষিত হবে।"
              : "No Case ID is minted at this step. The intake is stored as a local draft."}
          </p>

          {/* Live network + sync banner — GitHub status row style */}
          <div className={styles.intakeBanner} style={netBannerStyle}>
            <strong style={{ color: net.kind === "offline" ? "var(--gray)" : net.kind === "normal" ? "var(--yellow)" : "var(--green)" }}>●</strong>
            <span>
              {lang === "bn" ? "নেটওয়ার্ক:" : "Network:"}{" "}
              <strong>{net.statusLabel[lang]}</strong>
              {" · "}
              {lang === "bn" ? "অটো-সেভ" : "auto-save"}: <strong>{indicator.label}</strong>
              {autoSaveAt && ` ${lang === "bn" ? "সময়" : "at"} ${autoSaveAt}`}
              {autoSaveAppId && (
                <>
                  {" → "}
                  <strong style={{ color: "var(--green)" }}>{autoSaveAppId}</strong>
                </>
              )}
              {draftCount > 0 && (
                <>
                  {" · "}
                  <strong>{draftCount} {lang === "bn" ? "সিঙ্ক-অপেক্ষমান" : "pending sync"}</strong>
                </>
              )}
            </span>
            <span style={{ marginLeft: "auto", fontSize: "var(--t-label)", opacity: 0.8 }}>
              {lang === "bn" ? "idempotency" : "idempotency"}: {idempotencyKey ? `${idempotencyKey.slice(0, 18)}…` : "—"}
            </span>
          </div>
        </header>

        <section className={styles.section}>
          <div className={styles.fieldGrid}>
            <label htmlFor="ni-name">{lang === "bn" ? "আবেদনকারীর নাম" : "Applicant name"}</label>
            <input
              id="ni-name"
              type="text"
              value={applicantName}
              onChange={(e) => { setApplicantName(e.target.value); void autoSaveField({ applicant_name: e.target.value }); }}
              placeholder={lang === "bn" ? "যেমন: নুচিং মারমা" : "e.g. Nuching Marma"}
              className={autoSaveState === "saved" || autoSaveState === "synced" ? styles.fieldSaved : ""}
            />
            <small style={{ color: "var(--gray)" }}>{lang === "bn" ? "প্রতিটি অক্ষর অটো-সেভ হয়" : "Every keystroke auto-saves"}</small>

            <label htmlFor="ni-district">{lang === "bn" ? "জেলা" : "District"}</label>
            <input id="ni-district" type="text" value={district} onChange={(e) => { setDistrict(e.target.value); void autoSaveField({ district: e.target.value }); }} />
            <span></span>

            <label htmlFor="ni-matter">{lang === "bn" ? "মামলার ধরন" : "Matter type"}</label>
            <select id="ni-matter" value={matterType} onChange={(e) => { setMatterType(e.target.value); void autoSaveField({ matter_type: e.target.value }); }}>
              <option value="family">Family</option>
              <option value="land">Land</option>
              <option value="labour">Labour</option>
              <option value="criminal">Criminal</option>
              <option value="other">Other</option>
            </select>
            <span></span>

            <label htmlFor="ni-lang">{lang === "bn" ? "প্রাথমিক ভাষা" : "Primary language"}</label>
            <select id="ni-lang" value={primary} onChange={(e) => { setPrimary(e.target.value as LanguageCode); void autoSaveField({ primary_language: e.target.value }); }}>
              <option value="bn">Bangla</option>
              <option value="en">English</option>
              <option value="marma">Marma</option>
              <option value="chakma">Chakma</option>
              <option value="tripura">Tripura</option>
              <option value="garo">Garo</option>
            </select>
            <span></span>

            <label htmlFor="ni-interp">{lang === "bn" ? "দোভাষীর নাম" : "Interpreter name"}</label>
            <input id="ni-interp" type="text" value={interpreterName} onChange={(e) => { setInterpreterName(e.target.value); void autoSaveField({ interpreter_name: e.target.value }); }} />
            <span></span>

            <label htmlFor="ni-route">{lang === "bn" ? "যোগাযোগের রুট" : "Contact route"}</label>
            <select
              id="ni-route"
              value={contactKind}
              onChange={(e) => { setContactKind(e.target.value as ApplicantContactRouteKind); void autoSaveField({ contact_kind: e.target.value }); }}
            >
              <option value="applicant_controlled_phone">{lang === "bn" ? "আবেদনকারীর নিজের ফোন" : "Applicant-controlled phone"}</option>
              <option value="trusted_contact">{lang === "bn" ? "বিশ্বস্ত পরিচিতি" : "Trusted contact"}</option>
              <option value="safe_scheduled_contact">{lang === "bn" ? "নিরাপদ সময়ে যোগাযোগ" : "Safe scheduled contact"}</option>
              <option value="dlao_follow_up">{lang === "bn" ? "DLAO ফলো-আপ" : "DLAO follow-up"}</option>
              <option value="no_safe_phone">{lang === "bn" ? "নিরাপদ ফোন নেই" : "No safe phone"}</option>
              <option value="temporary_udc_number">{lang === "bn" ? "অস্থায়ী UDC নম্বর (জরুরি)" : "Temporary UDC number (urgent only)"}</option>
            </select>
            <span></span>

            <label htmlFor="ni-value">{lang === "bn" ? "যোগাযোগের মান" : "Contact value"}</label>
            <input id="ni-value" type="text" value={contactValue} onChange={(e) => { setContactValue(e.target.value); void autoSaveField({ contact_value: e.target.value }); }} />
            <span></span>

            <label htmlFor="ni-free">
              {lang === "bn" ? "ফ্রি-সার্ভিস নোটিশ পড়া ও বোঝানো হয়েছে" : "Free-service notice read + explained"}
            </label>
            <span>
              <input
                id="ni-free"
                type="checkbox"
                checked={freeNoticeAck}
                onChange={(e) => { setFreeNoticeAck(e.target.checked); void autoSaveField({ free_notice_acknowledged: e.target.checked }); }}
              />{" "}
              {lang === "bn" ? "হ্যাঁ" : "yes"}
            </span>
            <span></span>
          </div>

          <p className={styles.bannerInfo}>
            <span className={styles.draftAutoSave} style={{ color: indicator.colour }}>
              ● {indicator.label}
              {autoSaveAt && <span> {lang === "bn" ? "সময়" : "at"} {autoSaveAt}</span>}
            </span>
          </p>

          <div className={styles.btnRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={start}
              disabled={!applicantName.trim()}
            >
              {lang === "bn" ? "ইনটেক শুরু করুন" : "Start intake"}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => void autoSaveField({})}
              title={lang === "bn" ? "এখনই সংরক্ষণ করুন" : "Save now"}
            >
              {lang === "bn" ? "এখনই সংরক্ষণ" : "Save now"}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  Stable idempotency key — same tempId+payload → same key.
 *  Reusing the SHA-256 helper from the shakkho async-helpers.
 * ------------------------------------------------------------------ */
async function computeIdempotencyKey(tempId: string, payload: Record<string, unknown>): Promise<string> {
  const canonical = stableStringify({ tempId, payload });
  try {
    const enc = new TextEncoder().encode(canonical);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < canonical.length; i += 1) {
      h ^= canonical.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return `idem-${tempId}-${h.toString(16).padStart(8, "0")}`;
  }
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`).join(",")}}`;
}
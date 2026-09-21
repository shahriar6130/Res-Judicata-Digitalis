"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AssistedIntakeService,
  ensureSeeded,
  type LanguageCode,
  type ApplicantContactRouteKind,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

export function UdcNewIntakePanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const router = useRouter();
  const [applicantName, setApplicantName] = useState("");
  const [district, setDistrict] = useState("খাগড়াছড়ি");
  const [matterType, setMatterType] = useState("land");
  const [primary, setPrimary] = useState<LanguageCode>("marma");
  const [interpreterName, setInterpreterName] = useState("উচাই মারমা");
  const [contactKind, setContactKind] = useState<ApplicantContactRouteKind>("trusted_contact");
  const [contactValue, setContactValue] = useState("+8801XXXXXXXXX");

  useEffect(() => {
    ensureSeeded();
  }, []);

  function start() {
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
        </header>

        <section className={styles.section}>
          <div className={styles.fieldGrid}>
            <label htmlFor="ni-name">{lang === "bn" ? "আবেদনকারীর নাম" : "Applicant name"}</label>
            <input
              id="ni-name"
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder={lang === "bn" ? "যেমন: নুচিং মারমা" : "e.g. Nuching Marma"}
            />
            <span></span>

            <label htmlFor="ni-district">{lang === "bn" ? "জেলা" : "District"}</label>
            <input id="ni-district" type="text" value={district} onChange={(e) => setDistrict(e.target.value)} />
            <span></span>

            <label htmlFor="ni-matter">{lang === "bn" ? "মামলার ধরন" : "Matter type"}</label>
            <select id="ni-matter" value={matterType} onChange={(e) => setMatterType(e.target.value)}>
              <option value="family">Family</option>
              <option value="land">Land</option>
              <option value="labour">Labour</option>
              <option value="criminal">Criminal</option>
              <option value="other">Other</option>
            </select>
            <span></span>

            <label htmlFor="ni-lang">{lang === "bn" ? "প্রাথমিক ভাষা" : "Primary language"}</label>
            <select id="ni-lang" value={primary} onChange={(e) => setPrimary(e.target.value as LanguageCode)}>
              <option value="bn">Bangla</option>
              <option value="en">English</option>
              <option value="marma">Marma</option>
              <option value="chakma">Chakma</option>
              <option value="tripura">Tripura</option>
              <option value="garo">Garo</option>
            </select>
            <span></span>

            <label htmlFor="ni-interp">{lang === "bn" ? "দোভাষীর নাম" : "Interpreter name"}</label>
            <input id="ni-interp" type="text" value={interpreterName} onChange={(e) => setInterpreterName(e.target.value)} />
            <span></span>

            <label htmlFor="ni-route">{lang === "bn" ? "যোগাযোগের রুট" : "Contact route"}</label>
            <select
              id="ni-route"
              value={contactKind}
              onChange={(e) => setContactKind(e.target.value as ApplicantContactRouteKind)}
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
            <input id="ni-value" type="text" value={contactValue} onChange={(e) => setContactValue(e.target.value)} />
            <span></span>
          </div>
          <div className={styles.btnRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={start}
              disabled={!applicantName.trim()}
            >
              {lang === "bn" ? "ইনটেক শুরু করুন" : "Start intake"}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

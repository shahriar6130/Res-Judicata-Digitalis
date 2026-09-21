"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  AssistedIntakeService,
  DocumentCaptureService,
  DocumentQualityService,
  type DocumentCapture,
  type DocumentQualityFinding,
  type ChecklistItem,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

export function UdcDocumentsPanel({
  temporaryId,
  role = "udc",
}: {
  temporaryId: string;
  role?: string;
}) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const intake = envelope.assistedIntakes?.find((a) => a.temporaryId === temporaryId);
  const checklist = useMemo(
    () => AssistedIntakeService.defaultChecklist(intake?.matterType ?? "other"),
    [intake?.matterType],
  );
  const codes = DocumentQualityService.codes();
  const [selectedCode, setSelectedCode] = useState(codes[0]);
  const finding = DocumentQualityService.finding(selectedCode);
  const [docCaptures, setDocCaptures] = useState<DocumentCapture[]>([]);

  function capture(checklistItemId: string, label: string) {
    if (!intake) return;
    const c = DocumentCaptureService.capture({
      applicationOrDraftId: intake.temporaryId,
      checklistItemId,
      capturedBy: "UDC entrepreneur",
      documentType: { bn: label, en: label },
      pageCount: 1,
      bytes: 36_000,
      compressed: true,
      pageOrder: [1],
      sensitivity: "restricted",
    });
    const findings: DocumentQualityFinding[] = [finding];
    const updated = DocumentCaptureService.attachQuality(c, findings);
    const confirmed = DocumentCaptureService.confirmByApplicant(updated);
    setDocCaptures((prev) => [...prev, confirmed]);
  }

  if (!intake) {
    return (
      <main id="udc-main" className={styles.page}>
        <SkipLink targetId="udc-main" />
        <h1 className={styles.pageTitle}>{lang === "bn" ? "ইনটেক পাওয়া যায়নি" : "Intake not found"}</h1>
        <p className={styles.bannerInfo}>
          <Link href={`/dashboard/${role}/intake/new`}>{lang === "bn" ? "নতুন ইনটেক →" : "New intake →"}</Link>
        </p>
      </main>
    );
  }

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · নথি ক্যাপচার" : "UDC · document capture"}
          </span>
          <h1 className={styles.pageTitle}>{intake.applicantName} · {intake.temporaryId}</h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "প্রতিটি ক্যাপচারে ১০টি মান-পরীক্ষা কোডের যেকোনোটি প্রয়োগ হতে পারে। ব্লকিং সমস্যা হলে আবার তুলুন।"
              : "Each capture can carry any of 10 quality codes. Blocking findings must be retaken."}
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.fieldGrid}>
            <label htmlFor="doc-qcode">{lang === "bn" ? "মান কোড" : "Quality code"}</label>
            <select
              id="doc-qcode"
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value as typeof selectedCode)}
            >
              {codes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span></span>
          </div>
          <p className={styles.bannerInfo}>
            <strong>{finding.code}</strong> · severity: {finding.severity} ·{" "}
            {lang === "bn" ? finding.message.bn : finding.message.en} ·{" "}
            {lang === "bn" ? finding.guidance.bn : finding.guidance.en}
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "ক্যাপচার করুন" : "Capture"}</h2>
          </div>
          <div className={styles.btnRow}>
            {checklist.items.map((it: ChecklistItem) => (
              <button
                key={it.id}
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                onClick={() => capture(it.id, lang === "bn" ? it.label.bn : it.label.en)}
              >
                + {lang === "bn" ? it.label.bn : it.label.en}
              </button>
            ))}
          </div>
          <div className={styles.docsList}>
            {docCaptures.map((d) => (
              <div key={d.id} className={styles.docCard}>
                <strong>{d.documentType.en}</strong>
                <span>{d.capturedAt}</span>
                <ul className={styles.docFindings}>
                  {d.qualityFindings.map((f, i) => (
                    <li
                      key={i}
                      className={f.severity === "block" ? styles.docFindingBlock : styles.docFindingWarn}
                    >
                      {f.code} · {f.severity} · {lang === "bn" ? f.message.bn : f.message.en}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <Link href={`/dashboard/${role}/intake/${temporaryId}`} className={styles.btn}>
            ← {lang === "bn" ? "ইনটেকে ফিরে যান" : "Back to intake"}
          </Link>
        </section>
      </main>
    </>
  );
}

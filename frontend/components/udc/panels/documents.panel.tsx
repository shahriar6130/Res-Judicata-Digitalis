"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  AssistedIntakeService,
  DocumentCaptureService,
  DocumentQualityService,
  type DocumentCapture,
  type DocumentQualityFinding,
  type DocumentQualityIssueCode,
  type ChecklistItem,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { useNetwork } from "../primitives/use-network";
import styles from "../udc.module.css";

type ScanState = "idle" | "preparing" | "scanning" | "capturing" | "compressing" | "analyzing" | "ocr" | "done";

interface CapturedShot {
  id: string;
  label: string;
  pageCount: number;
  bytes: number;
  findings: DocumentQualityFinding[];
  thumbSeed: number; // pseudo-random for visual variety
  scanDurationMs: number;
  retryOf?: string; // if this is a retake of a prior shot
  sourceName?: string; // uploaded filename, if any
  sourceSizeBytes?: number;
  sourceMime?: string;
  ocrText?: string;          // mock OCR output
  ocrConfidence?: number;    // 0..1
  ocrHazy?: boolean;         // true if OCR returned a hazy verdict
  ocrPages?: number;
}

interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
}

const ALL_QUALITY_CODES = DocumentQualityService.codes();

export function UdcDocumentsPanel({
  temporaryId,
  role = "udc",
}: {
  temporaryId: string;
  role?: string;
}) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const net = useNetwork();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const intake = envelope.assistedIntakes?.find((a) => a.temporaryId === temporaryId);
  const checklist = useMemo(
    () => AssistedIntakeService.defaultChecklist(intake?.matterType ?? "other"),
    [intake?.matterType],
  );

  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [activeLabel, setActiveLabel] = useState<string>("");
  const [activeChecklistId, setActiveChecklistId] = useState<string>("");
  const [pageCount, setPageCount] = useState<1 | 2 | 3>(1);
  const [injectedIssue, setSelectedCode] = useState<string>("");
  const [uploads, setUploads] = useState<Record<string, UploadedFile>>({});
  const [ambiguityBanner, setAmbiguityBanner] = useState<{ label: string; codes: string[] } | null>(null);
  const [resubmitFor, setResubmitFor] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup any running scan timer on unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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

  function reset() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setScanState("idle");
    setActiveLabel("");
  }

  /** Realistic capture pipeline — visible phases.
   *  If a file has been uploaded for the matching checklist item, the
   *  pipeline runs the mock AI quality check, then a mock OCR pass;
   *  if OCR returns a "hazy" verdict the document is rejected and
   *  the user is asked to resubmit. Otherwise it simulates a camera
   *  capture (no OCR). */
  function startCapture(checklistItemId: string, label: string, retryOfId?: string) {
    reset();
    setActiveLabel(label);
    setActiveChecklistId(checklistItemId);
    setScanState("preparing");
    setAmbiguityBanner(null);
    const start = performance.now();

    const uploaded = uploads[checklistItemId];

    // Phase 1: focus / preparing (~250ms)
    timer.current = setTimeout(() => {
      setScanState("scanning");
      // Phase 2: scan animation (~800ms)
      timer.current = setTimeout(() => {
        setScanState("capturing");
        // Phase 3: capture (~600ms) — depends on page count
        timer.current = setTimeout(() => {
          setScanState("compressing");
          // Phase 4: compression (~400ms)
          timer.current = setTimeout(() => {
            setScanState("analyzing");
            // Phase 5: quality analysis (~500ms)
            timer.current = setTimeout(() => {
              const findings = synthesizeQuality(label, injectedIssue || undefined, uploaded?.file);
              const fallbackBytes = 24000 + Math.floor(Math.random() * 24000);
              const bytes = uploaded?.file?.size ?? fallbackBytes;

              // For uploaded files, run a mock OCR pass after quality.
              // For pure camera captures, skip OCR (no document to read).
              const runOcr = !!uploaded;

              const finalize = (ocr?: { text: string; confidence: number; hazy: boolean; pages: number }) => {
                const shot: CapturedShot = {
                  id: `SHOT-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
                  label,
                  pageCount,
                  bytes,
                  findings,
                  thumbSeed: Math.floor(Math.random() * 9999),
                  scanDurationMs: Math.round(performance.now() - start),
                  retryOf: retryOfId,
                  sourceName: uploaded?.file?.name,
                  sourceSizeBytes: uploaded?.file?.size,
                  sourceMime: uploaded?.file?.type,
                  ocrText: ocr?.text,
                  ocrConfidence: ocr?.confidence,
                  ocrHazy: ocr?.hazy,
                  ocrPages: ocr?.pages,
                };
                setShots((prev) => [...prev, shot]);
                setScanState("done");

                // ===== Rejection logic =====
                // 1. Quality findings (block or ambiguity) → reject
                // 2. OCR "hazy" verdict → reject, ask to resubmit
                const blockCodes = findings.filter((f) => f.severity === "block").map((f) => f.code);
                const ambiguityCodes = findings
                  .filter((f) =>
                    ["unreadable_text", "wrong_document_category", "missing_page", "blur", "low_contrast"].includes(f.code),
                  )
                  .map((f) => f.code);
                const ocrReject = ocr?.hazy;

                if (blockCodes.length > 0 || ambiguityCodes.length > 0 || ocrReject) {
                  const codes = Array.from(new Set([
                    ...blockCodes,
                    ...ambiguityCodes,
                    ...(ocrReject ? ["ocr_hazy"] : []),
                  ]));
                  setAmbiguityBanner({ label, codes });
                  setResubmitFor(checklistItemId);
                } else {
                  setAmbiguityBanner(null);
                  setResubmitFor("");
                }

                timer.current = setTimeout(() => setScanState("idle"), 1400);
              };

              if (runOcr) {
                // Phase 6: OCR (~700ms)
                setScanState("ocr");
                timer.current = setTimeout(() => {
                  const ocr = mockOcr(uploaded.file, findings);
                  finalize(ocr);
                }, 700);
              } else {
                finalize();
              }
            }, 500);
          }, 400);
        }, 600);
      }, 800);
    }, 250);
  }

  function handleUpload(checklistItemId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploads((prev) => {
      const next = { ...prev };
      if (next[checklistItemId]?.previewUrl) URL.revokeObjectURL(next[checklistItemId].previewUrl);
      next[checklistItemId] = {
        id: `UP-${Date.now()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      };
      return next;
    });
    setAmbiguityBanner(null);
    setResubmitFor("");
  }

  function clearUpload(checklistItemId: string) {
    setUploads((prev) => {
      const next = { ...prev };
      if (next[checklistItemId]?.previewUrl) URL.revokeObjectURL(next[checklistItemId].previewUrl);
      delete next[checklistItemId];
      return next;
    });
    if (resubmitFor === checklistItemId) {
      setResubmitFor("");
      setAmbiguityBanner(null);
    }
  }

  function acceptUploaded(checklistItemId: string) {
    const up = uploads[checklistItemId];
    if (!up) return;
    const item = checklist.items.find((i: ChecklistItem) => i.id === checklistItemId);
    if (!item) return;
    const label = lang === "bn" ? item.label.bn : item.label.en;
    startCapture(item.id, label);
  }

  function retake(shot: CapturedShot) {
    // Find the source checklist item by label match.
    const item = checklist.items.find((i: ChecklistItem) => {
      const en = lang === "bn" ? i.label.bn : i.label.en;
      return en === shot.label;
    });
    if (!item) return;
    startCapture(item.id, shot.label, shot.id);
  }

  function discard(shotId: string) {
    setShots((prev) => prev.filter((s) => s.id !== shotId));
  }

  const blocking = shots.filter((s) => s.findings.some((f) => f.severity === "block"));
  const blockingRate = shots.length === 0 ? 0 : Math.round((blocking.length / shots.length) * 100);

  const totalBytes = shots.reduce((sum, s) => sum + s.bytes, 0);

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

          <div className={styles.intakeBanner} style={{ background: net.kind === "offline" ? "var(--gray)" : "var(--ink)" }}>
            <strong>●</strong>
            <span>
              {lang === "bn" ? "ক্যামেরা:" : "Camera:"}{" "}
              <strong>{lang === "bn" ? "প্রোটোটাইপ সিমুলেশন" : "prototype simulation"}</strong>
              {" · "}
              {shots.length} {lang === "bn" ? "ক্যাপচার" : "captures"}
              {" · "}
              {(totalBytes / 1024).toFixed(1)} KB
              {blockingRate > 0 && (
                <>
                  {" · "}
                  <strong style={{ color: "var(--yellow)" }}>{blockingRate}% {lang === "bn" ? "ব্লকিং" : "blocking"}</strong>
                </>
              )}
            </span>
          </div>
        </header>

        {/* ===== Camera stage with live phase indicator ===== */}
        <section className={styles.cameraStage}>
          <h3>
            {lang === "bn" ? "ক্যামেরা ভিউ" : "Camera view"}
            {activeLabel && (
              <span style={{ marginLeft: 8, fontSize: "var(--t-label)", color: "var(--yellow)" }}>
                · {activeLabel}
              </span>
            )}
          </h3>

          <div className={styles.cameraViewport}>
            {scanState === "idle" && (
              <span style={{ textAlign: "center", padding: 16 }}>
                {lang === "bn"
                  ? "ক্যাপচার বোতাম চাপুন — প্রোটোটাইপ ভিউ"
                  : "Press a capture button — prototype viewfinder"}
              </span>
            )}
            {scanState !== "idle" && (
              <>
                <div className={styles.cameraReticle} />
                {scanState === "scanning" && <div className={styles.cameraScanLine} />}
                <div className={styles.cameraCaptured}>
                  {scanState === "preparing" && (lang === "bn" ? "ফোকাস হচ্ছে…" : "Focusing…")}
                  {scanState === "scanning"    && (lang === "bn" ? "স্ক্যান হচ্ছে…" : "Scanning…")}
                  {scanState === "capturing"   && (lang === "bn" ? "ক্যাপচার হচ্ছে…" : "Capturing…")}
                  {scanState === "compressing" && (lang === "bn" ? "সংকুচিত হচ্ছে…" : "Compressing…")}
                  {scanState === "analyzing"   && (lang === "bn" ? "মান পরীক্ষা হচ্ছে…" : "Analyzing quality…")}
                  {scanState === "ocr"         && (lang === "bn" ? "OCR চলছে…" : "Running OCR…")}
                  {scanState === "done"        && (lang === "bn" ? "সম্পন্ন ✓" : "Done ✓")}
                </div>
              </>
            )}
          </div>

          <div className={styles.cameraControls}>
            <span style={{ fontSize: "var(--t-label)", color: "var(--on-black-muted, #aaa)" }}>
              {lang === "bn" ? "পৃষ্ঠা সংখ্যা" : "pages"}:
            </span>
            <button type="button" onClick={() => setPageCount(1)} className={pageCount === 1 ? styles.btnActive : styles.btn}>1</button>
            <button type="button" onClick={() => setPageCount(2)} className={pageCount === 2 ? styles.btnActive : styles.btn}>2</button>
            <button type="button" onClick={() => setPageCount(3)} className={pageCount === 3 ? styles.btnActive : styles.btn}>3</button>

            <label style={{ fontSize: "var(--t-label)", color: "#aaa", marginLeft: 12 }}>
              {lang === "bn" ? "ভুল ইনজেক্ট করুন" : "Inject a defect"}:
              <select
                value={injectedIssue}
                onChange={(e) => setSelectedCode(e.target.value)}
                style={{ marginLeft: 6, padding: "4px 6px" }}
              >
                <option value="">—</option>
                {ALL_QUALITY_CODES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            {scanState !== "idle" && (
              <button type="button" onClick={reset} style={{ marginLeft: "auto" }}>
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
            )}
          </div>
        </section>

        {/* ===== AI quality-check result / resubmit banner ===== */}
        {ambiguityBanner && (
          <section className={styles.section}>
            <div className={styles.safetyBanner} role="alert">
              <strong>
                {lang === "bn"
                  ? `AI গুণমান পরীক্ষা — "${ambiguityBanner.label}" পুনরায় জমা দিন`
                  : `AI quality check — resubmit "${ambiguityBanner.label}"`}
              </strong>
              <p style={{ margin: "8px 0 0 0" }}>
                {lang === "bn"
                  ? `মডেল AI নিম্নলিখিত সমস্যা চিহ্নিত করেছে: ${ambiguityBanner.codes.join(", ")}. ছবি অস্পষ্ট বা বিভ্রান্তিকর — অনুগ্রহ করে আরও পরিষ্কার ফাইল আপলোড করুন।`
                  : `The model flagged: ${ambiguityBanner.codes.join(", ")}. The image is ambiguous or hazy — please upload a clearer file or retake the photo.`}
              </p>
              <div className={styles.btnRow}>
                {resubmitFor && (
                  <label className={`${styles.btn} ${styles.btnPrimary}`}>
                    ↑ {lang === "bn" ? "আবার ফাইল দিন" : "Upload another file"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => handleUpload(resubmitFor, e.target.files)}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setAmbiguityBanner(null);
                    setResubmitFor("");
                  }}
                >
                  {lang === "bn" ? "উপেক্ষা করুন" : "Dismiss"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===== Capture triggers (file upload per item) ===== */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "নথি আপলোড ও ক্যাপচার" : "Document upload & capture"}</h2>
            <small style={{ color: "var(--gray)" }}>
              {lang === "bn"
                ? "প্রতিটি আইটেমে সঠিক ফাইল দিন — AI মান পরীক্ষা করবে"
                : "Drop the right file under each item — AI will quality-check it"}
            </small>
          </div>
          <div className={styles.docUploadGrid}>
            {checklist.items.map((it: ChecklistItem) => {
              const label = lang === "bn" ? it.label.bn : it.label.en;
              const up = uploads[it.id];
              const needsResubmit = resubmitFor === it.id;
              return (
                <div
                  key={it.id}
                  className={`${styles.docUploadCard} ${needsResubmit ? styles.docUploadCardFail : up ? styles.docUploadCardReady : ""}`}
                >
                  <div className={styles.docUploadHead}>
                    <strong>{label}</strong>
                    {up && (
                      <span className={`${styles.statusPill} ${styles.statusPillSynced}`}>
                        {lang === "bn" ? "ফাইল প্রস্তুত" : "file ready"}
                      </span>
                    )}
                  </div>

                  {up ? (
                    <div className={styles.docUploadBody}>
                      {up.file.type.startsWith("image/") ? (
                        <img
                          src={up.previewUrl}
                          alt={up.file.name}
                          className={styles.docUploadPreview}
                        />
                      ) : (
                        <div className={styles.docUploadFileChip}>
                          <strong>📄 {up.file.name}</strong>
                          <small>
                            {(up.file.size / 1024).toFixed(1)} KB · {up.file.type || "unknown"}
                          </small>
                        </div>
                      )}
                      <div className={styles.btnRow}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                          onClick={() => acceptUploaded(it.id)}
                          disabled={scanState !== "idle" && scanState !== "done"}
                        >
                          ▶ {lang === "bn" ? "AI পরীক্ষা চালান" : "Run AI check"}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => clearUpload(it.id)}
                        >
                          {lang === "bn" ? "মুছুন" : "Discard"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={styles.docUploadDrop}>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => handleUpload(it.id, e.target.files)}
                      />
                      <span>
                        {lang === "bn"
                          ? "↑ ফাইল টানে আনুন বা ক্লিক করুন"
                          : "↑ Drop a file or click to choose"}
                      </span>
                      <small style={{ color: "var(--gray)" }}>
                        {lang === "bn" ? "ছবি বা PDF" : "image or PDF"}
                      </small>
                    </label>
                  )}

                  {needsResubmit && (
                    <p className={styles.bannerInfo}>
                      {lang === "bn"
                        ? "AI ফিরিয়ে দিয়েছে — আরও পরিষ্কার ফাইল দিন"
                        : "AI rejected this — supply a clearer file"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== Legacy capture row (camera-only path, kept for fallback) ===== */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "ক্যামেরা ক্যাপচার (ফলব্যাক)" : "Camera capture (fallback)"}</h2>
            <small style={{ color: "var(--gray)" }}>
              {lang === "bn"
                ? "ফাইল ছাড়াই সরাসরি ক্যামেরা সিমুলেশন"
                : "Simulated camera capture without a file"}
            </small>
          </div>
          <div className={styles.btnRow}>
            {checklist.items.map((it: ChecklistItem) => {
              const label = lang === "bn" ? it.label.bn : it.label.en;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`${styles.btn} ${styles.btnSm}`}
                  onClick={() => startCapture(it.id, label)}
                  disabled={scanState !== "idle" && scanState !== "done"}
                >
                  + {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ===== Live quality panel ===== */}
        {shots.length > 0 && (
          <section className={styles.qualityPanel}>
            <div>
              <strong style={{ display: "block", marginBottom: 8 }}>
                {lang === "bn" ? "শেষ ক্যাপচারের মান" : "Last capture quality"}
              </strong>
              <QualitySummary shot={shots[shots.length - 1]} lang={lang} />
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 8 }}>
                {lang === "bn" ? "সামগ্রিক" : "Aggregate"}
              </strong>
              <ul className={styles.qualityChecklist}>
                <li className={shots.length === 0 ? "" : styles.pass}>
                  ✓ {shots.length} {lang === "bn" ? "ক্যাপচার সম্পন্ন" : "captures completed"}
                </li>
                <li className={blocking.length === 0 ? styles.pass : styles.fail}>
                  {blocking.length === 0 ? "✓" : "✗"} {blocking.length} {lang === "bn" ? "ব্লকিং সমস্যা" : "blocking issues"}
                </li>
                <li className={shots.length > 0 ? (blockingRate < 30 ? styles.pass : styles.warn) : ""}>
                  ◐ {blockingRate}% {lang === "bn" ? "ব্লকিং হার" : "blocking rate"}
                </li>
                <li className={(totalBytes / 1024) < 500 ? styles.pass : styles.warn}>
                  ◐ {(totalBytes / 1024).toFixed(1)} KB {lang === "bn" ? "মোট সংরক্ষিত" : "stored"}
                </li>
              </ul>
            </div>
          </section>
        )}

        {/* ===== Thumbnail strip ===== */}
        {shots.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "ক্যাপচারের থাম্বনেইল" : "Capture thumbnails"}</h2>
            </div>
            <div className={styles.thumbStrip}>
              {shots.map((s) => {
                const hasBlock = s.findings.some((f) => f.severity === "block");
                const hasWarn  = s.findings.some((f) => f.severity === "warn");
                return (
                  <div
                    key={s.id}
                    className={`${styles.thumb} ${hasBlock ? styles.bad : hasWarn ? styles.warn : styles.good}`}
                    title={`${s.label} · ${s.pageCount}p · ${(s.bytes/1024).toFixed(1)}KB · ${s.scanDurationMs}ms`}
                  >
                    {s.label.slice(0, 4)}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== Captures list with retake/discard ===== */}
        {shots.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{lang === "bn" ? "ক্যাপচারসমূহ" : "Captures"}</h2>
            </div>
            <ul className={styles.docsList}>
              {shots.map((s) => {
                const isBlock = s.findings.some((f) => f.severity === "block");
                return (
                  <li
                    key={s.id}
                    className={styles.docCard}
                    style={{
                      borderLeft: `3px solid ${isBlock ? "var(--red)" : "var(--green)"}`,
                      background: isBlock ? "#fef2f2" : "#f0fdf4",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{s.label}</strong>
                      <span style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
                        {s.id.slice(-6)} · {s.pageCount}p · {(s.bytes/1024).toFixed(1)}KB · {s.scanDurationMs}ms
                        {s.retryOf && (
                          <em style={{ marginLeft: 8, color: "var(--green)" }}>
                            ({lang === "bn" ? "পুনঃক্যাপচার" : "retake"} of {s.retryOf.slice(-6)})
                          </em>
                        )}
                      </span>
                    </div>
                    <ul className={styles.docFindings}>
                      {s.findings.length === 0 ? (
                        <li className={styles.docFindingOk}>
                          {lang === "bn" ? "✓ সব পরীক্ষা পাস" : "✓ All checks passed"}
                        </li>
                      ) : (
                        s.findings.map((f, i) => (
                          <li
                            key={i}
                            className={f.severity === "block" ? styles.docFindingBlock : styles.docFindingWarn}
                          >
                            {f.code} · <strong>{f.severity}</strong> · {lang === "bn" ? f.message.bn : f.message.en}{" "}
                            <em style={{ color: "var(--gray)" }}>
                              ({lang === "bn" ? f.guidance.bn : f.guidance.en})
                            </em>
                          </li>
                        ))
                      )}
                    </ul>

                    {/* ===== OCR result (only when an actual file was uploaded) ===== */}
                    {s.ocrText !== undefined ? (
                      <div
                        className={s.ocrHazy ? styles.ocrBlockHazy : styles.ocrBlockOk}
                        style={{ marginTop: 8 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <strong>
                            {lang === "bn" ? "OCR ফলাফল" : "OCR result"}
                          </strong>
                          <small style={{ color: "var(--gray)" }}>
                            {lang === "bn" ? "আত্মবিশ্বাস" : "confidence"}:{" "}
                            <strong style={{
                              color: (s.ocrConfidence ?? 0) > 0.7 ? "var(--green, #16a34a)" :
                                     (s.ocrConfidence ?? 0) > 0.4 ? "#b8830b" : "var(--red, #dc2626)",
                            }}>
                              {Math.round((s.ocrConfidence ?? 0) * 100)}%
                            </strong>
                            {" · "}
                            {s.ocrPages} {lang === "bn" ? "পৃষ্ঠা" : "page(s)"}
                          </small>
                        </div>
                        <pre style={{
                          margin: "8px 0 0 0",
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                          fontSize: "var(--t-small)",
                          color: "var(--ink)",
                        }}>{s.ocrText}</pre>
                        {s.ocrHazy ? (
                          <p style={{ margin: "8px 0 0 0", color: "var(--red, #dc2626)" }}>
                            <strong>
                              {lang === "bn"
                                ? "✗ ছবি অস্পষ্ট — আবার তুলুন বা আরও পরিষ্কার ফাইল দিন"
                                : "✗ Document is hazy — retake or upload a clearer file"}
                            </strong>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className={styles.btnRow}>
                      {isBlock && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                          onClick={() => retake(s)}
                          disabled={scanState !== "idle" && scanState !== "done"}
                        >
                          {lang === "bn" ? "আবার তুলুন" : "Retake"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => discard(s.id)}
                      >
                            {lang === "bn" ? "বাতিল" : "Discard"}
                          </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className={styles.section}>
          <Link href={`/dashboard/${role}/intake/${temporaryId}`} className={styles.btn}>
            ← {lang === "bn" ? "ইনটেকে ফিরে যান" : "Back to intake"}
          </Link>
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */
function QualitySummary({ shot, lang }: { shot: CapturedShot; lang: "bn" | "en" }) {
  const score = scoreFor(shot);
  const cls = score >= 80 ? "ok" : score >= 50 ? "warn" : "fail";
  return (
    <div>
      <div className={`${styles.qualityScore} ${styles[cls]}`}>
        <span className={styles.qualityScoreNum}>{score}</span>
        <span>/ 100 {lang === "bn" ? "মান স্কোর" : "quality score"}</span>
      </div>
      <ul className={styles.qualityChecklist}>
        {shot.findings.length === 0 ? (
          <li className={styles.pass}>
            {lang === "bn" ? "✓ ১০টি পরীক্ষা পাস" : "✓ All 10 checks passed"}
          </li>
        ) : (
          shot.findings.map((f, i) => (
            <li
              key={i}
              className={f.severity === "block" ? styles.fail : styles.warn}
            >
              {f.severity === "block" ? "✗" : "!"} {f.code} · {lang === "bn" ? f.message.bn : f.message.en}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function scoreFor(shot: CapturedShot): number {
  let score = 100;
  for (const f of shot.findings) {
    if (f.severity === "block") score -= 35;
    else if (f.severity === "warn") score -= 12;
  }
  return Math.max(0, score);
}

/** Build a realistic set of quality findings. If a defect is injected, force it in.
 *  When a real file is provided, the mock AI uses crude file-shape
 *  heuristics to decide:
 *    - tiny files  (<50 KB)  → wrong_document_category / unreadable_text
 *    - huge files  (>10 MB)  → motion_blur / overexposure warning
 *    - non-image mime (pdf) → page_count warning if < 200 KB
 *  The same effect kicks in for blurry / hazy / ambiguous uploads —
 *  these return blocking findings so the UI can prompt a retake. */
function synthesizeQuality(
  label: string,
  injected?: string,
  uploaded?: File,
): DocumentQualityFinding[] {
  const findings: DocumentQualityFinding[] = [];
  const codes = ALL_QUALITY_CODES;
  const warnIdx = Math.floor(Math.random() * codes.length);
  const blockIdx = Math.floor(Math.random() * codes.length);

  // 1) Explicit injected defect always wins.
  if (injected && (ALL_QUALITY_CODES as readonly string[]).includes(injected)) {
    findings.push(DocumentQualityService.finding(injected as DocumentQualityIssueCode));
    return findings;
  }

  // 2) File-shape heuristic — mimics what a future CV/OCR quality
  //    service would return. Tiny files look ambiguous / unreadable,
  //    huge files are usually blurry scans, PDFs under 200 KB are
  //    often missing pages or cropped at the edges, filenames with
  //    "scan" under 100 KB typically have low contrast.
  if (uploaded) {
    const size = uploaded.size;
    const mime = uploaded.type || "";
    const name = (uploaded.name || "").toLowerCase();
    if (size > 0 && size < 50_000) {
      findings.push(DocumentQualityService.finding("wrong_document_category"));
      findings.push(DocumentQualityService.finding("unreadable_text"));
    } else if (size > 10_000_000) {
      findings.push(DocumentQualityService.finding("oversized_image"));
    } else if (mime === "application/pdf" && size < 200_000) {
      findings.push(DocumentQualityService.finding("missing_page"));
    } else if (name.includes("scan") && size < 100_000) {
      findings.push(DocumentQualityService.finding("low_contrast"));
    } else if (Math.random() < 0.15) {
      // 15% chance of a hazy scan on otherwise-valid uploads.
      findings.push(DocumentQualityService.finding("blur"));
    }
    return findings;
  }

  // 3) Pure camera-capture mode — random warning/blocker.
  if (Math.random() < 0.3) findings.push(DocumentQualityService.finding(codes[warnIdx]));
  if (Math.random() < 0.1) findings.push(DocumentQualityService.finding(codes[blockIdx]));
  return findings;
}

/** ---------------------------------------------------------------- *
 *  Mock OCR — replace with real Tesseract / cloud OCR call later.
 *
 *  Hazy verdict (which triggers the resubmit banner) is set when:
 *    - quality findings include blur / unreadable_text / low_contrast
 *    - file is very small (< 30 KB) → too little signal
 *    - file is a PDF under 150 KB → likely a blank scan
 *    - random 8% chance to simulate real-world fuzziness
 *
 *  Confidence is roughly inverse to the number of red flags.
 *  Text is fabricated plausibly so the UI has something to display.
 * ---------------------------------------------------------------- */
function mockOcr(
  file: File,
  findings: DocumentQualityFinding[],
): { text: string; confidence: number; hazy: boolean; pages: number } {
  const codes = new Set(findings.map((f) => f.code));
  const hazeFlags =
    (codes.has("blur") ? 1 : 0) +
    (codes.has("unreadable_text") ? 1 : 0) +
    (codes.has("low_contrast") ? 1 : 0) +
    (codes.has("glare") ? 0.5 : 0);
  const tinyFile = file.size < 30_000;
  const tinyPdf = file.type === "application/pdf" && file.size < 150_000;
  const randomHaze = Math.random() < 0.08;

  const hazy = hazeFlags > 0 || tinyFile || tinyPdf || randomHaze;
  const confidence = Math.max(
    0,
    Math.min(1, 0.95 - hazeFlags * 0.25 - (tinyFile ? 0.3 : 0) - (tinyPdf ? 0.2 : 0) - (randomHaze ? 0.15 : 0)),
  );

  const text = hazy
    ? "[OCR low-confidence — image is too hazy to read]"
    : `নাম: ____________________\nপিতা: ____________________\nগ্রাম: ____________________\nজেলা: ____________________\n\nবিষয়: আবেদন\n\n(এই নমুনা পাঠ্য — বাস্তব OCR সংযোগ পরে যোগ হবে।)`;

  const pages = file.type === "application/pdf" ? Math.max(1, Math.round(file.size / 80_000)) : 1;
  return { text, confidence, hazy, pages };
}
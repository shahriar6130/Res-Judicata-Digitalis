"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  ConsentService,
  useHelplineStore,
  type AssistanceConsent,
  type ConsentTopic,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

type ConsentVideo = {
  topic: ConsentTopic;
  url: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  recordedAt: string;
};

export function UdcConsentPanel({
  temporaryId,
  role = "udc",
}: {
  temporaryId: string;
  role?: string;
}) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const intake = envelope.assistedIntakes?.find((a) => a.temporaryId === temporaryId);
  const [topics, setTopics] = useState<ConsentTopic[]>(intake?.consents.map((c) => c.topic) ?? []);

  // Camera / recording state. Only one webcam stream is open at a time.
  const [activeTopic, setActiveTopic] = useState<ConsentTopic | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [videos, setVideos] = useState<Record<string, ConsentVideo>>({});
  const [supported, setSupported] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    ensureSeeded();
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined",
    );
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setRecording(false);
    setActiveTopic(null);
  }

  async function openCamera(topic: ConsentTopic) {
    setCameraError("");
    if (streamRef.current) stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setActiveTopic(topic);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => { /* autoplay may be blocked; user can press play */ });
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(
        lang === "bn"
          ? `ক্যামেরা চালু করা যায়নি: ${msg}`
          : `Could not open camera: ${msg}`,
      );
    }
  }

  function startRecording() {
    if (!streamRef.current || !activeTopic) return;
    chunksRef.current = [];
    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = mimeCandidates.find((m) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
    ) ?? "";
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const durationMs = Date.now() - startedAtRef.current;
      const topic = activeTopic;
      setVideos((prev) => ({
        ...prev,
        [topic]: {
          topic,
          url,
          durationMs,
          mimeType: blob.type,
          sizeBytes: blob.size,
          recordedAt: new Date().toISOString(),
        },
      }));

      // Persist this video as the consent evidence for the topic.
      // The blob is held in component state; we record the consent
      // entry pointing at it so the rest of the intake flow sees the
      // capture.
      try {
        ConsentService.record({
          topic,
          method: "video_consent_capture",
          language: lang === "bn" ? "bn" : "en",
          explainedBy: "udc-001",
          applicantResponse: "yes",
          note: {
            en: `Video consent capture · ${(blob.size / 1024).toFixed(0)} KB · ${(durationMs / 1000).toFixed(1)}s · ${blob.type}`,
            bn: `ভিডিও সম্মতি ক্যাপচার · ${(blob.size / 1024).toFixed(0)} KB · ${(durationMs / 1000).toFixed(1)}সে · ${blob.type}`,
          },
        });
      } catch {
        /* ConsentService.record failures should not block the user from
           seeing their own recording. The video still lives in the
           component state. */
      }

      stopCamera();
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    recorder.start();
    setRecording(true);
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function clearVideo(topic: ConsentTopic) {
    setVideos((prev) => {
      const next = { ...prev };
      if (next[topic]?.url) URL.revokeObjectURL(next[topic].url);
      delete next[topic];
      return next;
    });
  }

  if (!intake) {
    return (
      <main id="udc-main" className={styles.page}>
        <SkipLink targetId="udc-main" />
        <h1 className={styles.pageTitle}>{lang === "bn" ? "ইনটেক পাওয়া যায়নি" : "Intake not found"}</h1>
        <Link href={`/dashboard/${role}/intake/new`} className={styles.cardLink}>
          {lang === "bn" ? "নতুন ইনটেক →" : "New intake →"}
        </Link>
      </main>
    );
  }

  const noticeMap = ConsentService.topicNotices();
  const allTopics = ConsentService.topics();
  const methods = ConsentService.methods();

  const requiredTopics: ConsentTopic[] = [
    "form_entry_assistance",
    "human_translation_or_interpretation",
    "temporary_offline_storage",
    "submission_to_dlas",
  ];
  const missing = requiredTopics.filter((t) => !topics.includes(t));

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · সম্মতি রেকর্ড" : "UDC · consent record"}
          </span>
          <h1 className={styles.pageTitle}>
            {intake.applicantName} · {intake.temporaryId}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn"
              ? "প্রতিটি সম্মতি একটি ভিডিও হিসেবে রেকর্ড করা হয় — ক্যামেরা চালু করে আবেদনকারীর মৌখিক সম্মতি ধারণ করুন। ভিডিওটিই এই বিষয়ের সম্মতি প্রমাণ।"
              : "Each consent is captured on video — open the camera to record the applicant's oral consent. The video itself is the consent evidence for that topic."}
          </p>
          <p className={styles.bannerInfo}>
            <strong>
              {lang === "bn"
                ? `${Object.keys(videos).length} / ${allTopics.length} ভিডিও সম্মতি রেকর্ড হয়েছে`
                : `${Object.keys(videos).length} / ${allTopics.length} video consents on file`}
            </strong>
            {Object.keys(videos).length < allTopics.length ? (
              <>
                {" · "}
                {lang === "bn"
                  ? "বাকি বিষয়গুলোতে ভিডিও রেকর্ড করুন"
                  : "Record video for the remaining topics"}
              </>
            ) : (
              <>
                {" · "}
                <span style={{ color: "var(--green, #16a34a)" }}>
                  {lang === "bn" ? "সব ভিডিও সম্মতি সম্পন্ন ✓" : "All video consents complete ✓"}
                </span>
              </>
            )}
          </p>
        </header>

        <section className={styles.section}>
          {missing.length > 0 ? (
            <p className={styles.safetyBanner}>
              {lang === "bn"
                ? `প্রয়োজনীয় সম্মতি অনুপস্থিত: ${missing.join(", ")}`
                : `Missing required consents: ${missing.join(", ")}`}
            </p>
          ) : (
            <p className={styles.bannerSuccess}>
              {lang === "bn" ? "সব প্রয়োজনীয় সম্মতি পাওয়া গেছে।" : "All required consents granted."}
            </p>
          )}
          <div className={styles.consentList}>
            {allTopics.map((t) => {
              const notice = noticeMap[t];
              const existing: AssistanceConsent | undefined = intake.consents.find((c) => c.topic === t);
              const isActive = activeTopic === t;
              const video = videos[t];
              return (
                <div key={t} className={styles.consentRow}>
                  <input
                    id={`consent-${t}`}
                    type="checkbox"
                    checked={topics.includes(t)}
                    onChange={(e) =>
                      setTopics((prev) =>
                        e.target.checked
                          ? [...prev, t]
                          : prev.filter((p) => p !== t),
                      )
                    }
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                      <strong>{t}</strong>
                      {video ? (
                        <span
                          className={`${styles.statusPill} ${styles.statusPillSynced}`}
                          title={
                            lang === "bn"
                              ? "ভিডিও সম্মতি প্রমাণ হিসেবে সংরক্ষিত"
                              : "Stored as consent evidence"
                          }
                        >
                          ● {lang === "bn" ? "ভিডিও সম্মতি প্রমাণ" : "video consent evidence"}
                        </span>
                      ) : null}
                    </div>
                    <p className={styles.consentNotice}>
                      {lang === "bn" ? notice.bn : notice.en}
                    </p>
                    <div className={styles.consentMethod}>
                      {methods.map((m) => (
                        <label key={m}>
                          <input
                            type="radio"
                            name={`method-${t}`}
                            checked={
                              video
                                ? m === "video_consent_capture"
                                : existing?.method === m
                            }
                            readOnly
                          />
                          {m === "video_consent_capture"
                            ? (lang === "bn" ? "ভিডিও সম্মতি ক্যাপচার" : "video consent capture")
                            : m}
                        </label>
                      ))}
                    </div>
                    {existing ? (
                      <p className={styles.bannerInfo}>
                        {lang === "bn" ? "রেকর্ডকারী" : "Recorded by"}: {existing.explainedBy} ·{" "}
                        {lang === "bn" ? "ভাষা" : "Lang"}: {existing.language} ·{" "}
                        {existing.obtainedAt.split("T")[0]}
                      </p>
                    ) : null}

                    {/* ===== Video consent capture ===== */}
                    <div className={styles.consentVideoRow}>
                      {supported === false ? (
                        <small style={{ color: "var(--gray)" }}>
                          {lang === "bn"
                            ? "এই ব্রাউজারে ভিডিও ক্যাপচার সমর্থিত নয় — মৌখিক রিডব্যাক ব্যবহার করুন"
                            : "Video capture not supported in this browser — use oral read-back"}
                        </small>
                      ) : null}

                      {!isActive && !video && supported !== false ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSm}`}
                          onClick={() => openCamera(t)}
                        >
                          ● {lang === "bn" ? "ভিডিও সম্মতি রেকর্ড করুন" : "Record video consent"}
                        </button>
                      ) : null}

                      {isActive ? (
                        <div className={styles.consentCamera}>
                          <video
                            ref={videoRef}
                            className={styles.consentCameraPreview}
                            playsInline
                          />
                          <div className={styles.consentCameraStatus}>
                            <span className={`${styles.statusPill} ${recording ? styles.statusPillConflict : styles.statusPillSynced}`}>
                              {recording
                                ? `● REC ${(elapsedMs / 1000).toFixed(1)}s`
                                : (lang === "bn" ? "ক্যামেরা প্রস্তুত" : "Camera ready")}
                            </span>
                          </div>
                          <div className={styles.btnRow}>
                            {!recording ? (
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={startRecording}
                              >
                                ● {lang === "bn" ? "রেকর্ড শুরু" : "Start recording"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={stopRecording}
                              >
                                ■ {lang === "bn" ? "রেকর্ড বন্ধ" : "Stop recording"}
                              </button>
                            )}
                            <button type="button" className={styles.btn} onClick={stopCamera}>
                              {lang === "bn" ? "বাতিল" : "Cancel"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {video && !isActive ? (
                        <div className={styles.consentVideoPlayback}>
                          <video
                            src={video.url}
                            controls
                            playsInline
                            className={styles.consentCameraPreview}
                          />
                          <small style={{ color: "var(--gray)" }}>
                            {(video.durationMs / 1000).toFixed(1)}s ·{" "}
                            {(video.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                            {video.mimeType || "video/webm"}
                          </small>
                          <div className={styles.btnRow}>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSm}`}
                              onClick={() => openCamera(t)}
                            >
                              {lang === "bn" ? "পুনরায় রেকর্ড" : "Re-record"}
                            </button>
                            <button
                              type="button"
                              className={styles.btn}
                              onClick={() => clearVideo(t)}
                            >
                              {lang === "bn" ? "মুছুন" : "Discard"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {cameraError && !isActive ? (
                        <p className={styles.safetyBanner} role="alert">
                          {cameraError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
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

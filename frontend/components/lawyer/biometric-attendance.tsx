"use client";

/* ------------------------------------------------------------------ *
 *  /lawyer/biometric — SIMULATED biometric attendance for panel lawyers.
 *  Press and hold the fingerprint pad for 2 seconds: today's attendance is
 *  registered as PRESENT with method BIOMETRIC_SIMULATED (audited on the
 *  lawyer's record). Releasing early records nothing. No fingerprint is
 *  read — the scanner is a clearly labelled simulator for the prototype.
 * ------------------------------------------------------------------ */

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
import { LawyerAuth, dayKey, formatDateTime, useClock, useDlasDb } from "@/lib/dlas";

const HOLD_MS = 2000;
const DEVICE = "SIM-FP-SCANNER-01";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("dlas:db-changed", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("dlas:db-changed", cb);
  };
};
const currentLawyerId = () => {
  try {
    return window.localStorage.getItem("dlas.lawyer.current");
  } catch {
    return null;
  }
};

type Phase = "idle" | "scanning" | "done" | "short" | "error";

export function BiometricAttendance() {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const db = useDlasDb();
  const id = useSyncExternalStore(subscribe, currentLawyerId, () => null);
  const me = id ? db.lawyers.find((l) => l.lawyerId === id) : undefined;
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const now = useClock();
  const todayKey = me && now ? dayKey(now) : "";
  const today = me?.attendance?.find((d) => d.date === todayKey) ?? null;

  function stopLoop() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  function complete() {
    stopLoop();
    start.current = null;
    try {
      LawyerAuth.markAttendance("PRESENT", { method: "BIOMETRIC_SIMULATED", deviceId: DEVICE });
      setPhase("done");
      setError("");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(80);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function tick() {
    if (start.current === null) return;
    // rAF only animates the ring; the 2-second timer below decides (rAF pauses in background tabs).
    setProgress(Math.min(1, (performance.now() - start.current) / HOLD_MS));
    raf.current = requestAnimationFrame(tick);
  }
  function press() {
    if (!me || start.current !== null) return;
    setError("");
    setPhase("scanning");
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
    timer.current = setTimeout(complete, HOLD_MS);
  }
  function release() {
    if (start.current === null) return;
    stopLoop();
    start.current = null;
    setProgress(0);
    setPhase("short");
  }

  const ring = 2 * Math.PI * 88;
  const status =
    phase === "scanning"
      ? tx("স্ক্যান হচ্ছে… আঙুল ধরে রাখুন", "Scanning… keep your finger on the pad")
      : phase === "done"
        ? tx("✓ উপস্থিতি নিবন্ধিত", "✓ Attendance registered")
        : phase === "short"
          ? tx("খুব তাড়াতাড়ি ছেড়েছেন — ২ সেকেন্ড ধরে রাখুন", "Released too early — hold for 2 seconds")
          : phase === "error"
            ? error
            : tx("আঙুল রেখে ২ সেকেন্ড ধরে রাখুন", "Place your finger and hold for 2 seconds");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px", background: "var(--off-white, #faf9f6)" }}>
      <div style={{ width: "min(440px, 100%)", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 12, letterSpacing: "0.1em", fontWeight: 700, color: "var(--dlo-muted, #6b7280)" }}>{tx("প্যানেল আইনজীবী · বায়োমেট্রিক উপস্থিতি", "PANEL LAWYER · BIOMETRIC ATTENDANCE")}</span>
          <LanguageToggle />
        </div>
        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 4, border: "1.5px dashed #7c3aed", color: "#6d28d9", background: "#f5f3ff", marginBottom: 16 }}>
          {tx("সিমুলেটেড স্ক্যানার — কোনো আঙুলের ছাপ পড়া হয় না", "SIMULATED SCANNER — NO FINGERPRINT IS READ")}
        </div>

        {!me ? (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--white)", padding: 24 }}>
            <p style={{ margin: "0 0 12px" }}>{tx("উপস্থিতি দিতে আগে প্যানেল আইনজীবী হিসেবে সাইন ইন করুন।", "Sign in as a panel lawyer first to register attendance.")}</p>
            <Link href="/lawyer" style={{ fontWeight: 700 }}>
              {tx("আইনজীবী সাইন-ইন →", "Lawyer sign-in →")}
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "var(--font-serif)", margin: "0 0 4px", fontSize: "1.6rem" }}>{me.name}</h1>
            <p style={{ margin: "0 0 20px", color: "var(--dlo-muted)" }}>
              {me.barEnrolmentNo} · {new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(now || 0))}
            </p>

            <button
              type="button"
              aria-label={tx("আঙুলের ছাপ প্যাড — ২ সেকেন্ড চেপে ধরুন", "Fingerprint pad — press and hold for 2 seconds")}
              onPointerDown={(e) => {
                try {
                  e.currentTarget.setPointerCapture(e.pointerId); // keep the hold even if the finger drifts a little
                } catch {
                  /* no active pointer (e.g. assistive tech) — the hold still works */
                }
                press();
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                  e.preventDefault();
                  press();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " " || e.key === "Enter") release();
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{ position: "relative", width: 200, height: 200, borderRadius: "50%", border: 0, padding: 0, background: "transparent", cursor: "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
            >
              <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden>
                <circle cx="100" cy="100" r="88" fill={phase === "done" ? "#dcfce7" : phase === "scanning" ? "#eef2ff" : "#ffffff"} stroke="#e5e7eb" strokeWidth="10" />
                <circle cx="100" cy="100" r="88" fill="none" stroke={phase === "done" ? "#16a34a" : "#4f46e5"} strokeWidth="10" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - (phase === "done" ? 1 : progress))} transform="rotate(-90 100 100)" />
                <g fill="none" stroke={phase === "done" ? "#16a34a" : phase === "scanning" ? "#4f46e5" : "#6b7280"} strokeWidth="3.5" strokeLinecap="round">
                  <path d="M70 118c0-22 13-38 30-38s30 16 30 38" />
                  <path d="M80 124c0-18 8-32 20-32s20 14 20 32" />
                  <path d="M90 130c0-14 4-26 10-26s10 12 10 26" />
                  <path d="M100 112v26" />
                  <path d="M60 104c6-20 22-34 40-34s34 14 40 34" />
                  <path d="M66 86c9-12 21-20 34-20s25 8 34 20" />
                </g>
              </svg>
            </button>

            <p role="status" aria-live="polite" style={{ fontWeight: 700, minHeight: 24, color: phase === "done" ? "#15803d" : phase === "short" || phase === "error" ? "#b91c1c" : "var(--ink)" }}>
              {status}
            </p>

            <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--white)", padding: "12px 16px", textAlign: "left", fontSize: 14 }}>
              <strong>{tx("আজকের উপস্থিতি", "Today's attendance")}:</strong>{" "}
              {today ? (
                <>
                  {today.status === "PRESENT" ? tx("উপস্থিত", "Present") : tx("অনুপস্থিত", "Absent")} · {formatDateTime(today.at, lang)} ·{" "}
                  {today.method === "BIOMETRIC_SIMULATED" ? tx("বায়োমেট্রিক (সিমুলেটেড)", "biometric (simulated)") : tx("নিজে ঘোষিত", "self-declared")}
                </>
              ) : (
                tx("এখনো দেওয়া হয়নি", "not registered yet")
              )}
              <div style={{ color: "var(--dlo-muted)", fontSize: 12, marginTop: 4 }}>
                {tx("ডিভাইস", "Device")}: {DEVICE} · {tx("রেকর্ড আপনার অ্যাকাউন্টের অডিটে যায় এবং জেলা অফিস দেখতে পায়।", "Recorded in your account's audit; the district office can see it.")}
              </div>
            </div>
            <p style={{ marginTop: 16 }}>
              <Link href="/dashboard/lawyer#attendance">{tx("← আমার উপস্থিতি", "← My attendance")}</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

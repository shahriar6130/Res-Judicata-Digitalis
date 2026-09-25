"use client";

/* ------------------------------------------------------------------ *
 *  UDC light mode UI (lib/shakkho/services/light-mode.service.ts).
 *   • LightModeStrip  — under the network bar on every UDC screen: a
 *     paper-slip style note "text sent · files waiting", with upload
 *     progress when the connection comes back.
 *   • HeldUploadsList — the full list (Sync Centre).
 *  Network + uploads are SIMULATED.
 * ------------------------------------------------------------------ */

import { useEffect } from "react";
import { LightMode, installLightModeAutoFlush, useLightMode, type HeldUpload } from "@/lib/shakkho";
import { useClock } from "@/lib/dlas";
import { useNetwork } from "./use-network";
import styles from "../udc.module.css";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const WEAK_LABEL = { slow: { bn: "ধীর নেটওয়ার্ক", en: "slow network" }, intermittent: { bn: "অস্থির নেটওয়ার্ক", en: "unstable network" }, offline: { bn: "অফলাইন", en: "offline" } } as const;

const paper: React.CSSProperties = {
  background: "#fffdf6",
  color: "#1f2937",
  border: "1px dashed #b8a98a",
  borderRadius: 6,
  padding: "10px 14px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.85rem",
  lineHeight: 1.5,
  boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
};

function Bar({ u }: { u: HeldUpload }) {
  return (
    <span aria-hidden style={{ display: "inline-block", width: 120, height: 8, background: "#ece6d6", borderRadius: 4, overflow: "hidden", verticalAlign: "middle", marginLeft: 8 }}>
      <span style={{ display: "block", height: "100%", width: `${u.progress}%`, background: u.status === "SENT" ? "#15803d" : "#b45309", transition: "width .2s linear" }} />
    </span>
  );
}

function Row({ u, lang }: { u: HeldUpload; lang: "bn" | "en" }) {
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const state =
    u.status === "HELD" ? tx("⏸ এই ডিভাইসে রাখা — ভালো সংযোগের অপেক্ষা", "⏸ held on this device — waiting for a good connection")
    : u.status === "UPLOADING" ? tx(`↑ পাঠানো হচ্ছে ${u.progress}%`, `↑ uploading ${u.progress}%`)
    : u.status === "SENT" ? tx(`✓ পাঠানো হয়েছে ${u.attachedTo === "APPLICATION" ? "— আবেদনে যুক্ত" : "— ইনটেকে যুক্ত"}`, `✓ sent ${u.attachedTo === "APPLICATION" ? "— added to the application" : "— added to the intake"}`)
    : tx(`! ব্যর্থ — ${u.error}`, `! failed — ${u.error}`);
  return (
    <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span>📎 {u.label}</span>
      <span style={{ opacity: 0.7 }}>
        {u.fileName} · {kb(u.bytes)}
      </span>
      <span style={{ color: u.status === "SENT" ? "#15803d" : u.status === "FAILED" ? "#b91c1c" : "#92400e", fontWeight: 600 }}>{state}</span>
      {u.status === "UPLOADING" || u.status === "SENT" ? <Bar u={u} /> : null}
      {u.error && u.status === "HELD" ? <span style={{ opacity: 0.7 }}>({u.error})</span> : null}
    </li>
  );
}

/** Under the network bar — visible on every UDC screen while light mode matters. */
export function LightModeStrip({ lang = "en" }: { lang?: "bn" | "en" }) {
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const net = useNetwork();
  const { uploads, lastText } = useLightMode();
  const now = useClock();
  useEffect(() => installLightModeAutoFlush(), []);
  const weak = LightMode.active(net);
  const pending = uploads.filter((u) => u.status !== "SENT");
  const recent = uploads.filter((u) => u.status === "SENT" && u.sentAt && (!now || now - new Date(u.sentAt).getTime() < 120_000));
  if (!weak && !pending.length && !recent.length) return null;
  const heldBytes = pending.reduce((n, u) => n + u.bytes, 0);
  return (
    <div role="status" aria-live="polite" style={{ ...paper, margin: "8px var(--page-pad, 16px)" }}>
      <div style={{ fontWeight: 700, letterSpacing: 0.3 }}>
        {weak ? tx(`📄 লাইট মোড — ${WEAK_LABEL[net.kind as keyof typeof WEAK_LABEL]?.bn ?? ""}`, `📄 LIGHT MODE — ${WEAK_LABEL[net.kind as keyof typeof WEAK_LABEL]?.en ?? ""}`) : pending.some((u) => u.status === "UPLOADING") ? tx("↑ সংযোগ ফিরেছে — রাখা ফাইল পাঠানো হচ্ছে", "↑ CONNECTION BACK — sending held files") : tx("✓ সংযোগ ভালো", "✓ CONNECTION GOOD")}
        <span style={{ fontWeight: 400, opacity: 0.7 }}> · {tx("সিমুলেটেড", "simulated")}</span>
      </div>
      {weak ? (
        <div>
          {tx("শুধু লেখা (টেক্সট) পাঠানো হচ্ছে — ছবি/PDF এই ডিভাইসে থাকছে, সংযোগ ভালো হলে নিজে থেকে যাবে। কোনো বড় ফাইল এখন পাঠানো হবে না।", "Only text is sent now — photos/PDFs stay on this device and go automatically when the connection is good. No big files are sent on this link.")}
        </div>
      ) : null}
      <div style={{ borderTop: "1px dashed #d6ccb4", marginTop: 6, paddingTop: 6, display: "grid", gap: 2 }}>
        {lastText ? (
          <div>
            {tx("লেখা পাঠানো", "TEXT SENT")} ✓ {kb(lastText.bytes)} · {lastText.temporaryId} · {new Date(lastText.at).toLocaleTimeString()}
            {lastText.heldFiles ? ` · ${tx("তখন রাখা ফাইল", "files held then")}: ${lastText.heldFiles} (${kb(lastText.heldBytes)})` : ""}
          </div>
        ) : null}
        <div>
          {tx("অপেক্ষমাণ ফাইল", "FILES WAITING")}: {pending.length} {pending.length ? `(${kb(heldBytes)})` : ""}
          {!weak && pending.some((u) => u.status === "HELD" || u.status === "FAILED") ? (
            <button type="button" onClick={() => void LightMode.flush()} style={{ marginLeft: 10, font: "inherit", textDecoration: "underline", background: "none", border: 0, cursor: "pointer" }}>
              {tx("এখন পাঠান", "send now")}
            </button>
          ) : null}
        </div>
        {pending.length || recent.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
            {[...pending, ...recent].slice(0, 5).map((u) => (
              <Row key={u.id} u={u} lang={lang} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Full list for the Sync Centre. */
export function HeldUploadsList({ lang = "en" }: { lang?: "bn" | "en" }) {
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const net = useNetwork();
  const { uploads } = useLightMode();
  const weak = LightMode.active(net);
  return (
    <section className={styles.callColumn} aria-label={tx("লাইট মোড — রাখা ফাইল", "Light mode — held files")}>
      <h2>{tx("লাইট মোড — এই ডিভাইসে রাখা ফাইল", "Light mode — files held on this device")}</h2>
      <p style={{ margin: "4px 0 8px" }}>
        {tx("ধীর / অস্থির / অফলাইন নেটওয়ার্কে শুধু লেখা পাঠানো হয়; ফাইল এখানে অপেক্ষা করে এবং সংযোগ ফিরলে নিজে থেকে পাঠানো হয় (সিমুলেটেড)।", "On a slow, unstable or offline network only the text is sent; files wait here and upload automatically when the connection returns (simulated).")}
      </p>
      {!uploads.length ? (
        <p style={{ opacity: 0.7 }}>{tx("কোনো ফাইল রাখা নেই।", "No files are held.")}</p>
      ) : (
        <ul style={{ ...paper, listStyle: "none", display: "grid", gap: 4 }}>
          {[...uploads].reverse().map((u) => (
            <Row key={u.id} u={u} lang={lang} />
          ))}
        </ul>
      )}
      <div className={styles.btnRow}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={weak || !uploads.some((u) => u.status === "HELD" || u.status === "FAILED")} onClick={() => void LightMode.flush()}>
          ↑ {weak ? tx("ভালো সংযোগের অপেক্ষা…", "Waiting for a good connection…") : tx("রাখা ফাইল এখন পাঠান", "Send held files now")}
        </button>
        {uploads.some((u) => u.status === "SENT") ? (
          <button type="button" className={styles.btn} onClick={() => LightMode.clearSent()}>
            {tx("পাঠানোগুলো সরান", "Clear sent")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

"use client";

/* ------------------------------------------------------------------ *
 *  DocViewButton — "View" for a document on the shared record, used by
 *  both the DLAO workspace and the citizen's case page.
 *
 *  Opens a pop-up. If a viewable copy is stored in this browser
 *  (localStorage["dlas.files.v1"]) it shows that file. Otherwise it
 *  shows a clearly labelled SAMPLE PREVIEW built from the record's own
 *  metadata (type, file name, size, hash) — never passed off as the
 *  real document.
 * ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DOC_TYPES, label, useStoredFile, type ApplicationRecord, type DocumentRef } from "@/lib/dlas";
import { useI18n } from "@/lib/i18n";
import { X } from "@/components/icons";
import styles from "./doc-viewer.module.css";

export function DocViewButton({ app, doc, className }: { app: ApplicationRecord; doc: DocumentRef; className?: string }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? styles.viewBtn} onClick={() => setOpen(true)}>
        {lang === "bn" ? "দেখুন" : "View"}
      </button>
      {open ? <DocViewer app={app} doc={doc} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DocViewer({ app, doc, onClose }: { app: ApplicationRecord; doc: DocumentRef; onClose: () => void }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const f = useStoredFile(doc.docId);
  const typeLabel = label(DOC_TYPES, doc.type, lang);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const real = f && (f.mime.startsWith("image/") || f.mime === "application/pdf");

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={typeLabel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <div>
            <div className={styles.title}>{typeLabel}</div>
            <div className={styles.sub}>
              {doc.fileName ?? doc.docId} · {app.applicationId}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={tx("বন্ধ করুন", "Close")}>
            <X size={20} />
          </button>
        </header>

        <div className={styles.body}>
          {real ? (
            f.mime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.image} src={f.dataUrl} alt={typeLabel} />
            ) : (
              <iframe className={styles.pdf} src={f.dataUrl} title={typeLabel} />
            )
          ) : (
            <MockDocument app={app} doc={doc} typeLabel={typeLabel} />
          )}
        </div>

        <footer className={styles.foot}>
          {real ? (
            <span className={styles.okNote}>✓ {tx("এই ব্রাউজারে সংরক্ষিত কপি দেখানো হচ্ছে", "Showing the copy stored in this browser")}</span>
          ) : (
            <span className={styles.warnNote}>
              {tx("নমুনা প্রিভিউ — আসল ফাইল এই ডিভাইসে নেই; রেকর্ডের তথ্য দিয়ে তৈরি ডেমো।", "Sample preview — the real file is not on this device; this demo is built from the record's details.")}
            </span>
          )}
          {doc.sha256 ? <span className={styles.hash}>SHA-256 {doc.sha256.slice(0, 16)}…</span> : null}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

/** A paper-like placeholder so the jury can see "that's the document" without a real file. */
function MockDocument({ app, doc, typeLabel }: { app: ApplicationRecord; doc: DocumentRef; typeLabel: string }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const rows: [string, string][] = [
    [tx("নাম", "Name"), app.data.applicant.fullName ?? "—"],
    [tx("রেফারেন্স", "Reference"), app.applicationId],
    [tx("নথি আইডি", "Document ID"), doc.docId],
    [tx("অবস্থা", "Status"), doc.status],
    [tx("ফাইল", "File"), doc.fileName ? `${doc.fileName}${doc.sizeBytes ? ` · ${Math.round(doc.sizeBytes / 1024)} KB` : ""}` : tx("জমা হয়নি", "not submitted")],
  ];
  return (
    <div className={styles.paper}>
      <div className={styles.watermark} aria-hidden>
        {tx("নমুনা", "SAMPLE")}
      </div>
      <div className={styles.paperHead}>
        <div className={styles.seal} aria-hidden>
          ★
        </div>
        <div>
          <div className={styles.paperOrg}>{tx("গণপ্রজাতন্ত্রী বাংলাদেশ", "People's Republic of Bangladesh")}</div>
          <div className={styles.paperTitle}>{typeLabel}</div>
        </div>
      </div>
      <dl className={styles.paperRows}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.paperRow}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.lines} aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ width: `${92 - ((i * 13) % 35)}%` }} />
        ))}
      </div>
      <div className={styles.sign} aria-hidden>
        <span />
        {tx("স্বাক্ষর / সিল", "Signature / seal")}
      </div>
    </div>
  );
}

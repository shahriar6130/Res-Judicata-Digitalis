"use client";

/* ------------------------------------------------------------------ *
 *  Citizen "My case" → documents.
 *  Reads the raw shared record, so a document the DLAO requests (e.g.
 *  the GD copy) appears here at once as "Documents needed" with an
 *  upload button. Uploading goes through CitizenDocs.upload, which
 *  updates the record, closes the follow-up task and opens a review
 *  task for the officer. "View" opens the shared document pop-up.
 * ------------------------------------------------------------------ */

import { useRef, useState } from "react";
import { DOC_TYPES, label, type ApplicationRecord, type DocumentRef } from "@/lib/dlas";
import { CitizenDocs } from "@/lib/dlas/citizen-docs";
import { useCitizenApplication } from "@/lib/dlas/citizen-view";
import { useI18n } from "@/lib/i18n";
import { FileText } from "@/components/icons";
import { DocViewButton } from "./doc-viewer";
import styles from "./citizen-documents.module.css";

const fmt = (iso: string, lang: "bn" | "en") => new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export function CitizenDocuments({ applicationId }: { applicationId: string }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const app = useCitizenApplication(applicationId);
  if (!app) return null;
  const docs = app.data.documents;
  const needed = docs.filter((d) => d.status !== "ATTACHED").sort((x, y) => (y.requested?.at ?? "").localeCompare(x.requested?.at ?? ""));
  const submitted = docs.filter((d) => d.status === "ATTACHED");
  const closed = app.status === "REJECTED" || app.status === "CLOSED" || app.status === "WITHDRAWN";

  return (
    <>
      {needed.length && !closed ? (
        <section className={`${styles.card} ${styles.needed}`} aria-labelledby="docs-needed">
          <h2 id="docs-needed" className={styles.heading}>
            <span className={styles.pulse} aria-hidden />
            {tx("নথি প্রয়োজন", "Documents needed")} ({needed.length})
          </h2>
          <p className={styles.lead}>{tx("ফোনে ছবি তুলে বা পিডিএফ আপলোড করুন। না পারলে নিকটস্থ ইউডিসিতে নিয়ে যান।", "Take a photo with your phone or upload a PDF. If you can't, take it to your nearest UDC.")}</p>
          <ul className={styles.list}>
            {needed.map((d) => (
              <NeededRow key={d.docId} app={app} doc={d} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.card} aria-labelledby="docs-submitted">
        <h2 id="docs-submitted" className={styles.heading}>
          {tx("জমা দেওয়া নথি", "Submitted documents")}
        </h2>
        {submitted.length === 0 ? (
          <p className={styles.empty}>{tx("এখনো কোনো নথি জমা হয়নি।", "No documents submitted yet.")}</p>
        ) : (
          <ul className={styles.list}>
            {submitted.map((d) => (
              <li key={d.docId} className={styles.row}>
                <span className={styles.icon} aria-hidden>
                  <FileText size={18} />
                </span>
                <div className={styles.meta}>
                  <p className={styles.name}>{label(DOC_TYPES, d.type, lang)}</p>
                  <p className={styles.sub}>
                    {d.uploadedVia === "APPLICANT_WEB" && d.uploadedAt
                      ? `${tx("আপনি আপলোড করেছেন", "Uploaded by you")} · ${fmt(d.uploadedAt, lang)}`
                      : d.uploadedVia === "OFFICE"
                        ? tx("অফিসে জমা হয়েছে", "Received at the office")
                        : tx("আবেদনের সাথে জমা", "Sent with the application")}
                  </p>
                </div>
                <span className={styles.okPill}>✓ {tx("জমা", "Submitted")}</span>
                <DocViewButton app={app} doc={d} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function NeededRow({ app, doc }: { app: ApplicationRecord; doc: DocumentRef }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await CitizenDocs.upload(app.applicationId, doc.docId, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <li className={styles.row}>
      <span className={`${styles.icon} ${styles.iconWarn}`} aria-hidden>
        <FileText size={18} />
      </span>
      <div className={styles.meta}>
        <p className={styles.name}>{label(DOC_TYPES, doc.type, lang)}</p>
        <p className={styles.sub}>
          {doc.requested
            ? `${tx("লিগ্যাল এইড অফিস চেয়েছে", "Requested by the legal aid office")} · ${fmt(doc.requested.at, lang)}`
            : tx("আবেদনের সময় পরে দেবেন বলেছিলেন", "You said you would send this later")}
        </p>
        {doc.requested?.note ? <p className={styles.note}>“{doc.requested.note}”</p> : null}
        {error ? (
          <p className={styles.err} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" className={styles.upload} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? tx("আপলোড হচ্ছে…", "Uploading…") : tx("আপলোড করুন", "Upload")}
      </button>
    </li>
  );
}

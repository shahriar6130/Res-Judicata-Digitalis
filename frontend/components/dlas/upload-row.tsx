"use client";

/* Citizen "Upload" row — used on the case-detail page and on the
   home dashboard. Wraps the hidden file input + "Upload" button +
   inline error UI. Calls CitizenDocs.upload(), which is the single
   funnel for citizen uploads (store bytes, flip status, audit,
   close the follow-up task, open a DOCUMENT_REVIEW task). */

import { useRef, useState } from "react";
import { DOC_TYPES, formatDateTime, label, type ApplicationRecord, type DocumentRef } from "@/lib/dlas";
import { CitizenDocs } from "@/lib/dlas/citizen-docs";
import { FileText } from "@/components/icons";
import { useTx } from "./shared";
import styles from "./upload-row.module.css";

export type UploadRowProps = {
  app: ApplicationRecord;
  doc: DocumentRef;
  /** Optional label to render in place of the default `doc.type` name
   *  (e.g. when aggregated across multiple cases on home, where we
   *  prepend the application id and matter name). */
  children?: React.ReactNode;
};

export function UploadRow({ app, doc, children }: UploadRowProps) {
  const { lang, tx } = useTx();
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
        <p className={styles.name}>{children ?? label(DOC_TYPES, doc.type, lang)}</p>
        <p className={styles.sub}>
          {doc.requested
            ? `${tx("লিগ্যাল এইড অফিস চেয়েছে", "Requested by the legal aid office")} · ${formatDateTime(doc.requested.at, lang)}`
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

"use client";

/* Citizen case-detail page → documents. Unsubmitted docs (including
   those requested by the DLAO) become inline <UploadRow>s. Uploading
   goes through CitizenDocs.upload(), which closes the follow-up task
   and opens a DOCUMENT_REVIEW task for the officer. */

import { DOC_TYPES, formatDateTime, label } from "@/lib/dlas";
import { useCitizenApplication } from "@/lib/dlas/citizen-view";
import { FileText } from "@/components/icons";
import { DocViewButton } from "./doc-viewer";
import { useTx } from "./shared";
import { UploadRow } from "./upload-row";
import styles from "./citizen-documents.module.css";

export function CitizenDocuments({ applicationId }: { applicationId: string }) {
  const { lang, tx } = useTx();
  const app = useCitizenApplication(applicationId);
  if (!app) return null;
  const docs = app.data.documents;
  // Only what the Legal Aid Officer actually asked for — not the matter's default checklist (e.g. NID + marriage certificate for family).
  const needed = docs.filter((d) => d.status !== "ATTACHED" && !!d.requested).sort((x, y) => (y.requested?.at ?? "").localeCompare(x.requested?.at ?? ""));
  const submitted = docs.filter((d) => d.status === "ATTACHED");
  const closed = app.status === "REJECTED" || app.status === "RESOLVED" || app.status === "CLOSED" || app.status === "WITHDRAWN";

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
              <UploadRow key={d.docId} app={app} doc={d} />
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
                      ? `${tx("আপনি আপলোড করেছেন", "Uploaded by you")} · ${formatDateTime(d.uploadedAt, lang)}`
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

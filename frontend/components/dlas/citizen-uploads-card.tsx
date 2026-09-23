"use client";

/* Home-dashboard "Documents needed" card. Aggregates un-submitted
   docs across every open case and gives each one an upload row that
   shares the CitizenDocs.upload() funnel with the case-detail page. */

import { DOC_TYPES, label, MATTERS, type ApplicationRecord, type DocumentRef } from "@/lib/dlas";
import { useCitizenApplications } from "@/lib/dlas/citizen-view";
import { UploadRow } from "./upload-row";
import { useTx } from "./shared";
import styles from "./citizen-uploads-card.module.css";

type Pending = { app: ApplicationRecord; doc: DocumentRef };

export function CitizenUploadsCard() {
  const { lang, tx } = useTx();
  const apps = useCitizenApplications();

  const pending: Pending[] = [];
  for (const app of apps) {
    if (app.status === "REJECTED" || app.status === "CLOSED" || app.status === "WITHDRAWN") continue;
    for (const doc of app.data.documents) {
      if (doc.status !== "ATTACHED") pending.push({ app, doc });
    }
  }
  pending.sort((a, b) =>
    (b.doc.requested?.at ?? b.app.submittedAt).localeCompare(a.doc.requested?.at ?? a.app.submittedAt),
  );

  if (pending.length === 0) {
    return (
      <section className={`${styles.card} ${styles.cardQuiet}`} aria-labelledby="uploads-empty-title">
        <h2 id="uploads-empty-title" className={styles.heading}>
          {tx("নথি আপলোড", "Document uploads")}
        </h2>
        <p className={styles.emptyText}>{tx("আপনার জন্য কোনো নথি অপেক্ষা করছে না।", "No documents are waiting for you.")}</p>
        <p className={styles.emptySub}>
          {tx("দরকার হলে অফিসার আপনাকে নোটিফিকেশনের মাধ্যমে জানাবেন।", "If anything is needed, the officer will let you know through a notification.")}
        </p>
      </section>
    );
  }

  return (
    <section className={`${styles.card} ${styles.cardNeeded}`} aria-labelledby="uploads-needed-title">
      <h2 id="uploads-needed-title" className={styles.heading}>
        <span className={styles.pulse} aria-hidden />
        {tx("নথি প্রয়োজন", "Documents needed")} ({pending.length})
      </h2>
      <p className={styles.lead}>
        {tx("ফোনে ছবি তুলে বা পিডিএফ আপলোড করুন। একবার জমা দিলে অফিসার দেখে পরবর্তী পদক্ষেপ নেবেন।", "Take a photo with your phone or upload a PDF. Once submitted, the officer will review and take the next step.")}
      </p>
      <ul className={styles.list}>
        {pending.map(({ app, doc }) => {
          const docLabel = label(DOC_TYPES, doc.type, lang);
          const matter = label(MATTERS, app.data.matter.category, lang);
          return (
            <UploadRow key={`${app.applicationId}-${doc.docId}`} app={app} doc={doc}>
              {docLabel} · {app.applicationId} · {matter}
            </UploadRow>
          );
        })}
      </ul>
    </section>
  );
}

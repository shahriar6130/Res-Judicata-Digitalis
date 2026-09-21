"use client";

import Link from "next/link";
import { ensureSeeded, useHelplineStore } from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import styles from "../udc.module.css";

export function UdcClarificationTasksPanel({ role = "udc" }: { role?: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  if (typeof window !== "undefined") {
    ensureSeeded();
  }

  const intakes = envelope.assistedIntakes ?? [];
  const conflicts = envelope.syncConflicts ?? [];

  const tasks = [
    ...intakes
      .filter((a) => a.checklistItemResults.some((r) => r.state === "uncertain" || r.state === "follow_up_required"))
      .map((a) => ({
        id: `clar-${a.temporaryId}`,
        temporaryId: a.temporaryId,
        title: a.applicantName,
        body: `Checklist uncertain items: ${a.checklistItemResults.filter((r) => r.state === "uncertain").map((r) => r.itemId).join(", ")}`,
      })),
    ...conflicts
      .filter((c) => !c.resolution)
      .map((c) => ({
        id: `clar-${c.id}`,
        temporaryId: c.temporaryId,
        title: c.fieldOrObject,
        body: "Conflict awaiting human review",
        conflictId: c.id,
      })),
  ];

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · স্পষ্টীকরণ কার্যসূচি" : "UDC · clarification tasks"}
          </span>
          <h1 className={styles.pageTitle}>
            {lang === "bn" ? "DLAO/কেস সাপোর্ট থেকে আসা অনুরোধ" : "Requests from DLAO/case support"}
          </h1>
        </header>

        <section className={styles.section}>
          <ul className={styles.queueList}>
            {tasks.length === 0 ? (
              <li className={styles.queueRow}>
                <strong>—</strong>
                <span>{lang === "bn" ? "কোনো অনুরোধ নেই" : "No requests"}</span>
                <span>—</span>
                <span>—</span>
              </li>
            ) : (
              tasks.map((t) => (
                <li key={t.id} className={styles.queueRow}>
                  <strong>{t.temporaryId}</strong>
                  <span>
                    <strong>{t.title}</strong> — {t.body}
                  </span>
                  <span>—</span>
                  <Link href={`/dashboard/${role}/intake/${t.temporaryId}`}>
                    {lang === "bn" ? "খুলুন" : "Open"}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </>
  );
}

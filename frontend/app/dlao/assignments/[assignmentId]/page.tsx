"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, LawyerAssignmentService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoAssignmentWorkspace({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  useEffect(() => { ensureSeeded(); }, []);
  const a = LawyerAssignmentService.find(envelope, assignmentId);

  function offer() {
    if (!a) return;
    LawyerAssignmentService.offerTo({ assignmentId: a.assignmentId, actor: "DLAO officer" });
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/assignments" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoAssignmentWorkspaceTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoAssignmentWorkspaceTitle")}</h1>
        {!a && <div className={styles.notice}>Not found.</div>}
        {a && (
          <>
            <section className={styles.section}>
              <div className={styles.row}>
                <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{a.caseId}</div></div>
                <div><div className={styles.kvLabel}>Lawyer</div><div>{a.lawyerId}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{a.state}</span></div></div>
                <div><div className={styles.kvLabel}>Response deadline</div><div className={styles.kvValueMono}>{a.responseDeadline?.slice(0, 16).replace("T", " ") ?? "—"}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Reason</div><div>{a.reasonForAssignment}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Required first action</div><div>{a.requiredFirstAction}</div></div>
              </div>
            </section>
            {a.state === "prepared" && (
              <section className={styles.section}>
                <div className={styles.actions}>
                  <button type="button" className={styles.btn} onClick={offer}>{t("dlaoAssignmentOffer")}</button>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
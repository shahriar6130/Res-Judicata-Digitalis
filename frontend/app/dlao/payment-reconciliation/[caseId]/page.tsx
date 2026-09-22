"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  PaymentReconciliationService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const DEMO_ACTOR = "DLAO officer";

export default function DlaoPaymentReconciliationPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [amount, setAmount] = useState<string>("5000");
  useEffect(() => { ensureSeeded(); }, []);
  const reconciliations = PaymentReconciliationService.byCase(envelope, caseId);
  const stages = (envelope.paymentStages ?? []).filter((s) => s.caseId === caseId);

  function prepare() {
    PaymentReconciliationService.prepareWorksheet({ caseId, actor: DEMO_ACTOR, triggeredBy: "dlao_review" });
    setTick((x) => x + 1);
  }
  function approve(rid: string) {
    PaymentReconciliationService.approve({ reconciliationId: rid, actor: DEMO_ACTOR, reason: "Approved after human review", });
    setTick((x) => x + 1);
  }
  function pending(rid: string) {
    PaymentReconciliationService.markExternalPaymentPending({ reconciliationId: rid, actor: DEMO_ACTOR });
    setTick((x) => x + 1);
  }
  function paid(rid: string) {
    PaymentReconciliationService.markPaidOrClosed({ reconciliationId: rid, actor: DEMO_ACTOR });
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/payment-reconciliation" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoPaymentTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoPaymentTitle")} — {caseId}</h1>
        <div className={styles.disclaimer}>{t("dlaoPaymentDisclaimer")}</div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Worksheets</h2>
            <button type="button" className={styles.btn} onClick={prepare}>Prepare worksheet</button>
          </div>
          <div className={styles.card}>
            {reconciliations.length === 0 && <div className={styles.notice}>No worksheets yet.</div>}
            {reconciliations.map((r) => (
              <div key={r.reconciliationId} className={styles.row}>
                <div><div className={styles.kvLabel}>ID</div><div className={styles.kvValueMono}>{r.reconciliationId}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{r.state}</span></div></div>
                <div><div className={styles.kvLabel}>Trigger</div><div>{r.triggeredBy}</div></div>
                <div><div className={styles.kvLabel}>Prepared</div><div className={styles.kvValueMono}>{r.preparedAt.slice(0, 10)}</div></div>
                <div style={{ gridColumn: "1 / -1" }} className={styles.actions}>
                  <button type="button" className={styles.btn} onClick={() => approve(r.reconciliationId)}>Approve</button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => pending(r.reconciliationId)}>Mark external pending</button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => paid(r.reconciliationId)}>Mark paid/closed</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>Stages</div>
          <div className={styles.card}>
            {stages.length === 0 && <div className={styles.notice}>No payment stages recorded.</div>}
            {stages.map((s) => (
              <div key={s.stageId} className={styles.row}>
                <div><div className={styles.kvLabel}>Stage</div><div>{s.stage}</div></div>
                <div><div className={styles.kvLabel}>Claimed</div><div>{s.claimedAmount} BDT</div></div>
                <div><div className={styles.kvLabel}>Verified</div><div>{s.verifiedAmount} BDT</div></div>
                <div><div className={styles.kvLabel}>Status</div><div><span className={styles.tag}>{s.status}</span></div></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.formRow}>
            <label>Quick amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </section>
      </main>
    </div>
  );
}
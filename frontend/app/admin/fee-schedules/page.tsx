"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, FeeScheduleRegistryService } from "@/lib/shakkho";
import type { FeeScheduleStatus } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const STATUSES: FeeScheduleStatus[] = ["unverified", "verified", "expired", "superseded"];

export default function AdminFeeSchedulesPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<FeeScheduleStatus | "all">("all");
  const [adding, setAdding] = useState(false);

  // Add-form state
  const [officialInstrument, setOfficialInstrument] = useState("");
  const [reference, setReference] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [matterType, setMatterType] = useState("");
  const [courtOrServiceType, setCourtOrServiceType] = useState("");
  const [stage, setStage] = useState("");
  const [authorizedAmount, setAuthorizedAmount] = useState<number>(0);
  const [requiredSupportingRecords, setRequiredSupportingRecords] = useState<string>("");
  const [approvalAuthority, setApprovalAuthority] = useState("");
  const [officialSource, setOfficialSource] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { ensureSeeded(); }, []);

  const list = useMemo(() => {
    const items = FeeScheduleRegistryService.list(envelope);
    return filter === "all" ? items : items.filter((f) => f.status === filter);
  }, [envelope, tick, filter]);

  function markVerified(scheduleId: string) {
    FeeScheduleRegistryService.markVerified({ scheduleId, actor: "Admin Officer" });
    setTick((x) => x + 1);
  }
  function markExpired(scheduleId: string) {
    FeeScheduleRegistryService.markExpired({ scheduleId, actor: "Admin Officer" });
    setTick((x) => x + 1);
  }
  function submitNew() {
    if (!officialInstrument || !reference || !effectiveDate || !matterType || !stage || !approvalAuthority) return;
    FeeScheduleRegistryService.createVersion({
      officialInstrument,
      reference,
      effectiveDate,
      expiryDate: expiryDate || undefined,
      matterType,
      courtOrServiceType,
      stage,
      authorizedAmount,
      requiredSupportingRecords: requiredSupportingRecords
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      approvalAuthority,
      officialSource,
      actor: "Admin Officer",
      notes: notes || undefined,
    });
    setAdding(false);
    setOfficialInstrument("");
    setReference("");
    setEffectiveDate("");
    setExpiryDate("");
    setMatterType("");
    setCourtOrServiceType("");
    setStage("");
    setAuthorizedAmount(0);
    setRequiredSupportingRecords("");
    setApprovalAuthority("");
    setOfficialSource("");
    setNotes("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS Admin</span>
          <span>{t("adminFeeSchedulesTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("adminFeeSchedulesTitle")}</h1>
        <div className={styles.disclaimer}>
          Demonstration settings — these govern the payment-reconciliation worksheet only and do not connect to any external
          government payment system.
        </div>

        <section className={styles.section}>
          <div className={styles.formRow}>
            <label>Filter</label>
            <div className={styles.actions} style={{ marginTop: 0 }}>
              <button type="button" className={`${styles.btn} ${filter === "all" ? "" : styles.btnGhost}`} onClick={() => setFilter("all")}>All</button>
              {STATUSES.map((s) => (
                <button key={s} type="button" className={`${styles.btn} ${filter === s ? "" : styles.btnGhost}`} onClick={() => setFilter(s)}>{s}</button>
              ))}
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setAdding((v) => !v)} style={{ marginLeft: "auto" }}>
                {adding ? "Cancel" : t("adminFeeSchedulesNew")}
              </button>
            </div>
          </div>
        </section>

        {adding && (
          <section className={styles.section}>
            <div className={styles.card}>
              <div className={styles.formRow}>
                <label>Official instrument</label>
                <input value={officialInstrument} onChange={(e) => setOfficialInstrument(e.target.value)} placeholder="e.g. National Legal Aid Order 2024" />
              </div>
              <div className={styles.formRow}>
                <label>Reference</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Memo / circular reference" />
              </div>
              <div className={styles.formRow}>
                <label>Effective date</label>
                <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label>Expiry date (optional)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label>Matter type</label>
                <input value={matterType} onChange={(e) => setMatterType(e.target.value)} placeholder="e.g. criminal, family, civil, compensation" />
              </div>
              <div className={styles.formRow}>
                <label>Court / service type</label>
                <input value={courtOrServiceType} onChange={(e) => setCourtOrServiceType(e.target.value)} placeholder="e.g. Sessions Court, Magistrate Court" />
              </div>
              <div className={styles.formRow}>
                <label>Stage</label>
                <input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="e.g. pre-trial, hearing, disposal" />
              </div>
              <div className={styles.formRow}>
                <label>Authorized amount (BDT)</label>
                <input type="number" value={authorizedAmount} onChange={(e) => setAuthorizedAmount(Number(e.target.value))} />
              </div>
              <div className={styles.formRow}>
                <label>Required supporting records (one per line)</label>
                <textarea rows={3} value={requiredSupportingRecords} onChange={(e) => setRequiredSupportingRecords(e.target.value)} placeholder={"Order copy\nVoucher\nCause list"} />
              </div>
              <div className={styles.formRow}>
                <label>Approval authority</label>
                <input value={approvalAuthority} onChange={(e) => setApprovalAuthority(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label>Official source</label>
                <input value={officialSource} onChange={(e) => setOfficialSource(e.target.value)} placeholder="Government gazette / circular reference" />
              </div>
              <div className={styles.formRow}>
                <label>Notes (optional)</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.btn} onClick={submitNew}>Save (unverified)</button>
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.card}>
            {list.length === 0 && <div className={styles.notice}>No fee schedules recorded.</div>}
            {list.map((s) => (
              <div key={s.scheduleId} className={styles.row}>
                <div><div className={styles.kvLabel}>Reference</div><div className={styles.kvValueMono}>{s.reference}</div></div>
                <div><div className={styles.kvLabel}>Matter · Stage</div><div>{s.matterType} · {s.stage}</div></div>
                <div><div className={styles.kvLabel}>Court / service</div><div>{s.courtOrServiceType}</div></div>
                <div><div className={styles.kvLabel}>Amount</div><div>{s.authorizedAmount} {s.currency}</div></div>
                <div><div className={styles.kvLabel}>Effective</div><div>{s.effectiveDate.slice(0, 10)}</div></div>
                <div><div className={styles.kvLabel}>Status</div><div><span className={styles.tag}>{s.status}</span></div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Instrument</div><div>{s.officialInstrument}</div></div>
                {s.requiredSupportingRecords.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Required records</div><div>{s.requiredSupportingRecords.join(", ")}</div></div>
                )}
                <div style={{ gridColumn: "1 / -1" }} className={styles.actions}>
                  {s.status === "unverified" && (
                    <button type="button" className={styles.btn} onClick={() => markVerified(s.scheduleId)}>
                      {t("adminFeeSchedulesMarkVerified")}
                    </button>
                  )}
                  {(s.status === "verified" || s.status === "unverified") && (
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => markExpired(s.scheduleId)}>
                      Mark expired
                    </button>
                  )}
                  {s.status === "superseded" && s.supersededByScheduleId && (
                    <div className={styles.notice}>Superseded by {s.supersededByScheduleId}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

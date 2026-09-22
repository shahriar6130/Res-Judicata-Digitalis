"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  ReferralService,
  EscalationService,
  DemoTimeService,
  SensitiveEvidenceService,
  useHelplineStore,
  ensureSeeded,
  ApplicationRecordService,
} from "@/lib/shakkho";
import type { Referral, ReferralState } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

const STATE_LABELS: Record<ReferralState, keyof typeof STATE_KEY> = {
  draft: "referralStateDraft",
  package_review: "referralStatePackageReview",
  authorized: "referralStateAuthorized",
  sending: "referralStateSending",
  delivered: "referralStateDelivered",
  awaiting_acknowledgment: "referralStateAwaitingAck",
  acknowledged: "referralStateAcknowledged",
  accepted: "referralStateAccepted",
  action_in_progress: "referralStateActionInProgress",
  completed: "referralStateCompleted",
  delivery_failed: "referralStateDeliveryFailed",
  information_requested: "referralStateInfoRequested",
  returned: "referralStateReturned",
  overdue_acknowledgment: "referralStateOverdueAck",
  overdue_action: "referralStateOverdueAction",
  escalation_required: "referralStateEscalationRequired",
  escalated: "referralStateEscalated",
  superseded: "referralStateSuperseded",
  withdrawn_by_authorized_user: "referralStateWithdrawn",
};
const STATE_KEY = {
  referralStateDraft: 1,
  referralStatePackageReview: 1,
  referralStateAuthorized: 1,
  referralStateSending: 1,
  referralStateDelivered: 1,
  referralStateAwaitingAck: 1,
  referralStateAcknowledged: 1,
  referralStateAccepted: 1,
  referralStateActionInProgress: 1,
  referralStateCompleted: 1,
  referralStateDeliveryFailed: 1,
  referralStateInfoRequested: 1,
  referralStateReturned: 1,
  referralStateOverdueAck: 1,
  referralStateOverdueAction: 1,
  referralStateEscalationRequired: 1,
  referralStateEscalated: 1,
  referralStateSuperseded: 1,
  referralStateWithdrawn: 1,
} as const;

export default function ReferralDashboardPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  // Recompute overdue references on every render (idempotent).
  useMemo(() => {
    ReferralService.recalculateOverdue("system");
  }, [envelope.referrals]);

  const refs = envelope.referrals ?? [];
  const records = envelope.records ?? [];
  const counters = ReferralService.counters(envelope);
  const escalations = (envelope.escalationTasks ?? []).filter(
    (e) => e.state !== "receiving_authority_acknowledged",
  );

  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sensitivityFilter, setSensitivityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [overdueFilter, setOverdueFilter] = useState<boolean>(false);

  const filtered: Referral[] = refs.filter((r) => {
    if (priorityFilter !== "all" && r.package.priority !== priorityFilter) return false;
    if (sensitivityFilter !== "all" && r.package.sensitivity !== sensitivityFilter) return false;
    if (stateFilter !== "all" && r.package.state !== stateFilter) return false;
    if (overdueFilter && !(r.package.state === "overdue_acknowledgment" || r.package.state === "overdue_action")) return false;
    return true;
  });

  const recordName = (applicationId: string): string => {
    const r = ApplicationRecordService.find(envelope, applicationId);
    return r?.facts?.applicant_name?.value ?? applicationId;
  };

  const demoTime = envelope.demoTimeOffsetMs ?? 0;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="DLAS">
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{lang === "bn" ? "রেফারেল ওয়ার্কস্পেস" : "Referral workspace"}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`} aria-pressed={lang === "bn"}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`} aria-pressed={lang === "en"}>English</button>
        </div>
      </header>

      <div className={styles.banner} role="status">
        <strong>{t("referralDashboardTitle")}</strong>
        <span>{t("referralDashboardIntro")}</span>
      </div>

      <main className={styles.main} id="referral-main">
        <section className={styles.header}>
          <span className={styles.eyebrow}>DLAO</span>
          <h1 className={styles.title}>{t("referralDashboardTitle")}</h1>
          <p className={styles.intro}>{t("referralDashboardIntro")}</p>
        </section>

        <div className={styles.actions}>
          <Link href="/applications/APP-2026-NBILA-01/sensitive-review" className={styles.btn}>
            {t("referralOpenUrgent")}
          </Link>
          <Link href="/cases/APP-2026-RAHIM-01/referrals" className={`${styles.btn} ${styles.btnSecondary}`}>
            {t("referralOpenJurisdiction")}
          </Link>
          <Link href="/referrals/new" className={`${styles.btn} ${styles.btnGhost}`}>
            {t("referralNewPickContinue")}
          </Link>
        </div>

        <div className={styles.kpis}>
          <Kpi label={t("referralKpiAwaitingAck")} value={counters.awaitingAcknowledgment} />
          <Kpi label={t("referralKpiAckAwaitingAction")} value={counters.acknowledgedAwaitingAction} />
          <Kpi label={t("referralKpiReturned")} value={counters.returned} variant="warn" />
          <Kpi label={t("referralKpiOverdueAck")} value={counters.overdueAcknowledgment} variant="danger" />
          <Kpi label={t("referralKpiOverdueAction")} value={counters.overdueAction} variant="danger" />
          <Kpi label={t("referralKpiDrafts")} value={counters.drafts} />
          <Kpi label={t("referralKpiEscalated")} value={counters.escalated} variant="warn" />
          <Kpi label={t("referralKpiCompleted")} value={counters.completed} variant="ok" />
        </div>

        <div className={styles.demoTimeRow}>
          <span>{t("referralDemoTimeNote")} ({Math.round(demoTime / 3600000)}h offset)</span>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => DemoTimeService.advance(24, "officer")}>
            +24h
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => DemoTimeService.advance(72, "officer")}>
            +72h
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => DemoTimeService.reset("officer")}>
            {t("referralResetTime")}
          </button>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralQueueHeader")}</h2>
            <span className={styles.sectionSub}>{filtered.length}/{refs.length}</span>
          </div>
          <div className={styles.filters}>
            <FilterChip label={t("referralFilterPriority") + ": " + (priorityFilter === "all" ? t("referralFilterAll") : priorityFilter)} active={priorityFilter !== "all"} onClick={() => setPriorityFilter(priorityFilter === "all" ? "standard" : priorityFilter === "standard" ? "urgent" : "overdue")} />
            <FilterChip label={t("referralFilterSensitivity") + ": " + (sensitivityFilter === "all" ? t("referralFilterAll") : sensitivityFilter)} active={sensitivityFilter !== "all"} onClick={() => setSensitivityFilter(sensitivityFilter === "all" ? "standard" : sensitivityFilter === "standard" ? "sensitive" : "highly_sensitive")} />
            <FilterChip label={t("referralFilterState") + ": " + (stateFilter === "all" ? t("referralFilterAll") : stateFilter)} active={stateFilter !== "all"} onClick={() => setStateFilter(stateFilter === "all" ? "awaiting_acknowledgment" : stateFilter === "awaiting_acknowledgment" ? "acknowledged" : stateFilter === "acknowledged" ? "returned" : "overdue_acknowledgment")} />
            <FilterChip label={t("referralFilterOverdue")} active={overdueFilter} onClick={() => setOverdueFilter((v) => !v)} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>{t("referralQueueApplicant")}</th>
                  <th>{t("referralQueueSendingOffice")}</th>
                  <th>{t("referralQueueReceivingOffice")}</th>
                  <th>{t("referralQueueReason")}</th>
                  <th>{t("referralQueueState")}</th>
                  <th>{t("referralQueueOwner")}</th>
                  <th>{t("referralQueueAckDeadline")}</th>
                  <th>{t("referralQueueNextAction")}</th>
                  <th>{t("referralQueueOpen")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const state = r.package.state;
                  const isOverdue = state === "overdue_acknowledgment" || state === "overdue_action";
                  const isUrgent = r.package.priority === "urgent";
                  const rowClass = `${styles.queueRow} ${isOverdue ? styles.queueRowOverdue : isUrgent ? styles.queueRowUrgent : ""}`;
                  return (
                    <tr key={r.referralId} className={rowClass}>
                      <td className={styles.kvValueMono}>{r.applicationId}</td>
                      <td>{recordName(r.applicationId)}</td>
                      <td>{r.package.sendingOffice}</td>
                      <td>{r.package.receivingOffice}</td>
                      <td>{r.package.reason.slice(0, 80)}</td>
                      <td><StatePill state={state} lang={lang} t={t} /></td>
                      <td>{r.package.escalationOwner}</td>
                      <td className={styles.kvValueMono}>{new Date(r.package.deadline.acknowledgmentDeadline).toISOString().slice(0, 16).replace("T", " ")}</td>
                      <td>{nextActionFor(r)}</td>
                      <td>
                        <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>
                          {t("referralQueueOpen")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralEscalationsTitle")}</h2>
            <span className={styles.sectionSub}>{escalations.length}</span>
          </div>
          <div className={styles.card}>
            {escalations.length === 0 && <div className={styles.notice}>{t("referralEscalationNoDecision")}</div>}
            {escalations.map((e) => (
              <div key={e.escalationId} className={styles.noticeWarn} style={{ marginBottom: 10 }}>
                <strong>{t("referralEscalationRepeated")}</strong>
                <div>
                  <Link href={`/referrals/escalations/${e.escalationId}`} className={`${styles.btn} ${styles.btnSecondary}`}>
                    {t("referralQueueOpen")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Sensitive access requests</h2>
            <span className={styles.sectionSub}>{(envelope.sensitiveEvidence?.items ?? []).length}</span>
          </div>
          <div className={styles.card}>
            {(envelope.sensitiveEvidence?.items ?? []).map((item) => {
              const app = ApplicationRecordService.find(envelope, item.applicationId);
              return (
                <div key={item.evidenceId} className={styles.evidenceRow}>
                  <div>{item.accessClassification === "highly_restricted" ? "🔒" : "🗝"}</div>
                  <div>
                    <div>{item.subject}</div>
                    <div className={styles.evidenceMeta}>
                      {item.kind} · {app?.facts?.applicant_name?.value ?? item.applicationId} · hash {item.hash.slice(0, 12)}…
                    </div>
                  </div>
                  <Link href={`/applications/${item.applicationId}/sensitive-review`} className={`${styles.btn} ${styles.btnGhost}`}>
                    {t("referralQueueOpen")}
                  </Link>
                </div>
              );
            })}
            {SensitiveEvidenceService.listFor(envelope, "").length === 0 && (
              <div className={styles.notice}>{t("referralAccessEmpty")}</div>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>DLAS · Referral workspace · Demo</div>
        <div>{refs.length} referrals · {records.length} records</div>
      </footer>
    </div>
  );
}

function Kpi({ label, value, variant }: { label: string; value: number; variant?: "danger" | "warn" | "ok" }) {
  const cls = variant === "danger" ? styles.kpiDanger : variant === "warn" ? styles.kpiWarn : variant === "ok" ? styles.kpiOk : "";
  return (
    <div className={`${styles.kpi} ${cls}`}>
      <div className={styles.kpiNumber}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${styles.filterChip} ${active ? styles.filterChipActive : ""}`}>
      {label}
    </button>
  );
}

function StatePill({ state, lang: _lang, t }: { state: ReferralState; lang: "bn" | "en"; t: (k: MessageKey) => string }) {
  const cls = state === "completed" || state === "accepted" ? styles.statusPillOk :
              state === "returned" || state === "overdue_acknowledgment" || state === "overdue_action" || state === "delivery_failed" ? styles.statusPillFail :
              state === "escalation_required" || state === "escalated" || state === "information_requested" ? styles.statusPillWarn :
              styles.statusPillIdle;
  return <span className={`${styles.statusPill} ${cls}`}>{t(STATE_LABELS[state])}</span>;
}

function nextActionFor(r: Referral): string {
  switch (r.package.state) {
    case "awaiting_acknowledgment": return "Receiving office to acknowledge";
    case "acknowledged": return "Receiving office to accept or return";
    case "accepted": return "Receiving office to assign officer / first action";
    case "returned": return "Sending office to respond";
    case "overdue_acknowledgment": return "Reminder + escalation if no ack";
    case "overdue_action": return "Reminder + escalation if no action";
    case "completed": return "—";
    default: return r.package.expectedAction.slice(0, 40);
  }
}
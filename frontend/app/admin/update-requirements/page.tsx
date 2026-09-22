"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, RequiredUpdateService } from "@/lib/shakkho";
import type { RequiredUpdateTrigger } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const TRIGGER_LABELS: Record<RequiredUpdateTrigger, { bn: string; en: string }> = {
  assignment_acceptance: { bn: "মামলা গ্রহণ", en: "Assignment acceptance" },
  upcoming_hearing: { bn: "আসন্ন শুনানি", en: "Upcoming hearing" },
  completed_hearing: { bn: "সম্পন্ন শুনানি", en: "Completed hearing" },
  received_order: { bn: "প্রাপ্ত আদেশ", en: "Received order" },
  case_stage: { bn: "মামলার ধাপ", en: "Case stage" },
  dlao_request: { bn: "DLAO অনুরোধ", en: "DLAO request" },
  periodic_reporting: { bn: "পর্যায়ক্রমিক প্রতিবেদন", en: "Periodic reporting" },
};

const DEFAULT_DUE_DAYS: Record<RequiredUpdateTrigger, number> = {
  assignment_acceptance: 3,
  upcoming_hearing: 5,
  completed_hearing: 7,
  received_order: 5,
  case_stage: 14,
  dlao_request: 3,
  periodic_reporting: 30,
};

const ESCALATION_RULE: Record<RequiredUpdateTrigger, string> = {
  assignment_acceptance: "After 7 days overdue: surface in /dlao/overdue-lawyer-updates",
  upcoming_hearing: "After 3 days overdue: surface in /dlao/overdue-lawyer-updates",
  completed_hearing: "After 5 days overdue: surface in /dlao/overdue-lawyer-updates",
  received_order: "After 4 days overdue: surface in /dlao/overdue-lawyer-updates",
  case_stage: "After 7 days overdue: surface in /dlao/overdue-lawyer-updates",
  dlao_request: "After 3 days overdue: surface in /dlao/overdue-lawyer-updates",
  periodic_reporting: "After 14 days overdue: surface in /dlao/overdue-lawyer-updates",
};

const TRIGGER_EXCEPTIONS: Record<RequiredUpdateTrigger, string[]> = {
  assignment_acceptance: ["approved_leave", "alternative_channel_submission"],
  upcoming_hearing: ["approved_leave", "system_outage", "case_stayed"],
  completed_hearing: ["approved_leave", "system_outage", "case_stayed"],
  received_order: ["approved_leave", "system_outage", "case_stayed", "waived_by_officer"],
  case_stage: ["approved_leave", "system_outage", "case_stayed"],
  dlao_request: ["approved_leave", "system_outage", "waived_by_officer", "alternative_channel_submission"],
  periodic_reporting: ["approved_leave", "system_outage", "waived_by_officer", "case_stayed"],
};

const TRIGGERS = Object.keys(TRIGGER_LABELS) as RequiredUpdateTrigger[];

export default function AdminUpdateRequirementsPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [activeTrigger, setActiveTrigger] = useState<RequiredUpdateTrigger>("assignment_acceptance");

  useEffect(() => { ensureSeeded(); }, []);

  const all = useMemo(() => RequiredUpdateService.list(envelope), [envelope, tick]);
  const byTrigger = useMemo(() => {
    const m = new Map<RequiredUpdateTrigger, number>();
    for (const u of all) {
      m.set(u.trigger, (m.get(u.trigger) ?? 0) + 1);
    }
    return m;
  }, [all]);

  const activeList = useMemo(
    () => all.filter((u) => u.trigger === activeTrigger),
    [all, activeTrigger],
  );

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS Admin</span>
          <span>{t("adminUpdateRequirementsTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("adminUpdateRequirementsTitle")}</h1>
        <div className={styles.disclaimer}>
          Demonstration settings — these rule definitions govern required-update scheduling and exception handling. They are
          not connected to any external monitoring system. Changes here would normally require legal-aid authority approval.
        </div>

        <section className={styles.section}>
          <div className={styles.card}>
            {TRIGGERS.map((trigger) => (
              <div
                key={trigger}
                className={styles.row}
                style={{ cursor: "pointer", background: trigger === activeTrigger ? "var(--off-white, #fafafa)" : undefined }}
                onClick={() => setActiveTrigger(trigger)}
              >
                <div>
                  <div className={styles.kvLabel}>{t("adminUpdateRequirementsTrigger")}</div>
                  <div>{lang === "bn" ? TRIGGER_LABELS[trigger].bn : TRIGGER_LABELS[trigger].en}</div>
                </div>
                <div><div className={styles.kvLabel}>{t("adminUpdateRequirementsDueDays")}</div><div>{DEFAULT_DUE_DAYS[trigger]}</div></div>
                <div><div className={styles.kvLabel}>{t("adminUpdateRequirementsReminderDays")}</div><div>1 reminder, 2 days before due (SMS)</div></div>
                <div><div className={styles.kvLabel}>{t("adminUpdateRequirementsEscalation")}</div><div>{ESCALATION_RULE[trigger]}</div></div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className={styles.kvLabel}>{t("adminUpdateRequirementsExceptions")}</div>
                  <div>{TRIGGER_EXCEPTIONS[trigger].join(", ")}</div>
                </div>
                <div>
                  <div className={styles.kvLabel}>Active requirements</div>
                  <div><span className={styles.tag}>{byTrigger.get(trigger) ?? 0}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Active requirements — {lang === "bn" ? TRIGGER_LABELS[activeTrigger].bn : TRIGGER_LABELS[activeTrigger].en}
          </h2>
          <div className={styles.card}>
            {activeList.length === 0 && <div className={styles.notice}>No requirements for this trigger.</div>}
            {activeList.map((u) => (
              <div key={u.requirementId} className={styles.row}>
                <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{u.caseId}</div></div>
                <div><div className={styles.kvLabel}>Lawyer</div><div>{u.lawyerId}</div></div>
                <div><div className={styles.kvLabel}>Due</div><div className={styles.kvValueMono}>{u.dueAt.slice(0, 16).replace("T", " ")}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{u.state}</span></div></div>
                {u.exception && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div className={styles.kvLabel}>Exception</div>
                    <div>{u.exception.reason} — {u.exception.note} ({u.exception.notedBy})</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

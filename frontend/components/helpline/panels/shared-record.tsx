"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { SafeContactService } from "@/lib/shakkho";
import type {
  ApplicationRecord,
  AuditEvent,
  ProvenanceEntry,
  SafeContactEvaluation,
  SlotKey,
} from "@/lib/shakkho";
import { Shield } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

interface SharedRecordProps {
  record?: ApplicationRecord;
  audit: AuditEvent[];
  provenance: ProvenanceEntry[];
  safeContact?: SafeContactEvaluation;
}

const SLOT_LABELS: Record<SlotKey, MessageKey> = {
  applicant_name: "helplineSlotApplicant",
  category: "helplineSlotCategory",
  office: "helplineSlotOffice",
  incident_date: "helplineSlotIncidentDate",
  urgency_signals: "helplineSlotUrgency",
  safe_contact_time: "helplineSlotContactTime",
  consent: "helplineSlotConsent",
  applicant_national_id_fragment: "helplineSlotApplicant",
  caller_relation: "helplineSlotApplicant",
  caller_name: "helplineSlotApplicant",
};

export function SharedRecord({ record, audit, provenance, safeContact }: SharedRecordProps) {
  const { t } = useI18n();
  if (!record) {
    return <p className={styles.empty}>{t("helplineRecordNotFound")}</p>;
  }
  return (
    <div className={styles.callColumn}>
      <h2>{t("helplineRecordHeading")}</h2>
      <strong>{record.applicationId}</strong>

      <section>
        <h3 style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
          {t("helplineRecordProvenance")}
        </h3>
        <ul className={styles.provenanceList}>
          {provenance.length === 0 ? (
            <li><span>—</span><span>—</span></li>
          ) : null}
          {provenance.map((entry, idx) => (
            <li key={`${entry.slot}-${idx}`}>
              <span>{t(SLOT_LABELS[entry.slot])}</span>
              <span>
                {record.facts[entry.slot]?.value ?? "—"}{" "}
                <em style={{ color: "var(--gray)" }}>
                  ({entry.source} · {entry.confidence})
                </em>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
          {t("helplineRecordSafeContact")}
        </h3>
        {safeContact?.cleared ? (
          <p style={{ margin: 0, color: "var(--ink)" }}>
            ✓ {safeContact.reasons[0]?.en ?? t("helplineVerifiedBadge")}
          </p>
        ) : (
          <p className={styles.safetyBanner}>{t("helplineSafeContactBlocked")}</p>
        )}
        <IconButton
          Icon={Shield}
          size="sm"
          onClick={() => {
            const evaluation = SafeContactService.evaluate(record);
            try {
              SafeContactService.assertCleared(evaluation);
              alert(t("helplineVerifiedBadge"));
            } catch {
              alert(t("helplineErrSafeContactBlocked"));
            }
          }}
        >
          {t("helplineRevealAddressBtn")}
        </IconButton>
      </section>

      <section>
        <h3 style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
          {t("helplineRecordAudit")}
        </h3>
        <ul className={styles.auditList}>
          {audit.length === 0 ? (
            <li><time>—</time><span>—</span></li>
          ) : null}
          {audit.slice(-10).map((event) => (
            <li key={event.id}>
              <time>{new Date(event.occurredAt).toLocaleTimeString()}</time>
              <span>
                <strong>{event.action}</strong> · {event.actor}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

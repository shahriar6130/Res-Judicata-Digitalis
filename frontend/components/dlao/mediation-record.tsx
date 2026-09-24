"use client";

/* ------------------------------------------------------------------ *
 *  Feature 9 — mediator privacy / role-based access, officer & CLO side.
 *
 *  • MediationRecordPanel  (/dashboard/dlo#app/<id>, Legal pathway step)
 *    PUBLIC CASE RECORD of the mediation for a Legal Aid Officer / CLO,
 *    a locked MEDIATOR CONFIDENTIAL NOTES block (count only, never text),
 *    and the audit trail as User · Role · Case · Action · Timestamp.
 *    Opening it is itself audited (mediation.record_viewed).
 *  • MediationMonitor  (/dashboard/dlo#mediation-monitor) — CLO only:
 *    district mediation activity, mediator workload, channel mix, audit.
 *
 *  Data: lib/dlas/mediation-oversight.ts on top of mediation-access.ts.
 * ------------------------------------------------------------------ */

import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  MEDIATION_ROLE_SCOPES,
  MediationAccessLog,
  formatDateTime,
  useDistrictMediationMonitor,
  useOfficerMediationRecord,
  type ApplicationRecord,
  type AuditRow,
  type DistrictMediationRow,
  type MediationScope,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";
type Lang = "bn" | "en";

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`}>{children}</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{label}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}

const ROLE_LABEL: Record<string, { bn: string; en: string }> = {
  LEGAL_AID_OFFICER: { bn: "লিগ্যাল এইড অফিসার", en: "Legal Aid Officer" },
  CHIEF_LEGAL_AID_OFFICER: { bn: "চিফ লিগ্যাল এইড অফিসার (CLO)", en: "Chief Legal Aid Officer (CLO)" },
};
const AUDIT_ROLE: Record<string, string> = { dlao: "Legal Aid Officer", clo: "CLO", mediator: "Mediator", panel_lawyer: "Panel lawyer", dlo_staff: "Office staff", admin: "DBLA / Admin", citizen: "Citizen", system: "System" };
const pretty = (s: string | null | undefined) => (s ? s.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—");
const outcomeTone = (k: string | undefined): Tone => (k === "SETTLEMENT_REACHED" ? "ok" : k === "MEDIATION_FAILED" ? "err" : k ? "warn" : "neutral");

/* ------------------------------ audit table ------------------------------ */

export function AuditTable({ rows, showCase = true }: { rows: AuditRow[]; showCase?: boolean }) {
  const { lang, tx } = useTx();
  if (!rows.length) return <p className={styles.hint}>{tx("এখনো কোনো অডিট এন্ট্রি নেই।", "No audit entries yet.")}</p>;
  return (
    <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
      <table className={styles.table} aria-label={tx("অডিট ইতিহাস", "Audit history")}>
        <thead>
          <tr>
            <th>{tx("ব্যবহারকারী", "User")}</th>
            <th>{tx("ভূমিকা", "Role")}</th>
            {showCase ? <th>{tx("কেস", "Case")}</th> : null}
            <th>{tx("কাজ", "Action")}</th>
            <th>{tx("সময়", "Timestamp")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.caseId}-${r.seq}`}>
              <td>
                <strong>{r.user}</strong>
                <div className={styles.hint}>{r.userId}</div>
              </td>
              <td>{AUDIT_ROLE[r.role] ?? r.role}</td>
              {showCase ? <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{r.caseId}</td> : null}
              <td>
                <code>{r.action}</code>
              </td>
              <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.at, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ officer / CLO record ------------------------------ */

const SCOPES_SHOWN: MediationScope[] = ["PUBLIC_CASE_RECORD", "VERIFICATION", "PATHWAY", "ASSIGNMENT", "ATTENDANCE", "REQUIRED_RECORDS", "AUDIT_HISTORY", "AGREEMENT_CERTIFICATION", "DISTRICT_MONITORING", "MEDIATOR_CONFIDENTIAL_NOTES"];

export function MediationRecordPanel({ a }: { a: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const v = useOfficerMediationRecord(a);
  const id = a.applicationId;
  const allowed = !!v;

  useEffect(() => {
    if (allowed) MediationAccessLog.recordView(id, "MEDIATION_RECORD");
  }, [allowed, id]);

  if (!v) return null;
  const { role, can, record: r } = v;
  const clo = role === "CHIEF_LEGAL_AID_OFFICER";

  return (
    <section className={ui.panel} style={{ marginTop: "var(--s-5)" }} aria-label={tx("মধ্যস্থতার রেকর্ড", "Mediation record")}>
      <div className={ui.panelTitle}>
        <span>{tx("মধ্যস্থতার রেকর্ড — কর্মকর্তার দৃশ্য", "MEDIATION RECORD — officer view")}</span>
        <Tag tone={clo ? "ink" : "neutral"}>{ROLE_LABEL[role][lang]}</Tag>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "var(--s-3)" }} aria-label={tx("আপনার প্রবেশাধিকার", "Your access")}>
        {SCOPES_SHOWN.map((s) => (
          <span key={s} className={`${ui.tag} ${can(s) ? ui.ok : ""}`} style={{ opacity: can(s) ? 1 : 0.55 }} title={can(s) ? "Granted" : "Not granted to your role"}>
            {can(s) ? "✓" : "🔒"} {pretty(s)}
          </span>
        ))}
      </div>

      {/* PUBLIC CASE RECORD */}
      <div className={ui.flowStep} style={{ marginBottom: "var(--s-4)" }}>
        <div className={ui.sectionHead}>{tx("পাবলিক কেস রেকর্ড", "PUBLIC CASE RECORD")}</div>
        <div className={ui.rows}>
          <Row label={tx("অবস্থা", "Status")}>
            <Tag tone={r.status === "OUTCOME_RECORDED" ? "ok" : r.status === "IN_PROGRESS" ? "ink" : "warn"}>{pretty(r.status)}</Tag>
          </Row>
          <Row label={tx("মধ্যস্থতাকারী", "Mediator")}>{r.mediator ? `${r.mediator.name} · ${r.mediator.since ? `${tx("নিয়োগ", "assigned")} ${formatDateTime(r.mediator.since, lang)}` : ""}` : tx("এখনো নিয়োগ হয়নি", "Not assigned yet")}</Row>
          <Row label={tx("সেশন ও উপস্থিতি", "Sessions & attendance")}>
            {r.sessions.length === 0 ? (
              tx("কোনো সেশন নির্ধারিত হয়নি", "No session scheduled")
            ) : (
              <div style={{ display: "grid", gap: 4 }}>
                {r.sessions.map((s) => (
                  <div key={s.sessionId}>
                    <strong>
                      {tx("সেশন", "Session")} {s.number}
                    </strong>{" "}
                    · {pretty(s.channel)}
                    {s.place ? ` · ${s.place}` : ""} · {(s.startedAt ?? s.scheduledFor ? formatDateTime((s.startedAt ?? s.scheduledFor)!, lang) : "—")} · <Tag tone={s.status === "COMPLETED" ? "ok" : "neutral"}>{pretty(s.status)}</Tag>{" "}
                    <span className={styles.hint}>
                      {tx("আবেদনকারী", "Applicant")}: {pretty(s.attendance.applicant)} · {tx("প্রতিপক্ষ", "Respondent")}: {pretty(s.attendance.respondent)}
                      {s.fallbacks ? ` · ${s.fallbacks} ${tx("চ্যানেল পরিবর্তন", "channel fallback(s)")}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Row>
          <Row label={tx("ফলাফল", "Outcome")}>
            {r.finalOutcome ? (
              <>
                <Tag tone={outcomeTone(r.finalOutcome.kind)}>{pretty(r.finalOutcome.kind)}</Tag> {r.finalOutcome.byName} · {formatDateTime(r.finalOutcome.at, lang)}
              </>
            ) : r.outcomes.length ? (
              <>
                <Tag tone="warn">{pretty(r.outcomes[r.outcomes.length - 1].kind)}</Tag> {tx("(চূড়ান্ত নয়)", "(not final)")}
              </>
            ) : (
              "—"
            )}
          </Row>
          <Row label={tx("নিষ্পত্তি চুক্তি", "Settlement agreement")}>
            {r.settlement ? (
              <>
                <code>{r.settlement.agreementId}</code> · <Tag tone={r.settlement.resolved ? "ok" : "warn"}>{pretty(r.settlement.status)}</Tag>
                {r.settlement.certifiedBy ? ` · ${tx("যাচাই", "verified by")} ${r.settlement.certifiedBy}${r.settlement.certifiedAt ? `, ${formatDateTime(r.settlement.certifiedAt, lang)}` : ""}` : ""}{" "}
                {can("AGREEMENT_CERTIFICATION") ? (
                  <a className={ui.link} href={`/dashboard/dlo/settlements/${encodeURIComponent(id)}`}>
                    {tx("যাচাই ও প্রত্যয়নপত্র →", "Verify & testimonial →")}
                  </a>
                ) : (
                  <span className={styles.hint}>{tx("যাচাই করবেন লিগ্যাল এইড অফিসার", "Verified by the Legal Aid Officer")}</span>
                )}
              </>
            ) : (
              tx("কোনো চুক্তি নেই — পক্ষের 'সম্মত' ক্লিক আইনত চূড়ান্ত চুক্তি নয়", "No agreement — a party clicking 'accept' is not a legally final agreement")
            )}
          </Row>
          <Row label={tx("ব্যর্থতা / রেফারেল রেকর্ড", "Failure / referral record")}>
            {r.failure ? (
              <>
                <code>{r.failure.recordId}</code> · <Tag tone="err">{pretty(r.failure.status)}</Tag> · {formatDateTime(r.failure.createdAt, lang)}{" "}
                <a className={ui.link} href={`/dashboard/dlo/mediation-outcomes/${encodeURIComponent(id)}`}>
                  {tx("পর্যালোচনা →", "Review →")}
                </a>
              </>
            ) : (
              "—"
            )}
          </Row>
        </div>
      </div>

      {/* MEDIATOR CONFIDENTIAL NOTES — locked */}
      <div className={ui.confidential} style={{ padding: "var(--s-3) var(--s-4)", borderRadius: 8, marginBottom: "var(--s-4)" }} aria-label={tx("মধ্যস্থতাকারীর গোপন নোট", "Mediator confidential notes")}>
        <span className={ui.confidentialBadge}>🔒 {tx("মধ্যস্থতাকারীর গোপন নোট", "MEDIATOR CONFIDENTIAL NOTES")}</span>
        <p style={{ margin: "var(--s-2) 0 0" }}>
          {r.confidentialNoteCount
            ? tx(`${r.confidentialNoteCount}টি ককাস নোট আছে — আপনার ভূমিকার জন্য প্রবেশাধিকার নেই।`, `${r.confidentialNoteCount} caucus note(s) exist — not accessible to your role.`)
            : tx("কোনো ককাস নোট নেই।", "No caucus notes recorded.")}{" "}
          <span className={styles.hint}>{tx("শুধু নিয়োগপ্রাপ্ত মধ্যস্থতাকারী পড়তে পারেন; এগুলো কোনো রেকর্ড, রিপোর্ট বা বিজ্ঞপ্তিতে যায় না।", "Only the assigned mediator can read them; they never enter any record, report or notification.")}</span>
        </p>
      </div>

      {/* audit */}
      {can("AUDIT_HISTORY") ? (
        <>
          <div className={ui.sectionHead}>{tx("অডিট ইতিহাস — মধ্যস্থতা", "Audit history — mediation")}</div>
          <AuditTable rows={[...r.audit].reverse()} />
        </>
      ) : null}
    </section>
  );
}

/* ------------------------------ CLO district monitor ------------------------------ */

const BUCKET: Record<DistrictMediationRow["bucket"], { bn: string; en: string; tone: Tone }> = {
  AWAITING_ASSIGNMENT: { bn: "নিয়োগের অপেক্ষা", en: "Awaiting assignment", tone: "warn" },
  ACTIVE: { bn: "চলমান", en: "Active", tone: "ink" },
  AWAITING_CERTIFICATION: { bn: "প্রত্যয়নের অপেক্ষা", en: "Awaiting certification", tone: "warn" },
  RESOLVED: { bn: "নিষ্পন্ন", en: "Resolved", tone: "ok" },
  FAILED: { bn: "ব্যর্থ / রেফারেল", en: "Failed / referral", tone: "err" },
};

export function MediationMonitor() {
  const { lang, tx } = useTx();
  const v = useDistrictMediationMonitor();

  if (!v.allowed) {
    return (
      <div className={`${ui.banner} ${ui.bannerErr}`} role="alert">
        <span className={ui.bannerIcon} aria-hidden>
          🔒
        </span>
        <div>
          <strong>{tx("প্রবেশাধিকার নেই", "Access restricted")}</strong> — {tx("জেলার মধ্যস্থতা পর্যবেক্ষণ শুধু চিফ লিগ্যাল এইড অফিসারের জন্য।", "District mediation monitoring is available to the Chief Legal Aid Officer only.")}{" "}
          <span className={styles.hint}>
            {tx("আপনার ভূমিকার প্রবেশাধিকার", "Your role's scopes")}: {v.role ? MEDIATION_ROLE_SCOPES[v.role].map(pretty).join(", ") : "—"}
          </span>
        </div>
      </div>
    );
  }

  const stats: [number, string, Tone][] = [
    [v.counts.total, tx("মধ্যস্থতার কেস", "Mediation cases"), "neutral"],
    [v.counts.awaitingAssignment, tx("নিয়োগের অপেক্ষা", "Awaiting assignment"), v.counts.awaitingAssignment ? "warn" : "neutral"],
    [v.counts.active, tx("চলমান", "Active"), "neutral"],
    [v.counts.awaitingCertification, tx("প্রত্যয়নের অপেক্ষা", "Awaiting certification"), v.counts.awaitingCertification ? "warn" : "neutral"],
    [v.counts.resolved, tx("নিষ্পন্ন", "Resolved"), "ok"],
    [v.counts.failed, tx("ব্যর্থ / রেফারেল", "Failed / referral"), v.counts.failed ? "err" : "neutral"],
    [v.overdue.length, tx("দেরি হওয়া কাজ", "Overdue tasks"), v.overdue.length ? "err" : "neutral"],
  ];

  return (
    <>
      <h1 className={styles.title}>{tx("জেলার মধ্যস্থতা পর্যবেক্ষণ", "District mediation monitor")}</h1>
      <p className={styles.lead}>
        {tx("CLO-র জন্য: পাবলিক কেস রেকর্ড ও অডিট থেকে। মধ্যস্থতাকারীর গোপন নোট এখানে কখনো দেখানো হয় না।", "For the CLO: built from public case records and the audit trail. Mediator confidential notes are never shown here.")}
      </p>

      <div className={styles.stats}>
        {stats.map(([n, l, tone]) => (
          <div key={l} className={styles.stat} style={tone === "err" ? { borderColor: "var(--red)" } : tone === "warn" ? { borderColor: "var(--status-pending)" } : undefined}>
            <div className={styles.statNum} style={tone === "err" ? { color: "var(--red)" } : tone === "ok" ? { color: "var(--green)" } : undefined}>
              {n}
            </div>
            <div className={styles.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      <section className={ui.panel} style={{ marginBottom: "var(--s-5)" }}>
        <div className={ui.panelTitle}>
          <span>{tx("এই সপ্তাহের সেশন", "Sessions this week")}</span>
          <Tag>{v.sessionsThisWeek}</Tag>
        </div>
        <div className={ui.rows}>
          <Row label={tx("চ্যানেল", "By channel")}>
            {tx("সরাসরি", "Physical")} {v.byChannel.PHYSICAL} · {tx("ভয়েস", "Voice")} {v.byChannel.VOICE} · {tx("অনলাইন", "Online")} {v.byChannel.ONLINE}
          </Row>
          <Row label={tx("সংযোগ", "Connectivity")}>
            {v.limited ? <Tag tone="warn">{tx(`${v.limited}টি কেসে সীমিত সংযোগ`, `${v.limited} case(s) with limited connectivity`)}</Tag> : tx("সীমিত সংযোগের কেস নেই", "No limited-connectivity cases")} · {tx("চ্যানেল পরিবর্তন", "Channel fallbacks")}: {v.fallbacks}
          </Row>
          {v.overdue.length ? (
            <Row label={tx("দেরি হওয়া কাজ", "Overdue tasks")}>
              {v.overdue.map((t) => (
                <div key={t.taskId}>
                  <Tag tone="err">{pretty(t.type)}</Tag> {t.reason} · {tx("নির্ধারিত", "due")} {formatDateTime(t.dueAt, lang)}
                </div>
              ))}
            </Row>
          ) : null}
        </div>
      </section>

      <section className={ui.main} style={{ marginBottom: "var(--s-5)" }}>
        <div className={ui.sectionHead}>{tx("কেসসমূহ", "Cases")}</div>
        {v.rows.length === 0 ? (
          <p className={styles.hint}>{tx("আপনার অফিসে এখনো কোনো মধ্যস্থতার কেস নেই।", "No mediation cases in your office yet.")}</p>
        ) : (
          <div className={styles.tableWrap} style={{ maxHeight: "none" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tx("কেস", "Case")}</th>
                  <th>{tx("ধরন", "Track")}</th>
                  <th>{tx("পর্যায়", "Stage")}</th>
                  <th>{tx("মধ্যস্থতাকারী", "Mediator")}</th>
                  <th>{tx("কর্মক্ষেত্রের অবস্থা", "Workspace status")}</th>
                  <th>{tx("সর্বশেষ কার্যকলাপ", "Last activity")}</th>
                </tr>
              </thead>
              <tbody>
                {v.rows.map((r) => (
                  <tr key={r.a.applicationId}>
                    <td>
                      <a href={`#app/${encodeURIComponent(r.a.applicationId)}`}>
                        <strong>{r.caseId}</strong>
                      </a>
                    </td>
                    <td>{r.track === "COURT_REFERRED" ? tx("আদালত-প্রেরিত", "Court-referred") : tx("মামলা-পূর্ব", "Pre-litigation")}</td>
                    <td>
                      <Tag tone={BUCKET[r.bucket].tone}>{BUCKET[r.bucket][lang]}</Tag>
                    </td>
                    <td>{r.mediator ?? "—"}</td>
                    <td>{pretty(r.status)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.lastActivity, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={ui.main} style={{ marginBottom: "var(--s-5)" }}>
        <div className={ui.sectionHead}>{tx("মধ্যস্থতাকারীর কাজের চাপ", "Mediator workload")}</div>
        {v.mediators.length === 0 ? (
          <p className={styles.hint}>{tx("কোনো সক্রিয় মধ্যস্থতাকারী নেই।", "No active mediators.")}</p>
        ) : (
          <div className={styles.tableWrap} style={{ maxHeight: "none" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tx("মধ্যস্থতাকারী", "Mediator")}</th>
                  <th>{tx("চলমান কেস", "Active cases")}</th>
                  <th>{tx("সম্পন্ন সেশন", "Sessions held")}</th>
                  <th>{tx("নিষ্পত্তি", "Settled")}</th>
                  <th>{tx("ব্যর্থ", "Failed")}</th>
                </tr>
              </thead>
              <tbody>
                {v.mediators.map((x) => (
                  <tr key={x.m.mediatorId}>
                    <td>
                      <a href={`#mediator/${encodeURIComponent(x.m.mediatorId)}`}>
                        <strong>{x.m.name}</strong>
                      </a>
                      <div className={styles.hint}>{pretty(x.m.status)}</div>
                    </td>
                    <td>{x.active}</td>
                    <td>{x.sessionsHeld}</td>
                    <td>{x.settled}</td>
                    <td>{x.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={ui.main}>
        <div className={ui.sectionHead}>{tx("সাম্প্রতিক অডিট (সর্বশেষ ৪০)", "Recent audit (latest 40)")}</div>
        <AuditTable rows={v.audit} />
      </section>
    </>
  );
}

"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  EscalationService,
  RoutingRecommendationService,
  AuthorityDirectoryService,
  LegalBasisRegistryService,
  ReferralService,
  ApplicationRecordService,
  DemoTimeService,
  useHelplineStore,
  ensureSeeded,
} from "@/lib/shakkho";
import type { HumanRoutingDecision } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function EscalationWorkspacePage({ params }: { params: Promise<{ escalationId: string }> }) {
  const { escalationId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  const [decision, setDecision] = useState<HumanRoutingDecision["decision"]>("select_final_route");
  const [decidedBy, setDecidedBy] = useState<string>("জেলা আইনি সহায়তা কর্মকর্তা");
  const [authority, setAuthority] = useState<string>("জেলা আইনি সহায়তা কমিটি");
  const [destinationEntryId, setDestinationEntryId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [office, setOffice] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  const foundEscalation = EscalationService.find(envelope, escalationId);
  if (!foundEscalation) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;
  const escalation = foundEscalation;

  const ref = envelope.referrals ?? [];
  const caseRefs = ref.filter((r) => r.applicationId === escalation.applicationId);
  const app = ApplicationRecordService.find(envelope, escalation.applicationId);
  const stats = EscalationService.statsForApplication(envelope, escalation.applicationId);
  const directory = AuthorityDirectoryService.list(envelope);
  const legalBasis = LegalBasisRegistryService.active(envelope);

  const latestRec = useMemo(() => {
    return (envelope.routingRecommendations ?? [])
      .filter((r) => r.applicationId === escalation.applicationId)
      .slice()
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  }, [envelope.routingRecommendations, escalation.applicationId]);

  function generateRecommendation() {
    RoutingRecommendationService.recommend({
      applicationId: escalation.applicationId,
      matter: app?.facts?.category?.value ?? "compensation",
      district: app?.office,
      currentOffice: "Dhaka DLAO",
      actor: decidedBy || "officer",
    });
    setTick((tt) => tt + 1);
  }

  function moveToHumanReview() {
    EscalationService.transition({
      escalationId,
      to: "human_review_required",
      actor: decidedBy || "officer",
      reason: "Escalation reviewer has opened the workspace",
    });
    setTick((tt) => tt + 1);
  }

  function recordDecision() {
    const dl = deadline ? new Date(deadline).getTime() : undefined;
    const nextIso = dl ? new Date(dl).toISOString() : undefined;
    EscalationService.recordHumanRoutingDecision({
      escalationId,
      applicationId: escalation.applicationId,
      decision,
      decidedBy: decidedBy || "officer",
      reason: reason || "Manual routing decision recorded",
      authorityForDecision: authority,
      destinationEntryId: destinationEntryId || undefined,
      nextDeadline: nextIso,
      nextResponsibleOffice: office || undefined,
    });
    EscalationService.transition({
      escalationId,
      to: "route_assigned",
      actor: decidedBy || "officer",
      reason: "Route assigned by human reviewer",
    });
    setReason("");
    setTick((tt) => tt + 1);
  }

  function markAcknowledged() {
    EscalationService.markRouteAcknowledged({ escalationId, actor: decidedBy || "officer" });
    setTick((tt) => tt + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/escalations" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralEscalationWorkspaceTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralEscalationWorkspaceTitle")}</h1>
        <p className={styles.intro}>
          Escalation ID: <code>{escalation.escalationId}</code> · Case ID: <code>{escalation.caseId ?? "—"}</code> · Applicant: {app?.facts?.applicant_name?.value ?? escalation.applicationId}
        </p>

        <div className={styles.noticeWarn}>
          Repeated transfer detected — an authorised routing decision is required. The system does not decide jurisdiction.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Transfer history</h2>
            <span className={styles.sectionSub}>{caseRefs.length}</span>
          </div>
          <div className={styles.card}>
            <div className={styles.kvGrid}>
              <div className={styles.kvLabel}>Transfers</div>
              <div className={styles.kvValue}>{stats.transfers}</div>
              <div className={styles.kvLabel}>Returns</div>
              <div className={styles.kvValue}>{stats.returns}</div>
              <div className={styles.kvLabel}>Destinations</div>
              <div className={styles.kvValue}>{stats.destinations.join(", ") || "—"}</div>
            </div>

            {stats.returnReasons.length > 0 && (
              <div>
                <h3 className={styles.kvLabel} style={{ marginTop: 12 }}>Return reasons</h3>
                <ul className={styles.timeline}>
                  {stats.returnReasons.map((r, idx) => (
                    <li key={idx} className={styles.timelineItem}>
                      <span className={styles.timelineTime}>{new Date(r.at).toISOString().slice(0, 16).replace("T", " ")}</span>
                      <span><strong>{r.reason}</strong>{r.note ? ` — ${r.note}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {caseRefs.map((r) => (
              <div key={r.referralId} className={styles.evidenceRow}>
                <div>↗</div>
                <div>
                  <div><strong>{r.referralId}</strong> · {r.package.sendingOffice} → {r.package.receivingOffice}</div>
                  <div className={styles.evidenceMeta}>state {r.package.state} · priority {r.package.priority}</div>
                  <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>
                    {t("referralQueueOpen")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Routing recommendation</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={generateRecommendation}>
                Generate fresh recommendation
              </button>
            </div>
            {latestRec ? (
              <div className={styles.notice}>
                <div>
                  <strong>Confidence:</strong> <span className={`${styles.statusPill} ${latestRec.confidence === "sufficient_for_human_review" ? styles.statusPillOk : latestRec.confidence === "no_verified_route" ? styles.statusPillAlert : styles.statusPillWarn}`}>{latestRec.confidence}</span>
                </div>
                <div>
                  <strong>Recommended:</strong> {latestRec.recommendedDestination.displayName || "—"} ({latestRec.recommendedDestination.type})
                </div>
                <div>
                  <strong>Ruleset:</strong> <code>{latestRec.rulesetVersion}</code>
                </div>
                {latestRec.reasons.length > 0 && (
                  <ul className={styles.timeline}>
                    {latestRec.reasons.map((r, idx) => (
                      <li key={idx} className={styles.timelineItem}>
                        <span>{lang === "bn" ? r.bn : r.en}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {latestRec.conflicts.length > 0 && (
                  <div className={styles.noticeWarn}>
                    <strong>Conflicts:</strong>
                    <ul>
                      {latestRec.conflicts.map((c, idx) => (
                        <li key={idx}>{lang === "bn" ? c.bn : c.en}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestRec.missingOrUncertain.length > 0 && (
                  <div className={styles.noticeWarn}>
                    <strong>Missing/uncertain:</strong>
                    <ul>
                      {latestRec.missingOrUncertain.map((c, idx) => (
                        <li key={idx}>{lang === "bn" ? c.bn : c.en}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.notice}>No recommendation yet. Generate one above.</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Legal basis references</h2>
            <span className={styles.sectionSub}>{legalBasis.length}</span>
          </div>
          <div className={styles.card}>
            {legalBasis.length === 0 && <div className={styles.notice}>No active legal-basis entries.</div>}
            {legalBasis.map((b) => (
              <div key={b.basisId} className={styles.evidenceRow}>
                <div>📜</div>
                <div>
                  <div><strong>{b.instrument}</strong> · {b.reference}</div>
                  <div className={styles.evidenceMeta}>{b.area} · {b.matterCategory} · {b.receivingAuthorityType}</div>
                  <div className={styles.evidenceMeta}>{b.timeRequirement}</div>
                </div>
                <span className={`${styles.statusPill} ${b.verificationStatus === "verified" ? styles.statusPillOk : styles.statusPillWarn}`}>{b.verificationStatus}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralHumanRoutingDecisionHeading")}</h2>
          </div>
          <div className={styles.card}>
            {escalation.state === "repeat_detected" && (
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={moveToHumanReview}>
                  Open human review
                </button>
              </div>
            )}
            {(escalation.state === "human_review_required" || escalation.state === "repeat_detected") && (
              <>
                <div className={styles.formRow}>
                  <label htmlFor="dec">Decision</label>
                  <select id="dec" value={decision} onChange={(e) => setDecision(e.target.value as HumanRoutingDecision["decision"])}>
                    <option value="select_final_route">Select final route</option>
                    <option value="return_to_sender">Return to sender</option>
                    <option value="request_clarification">Request clarification</option>
                    <option value="retain_temporarily">Retain temporarily</option>
                    <option value="direct_coordinated_action">Direct coordinated action</option>
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="dst">Destination (authority directory)</label>
                  <select id="dst" value={destinationEntryId} onChange={(e) => setDestinationEntryId(e.target.value)}>
                    <option value="">— Select —</option>
                    {directory.map((d) => (
                      <option key={d.entryId} value={d.entryId}>
                        {d.displayNameEn} ({d.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="by">Decided by</label>
                  <input id="by" value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="auth">Authority for decision</label>
                  <input id="auth" value={authority} onChange={(e) => setAuthority(e.target.value)} />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="off">Next responsible office</label>
                  <input id="off" value={office} onChange={(e) => setOffice(e.target.value)} />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="dl">Next deadline</label>
                  <input id="dl" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="rs">Reason</label>
                  <textarea id="rs" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className={styles.actions}>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={recordDecision}>
                    Record human routing decision
                  </button>
                </div>
              </>
            )}
            {escalation.humanDecision && (
              <div className={styles.noticeOk}>
                Decision recorded by {escalation.humanDecision.decidedBy} ({escalation.humanDecision.decision}) at {new Date(escalation.humanDecision.decidedAt).toISOString().slice(0, 16).replace("T", " ")}.
                <div>{escalation.humanDecision.reason}</div>
              </div>
            )}
            {escalation.state === "route_assigned" && (
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={markAcknowledged}>
                  Mark receiving authority acknowledged
                </button>
              </div>
            )}
            {escalation.state === "receiving_authority_acknowledged" && (
              <div className={styles.noticeOk}>Escalation closed. Both offices share the same Case ID.</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Escalation history</h2>
            <span className={styles.sectionSub}>{escalation.history.length}</span>
          </div>
          <div className={styles.card}>
            <ul className={styles.timeline}>
              {escalation.history.slice().reverse().map((h, idx) => (
                <li key={idx} className={styles.timelineItem}>
                  <span className={styles.timelineTime}>{new Date(h.at).toISOString().slice(0, 16).replace("T", " ")}</span>
                  <span>{h.from} → <strong>{h.to}</strong> by {h.actor}{h.reason ? ` — ${h.reason}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href="/referrals/escalations" className={`${styles.btn} ${styles.btnGhost}`}>← Back to escalations</Link>
        </div>
      </main>
    </div>
  );
}
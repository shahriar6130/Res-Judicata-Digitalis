"use client";

/* ------------------------------------------------------------------ *
 *  MEDIATOR ASSIGNMENT — shown in the Legal pathway step once a case is
 *  in a mediation pathway (/dashboard/dlo#app/<id>). Separate from the
 *  panel-lawyer shortlist. Hard filters first, then the eligible mediators
 *  are RANKED (transparent rule-based score, advisory) as "best picks".
 *  The officer sends an offer; the mediator accepts or declines; a decline
 *  or no answer moves the offer to the next pick automatically.
 *  lib/dlas/mediator-assignment.ts + lib/dlas/mediator-offers.ts
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import {
  ASSIGNMENT_STATUS_LABELS,
  FILTER_LABELS,
  MEDIATION_CASE_TYPES,
  MEDIATION_CHANNELS,
  MediatorAssignmentService,
  MediatorOfferService,
  OFFER_HOURS,
  WEEKDAYS,
  formatDateTime,
  lbl,
  statusLabel,
  useMediatorAssignment,
  useMediatorBestPicks,
  useMediatorOfferSweep,
  type ApplicationRecord,
  type MediatorAssignmentRecord,
  type MediationCaseType,
  type MediatorAssignmentStatus,
  type MediatorCandidate,
  type RankedMediator,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";
type Lang = "bn" | "en";
type Run = (fn: () => void) => void;

function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`}>{children}</span>;
}

function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

const FLOW: MediatorAssignmentStatus[] = ["PENDING", "RECOMMENDED", "AWAITING_MEDIATOR_ACCEPTANCE", "ASSIGNED", "REASSIGNMENT_REQUESTED", "COMPLETED"];
const EXP: Record<string, { bn: string; en: string }> = { HIGH: { bn: "বেশি", en: "High" }, MEDIUM: { bn: "মাঝারি", en: "Medium" }, LOW: { bn: "কম", en: "Low" } };

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <span title={detail} aria-label={`${label}: ${ok ? "passed" : "failed"} — ${detail}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12, whiteSpace: "nowrap" }}>
      <span aria-hidden style={{ color: ok ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
        {ok ? "✓" : "✗"}
      </span>
      <span aria-hidden>{label}</span>
    </span>
  );
}

function ConflictDetected({ children }: { children?: ReactNode }) {
  const { tx } = useTx();
  return (
    <div className={`${ui.banner} ${ui.bannerErr}`} role="alert">
      <span className={ui.bannerIcon} aria-hidden>
        !
      </span>
      <div>
        <strong>{tx("স্বার্থের সংঘাত শনাক্ত", "CONFLICT DETECTED")}</strong> — {children}
      </div>
    </div>
  );
}

/* ================================================================== */

export function MediatorAssignPanel({ a, run }: { a: ApplicationRecord; run: Run }) {
  const { lang, tx } = useTx();
  const v = useMediatorAssignment(a);
  const picks = useMediatorBestPicks(a);
  useMediatorOfferSweep();
  const status: MediatorAssignmentStatus = v.matter?.assignmentStatus ?? "PENDING";
  const run0 = v.lastRun;
  const court = v.track === "COURT_REFERRED";

  // Eligible list comes from the last saved run (what the officer decides from), refreshed live for conflicts.
  const liveById = new Map(v.live.map((c) => [c.mediatorId, c]));
  const rows: MediatorCandidate[] = (run0?.candidates ?? []).map((c) => liveById.get(c.mediatorId) ?? c);
  const excluded = rows.filter((c) => !c.eligible);
  const canPick = !picks.offer && status !== "COMPLETED";

  return (
    <section className={ui.panel} style={{ marginTop: "var(--s-5)" }} aria-label={tx("মধ্যস্থতাকারী নিয়োগ", "Mediator assignment")}>
      <div className={ui.panelTitle}>
        <span>{tx("মধ্যস্থতাকারী নিয়োগ", "MEDIATOR ASSIGNMENT")}</span>
        <Tag tone={status === "ASSIGNED" || status === "COMPLETED" ? "ok" : status === "REASSIGNMENT_REQUESTED" ? "err" : "warn"}>{ASSIGNMENT_STATUS_LABELS[status][lang]}</Tag>
      </div>

      {/* status trail */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 var(--s-3)" }} aria-label={tx("অবস্থা", "Assignment status")}>
        {FLOW.map((s) => (
          <span key={s} className={`${ui.tag} ${s === status ? ui.ink : ""}`} aria-current={s === status ? "step" : undefined} style={{ opacity: s === status ? 1 : 0.55 }}>
            {ASSIGNMENT_STATUS_LABELS[s][lang]}
          </span>
        ))}
      </div>

      <div className={ui.rows}>
        <Row label={tx("মধ্যস্থতার উৎস", "Mediation origin")}>
          <Tag tone={court ? "ink" : "ok"}>{(v.matter?.origin ?? (court ? "COURT_REFERRED" : "PRE_LITIGATION")).replaceAll("_", " ")}</Tag> {v.matter ? statusLabel(v.matter.pathwayStatus, lang) : ""}
        </Row>
        {v.currents.length ? <Row label={tx("নিয়োগকৃত মধ্যস্থতাকারী", "Assigned mediators")}><strong>{v.currents.length}</strong> · {v.currents.map((x) => x.mediatorName).join(", ")}</Row> : null}
        {court ? <Row label={tx("আদালত রেফারেল তথ্য", "Court referral record")}>{[a.pathwayClassification?.inputs.courtName, a.pathwayClassification?.inputs.courtLevel?.replaceAll("_", " "), a.pathwayClassification?.inputs.courtCaseNo, a.pathwayClassification?.inputs.referralOrderReference, a.pathwayClassification?.inputs.referringAuthority, a.pathwayClassification?.inputs.currentLitigationStage?.replaceAll("_", " "), a.pathwayClassification?.inputs.referralDeadline].filter(Boolean).join(" · ") || "—"}</Row> : null}
        <Row label={tx("মামলার ধরন (ফিল্টারে ব্যবহৃত)", "Case type (used by the filters)")}>
          {canPick && !v.current && !v.pending ? (
            <select className={styles.select} style={{ maxWidth: 320 }} value={v.caseType ?? ""} onChange={(e) => e.target.value && run(() => void MediatorAssignmentService.setCaseType(a.applicationId, e.target.value as MediationCaseType))}>
              <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
              {MEDIATION_CASE_TYPES.filter((c) => c.track === v.track).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label[lang]}
                </option>
              ))}
            </select>
          ) : (
            lbl(MEDIATION_CASE_TYPES, v.caseType, lang)
          )}{" "}
          <span className={styles.hint}>{v.matter?.caseTypeSource === "OFFICER_SET" ? tx("কর্মকর্তা নির্ধারিত", "set by officer") : tx("উপ-ধরন থেকে", "from the pathway subcategory")}</span>
        </Row>
      </div>

      {/* ---------- assigned ---------- */}
      {v.currents.map((assignment, index) => <Assigned key={assignment.assignmentId} a={a} run={run} assignment={assignment} allowComplete={index === 0} />)}

      {/* ---------- awaiting confirmation ---------- */}
      {v.pending ? <Awaiting a={a} run={run} /> : null}

      {/* ---------- offer waiting for the mediator ---------- */}
      {picks.offer ? <OpenOffer a={a} run={run} offer={picks.offer} /> : null}

      {/* ---------- eligibility ---------- */}
      {canPick ? (
        <div style={{ marginTop: "var(--s-4)" }}>
          <div className={ui.bar}>
            <Button variant={run0 ? "secondary" : "primary"} disabled={!v.caseType} onClick={() => run(() => void MediatorAssignmentService.checkEligibility(a.applicationId))}>
              {v.currents.length ? tx("সহ-মধ্যস্থতাকারী যোগ করতে যোগ্যতা যাচাই", "Check eligibility to add a co-mediator") : run0 ? tx("যোগ্যতা আবার যাচাই", "Re-check eligible mediators") : tx("যোগ্য মধ্যস্থতাকারী খুঁজুন", "Check eligible mediators")}
            </Button>
            {run0 ? (
              <span className={styles.hint}>
                {tx("শেষ যাচাই", "Last check")} {formatDateTime(run0.at, lang)} · {run0.byName}
              </span>
            ) : null}
          </div>

          {run0 ? (
            <>
              <BestPicks a={a} run={run} ranked={picks.ranked} tried={picks.history.filter((x) => x.status === "DECLINED" || x.status === "EXPIRED").length} />

              {excluded.length ? (
                <details style={{ marginTop: "var(--s-4)" }} open={excluded.some((c) => c.conflictIds.length > 0)}>
                  <summary style={{ cursor: "pointer" }}>
                    {tx(`যোগ্য নন (${excluded.length}) — কারণসহ`, `Not eligible (${excluded.length}) — with reasons`)}
                  </summary>
                  <div className={ui.rows} style={{ marginTop: 8 }}>
                    {excluded.map((c) => (
                      <Row key={c.mediatorId} label={c.name}>
                        {c.conflictIds.length ? <Tag tone="err">{tx("স্বার্থের সংঘাত শনাক্ত", "CONFLICT DETECTED")}</Tag> : null}{" "}
                        {c.checks
                          .filter((k) => !k.ok)
                          .map((k) => `${FILTER_LABELS[k.key][lang]}: ${k.detail}`)
                          .join(" · ")}{" "}
                        <a className={ui.textBtn} href={`#mediator/${c.mediatorId}`}>
                          {tx("প্রোফাইল", "Profile")}
                        </a>
                      </Row>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <p className={styles.hint}>{tx("জেলার মধ্যস্থতাকারী রেজিস্ট্রি থেকে শক্ত শর্তগুলো (সক্রিয়, সনদ, এখতিয়ার, সময়, স্বার্থের সংঘাত, মামলার ধরন) যাচাই হবে।", "The hard filters (active, certification, jurisdiction, availability, conflict of interest, case type) run over the district's mediator registry.")}</p>
          )}
        </div>
      ) : null}

      <History a={a} />
    </section>
  );
}

/* ------------------------------ best picks ------------------------------ */

const PART: { key: keyof RankedMediator["breakdown"]; max: number; bn: string; en: string }[] = [
  { key: "experience", max: 35, bn: "অভিজ্ঞতা", en: "Experience" },
  { key: "capacity", max: 30, bn: "খালি সক্ষমতা", en: "Free capacity" },
  { key: "availability", max: 15, bn: "সময়", en: "Availability" },
  { key: "record", max: 15, bn: "রেকর্ড", en: "Record" },
  { key: "area", max: 5, bn: "এলাকা", en: "Area" },
];

function CandidateFacts({ c }: { c: MediatorCandidate }) {
  const { lang, tx } = useTx();
  return (
    <>
      <div style={{ margin: "6px 0", fontSize: "var(--t-small)" }}>
        <Check ok label={tx("যোগ্যতা", "Eligibility")} detail="all hard filters passed" />
        {c.checks.map((k) => (
          <Check key={k.key} ok={k.ok} label={FILTER_LABELS[k.key][lang]} detail={k.detail} />
        ))}
      </div>
      <div className={ui.rows}>
        <Row label={tx("প্রাসঙ্গিক অভিজ্ঞতা", "Relevant experience")}>
          <strong>{EXP[c.considerations.relevantExperience][lang]}</strong> <span className={styles.hint}>· {c.considerations.experienceNote}</span>
        </Row>
        <Row label={tx("বর্তমান কাজের চাপ", "Current workload")}>
          {c.considerations.currentLoad} / {c.considerations.capacity}
        </Row>
        <Row label={tx("সময়", "Availability")}>
          {c.considerations.availability === "LIMITED" ? <Tag tone="warn">{tx("সীমিত", "Limited")}</Tag> : <Tag tone="ok">{tx("উপলব্ধ", "Available")}</Tag>} {c.considerations.days.map((d) => lbl(WEEKDAYS, d, lang)).join(", ")} · {c.considerations.channels.map((ch) => lbl(MEDIATION_CHANNELS, ch, lang)).join(", ")}
        </Row>
        <Row label={tx("এলাকা", "Area")}>
          {c.considerations.areas.join(", ") || "—"} {c.considerations.areaMatch ? <Tag tone="ok">{tx("আবেদনকারীর এলাকা", "applicant's area")}</Tag> : null}
        </Row>
        <Row label={tx("প্রশাসনিক রেকর্ড", "Timeliness / record")}>
          <Tag tone={c.considerations.record === "CONCERN" ? "warn" : c.considerations.record === "COMMENDED" ? "ok" : "neutral"}>
            {c.considerations.record === "CONCERN" ? tx("অভিযোগ আছে", "Complaint on record") : c.considerations.record === "COMMENDED" ? tx("প্রশংসিত", "Commended") : c.considerations.record === "NOTES_ONLY" ? tx("নোট আছে", "Notes only") : tx("কোনো এন্ট্রি নেই", "No entries")}
          </Tag>{" "}
          <span className={styles.hint}>{c.considerations.recordNote}</span>
        </Row>
      </div>
    </>
  );
}

/** Ranked eligible mediators; the officer sends the offer (normally to #1). */
function BestPicks({ a, run, ranked, tried }: { a: ApplicationRecord; run: Run; ranked: RankedMediator[]; tried: number }) {
  const { tx } = useTx();
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [more, setMore] = useState(false);
  const shown = more ? ranked : ranked.slice(0, 3);
  const send = (id: string) =>
    run(() => {
      MediatorOfferService.offer(a.applicationId, id, reason);
      setOpen(null);
      setReason("");
    });
  return (
    <div style={{ marginTop: "var(--s-3)" }} id="best-picks">
      <div className={`${ui.banner} ${ui.bannerWarn}`}>
        <span className={ui.bannerIcon} aria-hidden>
          i
        </span>
        <div>
          <strong>{tx("সিস্টেমের র‍্যাঙ্কিং — পরামর্শমূলক।", "System ranking — advisory.")}</strong>{" "}
          {tx(
            `শর্ত পূরণকারী মধ্যস্থতাকারীদের নিয়মভিত্তিক স্কোর (অভিজ্ঞতা, খালি সক্ষমতা, সময়, রেকর্ড, এলাকা)। কাকে প্রস্তাব পাঠাবেন তা আপনি ঠিক করেন। মধ্যস্থতাকারী ${OFFER_HOURS} ঘণ্টার মধ্যে গ্রহণ না করলে বা প্রত্যাখ্যান করলে পরের জনকে স্বয়ংক্রিয়ভাবে পাঠানো হয়।`,
            `Mediators who pass every hard filter, scored by fixed rules (experience, free capacity, availability, record, area). You decide whom to offer the case to. If the mediator declines or does not answer within ${OFFER_HOURS} h, the next pick is offered the case automatically.`,
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "var(--s-3) 0" }}>
        <strong>
          {tx("সেরা পছন্দ", "BEST PICKS")} ({ranked.length} {tx("জন যোগ্য", "eligible")})
        </strong>
        {tried ? <Tag tone="warn">{tx(`${tried} জন আগে প্রত্যাখ্যান/উত্তরহীন — বাদ`, `${tried} already declined / no answer — left out`)}</Tag> : null}
        {ranked[0] ? (
          <Button onClick={() => send(ranked[0].c.mediatorId)}>
            ★ {tx(`সেরা পছন্দ #১-কে প্রস্তাব পাঠান (${ranked[0].c.name})`, `Send offer to best pick #1 (${ranked[0].c.name})`)}
          </Button>
        ) : null}
      </div>

      {ranked.length === 0 ? (
        <p className={styles.hint}>{tx("কেউ সব শর্ত পূরণ করেননি (বা সবাই প্রত্যাখ্যান করেছেন) — নিচে কারণ দেখুন, পরে যোগ্যতা আবার যাচাই করুন (নতুন মধ্যস্থতাকারী নিবন্ধন করলে তালিকায় আসবেন), অথবা অন্য আইনি পথ বেছে নিন।", "No one passes every hard filter (or everyone has declined) — see the reasons below, re-check later (newly signed-up mediators appear automatically), or choose another legal pathway.")}</p>
      ) : (
        <ol style={{ display: "grid", gap: "var(--s-3)", listStyle: "none", padding: 0, margin: 0 }}>
          {shown.map((r) => (
            <li key={r.c.mediatorId} className={`${ui.flowStep} ${r.rank === 1 ? ui.suggest : ""}`}>
              {r.rank === 1 ? <span className={ui.suggestBadge}>{tx("সেরা পছন্দ — সিস্টেমের পরামর্শ", "BEST PICK — SYSTEM SUGGESTION")}</span> : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <strong>
                  #{r.rank} · {r.c.name} {r.c.sample ? <Tag tone="ink">{tx("নমুনা", "SAMPLE")}</Tag> : null}
                </strong>
                <span>
                  <strong style={{ fontSize: "var(--t-sub)" }}>{r.score}</strong>
                  <span className={styles.hint}>/100</span>
                </span>
              </div>
              <div className={styles.hint} style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", margin: "4px 0" }} aria-label={tx("স্কোরের ভাঙন", "Score breakdown")}>
                {PART.map((p) => (
                  <span key={p.key}>
                    {tx(p.bn, p.en)} {r.breakdown[p.key]}/{p.max}
                  </span>
                ))}
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: "var(--t-small)" }}>{tx("শর্ত ও তথ্য", "Filters and facts")}</summary>
                <CandidateFacts c={r.c} />
              </details>
              {open === r.c.mediatorId ? (
                <div style={{ marginTop: 8 }}>
                  <label className={styles.field}>
                    <span className={styles.label}>{tx("প্রস্তাবের নোট (ঐচ্ছিক)", "Note with the offer (optional)")}</span>
                    <input className={styles.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("যেমন: পারিবারিক বিষয়ে অভিজ্ঞ", "e.g. experienced in family matters")} />
                  </label>
                  <div className={styles.actions} style={{ marginTop: 6 }}>
                    <Button onClick={() => send(r.c.mediatorId)}>{tx("প্রস্তাব পাঠান", "Send offer")}</Button>
                    <Button variant="secondary" onClick={() => setOpen(null)}>
                      {tx("বাতিল", "Cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions} style={{ marginTop: 8 }}>
                  <a className={ui.textBtn} href={`#mediator/${r.c.mediatorId}`}>
                    {tx("প্রোফাইল দেখুন", "View profile")}
                  </a>
                  <Button variant={r.rank === 1 ? "primary" : "secondary"} onClick={() => setOpen(r.c.mediatorId)}>
                    {tx("প্রস্তাব পাঠান…", "Send offer…")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {ranked.length > 3 ? (
        <button type="button" className={ui.textBtn} style={{ marginTop: 8 }} onClick={() => setMore(!more)}>
          {more ? tx("শুধু সেরা ৩ জন দেখান", "Show only the top 3") : tx(`সব ${ranked.length} জন দেখান`, `Show all ${ranked.length}`)}
        </button>
      ) : null}
    </div>
  );
}

/** The offer waiting for the mediator's answer (and what happened before). */
function OpenOffer({ a, run, offer }: { a: ApplicationRecord; run: Run; offer: MediatorAssignmentRecord }) {
  const { lang, tx } = useTx();
  const [withdraw, setWithdraw] = useState(false);
  const [why, setWhy] = useState("");
  const o = offer.offer!;
  return (
    <div className={`${ui.flowStep} ${ui.suggest}`} style={{ marginTop: "var(--s-4)" }} role="status">
      <span className={ui.suggestBadge}>{tx("মধ্যস্থতাকারীর উত্তরের অপেক্ষায়", "WAITING FOR THE MEDIATOR TO ACCEPT")}</span>
      <div className={ui.bigPathway} style={{ fontSize: "var(--t-sub)" }}>
        {offer.mediatorName}
      </div>
      <div className={ui.rows} style={{ marginTop: 8 }}>
        <Row label={tx("র‍্যাঙ্ক / স্কোর", "Rank / score")}>
          #{o.rank} · {o.score}/100
        </Row>
        <Row label={tx("পাঠিয়েছেন", "Offered by")}>
          {o.via === "AUTO_NEXT" ? <Tag tone="ink">{tx("স্বয়ংক্রিয় — পরের জন", "Automatic — next pick")}</Tag> : offer.recommendedByName} · {formatDateTime(o.offeredAt, lang)}
        </Row>
        {offer.recommendationNote ? <Row label={tx("নোট", "Note")}>“{offer.recommendationNote}”</Row> : null}
        <Row label={tx("উত্তরের শেষ সময়", "Answer by")}>
          {formatDateTime(o.respondBy, lang)} <span className={styles.hint}>· {tx("না হলে পরের জনকে স্বয়ংক্রিয়ভাবে পাঠানো হবে", "otherwise the next pick is offered automatically")}</span>
        </Row>
        <Row label={tx("মধ্যস্থতাকারীকে জানানো", "Mediator notified")}>
          {tx("এসএমএস + পোর্টালে কাজ", "SMS + portal task")} <Tag tone="ink">{tx("সিমুলেটেড এসএমএস", "SIMULATED SMS")}</Tag>
        </Row>
      </div>
      {withdraw ? (
        <div style={{ marginTop: 8 }}>
          <input className={styles.input} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={tx("প্রত্যাহারের কারণ", "Reason for withdrawing")} />
          <div className={styles.actions} style={{ marginTop: 6 }}>
            <Button
              variant="secondary"
              disabled={why.trim().length < 5}
              onClick={() =>
                run(() => {
                  MediatorOfferService.withdrawOffer(a.applicationId, why);
                  setWithdraw(false);
                  setWhy("");
                })
              }
            >
              {tx("প্রত্যাহার নিশ্চিত", "Confirm withdrawal")}
            </Button>
            <Button variant="secondary" onClick={() => setWithdraw(false)}>
              {tx("বাতিল", "Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className={ui.textBtn} style={{ marginTop: 8 }} onClick={() => setWithdraw(true)}>
          {tx("প্রস্তাব প্রত্যাহার করে অন্য কাউকে বাছুন", "Withdraw the offer and choose someone else")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------ awaiting confirmation ------------------------------ */

function Awaiting({ a, run }: { a: ApplicationRecord; run: Run }) {
  const { lang, tx } = useTx();
  const v = useMediatorAssignment(a);
  const [reason, setReason] = useState("");
  const [withdraw, setWithdraw] = useState(false);
  const [why, setWhy] = useState("");
  const p = v.pending!;
  const live = v.pendingLive;
  const conflict = !!live && live.conflictIds.length > 0;
  return (
    <div className={`${ui.flowStep} ${ui.suggest}`} style={{ marginTop: "var(--s-4)" }}>
      <span className={ui.suggestBadge}>{tx("সিস্টেমের সুপারিশ — কর্মকর্তার নিশ্চিতকরণ প্রয়োজন", "SYSTEM RECOMMENDATION — OFFICER CONFIRMATION REQUIRED")}</span>
      <div className={ui.bigPathway} style={{ fontSize: "var(--t-sub)" }}>
        {p.mediatorName}
      </div>
      <div className={styles.hint}>
        {tx("সুপারিশ করেছেন", "Recommended by")} {p.recommendedByName} · {formatDateTime(p.recommendedAt, lang)}
        {p.recommendationNote ? ` · “${p.recommendationNote}”` : ""}
      </div>
      {live ? (
        <div style={{ margin: "8px 0", fontSize: "var(--t-small)" }}>
          {live.checks.map((k) => (
            <Check key={k.key} ok={k.ok} label={FILTER_LABELS[k.key][lang]} detail={k.detail} />
          ))}
        </div>
      ) : null}
      {conflict ? <ConflictDetected>{tx("এই মধ্যস্থতাকারী এই মামলার সাথে স্বার্থের সংঘাত ঘোষণা করেছেন। স্বাভাবিক নিয়োগ সম্ভব নয় — সুপারিশ প্রত্যাহার করে অন্য কাউকে বেছে নিন।", "this mediator has a declared conflict with this case. Normal assignment is not allowed — withdraw the recommendation and choose another mediator.")}</ConflictDetected> : null}
      {!conflict ? (
        <>
          <label className={styles.field} style={{ marginTop: 8 }}>
            <span className={styles.label}>{tx("নিয়োগের কারণ (কমপক্ষে ১০ অক্ষর)", "Assignment reason (at least 10 characters)")}</span>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className={ui.bar}>
            <Button disabled={reason.trim().length < 10} onClick={() => run(() => void MediatorAssignmentService.confirm(a.applicationId, p.assignmentId, reason))}>
              ✓ {tx("নিয়োগ নিশ্চিত করুন", "Confirm assignment")}
            </Button>
            <span className={styles.hint}>{reason.trim().length}/10</span>
          </div>
        </>
      ) : null}
      {withdraw ? (
        <div style={{ marginTop: 8 }}>
          <input className={styles.input} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={tx("প্রত্যাহারের কারণ", "Reason for withdrawing")} />
          <div className={styles.actions} style={{ marginTop: 6 }}>
            <Button variant="secondary" disabled={why.trim().length < 5} onClick={() => run(() => void MediatorAssignmentService.withdraw(a.applicationId, p.assignmentId, why))}>
              {tx("প্রত্যাহার নিশ্চিত", "Confirm withdrawal")}
            </Button>
            <Button variant="secondary" onClick={() => setWithdraw(false)}>
              {tx("বাতিল", "Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className={ui.textBtn} style={{ marginTop: 8 }} onClick={() => setWithdraw(true)}>
          {tx("সুপারিশ প্রত্যাহার করুন", "Withdraw recommendation")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------ assigned ------------------------------ */

function Assigned({ a, run, assignment: c, allowComplete }: { a: ApplicationRecord; run: Run; assignment: MediatorAssignmentRecord; allowComplete: boolean }) {
  const { lang, tx } = useTx();
  const v = useMediatorAssignment(a);
  const [mode, setMode] = useState<"reassign" | "complete" | null>(null);
  const [text, setText] = useState("");
  const live = v.live.find((x) => x.mediatorId === c.mediatorId);
  const conflict = !!live?.conflictIds.length;
  return (
    <div className={`${ui.flowStep} ${conflict ? "" : ui.confirmed}`} style={{ marginTop: "var(--s-4)", borderColor: conflict ? "var(--red)" : undefined, borderWidth: conflict ? 2 : undefined }}>
      <span className={ui.confirmedBadge} style={conflict ? { background: "var(--red)" } : undefined}>
        {conflict ? tx("নিয়োগকৃত — পুনঃনিয়োগ প্রয়োজন", "ASSIGNED — REASSIGNMENT REQUIRED") : c.offer ? `✓ ${tx("মধ্যস্থতাকারী গ্রহণ করেছেন", "MEDIATOR ACCEPTED")}` : `✓ ${tx("কর্মকর্তা নিশ্চিত করেছেন", "OFFICER CONFIRMED")}`}
      </span>
      {conflict ? (
        <div style={{ marginTop: 8 }}>
          <ConflictDetected>{tx("নিয়োগের পরে এই মধ্যস্থতাকারীর ঘোষিত স্বার্থের সংঘাত এই মামলার সাথে মিলেছে। পুনঃনিয়োগ করুন।", "a conflict declared by this mediator now matches this case. Request reassignment.")}</ConflictDetected>
        </div>
      ) : null}
      <div className={ui.rows} style={{ marginTop: 8 }}>
        <Row label={tx("নিয়োগকৃত মধ্যস্থতাকারী", "Assigned mediator")}>
          <strong>{c.mediatorName}</strong> {live?.sample ? <Tag tone="ink">{tx("নমুনা", "SAMPLE")}</Tag> : null}{" "}
          <a className={ui.textBtn} href={`#mediator/${c.mediatorId}`}>
            {tx("প্রোফাইল", "Profile")}
          </a>
        </Row>
        <Row label={tx("নিয়োগ দিয়েছেন", "Assigned by")}>{c.assignedByName}</Row>
        <Row label={tx("তারিখ / সময়", "Date / time")}>{c.assignedAt ? formatDateTime(c.assignedAt, lang) : "—"}</Row>
        <Row label={tx("নিয়োগের কারণ", "Assignment reason")}>{c.reason ?? "—"}</Row>
        {c.offer ? (
          <Row label={tx("প্রস্তাব", "Offer")}>
            #{c.offer.rank} ({c.offer.score}/100) · {c.offer.via === "AUTO_NEXT" ? tx("স্বয়ংক্রিয় পরের প্রস্তাব", "automatic next offer") : `${tx("প্রস্তাব পাঠিয়েছেন", "offered by")} ${c.recommendedByName}`} · {tx("গ্রহণ", "accepted")} {c.offer.respondedAt ? formatDateTime(c.offer.respondedAt, lang) : "—"}
          </Row>
        ) : null}
        <Row label={tx("অবস্থা", "Assignment status")}>
          <Tag tone={conflict ? "err" : "ok"}>{ASSIGNMENT_STATUS_LABELS.ASSIGNED[lang]}</Tag> · {tx("স্বার্থের সংঘাত যাচাই", "conflict check")} {c.conflictCheck.clear ? tx("পরিষ্কার", "clear") : tx("সংঘাত", "conflict")} ({formatDateTime(c.conflictCheck.at, lang)})
        </Row>
        <Row label={tx("মামলায় প্রবেশাধিকার", "Case access")}>{c.accessGrantedAt ? `${tx("দেওয়া হয়েছে", "granted")} ${formatDateTime(c.accessGrantedAt, lang)} · ${tx("শুধু মধ্যস্থতার জন্য প্রয়োজনীয় তথ্য", "need-to-know view only")}` : "—"}</Row>
      </div>
      <div className={ui.modeBar} style={{ marginTop: "var(--s-3)" }}>
        <Button variant={conflict ? "destructive" : "secondary"} onClick={() => setMode("reassign")}>
          ⇄ {tx("পুনঃনিয়োগের অনুরোধ", "Request reassignment")}
        </Button>
        {!conflict && allowComplete ? (
          <Button variant="secondary" onClick={() => setMode("complete")}>
            {tx("মধ্যস্থতা সম্পন্ন", "Mark mediation completed")}
          </Button>
        ) : null}
      </div>
      {mode ? (
        <>
          <label className={styles.field}>
            <span className={styles.label}>{mode === "reassign" ? tx("কারণ (কমপক্ষে ১০ অক্ষর) — প্রবেশাধিকার বন্ধ হবে", "Reason (at least 10 characters) — access will be revoked") : tx("কীভাবে শেষ হলো (কমপক্ষে ১০ অক্ষর)", "How it concluded (at least 10 characters)")}</span>
            <textarea className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className={ui.bar}>
            <Button
              variant={mode === "reassign" ? "destructive" : "primary"}
              disabled={text.trim().length < 10}
              onClick={() =>
                run(() => {
                  if (mode === "reassign") MediatorAssignmentService.requestReassignment(a.applicationId, c.assignmentId, text);
                  else MediatorAssignmentService.complete(a.applicationId, text);
                  setMode(null);
                  setText("");
                })
              }
            >
              {mode === "reassign" ? tx("পুনঃনিয়োগ চাই", "Request reassignment") : tx("সম্পন্ন চিহ্নিত করুন", "Mark completed")}
            </Button>
            <Button variant="secondary" onClick={() => setMode(null)}>
              {tx("বাতিল", "Cancel")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------ history ------------------------------ */

function History({ a }: { a: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const list = a.mediation?.assignments ?? [];
  if (!list.length) return null;
  const tone = (s: string): Tone => (s === "ASSIGNED" ? "ok" : s === "AWAITING_OFFICER_CONFIRMATION" || s === "OFFERED" ? "warn" : s === "REASSIGNMENT_REQUESTED" || s === "DECLINED" || s === "EXPIRED" ? "err" : "neutral");
  const REC: Record<string, { bn: string; en: string }> = { WITHDRAWN: { bn: "প্রত্যাহৃত", en: "Withdrawn" }, OFFERED: { bn: "প্রস্তাব পাঠানো", en: "Offered" }, DECLINED: { bn: "প্রত্যাখ্যাত", en: "Declined" }, EXPIRED: { bn: "উত্তর আসেনি", en: "No answer (expired)" } };
  return (
    <div style={{ marginTop: "var(--s-4)" }}>
      <div className={ui.sectionHead}>{tx("নিয়োগের ইতিহাস", "Assignment history")}</div>
      <div className={ui.rows}>
        {[...list].reverse().map((x) => (
          <Row key={x.assignmentId} label={formatDateTime(x.recommendedAt, lang)}>
            <Tag tone={tone(x.status)}>{REC[x.status]?.[lang] ?? ASSIGNMENT_STATUS_LABELS[x.status as MediatorAssignmentStatus]?.[lang] ?? x.status}</Tag> <strong>{x.mediatorName}</strong>
            {x.offer ? ` · #${x.offer.rank} (${x.offer.score}/100) · ${x.offer.via === "AUTO_NEXT" ? tx("স্বয়ংক্রিয় প্রস্তাব", "auto-offered") : `${tx("প্রস্তাব", "offered by")} ${x.recommendedByName}`}` : ` · ${tx("সুপারিশ", "recommended by")} ${x.recommendedByName}`}
            {x.assignedByName ? ` · ${tx("নিয়োগ", "assigned by")} ${x.assignedByName}` : ""}
            {x.endReason ? (
              <span className={styles.hint} style={{ display: "block" }}>
                “{x.endReason}”
              </span>
            ) : null}
          </Row>
        ))}
      </div>
    </div>
  );
}

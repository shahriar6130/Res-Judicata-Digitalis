"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/dlo#mediators · #mediator/<MED-ID>[/record]
 *  Mediator directory — VIEW ONLY for the office.
 *  Mediators sign up themselves and are auto-approved (ACTIVE) at once.
 *  The office does not approve, reject, edit, suspend or annotate them;
 *  it only ASSIGNS cases (Legal pathway → Mediation → Best picks → offer). Data: localStorage["dlas.db.v1"].mediators
 *  (lib/dlas/mediators.ts).
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import {
  CERTIFICATION_STATUSES,
  DISTRICTS,
  EMPTY_MEDIATOR_FILTERS,
  LANGUAGES,
  MEDIATION_CASE_TYPES,
  MEDIATION_CHANNELS,
  MEDIATION_TRACKS,
  MEDIATOR_ROLES,
  MEDIATOR_STATUSES,
  MediatorRegistry,
  QUALIFICATIONS,
  assignmentReadiness,
  availabilityNow,
  certificationState,
  formatDateTime,
  label,
  lbl,
  mediatorLoad,
  useClock,
  useDlasDb,
  useMediator,
  useMediatorRegistry,
  type CertificationState,
  type MediatorFilters,
  type MediatorRecord,
  type MediatorStatus,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";
type Lang = "bn" | "en";

function Tag({ tone = "neutral", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`} title={title}>
      {children}
    </span>
  );
}

function Banner({ tone, icon, children }: { tone: "ok" | "warn" | "err"; icon: string; children: ReactNode }) {
  const cls = tone === "ok" ? ui.bannerOk : tone === "err" ? ui.bannerErr : ui.bannerWarn;
  return (
    <div className={`${ui.banner} ${cls}`} role={tone === "err" ? "alert" : undefined}>
      <span className={ui.bannerIcon} aria-hidden>
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
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

const STATUS_TONE: Record<MediatorStatus, Tone> = { ACTIVE: "ok", PENDING_VERIFICATION: "warn", INACTIVE: "neutral", SUSPENDED: "err" };

function StatusTag({ s }: { s: MediatorStatus }) {
  const { lang } = useTx();
  return <Tag tone={STATUS_TONE[s]}>{lbl(MEDIATOR_STATUSES, s, lang)}</Tag>;
}

function SampleTag() {
  const { tx } = useTx();
  return (
    <Tag tone="ink" title={tx("উদাহরণমূলক নমুনা রেকর্ড — বাস্তব ব্যক্তি নন", "Illustrative sample record — not a real person")}>
      {tx("নমুনা", "SAMPLE")}
    </Tag>
  );
}

const CERT_LABEL: Record<CertificationState, { bn: string; en: string; tone: Tone }> = {
  VALID: { bn: "বৈধ", en: "Valid", tone: "ok" },
  EXPIRED: { bn: "মেয়াদোত্তীর্ণ", en: "Expired", tone: "err" },
  UNVERIFIED: { bn: "যাচাই হয়নি", en: "Not verified", tone: "warn" },
  NOT_QUALIFYING: { bn: "প্রশিক্ষণ অসম্পূর্ণ", en: "Not qualifying", tone: "warn" },
};

function CertTag({ m, now }: { m: MediatorRecord; now: number }) {
  const { lang } = useTx();
  const s = certificationState(m, now);
  return (
    <Tag tone={CERT_LABEL[s].tone} title={lbl(CERTIFICATION_STATUSES, m.certification.status, lang)}>
      {CERT_LABEL[s][lang]}
    </Tag>
  );
}

function AvailTag({ m, now }: { m: MediatorRecord; now: number }) {
  const { tx } = useTx();
  const a = availabilityNow(m, now);
  return a === "AVAILABLE" ? <Tag tone="ok">{tx("উপলব্ধ", "Available")}</Tag> : a === "LIMITED" ? <Tag tone="warn">{tx("সীমিত", "Limited")}</Tag> : <Tag tone="err">{tx("অনুপলব্ধ", "Unavailable")}</Tag>;
}

/* ================================================================== */
/*  Registry list                                                      */
/* ================================================================== */

export function MediatorsRegistry() {
  const { lang, tx } = useTx();
  const [f, setF] = useState<MediatorFilters>(EMPTY_MEDIATOR_FILTERS);
  const reg = useMediatorRegistry(f);
  const db = useDlasDb();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const now = useClock();
  const set = <K extends keyof MediatorFilters>(k: K, v: MediatorFilters[K]) => setF((x) => ({ ...x, [k]: v }));
  const district = DISTRICTS.find((d) => d.code === reg.officer?.district);
  const filtered = Object.values(f).some(Boolean);
  const run = (fn: () => unknown, ok: string) => {
    try {
      fn();
      setMsg({ tone: "ok", text: ok });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <h1 className={styles.title}>{tx("মধ্যস্থতাকারী", "Mediators")}</h1>
      <p className={styles.lead}>
        {tx(
          `মধ্যস্থতাকারী তালিকা — ${district?.label.bn ?? ""}। মধ্যস্থতাকারীরা নিজেরাই নিবন্ধন করেন এবং সঙ্গে সঙ্গে সক্রিয় হন। অফিস শুধু কেস নিয়োগ করে (আইনি পথ → মধ্যস্থতা → সেরা পছন্দ)। এই তালিকা শুধু দেখার জন্য।`,
          `Mediator directory — ${district?.label.en ?? ""}. Mediators sign up themselves and are active at once. The office only assigns cases (Legal pathway → Mediation → Best picks). This list is view-only.`,
        )}
      </p>

      <div className={styles.stats}>
        {(
          [
            [reg.counts.total, tx("মোট", "Registered"), "neutral"],
            [reg.counts.active, tx("সক্রিয়", "Active"), "ok"],
            [reg.counts.suspended, tx("স্থগিত", "Suspended"), reg.counts.suspended ? "err" : "neutral"],
            [reg.counts.ready, tx("নিয়োগযোগ্য", "Assignment-ready"), "ok"],
            [reg.counts.certIssues, tx("সক্রিয় কিন্তু সনদ সমস্যা", "Active, certificate issue"), reg.counts.certIssues ? "err" : "neutral"],
          ] as [number, string, Tone][]
        ).map(([n, l, tone]) => (
          <div key={l} className={styles.stat} style={tone === "err" ? { borderColor: "var(--red)" } : tone === "warn" ? { borderColor: "var(--status-pending)" } : undefined}>
            <div className={styles.statNum} style={tone === "err" ? { color: "var(--red)" } : tone === "ok" ? { color: "var(--green)" } : undefined}>
              {n}
            </div>
            <div className={styles.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      {msg ? (
        <Banner tone={msg.tone} icon={msg.tone === "ok" ? "✓" : "!"}>
          {msg.text}
        </Banner>
      ) : null}

      <div className={styles.actions} style={{ marginBottom: "var(--s-4)" }}>
        {reg.samples === 0 ? (
          <Button variant="secondary" onClick={() => run(() => MediatorRegistry.loadSamples(), tx("নমুনা মধ্যস্থতাকারী যোগ হয়েছে (উদাহরণমূলক, বাস্তব ব্যক্তি নন)।", "Sample mediators loaded (illustrative — not real people)."))}>
            {tx("নমুনা মধ্যস্থতাকারী লোড করুন", "Load sample mediators")}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => run(() => MediatorRegistry.removeSamples(), tx("নমুনা রেকর্ড সরানো হয়েছে।", "Sample records removed."))}>
            {tx(`নমুনা রেকর্ড সরান (${reg.samples})`, `Remove sample records (${reg.samples})`)}
          </Button>
        )}
      </div>

      {reg.samples > 0 ? (
        <Banner tone="warn" icon="i">
          {tx(
            `${reg.samples}টি নমুনা রেকর্ড দেখানো হচ্ছে (“নমুনা” চিহ্নিত)। এগুলো উদাহরণমূলক — বাস্তব ব্যক্তি নন; নাম, ফোন ও সনদ নম্বর কাল্পনিক।`,
            `${reg.samples} sample record(s) shown (marked “SAMPLE”). They are illustrative — not real people; names, phones and certificate numbers are fictitious.`,
          )}
        </Banner>
      ) : null}

      <section className={ui.panel} style={{ marginBottom: "var(--s-4)" }} aria-label={tx("খুঁজুন ও ফিল্টার", "Search and filter")}>
        <div className={styles.grid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--s-3)" }}>
          <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
            <span className={styles.label}>{tx("খুঁজুন", "Search")}</span>
            <input className={styles.input} value={f.q} onChange={(e) => set("q", e.target.value)} placeholder={tx("নাম, আইডি, ফোন, এলাকা", "Name, ID, phone, area")} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("অবস্থা", "Status")}</span>
            <select className={styles.select} value={f.status} onChange={(e) => set("status", e.target.value as MediatorFilters["status"])}>
              <option value="">{tx("সব", "All")}</option>
              {MEDIATOR_STATUSES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("জেলা", "District")}</span>
            <select className={styles.select} value={f.district} onChange={(e) => set("district", e.target.value as MediatorFilters["district"])}>
              <option value="">{tx("সব", "All")}</option>
              {DISTRICTS.filter((d) => reg.officer?.officeType === "SCLAC" || d.code === reg.officer?.district).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("মামলার ধরন", "Case type")}</span>
            <select className={styles.select} value={f.caseType} onChange={(e) => set("caseType", e.target.value as MediatorFilters["caseType"])}>
              <option value="">{tx("সব", "All")}</option>
              {MEDIATION_CASE_TYPES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("সময়", "Availability")}</span>
            <select className={styles.select} value={f.availability} onChange={(e) => set("availability", e.target.value as MediatorFilters["availability"])}>
              <option value="">{tx("সব", "All")}</option>
              <option value="AVAILABLE">{tx("উপলব্ধ", "Available")}</option>
              <option value="LIMITED">{tx("সীমিত", "Limited")}</option>
              <option value="UNAVAILABLE">{tx("অনুপলব্ধ", "Unavailable")}</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("সনদ", "Certification")}</span>
            <select className={styles.select} value={f.certification} onChange={(e) => set("certification", e.target.value as MediatorFilters["certification"])}>
              <option value="">{tx("সব", "All")}</option>
              {(Object.keys(CERT_LABEL) as CertificationState[]).map((k) => (
                <option key={k} value={k}>
                  {CERT_LABEL[k][lang]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filtered ? (
          <p className={styles.hint} style={{ marginBottom: 0 }}>
            {tx(`${reg.list.length}/${reg.all.length} দেখানো হচ্ছে`, `Showing ${reg.list.length} of ${reg.all.length}`)} ·{" "}
            <button type="button" className={ui.textBtn} onClick={() => setF(EMPTY_MEDIATOR_FILTERS)}>
              {tx("ফিল্টার মুছুন", "Clear filters")}
            </button>
          </p>
        ) : null}
      </section>

      {reg.all.length === 0 ? (
        <Banner tone="warn" icon="i">
          {tx("এই জেলার রেজিস্ট্রিতে এখনো কোনো মধ্যস্থতাকারী নেই। “মধ্যস্থতাকারী যোগ করুন” বা নমুনা রেকর্ড লোড করুন।", "No mediators in this district's registry yet. Use “Add mediator”, or load sample records.")}
        </Banner>
      ) : reg.list.length === 0 ? (
        <p className={styles.hint}>{tx("এই ফিল্টারে কেউ নেই।", "No mediators match these filters.")}</p>
      ) : (
        <div className={styles.tableWrap} style={{ maxHeight: "none" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{tx("মধ্যস্থতাকারী", "Mediator")}</th>
                <th>{tx("অবস্থা", "Status")}</th>
                <th>{tx("যোগ্যতা", "Qualification")}</th>
                <th>{tx("অভিজ্ঞতা", "Experience")}</th>
                <th>{tx("জেলা", "District")}</th>
                <th>{tx("সময়", "Availability")}</th>
                <th>{tx("বর্তমান চাপ", "Current load")}</th>
                <th>{tx("কাজ", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {reg.list.map((m) => {
                const load = mediatorLoad(m, db);
                const conflicts = m.conflicts.filter((c) => c.status === "ACTIVE").length;
                return (
                  <tr key={m.mediatorId}>
                    <td>
                      <a href={`#mediator/${m.mediatorId}`}>
                        <strong>{m.name}</strong>
                      </a>{" "}
                      {m.sample ? <SampleTag /> : null}
                      <div className={styles.hint}>
                        {m.mediatorId} · {lbl(MEDIATOR_ROLES, m.role, lang)}
                      </div>
                      <div className={styles.hint}>{m.tracks.map((t) => lbl(MEDIATION_TRACKS, t, lang)).join(" · ")}</div>
                    </td>
                    <td>
                      <StatusTag s={m.status} />
                    </td>
                    <td>
                      {lbl(QUALIFICATIONS, m.qualification.kind, lang)}
                      <div style={{ marginTop: 4 }}>
                        <CertTag m={m} now={now} />
                      </div>
                    </td>
                    <td>
                      {tx(`${m.experience.years} বছর`, `${m.experience.years} yrs`)}
                      <div className={styles.hint}>{tx(`${m.experience.mediationsConducted}টি মধ্যস্থতা · ${m.experience.settled}টি নিষ্পত্তি`, `${m.experience.mediationsConducted} mediations · ${m.experience.settled} settled`)}</div>
                    </td>
                    <td>
                      {label(DISTRICTS, m.district, lang)}
                      <div className={styles.hint}>{m.operationalAreas.slice(0, 2).join(", ")}</div>
                    </td>
                    <td>
                      <AvailTag m={m} now={now} />
                      <div className={styles.hint}>{m.availability.channels.map((c) => lbl(MEDIATION_CHANNELS, c, lang)).join(", ")}</div>
                    </td>
                    <td>
                      <Tag tone={load.full ? "err" : load.active / load.max >= 0.8 ? "warn" : "neutral"}>
                        {load.active}/{load.max}
                      </Tag>
                      {load.here ? <div className={styles.hint}>{tx(`এখানে ${load.here}টি নিয়োগ`, `${load.here} assigned here`)}</div> : null}
                      {m.workload.basis === "SAMPLE" ? <div className={styles.hint}>{tx("নমুনা", "sample")}</div> : null}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--t-small)" }}>
                        <a href={`#mediator/${m.mediatorId}`}>{tx("দেখুন", "View")}</a>
                        <a href={`#mediator/${m.mediatorId}/edit`}>{tx("সম্পাদনা", "Edit")}</a>
                        <a href={`#mediator/${m.mediatorId}/availability`}>{tx("সময়সূচি", "Availability")}</a>
                        <a href={`#mediator/${m.mediatorId}/conflicts`}>
                          {tx("স্বার্থের সংঘাত", "Conflict declaration")}
                          {conflicts ? ` (${conflicts})` : ""}
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/*  Detail                                                             */
/* ================================================================== */

type DetailTab = "overview" | "record";
const TABS: { key: DetailTab; bn: string; en: string }[] = [
  { key: "overview", bn: "প্রোফাইল", en: "Profile" },
  { key: "record", bn: "রেকর্ড ও অডিট", en: "Record & audit" },
];

export function MediatorDetail({ id, tab }: { id: string; tab: string }) {
  const { lang, tx } = useTx();
  const { m } = useMediator(id);
  const now = useClock();
  const active: DetailTab = (TABS.some((t) => t.key === tab) ? tab : "overview") as DetailTab;
  if (!m) {
    return (
      <>
        <a className={styles.crumb} href="#mediators">
          ← {tx("মধ্যস্থতাকারী", "Mediators")}
        </a>
        <Banner tone="err" icon="!">
          {tx("এই মধ্যস্থতাকারী আপনার জেলার রেজিস্ট্রিতে নেই।", "This mediator is not in your district's registry.")}
        </Banner>
      </>
    );
  }
  return (
    <>
      <a className={styles.crumb} href="#mediators">
        ← {tx("মধ্যস্থতাকারী", "Mediators")}
      </a>
      <header>
        <div className={ui.head}>
          <span className={ui.headId} style={{ fontFamily: "inherit" }}>
            {m.name}
          </span>
          <StatusTag s={m.status} />
          <CertTag m={m} now={now} />
          <AvailTag m={m} now={now} />
          {m.sample ? <SampleTag /> : null}
        </div>
        <div className={ui.meta}>
          <span>{m.mediatorId}</span>
          <span>{lbl(MEDIATOR_ROLES, m.role, lang)}</span>
          <span>{label(DISTRICTS, m.district, lang)}</span>
          <span>
            {tx("হালনাগাদ", "Updated")} {formatDateTime(m.updatedAt, lang)}
          </span>
        </div>
      </header>

      {m.sample ? (
        <Banner tone="warn" icon="i">
          {tx("উদাহরণমূলক নমুনা রেকর্ড — বাস্তব ব্যক্তি নন। নাম, ফোন ও সনদ নম্বর কাল্পনিক।", "Illustrative sample record — not a real person. Name, phone and certificate number are fictitious.")}
        </Banner>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label={tx("মধ্যস্থতাকারীর তথ্য", "Mediator sections")}>
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={active === t.key} className={styles.tab} onClick={() => (window.location.hash = `mediator/${m.mediatorId}${t.key === "overview" ? "" : `/${t.key}`}`)}>
            {lang === "bn" ? t.bn : t.en}
          </button>
        ))}
      </div>

      {active === "overview" ? <Overview key={m.updatedAt} m={m} now={now} /> : null}
      {active === "record" ? <RecordPanel m={m} /> : null}
    </>
  );
}

function Overview({ m, now }: { m: MediatorRecord; now: number }) {
  const { lang, tx } = useTx();
  const db = useDlasDb();
  const load = mediatorLoad(m, db);
  const r = assignmentReadiness(m, now, db);
  const cert = certificationState(m, now);
  const c = m.certification;
  return (
    <div className={ui.layout}>
      <section className={ui.main}>
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("প্রোফাইল", "Profile")}</div>
          <div className={ui.rows}>
            <Row label={tx("ভূমিকা", "Role")}>{lbl(MEDIATOR_ROLES, m.role, lang)}</Row>
            <Row label={tx("যোগ্যতা", "Qualification")}>
              {lbl(QUALIFICATIONS, m.qualification.kind, lang)} — {m.qualification.detail}
            </Row>
            <Row label={tx("অভিজ্ঞতা", "Experience")}>
              {tx(`${m.experience.years} বছর · ${m.experience.mediationsConducted}টি মধ্যস্থতা · ${m.experience.settled}টি নিষ্পত্তি`, `${m.experience.years} years · ${m.experience.mediationsConducted} mediations · ${m.experience.settled} settled`)}
              {m.experience.note ? <div className={styles.hint}>{m.experience.note}</div> : null}
            </Row>
            <Row label={tx("ধারা", "Tracks")}>{m.tracks.map((t) => lbl(MEDIATION_TRACKS, t, lang)).join(" · ")}</Row>
            <Row label={tx("মামলার ধরন", "Case types")}>
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                {m.caseTypes.map((ct) => (
                  <Tag key={ct}>{lbl(MEDIATION_CASE_TYPES, ct, lang)}</Tag>
                ))}
              </span>
            </Row>
            <Row label={tx("জেলা / এলাকা", "District / area")}>
              {label(DISTRICTS, m.district, lang)}
              {m.operationalAreas.length ? ` — ${m.operationalAreas.join(", ")}` : ""}
            </Row>
            <Row label={tx("ভাষা", "Languages")}>{m.languages.map((l) => label(LANGUAGES, l, lang)).join(", ")}</Row>
            <Row label={tx("যোগাযোগ", "Contact")}>
              {m.contact.phone}
              {m.contact.email ? ` · ${m.contact.email}` : ""} · {tx("পছন্দ", "prefers")} {m.contact.preferredChannel}
              {m.contact.office ? <div className={styles.hint}>{m.contact.office}</div> : null}
            </Row>
            <Row label={tx("বর্তমান চাপ", "Current load")}>
              {load.active}/{load.max}{" "}
              <span className={styles.hint}>
                {tx(`(নথিভুক্ত ${load.baseline}${m.workload.basis === "SAMPLE" ? " — নমুনা" : ""} + এখানে নিয়োগকৃত ${load.here})`, `(recorded ${load.baseline}${m.workload.basis === "SAMPLE" ? " — sample" : ""} + ${load.here} assigned here)`)}
              </span>
            </Row>
            <Row label={tx("নিবন্ধন", "Registered")}>{formatDateTime(m.createdAt, lang)}</Row>
          </div>
        </div>

        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("সনদ / প্রশিক্ষণ", "Certification / training")}</div>
          <div className={ui.rows}>
            <Row label={tx("অবস্থা", "Status")}>
              {lbl(CERTIFICATION_STATUSES, c.status, lang)} <Tag tone={CERT_LABEL[cert].tone}>{CERT_LABEL[cert][lang]}</Tag>
            </Row>
            <Row label={tx("প্রতিষ্ঠান", "Body")}>{c.body ?? "—"}</Row>
            <Row label={tx("সনদ নম্বর", "Certificate no.")}>{c.certificateNo ?? "—"}</Row>
            <Row label={tx("মেয়াদ", "Issued / valid until")}>
              {c.issuedOn ?? "—"} → {c.validUntil ?? tx("মেয়াদ নেই", "no expiry")}
            </Row>
            <Row label={tx("যাচাই", "Verified")}>{c.verifiedAt ? `${c.verifiedByName} · ${formatDateTime(c.verifiedAt, lang)}` : tx("যাচাই হয়নি", "Not verified")}</Row>
          </div>
        </div>
      </section>

      <aside className={ui.aside}>
        <div className={ui.panel}>
          <div className={ui.panelTitle}>
            <span>{tx("ভবিষ্যৎ নিয়োগের প্রস্তুতি", "Assignment readiness (preview)")}</span>
            <Tag tone={r.ready ? "ok" : "err"}>{r.ready ? tx("প্রস্তুত", "Ready") : tx("প্রস্তুত নয়", "Not ready")}</Tag>
          </div>
          <p className={styles.hint} style={{ marginTop: 0 }}>
            {tx("নিয়োগের শক্ত শর্ত (মামলা ছাড়া)। নিয়োগ হয় কেসের আইনি পথ → মধ্যস্থতা অংশে: সিস্টেম সেরা পছন্দ দেখায়, আপনি প্রস্তাব পাঠান, মধ্যস্থতাকারী গ্রহণ করেন।", "Case-independent hard filters. Assignment happens on the case (Legal pathway → Mediation): the system shows best picks, you send the offer, the mediator accepts.")}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {r.checks.map((ch) => (
              <li key={ch.key} style={{ display: "flex", gap: 8 }}>
                <span aria-hidden style={{ color: ch.ok ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                  {ch.ok ? "✓" : "✗"}
                </span>
                <span>
                  {ch.label[lang]}
                  <span className={styles.hint} style={{ display: "block" }}>
                    {ch.detail[lang]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

      </aside>
    </div>
  );
}

/* ------------------------------ admin record & audit ------------------------------ */

function RecordPanel({ m }: { m: MediatorRecord }) {
  const { lang, tx } = useTx();
  const KIND_LABEL: Record<string, string> = {
    NOTE: tx("নোট", "Note"),
    TRAINING: tx("প্রশিক্ষণ", "Training"),
    COMPLAINT: tx("অভিযোগ", "Complaint"),
    COMMENDATION: tx("প্রশংসা", "Commendation"),
    STATUS_CHANGE: tx("অবস্থা পরিবর্তন", "Status change"),
    VERIFICATION: tx("যাচাই", "Verification"),
    AVAILABILITY: tx("সময়সূচি", "Availability"),
    PROFILE: tx("প্রোফাইল", "Profile"),
  };
  return (
    <div className={ui.layout}>
      <section className={ui.main}>
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("প্রশাসনিক রেকর্ড", "Administrative record")}</div>
          {m.adminRecord.length === 0 ? (
            <p className={styles.hint}>{tx("কোনো এন্ট্রি নেই।", "No entries yet.")}</p>
          ) : (
            <div className={ui.rows}>
              {[...m.adminRecord].reverse().map((e) => (
                <Row key={e.entryId} label={formatDateTime(e.at, lang)}>
                  <Tag tone={e.kind === "COMPLAINT" ? "err" : e.kind === "COMMENDATION" ? "ok" : "neutral"}>{KIND_LABEL[e.kind] ?? e.kind}</Tag> {e.text}
                  <span className={styles.hint} style={{ display: "block" }}>
                    {e.byName}
                  </span>
                </Row>
              ))}
            </div>
          )}
        </div>
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("অডিট ট্রেইল", "Audit trail")}</div>
          <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{tx("সময়", "Time")}</th>
                  <th>{tx("কাজ", "Action")}</th>
                  <th>{tx("কে", "Actor")}</th>
                </tr>
              </thead>
              <tbody>
                {[...m.audit].reverse().map((e) => (
                  <tr key={e.seq}>
                    <td>{e.seq}</td>
                    <td>{formatDateTime(e.at, lang)}</td>
                    <td>
                      <code>{e.action}</code>
                    </td>
                    <td>
                      {e.role} · {e.actor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

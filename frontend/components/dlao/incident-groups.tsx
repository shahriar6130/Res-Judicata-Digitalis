"use client";

/* ------------------------------------------------------------------ *
 *  T3 — Group cases (/dashboard/dlo#groups · #group/<GRP-ID>).
 *  The DLO groups cases from the same incident: one view of all
 *  applicants, common evidence uploaded ONCE for the group. Cases are
 *  LINKED, NOT MERGED — each keeps its own record, details and outcome.
 *  lib/dlas/incident-groups.ts
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import { DOC_TYPES, FileStore, IncidentGroupService, MATTERS, formatDateTime, incidentLabel, incidentOf, isRedFlagged, label, useIncidentGroup, useIncidentGroups, type ApplicationRecord, type DocType, type IncidentGroup } from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

type Lang = "bn" | "en";
function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}
function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}
const isClosed = (a: ApplicationRecord) => !!a.closedAt || ["REJECTED", "WITHDRAWN", "CLOSED"].includes(a.status);
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function GuardrailNote() {
  const { tx } = useTx();
  return (
    <div className={`${ui.banner} ${ui.bannerWarn}`} style={{ marginBottom: "var(--s-4)" }}>
      <span className={ui.bannerIcon} aria-hidden>
        🔗
      </span>
      <div>
        <strong>{tx("যুক্ত করা হয়, একীভূত নয়।", "Linked, not merged.")}</strong>{" "}
        {tx("গ্রুপে সব আবেদনকারী এক জায়গায় এবং সাধারণ প্রমাণ একবার আপলোড হয়; কিন্তু প্রত্যেকের নিজের রেকর্ড, গোপনীয়তা, নির্দেশনা ও ফলাফল আলাদা থাকে। নাগরিকরা অন্যদের ব্যক্তিগত তথ্য দেখেন না।", "The group puts all applicants in one place and common evidence is uploaded once; each applicant keeps their own record, confidentiality, instructions and outcome. Citizens never see each other's personal details.")}
      </div>
    </div>
  );
}

/* ------------------------------ list + create ------------------------------ */

export function IncidentGroups() {
  const { lang, tx } = useTx();
  const v = useIncidentGroups();
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", description: "", incidentDate: "", place: "", reason: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState("");
  const candidates = v.cases.filter((a) => !isClosed(a) && !a.incidentGroupId);
  const shown = candidates.filter((a) => !q.trim() || JSON.stringify([a.caseId, a.applicationId, a.data.applicant.fullName, a.data.matter.summary, a.data.matter.opposingParty]).toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const create = () => {
    try {
      const g = IncidentGroupService.create({ ...form, applicationIds: picked });
      setMsg({ ok: true, text: tx(`গ্রুপ তৈরি — ${g.applicationIds.length}টি কেস যুক্ত; আবেদনকারীদের জানানো হয়েছে।`, `Group created — ${g.applicationIds.length} cases linked; the applicants were notified.`) });
      setPicked([]);
      setForm({ title: "", description: "", incidentDate: "", place: "", reason: "" });
      window.location.hash = `group/${g.groupId}`;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  if (!v.officer) return <div className={ui.banner}>{tx("প্রথমে লগইন করুন।", "Please log in first.")}</div>;
  return (
    <div className={ui.readable}>
      <div className={ui.queuePlainHead}>
        <span className={ui.heroKicker}>T3 · {tx("একই ঘটনা, একাধিক আবেদনকারী", "One incident, several applicants")}</span>
        <h1 className={ui.queueTitle}>{tx("কেস গ্রুপ", "Group cases")}</h1>
        <p className={styles.lead}>{tx("একই পরিস্থিতির কেসগুলো একটি গ্রুপে রাখুন — সব আবেদনকারী এক জায়গায়, সাধারণ প্রমাণ একবার।", "Put cases with the same circumstances in one group — all applicants in one place, common evidence once.")}</p>
      </div>
      <GuardrailNote />
      {msg ? (
        <div className={`${ui.banner} ${msg.ok ? ui.bannerOk : ui.bannerErr}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </div>
      ) : null}

      {/* existing groups */}
      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>
          {tx("গ্রুপসমূহ", "Groups")} ({v.groups.filter((g) => g.status === "ACTIVE").length})
        </div>
        {!v.groups.length ? <p className={styles.hint}>{tx("এখনো কোনো গ্রুপ নেই।", "No groups yet.")}</p> : null}
        <div style={{ display: "grid", gap: 8 }}>
          {v.groups.map((g) => (
            <a key={g.groupId} href={`#group/${g.groupId}`} className={ui.workItem} style={{ textDecoration: "none", color: "inherit", opacity: g.status === "ACTIVE" ? 1 : 0.6 }}>
              <div className={ui.workItemHead}>
                <div className={ui.workItemIdentity}>
                  <span className={ui.workItemEyebrow}>
                    {g.groupId} · {g.status === "ACTIVE" ? tx("সক্রিয়", "active") : tx("বিলুপ্ত", "dissolved")}
                  </span>
                  <strong>🔗 {g.title}</strong>
                </div>
                <span className={ui.tag}>
                  {g.applicationIds.length} {tx("কেস", "cases")} · {g.sharedEvidence.length} {tx("সাধারণ প্রমাণ", "shared evidence")}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* rule-based suggestions */}
      {v.suggestions.length ? (
        <section className={`${ui.flowStep} ${ui.suggest}`}>
          <span className={ui.suggestBadge}>{tx("সিস্টেমের পরামর্শ — একই ঘটনা হতে পারে", "SYSTEM SUGGESTION — may be the same incident")}</span>
          {v.suggestions.slice(0, 3).map((s) => (
            <div key={s.applicationIds.join()} style={{ marginTop: 8 }}>
              <strong>
                {s.applicationIds.length} {tx("টি কেস", "cases")}:
              </strong>{" "}
              {s.applicationIds.map((id) => v.cases.find((a) => a.applicationId === id)).map((a) => `${a?.caseId ?? a?.applicationId} (${a?.data.applicant.fullName ?? "—"})`).join(", ")}
              <div className={styles.hint}>{s.reasons.join(" · ")}</div>
              <button type="button" className={ui.textBtn} onClick={() => setPicked(s.applicationIds)}>
                {tx("এগুলো বাছাই করুন →", "Select these →")}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {/* create */}
      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>{tx("নতুন গ্রুপ", "New group")}</div>
        <input className={styles.input} placeholder={tx("খুঁজুন: নাম, কেস, প্রতিপক্ষ, বর্ণনা", "Search: name, case, other party, description")} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        <div style={{ maxHeight: 320, overflow: "auto", display: "grid", gap: 4, marginBottom: 12 }}>
          {shown.length === 0 ? <p className={styles.hint}>{tx("গ্রুপ করার মতো খোলা কেস নেই।", "No open, ungrouped cases.")}</p> : null}
          {shown.map((a) => (
            <label key={a.applicationId} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 6, borderRadius: 6, background: picked.includes(a.applicationId) ? "var(--off-white)" : undefined, cursor: "pointer" }}>
              <input type="checkbox" checked={picked.includes(a.applicationId)} onChange={() => toggle(a.applicationId)} style={{ marginTop: 3 }} />
              <span>
                <strong>{a.caseId ?? a.applicationId}</strong> · {a.data.applicant.fullName ?? "—"} · {label(MATTERS, a.data.matter.category, lang)}
                {isRedFlagged(a) ? <span style={{ color: "var(--red)", fontWeight: 700 }}> · ⚑ {incidentLabel(incidentOf(a).category, incidentOf(a).subcategory, lang)}</span> : null}
                <span className={styles.hint} style={{ display: "block" }}>
                  {a.data.matter.opposingParty ? `${tx("প্রতিপক্ষ", "Other party")}: ${a.data.matter.opposingParty} · ` : ""}“{(a.data.matter.summary ?? "").slice(0, 110)}”
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>{tx("ঘটনার নাম", "Incident title")}</span>
            <input className={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tx("যেমন: রহমান গার্মেন্টস কারখানায় আগুন", "e.g. Rahman Garments factory fire")} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("তারিখ", "Date")}</span>
            <input type="date" className={styles.input} value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("স্থান", "Place")}</span>
            <input className={styles.input} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("ঘটনার বিবরণ (সবাই দেখবেন)", "What happened (all applicants see this)")}</span>
            <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tx("কেন একসাথে (অডিটে যাবে)", "Why these belong together (goes to the audit)")}</span>
            <textarea className={styles.textarea} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </div>
        <div className={styles.actions}>
          <Button disabled={picked.length < 2 || form.title.trim().length < 4 || form.reason.trim().length < 10} onClick={create}>
            🔗 {tx(`${picked.length}টি কেস গ্রুপ করুন`, `Group ${picked.length} cases`)}
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ group detail ------------------------------ */

function openEvidence(id: string) {
  const f = FileStore.get(id);
  if (!f) return;
  const w = window.open();
  if (w) w.document.write(f.mime.startsWith("image/") ? `<img src="${f.dataUrl}" style="max-width:100%">` : `<iframe src="${f.dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
}

export function IncidentGroupDetail({ id }: { id: string }) {
  const { lang, tx } = useTx();
  const { group: g, cases } = useIncidentGroup(id);
  const all = useIncidentGroups();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ev, setEv] = useState<{ file: File | null; title: string; docType: DocType; note: string }>({ file: null, title: "", docType: "OTHER", note: "" });
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ id: "", reason: "" });
  const [removing, setRemoving] = useState<{ id: string; reason: string } | null>(null);
  const run = (fn: () => unknown, ok: string) => {
    try {
      fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  if (!g) {
    return (
      <div className={ui.readable}>
        <a className={ui.textBtn} href="#groups">
          ← {tx("কেস গ্রুপ", "Group cases")}
        </a>
        <div className={`${ui.banner} ${ui.bannerErr}`}>{tx("এই গ্রুপ আপনার অফিসে নেই।", "This group is not in your office.")}</div>
      </div>
    );
  }
  const active = g.status === "ACTIVE";
  const addable = all.cases.filter((a) => !isClosed(a) && !a.incidentGroupId);
  const upload = async () => {
    if (!ev.file) return;
    setBusy(true);
    try {
      await IncidentGroupService.uploadSharedEvidence(g.groupId, { file: ev.file, docType: ev.docType, title: ev.title, note: ev.note });
      setMsg({ ok: true, text: tx(`একবার আপলোড — ${g.applicationIds.length}টি কেসেই দেখা যাবে।`, `Uploaded once — visible in all ${g.applicationIds.length} cases.`) });
      setEv({ file: null, title: "", docType: "OTHER", note: "" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={ui.readable}>
      <a className={ui.textBtn} href="#groups">
        ← {tx("কেস গ্রুপ", "Group cases")}
      </a>
      <div className={ui.queuePlainHead}>
        <span className={ui.heroKicker}>
          {g.groupId} · {active ? tx("সক্রিয় গ্রুপ", "active group") : tx("বিলুপ্ত", "dissolved")}
        </span>
        <h1 className={ui.queueTitle}>🔗 {g.title}</h1>
        <p className={styles.lead}>
          {[g.incidentDate, g.place].filter(Boolean).join(" · ")}
          {g.description ? ` — ${g.description}` : ""}
        </p>
      </div>
      <GuardrailNote />
      {msg ? (
        <div className={`${ui.banner} ${msg.ok ? ui.bannerOk : ui.bannerErr}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </div>
      ) : null}

      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>
          {tx("সব আবেদনকারী", "All applicants")} ({cases.length})
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{tx("কেস", "Case")}</th>
                <th>{tx("আবেদনকারী", "Applicant")}</th>
                <th>{tx("বিষয়", "Matter")}</th>
                <th>{tx("অবস্থা", "Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cases.map((a) => (
                <tr key={a.applicationId}>
                  <td>
                    <a href={`#app/${encodeURIComponent(a.applicationId)}`} style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {a.caseId ?? a.applicationId}
                    </a>
                  </td>
                  <td>
                    {a.data.applicant.fullName ?? "—"}
                    {isRedFlagged(a) ? <span style={{ color: "var(--red)", fontWeight: 700 }}> ⚑</span> : null}
                  </td>
                  <td>{label(MATTERS, a.data.matter.category, lang)}</td>
                  <td>
                    {a.status.toLowerCase().replaceAll("_", " ")} · {a.stage.toLowerCase().replaceAll("_", " ")}
                  </td>
                  <td>
                    {active ? (
                      removing?.id === a.applicationId ? (
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input className={styles.input} style={{ minWidth: 180 }} placeholder={tx("কারণ", "Reason")} value={removing.reason} onChange={(e) => setRemoving({ id: a.applicationId, reason: e.target.value })} />
                          <Button variant="secondary" disabled={removing.reason.trim().length < 10} onClick={() => run(() => { IncidentGroupService.removeCase(g.groupId, a.applicationId, removing.reason); setRemoving(null); }, tx("কেস গ্রুপ থেকে সরানো হয়েছে।", "Case removed from the group."))}>
                            {tx("সরান", "Remove")}
                          </Button>
                        </span>
                      ) : (
                        <button type="button" className={ui.textBtn} onClick={() => setRemoving({ id: a.applicationId, reason: "" })}>
                          {tx("গ্রুপ থেকে সরান", "Unlink")}
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {active ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <select className={styles.select} value={add.id} onChange={(e) => setAdd({ ...add, id: e.target.value })} style={{ maxWidth: 320 }}>
              <option value="">{tx("— আরও কেস যোগ করুন —", "— add another case —")}</option>
              {addable.map((a) => (
                <option key={a.applicationId} value={a.applicationId}>
                  {a.caseId ?? a.applicationId} · {a.data.applicant.fullName ?? "—"}
                </option>
              ))}
            </select>
            <input className={styles.input} style={{ maxWidth: 320 }} placeholder={tx("কেন (কমপক্ষে ১০ অক্ষর)", "Why (at least 10 characters)")} value={add.reason} onChange={(e) => setAdd({ ...add, reason: e.target.value })} />
            <Button variant="secondary" disabled={!add.id || add.reason.trim().length < 10} onClick={() => run(() => { IncidentGroupService.addCase(g.groupId, add.id, add.reason); setAdd({ id: "", reason: "" }); }, tx("কেস যুক্ত; আবেদনকারীকে জানানো হয়েছে।", "Case linked; the applicant was notified."))}>
              + {tx("যোগ করুন", "Add")}
            </Button>
          </div>
        ) : null}
      </section>

      <section className={ui.flowStep}>
        <div className={ui.sectionHead}>
          {tx("সাধারণ প্রমাণ — একবার আপলোড, সব কেসে দেখা যায়", "Shared evidence — uploaded once, visible in every case")} ({g.sharedEvidence.length})
        </div>
        {g.sharedEvidence.length ? (
          <div className={ui.rows}>
            {g.sharedEvidence.map((e) => (
              <Row key={e.evidenceId} label={e.title}>
                {label(DOC_TYPES, e.docType, lang)} · {e.fileName} · {kb(e.sizeBytes)} · {e.uploadedByName} · {formatDateTime(e.uploadedAt, lang)}
                {e.sha256 ? <span className={styles.hint}> · SHA-256 {e.sha256.slice(0, 12)}…</span> : null}
                {e.note ? <div className={styles.hint}>{e.note}</div> : null}
                {e.preview === "STORED" ? (
                  <button type="button" className={ui.textBtn} onClick={() => openEvidence(e.evidenceId)}>
                    {tx("দেখুন", "View")}
                  </button>
                ) : null}
              </Row>
            ))}
          </div>
        ) : (
          <p className={styles.hint}>{tx("এখনো কোনো সাধারণ প্রমাণ নেই।", "No shared evidence yet.")}</p>
        )}
        {active ? (
          <div className={styles.grid} style={{ marginTop: 8 }}>
            <label className={styles.field}>
              <span className={styles.label}>{tx("ফাইল (ছবি/PDF)", "File (photo/PDF)")}</span>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setEv({ ...ev, file: e.target.files?.[0] ?? null })} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("শিরোনাম", "Title")}</span>
              <input className={styles.input} value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder={tx("যেমন: ফায়ার সার্ভিসের প্রতিবেদন", "e.g. Fire service report")} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("ধরন", "Type")}</span>
              <select className={styles.select} value={ev.docType} onChange={(e) => setEv({ ...ev, docType: e.target.value as DocType })}>
                {DOC_TYPES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label[lang]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("নোট", "Note")}</span>
              <input className={styles.input} value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} />
            </label>
            <div className={styles.actions}>
              <Button disabled={busy || !ev.file || ev.title.trim().length < 3} onClick={() => void upload()}>
                ↑ {tx("একবার আপলোড করুন (সব কেসে)", "Upload once (for all cases)")}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <details className={ui.flowStep}>
        <summary style={{ cursor: "pointer" }}>
          {tx("গ্রুপের অডিট", "Group audit")} ({g.audit.length})
        </summary>
        <div className={ui.rows} style={{ marginTop: 8 }}>
          {[...g.audit].reverse().map((e) => (
            <Row key={e.seq} label={formatDateTime(e.at, lang)}>
              <code>{e.action}</code> · {e.role} · {String((e.detail as Record<string, unknown> | undefined)?.officer ?? e.actor)}
            </Row>
          ))}
        </div>
      </details>
    </div>
  );
}

/** Small banner on a case page when the case belongs to a group. */
export function CaseGroupBanner({ a, group }: { a: ApplicationRecord; group: IncidentGroup | null }) {
  const { tx } = useTx();
  if (!group) return null;
  return (
    <div className={`${ui.banner} ${ui.bannerWarn}`} style={{ marginBottom: "var(--s-4)" }}>
      <span className={ui.bannerIcon} aria-hidden>
        🔗
      </span>
      <div>
        <strong>
          {tx("সংযুক্ত গ্রুপ", "Linked group")}: {group.title}
        </strong>{" "}
        · {group.applicationIds.length} {tx("টি কেস", "cases")} · {group.sharedEvidence.length} {tx("সাধারণ প্রমাণ", "shared evidence")}
        <div className={ui.meta} style={{ marginTop: 2 }}>
          <a className={ui.textBtn} href={`#group/${group.groupId}`}>
            {tx("গ্রুপ খুলুন →", "Open the group →")}
          </a>
          <span>{tx(`এই কেসের (${a.caseId ?? a.applicationId}) নিজের রেকর্ড আলাদা থাকে।`, `This case (${a.caseId ?? a.applicationId}) keeps its own record.`)}</span>
        </div>
        {group.sharedEvidence.length ? (
          <div style={{ marginTop: 4 }}>
            {tx("সাধারণ প্রমাণ", "Shared evidence")}:{" "}
            {group.sharedEvidence.map((e, i) => (
              <span key={e.evidenceId}>
                {i ? " · " : ""}📎 {e.title}{" "}
                {e.preview === "STORED" ? (
                  <button type="button" className={ui.textBtn} onClick={() => openEvidence(e.evidenceId)}>
                    {tx("দেখুন", "view")}
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

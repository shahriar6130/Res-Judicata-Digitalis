"use client";

import { useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";
import { useDlasDb } from "@/lib/dlas/store";
import { DISTRICTS, MATTERS, label } from "@/lib/dlas/reference";
import { AdminService, type AdminHearingInput, type ManagedInput, type ManagedRole } from "@/lib/dlas/admin";
import { MEDIATION_CASE_TYPES, MEDIATION_TRACKS } from "@/lib/dlas/mediators";
import { exportBackup, importBackup, previewBackup, type BackupPreview } from "@/lib/dlas/backup";
import type { AuditEntry, DlasDb, Hearing } from "@/lib/dlas/schema";
import css from "./admin-workspace.module.css";
import { AdminMediationOversight } from "./mediation-oversight";

const roles: { key: ManagedRole; bn: string; en: string }[] = [
  { key: "citizens", bn: "নাগরিক", en: "Citizens" },
  { key: "lawyers", bn: "আইনজীবী", en: "Lawyers" },
  { key: "officers", bn: "ডিএলও কর্মকর্তা", en: "DLO officers" },
  { key: "mediators", bn: "মধ্যস্থতাকারী", en: "Mediators" },
  { key: "udcOperators", bn: "ইউডিসি অপারেটর", en: "UDC operators" },
];
const managedIdField: Record<ManagedRole, string> = { citizens: "citizenId", lawyers: "lawyerId", officers: "officerId", mediators: "mediatorId", udcOperators: "operatorId" };
type Section = "overview" | "users" | "cases" | "mediation" | "rules" | "audit" | "backup";
const sections: Section[] = ["overview", "users", "cases", "mediation", "rules", "audit", "backup"];
const subscribeHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const currentHash = () => window.location.hash.slice(1);

function displayRecord(db: DlasDb, role: ManagedRole) {
  return db[role] as unknown as Array<{ name: string; phone?: string; contact?: { phone?: string }; [key: string]: unknown }>;
}

const recordPhone = (role: ManagedRole, record: { phone?: string; contact?: { phone?: string } }) => role === "mediators" ? record.contact?.phone ?? "" : record.phone ?? "";
const localDateTimeValue = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function AdminWorkspace() {
  const { lang } = useI18n();
  const db = useDlasDb();
  const hash = useSyncExternalStore(subscribeHash, currentHash, () => "");
  const section: Section = sections.includes(hash as Section) ? hash as Section : hash === "metrics" ? "overview" : "overview";
  const [role, setRole] = useState<ManagedRole>("citizens");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ role: ManagedRole; id: string | null; input: ManagedInput } | null>(null);
  const [hearingEditing, setHearingEditing] = useState<{ applicationId: string; hearingId: string | null; input: AdminHearingInput } | null>(null);
  const [deleting, setDeleting] = useState<{ role: ManagedRole; id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState<BackupPreview | null>(null);
  const [backupError, setBackupError] = useState("");
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const count = db.citizens.length + db.lawyers.length + db.officers.length + db.mediators.length + db.udcOperators.length;
  const openTasks = db.tasks.filter((t) => t.status !== "DONE").length;
  const pending = db.applications.filter((a) => !a.review?.decision).length;
  const audit = [
    ...db.adminAudit,
    ...db.applications.flatMap((a) => a.audit),
    ...db.citizens.flatMap((a) => a.audit),
    ...db.lawyers.flatMap((a) => a.audit),
    ...db.officers.flatMap((a) => a.audit),
    ...db.mediators.flatMap((a) => a.audit),
    ...db.udcOperators.flatMap((a) => a.audit),
  ].filter((a, i, all) => all.findIndex((x) => x.seq === a.seq) === i).sort((a, b) => b.seq - a.seq).slice(0, 25);

  function edit(selectedRole: ManagedRole, record?: Record<string, unknown>) {
    setError(""); setNotice("");
    setEditing({
      role: selectedRole,
      id: record ? String(record[managedIdField[selectedRole]]) : null,
      input: {
        name: String(record?.name ?? ""), phone: selectedRole === "mediators" ? String((record?.contact as { phone?: string } | undefined)?.phone ?? "") : String(record?.phone ?? ""),
        district: String(record?.district ?? ""), officeType: String(record?.officeType ?? "DLAO"),
        centre: String(record?.centre ?? ""), barEnrolmentNo: String(record?.barEnrolmentNo ?? ""),
        practiceAreas: Array.isArray(record?.practiceAreas) ? record.practiceAreas as string[] : [],
        mediatorStatus: String(record?.status ?? "PENDING_VERIFICATION"), mediatorRole: String(record?.role ?? "PANEL_MEDIATOR"),
        qualification: String((record?.qualification as { detail?: string } | undefined)?.detail ?? ""),
        caseTypes: Array.isArray(record?.caseTypes) ? record.caseTypes as string[] : [],
        tracks: Array.isArray(record?.tracks) ? record.tracks as string[] : [],
      },
    });
  }
  function save() {
    if (!editing) return;
    try {
      AdminService.saveAccount(editing.role, editing.id, editing.input);
      setEditing(null); setError("");
      setNotice(tx("পরিবর্তন সংরক্ষিত হয়েছে।", "Changes saved."));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function editHearing(applicationId: string, hearing?: Hearing) {
    setError(""); setNotice("");
    setHearingEditing({
      applicationId,
      hearingId: hearing?.hearingId ?? null,
      input: {
        at: hearing ? localDateTimeValue(hearing.at) : "",
        court: hearing?.court ?? "",
        purpose: hearing?.purpose ?? "",
      },
    });
  }
  function saveHearing() {
    if (!hearingEditing) return;
    try {
      AdminService.saveHearing(hearingEditing.applicationId, hearingEditing.hearingId, hearingEditing.input);
      setHearingEditing(null); setError("");
      setNotice(tx("শুনানির তথ্য সংরক্ষিত হয়েছে।", "Hearing information saved."));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function remove() {
    if (!deleting) return;
    try {
      AdminService.deleteAccount(deleting.role, deleting.id);
      setDeleting(null); setDeleteError("");
      setNotice(tx("অ্যাকাউন্ট মুছে ফেলা হয়েছে।", "Account deleted."));
    } catch (e) { setDeleteError(e instanceof Error ? e.message : String(e)); }
  }
  function downloadBackup() {
    try {
      const blob = new Blob([exportBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shakkho-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setBackupError("");
    } catch (e) { setBackupError(e instanceof Error ? e.message : String(e)); }
  }
  async function chooseBackup(file: File | undefined) {
    setBackup(null); setBackupError("");
    if (!file) return;
    try { setBackup(previewBackup(await file.text())); }
    catch (e) { setBackupError(e instanceof Error ? e.message : String(e)); }
  }
  const items = displayRecord(db, role).filter((r) => [r.name, recordPhone(role, r), String(r.centre ?? ""), String(r.district ?? ""), String(r.status ?? "")].some((s) => s.toLowerCase().includes(query.toLowerCase())));
  const roleName = roles.find((x) => x.key === role)!;

  return <main className={css.page}>
    <header className={css.hero}>
      <div><p className={css.kicker}>{tx("সিস্টেম প্রশাসন / লাইভ রেকর্ড", "SYSTEM ADMINISTRATION / LIVE RECORD")}</p><h1>{tx("কার্যক্রম নিয়ন্ত্রণ", "Operations control")}</h1><p>{tx("নাগরিক, আইনজীবী, ডিএলও, মধ্যস্থতাকারী, ইউডিসি ও আবেদন একই রেকর্ড থেকে পর্যবেক্ষণ করুন।", "Monitor citizens, lawyers, DLOs, mediators, UDCs and applications from the shared record.")}</p></div>
      <span className={css.live}>{tx("স্থানীয় প্রোটোটাইপ", "Local prototype")}</span>
    </header>
    <nav className={css.tabs} aria-label={tx("প্রশাসক বিভাগ", "Admin sections")}>{sections.map((s) => <a key={s} href={s === "overview" ? "/dashboard/admin" : `#${s}`} aria-current={section === s ? "page" : undefined}>{({ overview: tx("সংক্ষেপ", "Overview"), users: tx("ব্যবহারকারী", "People"), cases: tx("আবেদন", "Applications"), rules: tx("নীতিমালা", "Policy"), mediation: tx("মধ্যস্থতা তত্ত্বাবধান", "Mediation oversight"), audit: tx("অডিট", "Audit"), backup: tx("ব্যাকআপ", "Backup") })[s]}</a>)}</nav>
    {notice ? <p className={css.notice} role="status">{notice}</p> : null}
    {section === "overview" ? <>
      <div className={css.metrics}>
        {[
          [count, tx("নিবন্ধিত মানুষ", "Registered people")],
          [db.applications.length, tx("মোট আবেদন", "Applications")],
          [pending, tx("সিদ্ধান্ত বাকি", "Awaiting decision")],
          [openTasks, tx("খোলা কাজ", "Open tasks")],
        ].map(([n, title]) => <article key={title}><strong>{n}</strong><span>{title}</span></article>)}
      </div>
      <div className={css.grid}>
        <section className={css.panel}><div className={css.panelHead}><h2>{tx("মানুষ ও কেন্দ্র", "People and centres")}</h2><a href="#users">{tx("পরিচালনা করুন →", "Manage →")}</a></div>{roles.map((r) => <button className={css.lineButton} key={r.key} onClick={() => { setRole(r.key); window.location.hash = "users"; }}><span>{r[lang]}</span><strong>{db[r.key].length}</strong></button>)}<div className={css.line}><span>{tx("ইউডিসি কেন্দ্র", "UDC centres")}</span><strong>{db.udcCentres.length}</strong></div></section>
        <section className={css.panel}><div className={css.panelHead}><h2>{tx("সাম্প্রতিক আবেদন", "Recent applications")}</h2><a href="#cases">{tx("সব দেখুন →", "View all →")}</a></div>{db.applications.slice(-5).reverse().map((a) => <div className={css.line} key={a.applicationId}><span><strong>{a.applicationId}</strong><small>{a.data.applicant.fullName ?? "—"} · {label(MATTERS, a.data.matter.category, lang)}</small></span><em>{a.status}</em></div>)}{!db.applications.length ? <p className={css.empty}>{tx("এখনো কোনো আবেদন নেই।", "No applications yet.")}</p> : null}</section>
      </div>
    </> : null}
    {section === "users" ? <section className={css.panel}>
      <div className={css.panelHead}><div><p className={css.kicker}>{tx("অ্যাকাউন্ট ডিরেক্টরি", "ACCOUNT DIRECTORY")}</p><h2>{tx("মানুষ পরিচালনা করুন", "Manage people")}</h2></div><button className={css.primary} onClick={() => edit(role)}>{tx("+ নতুন যোগ করুন", "+ Add new")}</button></div>
      <div className={css.toolbar}><div className={css.roleTabs}>{roles.map((r) => <button key={r.key} aria-pressed={role === r.key} onClick={() => { setRole(r.key); setQuery(""); }}>{r[lang]} <b>{db[r.key].length}</b></button>)}</div><input aria-label={tx("খুঁজুন", "Search")} placeholder={tx("নাম, ফোন, কেন্দ্র বা জেলা খুঁজুন", "Search name, phone, centre or district")} value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <p className={css.subtle}>{roleName[lang]} · {items.length}</p>
      {items.map((r) => { const key = managedIdField[role]; const accountId = String(r[key]); return <div className={css.person} key={accountId}><div><strong>{r.name}</strong><small>{accountId} · {recordPhone(role, r)}{r.district ? ` · ${r.district}` : ""}{r.centre ? ` · ${r.centre}` : ""}{role === "mediators" ? ` · ${String(r.status ?? "")}` : ""}</small></div><div className={css.rowActions}><button className={css.secondary} onClick={() => edit(role, r)}>{tx("সম্পাদনা", "Edit")}</button><button className={css.danger} onClick={() => { setDeleteError(""); setNotice(""); setDeleting({ role, id: accountId, name: r.name }); }}>{tx("মুছুন", "Delete")}</button></div></div>; })}
      {!items.length ? <p className={css.empty}>{tx("কোনো মিল পাওয়া যায়নি। নতুন অ্যাকাউন্ট যোগ করতে পারেন।", "No matching accounts. You can add a new one.")}</p> : null}
    </section> : null}
    {section === "cases" ? <section className={css.panel}>
      <div className={css.panelHead}><div><p className={css.kicker}>{tx("সব অফিস ও চ্যানেল", "ALL OFFICES AND CHANNELS")}</p><h2>{tx("আবেদন ও শুনানি পর্যবেক্ষণ", "Applications and hearings")}</h2></div><strong>{db.applications.length}</strong></div>
      {db.applications.slice().reverse().map((a) => {
        const hearings = [...(a.lawyer?.hearings ?? [])].sort((x, y) => x.at.localeCompare(y.at));
        return <article className={css.caseRecord} key={a.applicationId}>
          <div className={css.caseSummary}>
            <div><strong>{a.applicationId} · {a.data.applicant.fullName ?? "—"}</strong><small>{label(MATTERS, a.data.matter.category, lang)} · {a.routing.office} · {a.channel.code} · {a.status}</small></div>
            <div className={css.rowActions}><span className={css.status}>{a.review?.decision?.decision ?? tx("সিদ্ধান্ত বাকি", "Pending")}</span><button type="button" className={css.secondary} onClick={() => editHearing(a.applicationId)}>{tx("+ শুনানি যোগ করুন", "+ Add hearing")}</button></div>
          </div>
          <div className={css.hearingList}>
            <div className={css.hearingHead}><strong>{tx("শুনানির তথ্য", "Hearing information")}</strong><span>{hearings.length}</span></div>
            {hearings.map((hearing) => <div className={css.hearingRow} key={hearing.hearingId}>
              <div><strong>{new Date(hearing.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</strong><small>{hearing.court}{hearing.purpose ? ` · ${hearing.purpose}` : ""} · {tx("ফল", "Outcome")}: {hearing.result ?? tx("এখনও নেই", "Not recorded")}</small></div>
              <button type="button" className={css.secondary} onClick={() => editHearing(a.applicationId, hearing)}>{tx("শুনানি সম্পাদনা", "Edit hearing")}</button>
            </div>)}
            {!hearings.length ? <p className={css.subtle}>{tx("কোনো শুনানি নথিভুক্ত নেই।", "No hearings recorded.")}</p> : null}
          </div>
        </article>;
      })}
      {!db.applications.length ? <p className={css.empty}>{tx("এখনো কোনো আবেদন নেই।", "No applications yet.")}</p> : null}
      <p className={css.subtle}>{tx("প্রশাসক শুনানির সময়, আদালত ও উদ্দেশ্য সংশোধন করতে পারেন। উপস্থিতি ও ফলাফল আইনজীবীর প্রতিবেদন হিসেবে অপরিবর্তিত থাকে; আইনগত সিদ্ধান্ত সংশ্লিষ্ট ডিএলও কর্মপ্রবাহে থাকে।", "Administrators may correct a hearing's date, court and purpose. Attendance and outcomes remain unchanged as lawyer-reported evidence; legal decisions stay in the responsible DLO workflow.")}</p>
    </section> : null}
    {section === "rules" ? <section className={css.panel}><p className={css.kicker}>{tx("সংস্করণযুক্ত নীতিমালা", "VERSIONED POLICY")}</p><h2>{tx("সক্রিয় নিয়ম", "Current rules")}</h2><p>{tx("এলিজিবিলিটি নিয়মের কর্মরত সংস্করণ", "Working eligibility ruleset")}: <strong>{db.eligibilityRulesets.at(-1)?.version ?? "—"}</strong></p><p>{tx("আইনজীবীর নিয়ম", "Lawyer rules")}: <strong>{db.lawyerRules?.version ?? "—"}</strong></p><p className={css.subtle}>{tx("আইনগত সিদ্ধান্ত কেবল অনুমোদিত ডিএলও কর্মকর্তা নেন।", "Legal decisions remain with authorised DLO officers.")}</p></section> : null}
    {section === "mediation" ? <AdminMediationOversight /> : null}
    {section === "audit" ? <section className={css.panel}><p className={css.kicker}>{tx("সংরক্ষিত ইতিহাস", "PERSISTED HISTORY")}</p><h2>{tx("সাম্প্রতিক অডিট ঘটনা", "Recent audit events")}</h2>{audit.map((e: AuditEntry) => <div className={css.line} key={e.seq}><span><strong>{e.action}</strong><small>{e.actor} · {e.role}</small></span><time>{new Date(e.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</time></div>)}{!audit.length ? <p className={css.empty}>{tx("এখনো কোনো অডিট ঘটনা নেই।", "No audit events yet.")}</p> : null}</section> : null}
    {section === "backup" ? <div className={css.grid}>
      <section className={css.panel}><p className={css.kicker}>{tx("সম্পূর্ণ তথ্য", "COMPLETE DATA")}</p><h2>{tx("JSON এক্সপোর্ট", "Export JSON")}</h2><p>{tx("আবেদন, অ্যাকাউন্ট, কাজ, অডিট, সংরক্ষিত নথির কপি এবং অন্যান্য অ্যাপ ডেটা একটি ফাইলে ডাউনলোড করুন।", "Download applications, accounts, tasks, audits, stored document copies and other app data in one file.")}</p><button type="button" className={css.primary} onClick={downloadBackup}>{tx("JSON ডাউনলোড করুন", "Download JSON")}</button><p className={css.subtle}>{tx("ফাইলে ব্যক্তিগত তথ্য ও সংরক্ষিত নথি থাকতে পারে।", "This file may contain personal information and stored documents.")}</p></section>
      <section className={css.panel}><p className={css.kicker}>{tx("পুনরুদ্ধার", "RESTORE")}</p><h2>{tx("JSON ইমপোর্ট", "Import JSON")}</h2><p>{tx("একটি ব্যাকআপ ফাইল বেছে নিন। আমদানির আগে তথ্যের সারাংশ দেখানো হবে।", "Choose a backup file. Review its contents before importing.")}</p><label className={css.importField}>{tx("ব্যাকআপ ফাইল", "Backup file")}<input type="file" accept=".json,application/json" onChange={(e) => { void chooseBackup(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {backupError ? <p className={css.error} role="alert">{tx("ফাইল পড়া যায়নি: ", "Could not read file: ")}{backupError}</p> : null}
        {backup ? <div className={css.preview}><h3>{tx("ইমপোর্টের সারাংশ", "Import preview")}</h3><p>{backup.exportedAt ? new Date(backup.exportedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB") : tx("পুরোনো রেকর্ড ফরম্যাট", "Older record format")}</p><div className={css.line}><span>{tx("আবেদন", "Applications")}</span><strong>{backup.applications}</strong></div><div className={css.line}><span>{tx("অ্যাকাউন্ট", "Accounts")}</span><strong>{backup.people}</strong></div><div className={css.line}><span>{tx("সংরক্ষিত নথি", "Stored documents")}</span><strong>{backup.documents}</strong></div><p className={css.subtle}>{tx("ইমপোর্ট করলে এই ব্রাউজারের বর্তমান অ্যাপ তথ্য বদলে যাবে।", "Import replaces this browser's current app data.")}</p><button type="button" className={css.primary} onClick={() => { try { importBackup(backup); } catch (e) { setBackupError(e instanceof Error ? e.message : String(e)); } }}>{tx("বর্তমান তথ্য বদলে ইমপোর্ট করুন", "Replace current data and import")}</button></div> : null}
      </section>
    </div> : null}
    {hearingEditing ? <div className={css.backdrop}><section className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="admin-hearing-title"><div className={css.panelHead}><div><p className={css.kicker}>{hearingEditing.applicationId}</p><h2 id="admin-hearing-title">{hearingEditing.hearingId ? tx("শুনানি সম্পাদনা", "Edit hearing") : tx("শুনানি যোগ করুন", "Add hearing")}</h2></div><button type="button" className={css.secondary} onClick={() => { setHearingEditing(null); setError(""); }}>{tx("বন্ধ", "Close")}</button></div><form onSubmit={(e) => { e.preventDefault(); saveHearing(); }} className={css.form}>
      <label>{tx("শুনানির তারিখ ও সময়", "Hearing date and time")}<input required type="datetime-local" value={hearingEditing.input.at} onChange={(e) => setHearingEditing({ ...hearingEditing, input: { ...hearingEditing.input, at: e.target.value } })} /></label>
      <label>{tx("আদালত", "Court")}<input required minLength={2} value={hearingEditing.input.court} onChange={(e) => setHearingEditing({ ...hearingEditing, input: { ...hearingEditing.input, court: e.target.value } })} /></label>
      <label className={css.fullField}>{tx("শুনানির উদ্দেশ্য", "Purpose")}<input value={hearingEditing.input.purpose} onChange={(e) => setHearingEditing({ ...hearingEditing, input: { ...hearingEditing.input, purpose: e.target.value } })} /></label>
      <p className={`${css.subtle} ${css.fullField}`}>{tx("উপস্থিতি বা ফলাফল এখানে বদলানো হয় না; সেগুলো আইনজীবীর প্রতিবেদন হিসেবে সংরক্ষিত থাকে।", "Attendance and outcome are not changed here; they remain preserved as lawyer-reported evidence.")}</p>
      {error ? <p role="alert" className={css.error}>{error}</p> : null}<button className={css.primary} type="submit">{tx("শুনানি সংরক্ষণ করুন", "Save hearing")}</button>
    </form></section></div> : null}
    {editing ? <div className={css.backdrop}><section className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="admin-edit-title"><div className={css.panelHead}><div><p className={css.kicker}>{roles.find((r) => r.key === editing.role)?.[lang]}</p><h2 id="admin-edit-title">{editing.id ? tx("অ্যাকাউন্ট সম্পাদনা", "Edit account") : tx("অ্যাকাউন্ট যোগ করুন", "Add account")}</h2></div><button className={css.secondary} onClick={() => setEditing(null)}>{tx("বন্ধ", "Close")}</button></div><form onSubmit={(e) => { e.preventDefault(); save(); }} className={css.form}>
      <label>{tx("নাম", "Name")}<input required minLength={2} value={editing.input.name} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, name: e.target.value } })} /></label>
      <label>{tx("মোবাইল", "Mobile")}<input required inputMode="tel" value={editing.input.phone} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, phone: e.target.value } })} /></label>
      {editing.role === "officers" ? <label>{tx("অফিসের ধরন", "Office type")}<select value={editing.input.officeType} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, officeType: e.target.value } })}>{["DLAO", "SCLAC", "LLAC"].map((x) => <option key={x}>{x}</option>)}</select></label> : null}
      {editing.role !== "citizens" && !(editing.role === "officers" && editing.input.officeType === "SCLAC") ? <label>{tx("জেলা", "District")}<select required value={editing.input.district} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, district: e.target.value } })}><option value="">{tx("জেলা নির্বাচন", "Select district")}</option>{DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.label[lang]}</option>)}</select></label> : null}
      {editing.role === "udcOperators" ? <label>{tx("ইউডিসি কেন্দ্র", "UDC centre")}<input required value={editing.input.centre} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, centre: e.target.value } })} /></label> : null}
      {editing.role === "lawyers" ? <><label>{tx("বার এনরোলমেন্ট", "Bar enrolment")}<input required value={editing.input.barEnrolmentNo} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, barEnrolmentNo: e.target.value } })} /></label><fieldset><legend>{tx("কাজের ক্ষেত্র", "Practice areas")}</legend><div className={css.checks}>{MATTERS.map((m) => <label key={m.code}><input type="checkbox" checked={editing.input.practiceAreas?.includes(m.code) ?? false} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, practiceAreas: e.target.checked ? [...(editing.input.practiceAreas ?? []), m.code] : (editing.input.practiceAreas ?? []).filter((x) => x !== m.code) } })} />{m.label[lang]}</label>)}</div></fieldset></> : null}
      {editing.role === "mediators" ? <>
        <label>{tx("অবস্থা", "Status")}<select value={editing.input.mediatorStatus} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, mediatorStatus: e.target.value } })}>{["PENDING_VERIFICATION", "ACTIVE", "INACTIVE", "SUSPENDED"].map((x) => <option key={x}>{x.replaceAll("_", " ")}</option>)}</select></label>
        <label>{tx("মধ্যস্থতাকারীর ভূমিকা", "Mediator role")}<select value={editing.input.mediatorRole} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, mediatorRole: e.target.value } })}>{["PANEL_MEDIATOR", "COMMUNITY_MEDIATOR", "LEGAL_AID_OFFICER"].map((x) => <option key={x}>{x.replaceAll("_", " ")}</option>)}</select></label>
        <label className={css.fullField}>{tx("যোগ্যতা", "Qualification")}<input required value={editing.input.qualification} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, qualification: e.target.value } })} /></label>
        <fieldset><legend>{tx("মধ্যস্থতার ধারা", "Mediation tracks")}</legend><div className={css.checks}>{MEDIATION_TRACKS.map((m) => <label key={m.code}><input type="checkbox" checked={editing.input.tracks?.includes(m.code) ?? false} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, tracks: e.target.checked ? [...(editing.input.tracks ?? []), m.code] : (editing.input.tracks ?? []).filter((x) => x !== m.code) } })} />{m.label[lang]}</label>)}</div></fieldset>
        <fieldset><legend>{tx("মামলার ধরন", "Case types")}</legend><div className={css.checks}>{MEDIATION_CASE_TYPES.map((m) => <label key={m.code}><input type="checkbox" checked={editing.input.caseTypes?.includes(m.code) ?? false} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, caseTypes: e.target.checked ? [...(editing.input.caseTypes ?? []), m.code] : (editing.input.caseTypes ?? []).filter((x) => x !== m.code) } })} />{m.label[lang]}</label>)}</div></fieldset>
      </> : null}
      {error ? <p role="alert" className={css.error}>{error}</p> : null}<button className={css.primary} type="submit">{tx("সংরক্ষণ করুন", "Save account")}</button>
    </form></section></div> : null}
    {deleting ? <div className={css.backdrop}><section className={`${css.dialog} ${css.deleteDialog}`} role="alertdialog" aria-modal="true" aria-labelledby="admin-delete-title" aria-describedby="admin-delete-description"><p className={css.kicker}>{roles.find((r) => r.key === deleting.role)?.[lang]}</p><h2 id="admin-delete-title">{tx("অ্যাকাউন্ট মুছে ফেলবেন?", "Delete this account?")}</h2><p id="admin-delete-description"><strong>{deleting.name}</strong><br /><span className={css.subtle}>{deleting.id}</span></p><p className={css.deleteWarning}>{tx("এই ব্যক্তির প্রবেশাধিকার বাতিল হবে। বিদ্যমান আবেদন ও অডিট ইতিহাস সংরক্ষিত থাকবে। সক্রিয় নিয়োগ থাকলে মধ্যস্থতাকারী বা আইনজীবীর অ্যাকাউন্ট মোছা যাবে না।", "This removes the person's access. Existing applications and audit history remain. Mediator or lawyer accounts with active assignments cannot be deleted.")}</p>{deleteError ? <p role="alert" className={css.error}>{deleteError}</p> : null}<div className={css.dialogActions}><button type="button" className={css.secondary} onClick={() => { setDeleting(null); setDeleteError(""); }}>{tx("বাতিল", "Cancel")}</button><button type="button" className={css.danger} onClick={remove}>{tx("অ্যাকাউন্ট মুছুন", "Delete account")}</button></div></section></div> : null}
  </main>;
}

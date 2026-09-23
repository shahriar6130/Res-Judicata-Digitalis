"use client";

import { useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";
import { useDlasDb } from "@/lib/dlas/store";
import { DISTRICTS, MATTERS, label } from "@/lib/dlas/reference";
import { AdminService, type ManagedInput, type ManagedRole } from "@/lib/dlas/admin";
import { exportBackup, importBackup, previewBackup, type BackupPreview } from "@/lib/dlas/backup";
import type { AuditEntry, DlasDb } from "@/lib/dlas/schema";
import css from "./admin-workspace.module.css";

const roles: { key: ManagedRole; bn: string; en: string }[] = [
  { key: "citizens", bn: "নাগরিক", en: "Citizens" },
  { key: "lawyers", bn: "আইনজীবী", en: "Lawyers" },
  { key: "officers", bn: "ডিএলও কর্মকর্তা", en: "DLO officers" },
  { key: "udcOperators", bn: "ইউডিসি অপারেটর", en: "UDC operators" },
];
type Section = "overview" | "users" | "cases" | "rules" | "audit" | "backup";
const sections: Section[] = ["overview", "users", "cases", "rules", "audit", "backup"];
const subscribeHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const currentHash = () => window.location.hash.slice(1);

function displayRecord(db: DlasDb, role: ManagedRole) {
  return db[role] as unknown as Array<{ name: string; phone: string; [key: string]: unknown }>;
}

export function AdminWorkspace() {
  const { lang } = useI18n();
  const db = useDlasDb();
  const hash = useSyncExternalStore(subscribeHash, currentHash, () => "");
  const section: Section = sections.includes(hash as Section) ? hash as Section : hash === "metrics" ? "overview" : "overview";
  const [role, setRole] = useState<ManagedRole>("citizens");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ role: ManagedRole; id: string | null; input: ManagedInput } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState<BackupPreview | null>(null);
  const [backupError, setBackupError] = useState("");
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const count = db.citizens.length + db.lawyers.length + db.officers.length + db.udcOperators.length;
  const openTasks = db.tasks.filter((t) => t.status !== "DONE").length;
  const pending = db.applications.filter((a) => !a.review?.decision).length;
  const audit = [
    ...db.adminAudit,
    ...db.applications.flatMap((a) => a.audit),
    ...db.citizens.flatMap((a) => a.audit),
    ...db.lawyers.flatMap((a) => a.audit),
    ...db.officers.flatMap((a) => a.audit),
    ...db.udcOperators.flatMap((a) => a.audit),
  ].filter((a, i, all) => all.findIndex((x) => x.seq === a.seq) === i).sort((a, b) => b.seq - a.seq).slice(0, 25);

  function edit(selectedRole: ManagedRole, record?: Record<string, unknown>) {
    setError(""); setNotice("");
    setEditing({
      role: selectedRole,
      id: record ? String(record[{ citizens: "citizenId", lawyers: "lawyerId", officers: "officerId", udcOperators: "operatorId" }[selectedRole]]) : null,
      input: {
        name: String(record?.name ?? ""), phone: String(record?.phone ?? ""),
        district: String(record?.district ?? ""), officeType: String(record?.officeType ?? "DLAO"),
        centre: String(record?.centre ?? ""), barEnrolmentNo: String(record?.barEnrolmentNo ?? ""),
        practiceAreas: Array.isArray(record?.practiceAreas) ? record.practiceAreas as string[] : [],
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
  const items = displayRecord(db, role).filter((r) => [r.name, r.phone, String(r.centre ?? ""), String(r.district ?? "")].some((s) => s.toLowerCase().includes(query.toLowerCase())));
  const roleName = roles.find((x) => x.key === role)!;

  return <main className={css.page}>
    <header className={css.hero}>
      <div><p className={css.kicker}>{tx("সিস্টেম প্রশাসন / লাইভ রেকর্ড", "SYSTEM ADMINISTRATION / LIVE RECORD")}</p><h1>{tx("কার্যক্রম নিয়ন্ত্রণ", "Operations control")}</h1><p>{tx("নাগরিক, আইনজীবী, ডিএলও, ইউডিসি ও আবেদন একই রেকর্ড থেকে পর্যবেক্ষণ করুন।", "Monitor citizens, lawyers, DLOs, UDCs and applications from the shared record.")}</p></div>
      <span className={css.live}>{tx("স্থানীয় প্রোটোটাইপ", "Local prototype")}</span>
    </header>
    <nav className={css.tabs} aria-label={tx("প্রশাসক বিভাগ", "Admin sections")}>{sections.map((s) => <a key={s} href={s === "overview" ? "/dashboard/admin" : `#${s}`} aria-current={section === s ? "page" : undefined}>{({ overview: tx("সংক্ষেপ", "Overview"), users: tx("ব্যবহারকারী", "People"), cases: tx("আবেদন", "Applications"), rules: tx("নীতিমালা", "Policy"), audit: tx("অডিট", "Audit"), backup: tx("ব্যাকআপ", "Backup") })[s]}</a>)}</nav>
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
      {items.map((r) => { const key = { citizens: "citizenId", lawyers: "lawyerId", officers: "officerId", udcOperators: "operatorId" }[role]; return <div className={css.person} key={String(r[key])}><div><strong>{r.name}</strong><small>{String(r[key])} · {r.phone}{r.district ? ` · ${r.district}` : ""}{r.centre ? ` · ${r.centre}` : ""}</small></div><button className={css.secondary} onClick={() => edit(role, r)}>{tx("সম্পাদনা", "Edit")}</button></div>; })}
      {!items.length ? <p className={css.empty}>{tx("কোনো মিল পাওয়া যায়নি। নতুন অ্যাকাউন্ট যোগ করতে পারেন।", "No matching accounts. You can add a new one.")}</p> : null}
    </section> : null}
    {section === "cases" ? <section className={css.panel}><div className={css.panelHead}><div><p className={css.kicker}>{tx("সব অফিস ও চ্যানেল", "ALL OFFICES AND CHANNELS")}</p><h2>{tx("আবেদন পর্যবেক্ষণ", "Application monitor")}</h2></div><strong>{db.applications.length}</strong></div>{db.applications.slice().reverse().map((a) => <div className={css.person} key={a.applicationId}><div><strong>{a.applicationId} · {a.data.applicant.fullName ?? "—"}</strong><small>{label(MATTERS, a.data.matter.category, lang)} · {a.routing.office} · {a.channel.code} · {a.status}</small></div><span className={css.status}>{a.review?.decision?.decision ?? tx("সিদ্ধান্ত বাকি", "Pending")}</span></div>)}{!db.applications.length ? <p className={css.empty}>{tx("এখনো কোনো আবেদন নেই।", "No applications yet.")}</p> : null}<p className={css.subtle}>{tx("আবেদন সংশোধন ও আইনগত সিদ্ধান্ত সংশ্লিষ্ট ডিএলও যাচাই কর্মপ্রবাহে নথিভুক্ত হয়।", "Application corrections and legal decisions are recorded in the responsible DLO review workflow.")}</p></section> : null}
    {section === "rules" ? <section className={css.panel}><p className={css.kicker}>{tx("সংস্করণযুক্ত নীতিমালা", "VERSIONED POLICY")}</p><h2>{tx("সক্রিয় নিয়ম", "Current rules")}</h2><p>{tx("এলিজিবিলিটি নিয়মের কর্মরত সংস্করণ", "Working eligibility ruleset")}: <strong>{db.eligibilityRulesets.at(-1)?.version ?? "—"}</strong></p><p>{tx("আইনজীবীর নিয়ম", "Lawyer rules")}: <strong>{db.lawyerRules?.version ?? "—"}</strong></p><p className={css.subtle}>{tx("আইনগত সিদ্ধান্ত কেবল অনুমোদিত ডিএলও কর্মকর্তা নেন।", "Legal decisions remain with authorised DLO officers.")}</p></section> : null}
    {section === "audit" ? <section className={css.panel}><p className={css.kicker}>{tx("সংরক্ষিত ইতিহাস", "PERSISTED HISTORY")}</p><h2>{tx("সাম্প্রতিক অডিট ঘটনা", "Recent audit events")}</h2>{audit.map((e: AuditEntry) => <div className={css.line} key={e.seq}><span><strong>{e.action}</strong><small>{e.actor} · {e.role}</small></span><time>{new Date(e.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</time></div>)}{!audit.length ? <p className={css.empty}>{tx("এখনো কোনো অডিট ঘটনা নেই।", "No audit events yet.")}</p> : null}</section> : null}
    {section === "backup" ? <div className={css.grid}>
      <section className={css.panel}><p className={css.kicker}>{tx("সম্পূর্ণ তথ্য", "COMPLETE DATA")}</p><h2>{tx("JSON এক্সপোর্ট", "Export JSON")}</h2><p>{tx("আবেদন, অ্যাকাউন্ট, কাজ, অডিট, সংরক্ষিত নথির কপি এবং অন্যান্য অ্যাপ ডেটা একটি ফাইলে ডাউনলোড করুন।", "Download applications, accounts, tasks, audits, stored document copies and other app data in one file.")}</p><button type="button" className={css.primary} onClick={downloadBackup}>{tx("JSON ডাউনলোড করুন", "Download JSON")}</button><p className={css.subtle}>{tx("ফাইলে ব্যক্তিগত তথ্য ও সংরক্ষিত নথি থাকতে পারে।", "This file may contain personal information and stored documents.")}</p></section>
      <section className={css.panel}><p className={css.kicker}>{tx("পুনরুদ্ধার", "RESTORE")}</p><h2>{tx("JSON ইমপোর্ট", "Import JSON")}</h2><p>{tx("একটি ব্যাকআপ ফাইল বেছে নিন। আমদানির আগে তথ্যের সারাংশ দেখানো হবে।", "Choose a backup file. Review its contents before importing.")}</p><label className={css.importField}>{tx("ব্যাকআপ ফাইল", "Backup file")}<input type="file" accept=".json,application/json" onChange={(e) => { void chooseBackup(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {backupError ? <p className={css.error} role="alert">{tx("ফাইল পড়া যায়নি: ", "Could not read file: ")}{backupError}</p> : null}
        {backup ? <div className={css.preview}><h3>{tx("ইমপোর্টের সারাংশ", "Import preview")}</h3><p>{backup.exportedAt ? new Date(backup.exportedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB") : tx("পুরোনো রেকর্ড ফরম্যাট", "Older record format")}</p><div className={css.line}><span>{tx("আবেদন", "Applications")}</span><strong>{backup.applications}</strong></div><div className={css.line}><span>{tx("অ্যাকাউন্ট", "Accounts")}</span><strong>{backup.people}</strong></div><div className={css.line}><span>{tx("সংরক্ষিত নথি", "Stored documents")}</span><strong>{backup.documents}</strong></div><p className={css.subtle}>{tx("ইমপোর্ট করলে এই ব্রাউজারের বর্তমান অ্যাপ তথ্য বদলে যাবে।", "Import replaces this browser's current app data.")}</p><button type="button" className={css.primary} onClick={() => { try { importBackup(backup); } catch (e) { setBackupError(e instanceof Error ? e.message : String(e)); } }}>{tx("বর্তমান তথ্য বদলে ইমপোর্ট করুন", "Replace current data and import")}</button></div> : null}
      </section>
    </div> : null}
    {editing ? <div className={css.backdrop}><section className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="admin-edit-title"><div className={css.panelHead}><div><p className={css.kicker}>{roles.find((r) => r.key === editing.role)?.[lang]}</p><h2 id="admin-edit-title">{editing.id ? tx("অ্যাকাউন্ট সম্পাদনা", "Edit account") : tx("অ্যাকাউন্ট যোগ করুন", "Add account")}</h2></div><button className={css.secondary} onClick={() => setEditing(null)}>{tx("বন্ধ", "Close")}</button></div><form onSubmit={(e) => { e.preventDefault(); save(); }} className={css.form}>
      <label>{tx("নাম", "Name")}<input required minLength={2} value={editing.input.name} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, name: e.target.value } })} /></label>
      <label>{tx("মোবাইল", "Mobile")}<input required inputMode="tel" value={editing.input.phone} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, phone: e.target.value } })} /></label>
      {editing.role === "officers" ? <label>{tx("অফিসের ধরন", "Office type")}<select value={editing.input.officeType} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, officeType: e.target.value } })}>{["DLAO", "SCLAC", "LLAC"].map((x) => <option key={x}>{x}</option>)}</select></label> : null}
      {editing.role !== "citizens" && !(editing.role === "officers" && editing.input.officeType === "SCLAC") ? <label>{tx("জেলা", "District")}<select required value={editing.input.district} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, district: e.target.value } })}><option value="">{tx("জেলা নির্বাচন", "Select district")}</option>{DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.label[lang]}</option>)}</select></label> : null}
      {editing.role === "udcOperators" ? <label>{tx("ইউডিসি কেন্দ্র", "UDC centre")}<input required value={editing.input.centre} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, centre: e.target.value } })} /></label> : null}
      {editing.role === "lawyers" ? <><label>{tx("বার এনরোলমেন্ট", "Bar enrolment")}<input required value={editing.input.barEnrolmentNo} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, barEnrolmentNo: e.target.value } })} /></label><fieldset><legend>{tx("কাজের ক্ষেত্র", "Practice areas")}</legend><div className={css.checks}>{MATTERS.map((m) => <label key={m.code}><input type="checkbox" checked={editing.input.practiceAreas?.includes(m.code) ?? false} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, practiceAreas: e.target.checked ? [...(editing.input.practiceAreas ?? []), m.code] : (editing.input.practiceAreas ?? []).filter((x) => x !== m.code) } })} />{m.label[lang]}</label>)}</div></fieldset></> : null}
      {error ? <p role="alert" className={css.error}>{error}</p> : null}<button className={css.primary} type="submit">{tx("সংরক্ষণ করুন", "Save account")}</button>
    </form></section></div> : null}
  </main>;
}

"use client";

/* ------------------------------------------------------------------ *
 *  /debug — inspect the shared record at any step.
 *
 *  Reads `localStorage["dlas.db.v1"]` live (updates across tabs), so
 *  you can keep it open next to any door and watch the JSON change.
 *  Select a session (pre-submission) or an application (post-
 *  submission) to see its step, pipeline stage, JSON, provenance,
 *  audit, tasks, messages and transcript. Deep link: /debug?id=APP-…
 * ------------------------------------------------------------------ */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/button";
import {
  DLAS_KEY,
  INTAKE_STEPS,
  PIPELINE,
  exportDb,
  importDb,
  resetDb,
  useDlasDb,
  type ApplicationRecord,
  type IntakeSession,
} from "@/lib/dlas";
import { styles, useTx } from "./shared";

type Item =
  | { kind: "application"; id: string; at: string; app: ApplicationRecord; session?: IntakeSession }
  | { kind: "session"; id: string; at: string; session: IntakeSession };

type Tab = "json" | "provenance" | "audit" | "tasks" | "messages" | "transcript";
type Top = "records" | "raw" | "storage";

export function DebugConsole() {
  const db = useDlasDb();
  const { tx } = useTx();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");
  const [top, setTop] = useState<Top>("records");
  const [tab, setTab] = useState<Tab>("json");
  const [filter, setFilter] = useState<"all" | "applications" | "sessions">("all");
  const [q, setQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string>(DLAS_KEY);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const app of db.applications) {
      out.push({ kind: "application", id: app.applicationId, at: app.updatedAt, app, session: db.sessions.find((s) => s.sessionId === app.channel.sessionId) });
    }
    for (const s of db.sessions) {
      if (s.applicationId) continue; // shown under its application
      out.push({ kind: "session", id: s.sessionId, at: s.updatedAt, session: s });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [db]);

  const visible = items.filter((i) => {
    if (filter === "applications" && i.kind !== "application") return false;
    if (filter === "sessions" && i.kind !== "session") return false;
    if (!q.trim()) return true;
    const hay = JSON.stringify(i.kind === "application" ? i.app.data : i.session.draft) + i.id + (i.kind === "application" ? i.app.channel.sessionId : "");
    return hay.toLowerCase().includes(q.toLowerCase());
  });

  const selected =
    items.find((i) => i.id === selectedId) ??
    // allow deep link to a session that already became an application
    items.find((i) => i.kind === "application" && i.app.channel.sessionId === selectedId);

  function select(id: string) {
    router.replace(`/debug?id=${encodeURIComponent(id)}`, { scroll: false });
  }

  function download() {
    const blob = new Blob([exportDb()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dlas-db-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      importDb(await file.text());
      setMsg(tx("ইমপোর্ট সম্পন্ন", "Import complete"));
    } catch (e) {
      setMsg(tx("ইমপোর্ট ব্যর্থ: ", "Import failed: ") + String(e));
    }
  }

  const stepCounts = INTAKE_STEPS.concat(["ABANDONED"]).map((s) => ({ s, n: db.sessions.filter((x) => x.step === s).length }));
  const openTasks = db.tasks.filter((t) => t.status === "OPEN").length;

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNum}>{db.applications.length}</div>
          <div className={styles.statLabel}>{tx("আবেদন (আইডি সহ)", "Applications (with ID)")}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{db.sessions.length}</div>
          <div className={styles.statLabel}>{tx("ইনটেক সেশন", "Intake sessions")}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{openTasks}</div>
          <div className={styles.statLabel}>{tx("খোলা কাজ", "Open tasks")}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{db.outbox.length}</div>
          <div className={styles.statLabel}>{tx("সিমুলেটেড বার্তা", "Simulated messages")}</div>
        </div>
        {stepCounts.map(({ s, n }) => (
          <div className={styles.stat} key={s}>
            <div className={styles.statNum}>{n}</div>
            <div className={styles.statLabel}>{s}</div>
          </div>
        ))}
      </div>

      <div className={styles.actions} style={{ marginTop: 0, marginBottom: "var(--s-4)" }}>
        <div className={styles.tabs} role="tablist" style={{ marginBottom: 0, borderBottom: "none" }}>
          {(
            [
              ["records", tx("রেকর্ড", "Records")],
              ["raw", tx("সম্পূর্ণ DB JSON", "Whole DB JSON")],
              ["storage", "localStorage"],
            ] as [Top, string][]
          ).map(([k, l]) => (
            <button key={k} role="tab" className={styles.tab} aria-selected={top === k} onClick={() => setTop(k)}>
              {l}
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        <Button variant="secondary" onClick={download}>
          {tx("এক্সপোর্ট", "Export JSON")}
        </Button>
        <label className={styles.chip}>
          {tx("ইমপোর্ট", "Import JSON")}
          <input type="file" accept="application/json" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {confirmReset ? (
          <>
            <Button
              variant="destructive"
              onClick={() => {
                resetDb();
                setConfirmReset(false);
                setMsg(tx("DB খালি করা হয়েছে", "DB cleared"));
                router.replace("/debug");
              }}
            >
              {tx("নিশ্চিত — সব মুছুন", "Confirm — wipe all")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              {tx("না", "Cancel")}
            </Button>
          </>
        ) : (
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            {tx("রিসেট", "Reset DB")}
          </Button>
        )}
      </div>
      {msg ? <p className={styles.notice}>{msg}</p> : null}

      {top === "raw" ? <pre className={`${styles.json} ${styles.jsonTall}`}>{JSON.stringify(db, null, 2)}</pre> : null}

      {top === "storage" ? <StorageBrowser selected={storageKey} onSelect={setStorageKey} /> : null}

      {top === "records" ? (
        <div className={styles.debugLayout}>
          <div>
            <input className={styles.input} placeholder={tx("খুঁজুন: আইডি, নাম, ফোন…", "Search: id, name, phone…")} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className={styles.chips} style={{ margin: "var(--s-3) 0" }}>
              {(["all", "applications", "sessions"] as const).map((f) => (
                <button key={f} type="button" className={styles.chip} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className={styles.hint}>
                {tx("কিছু নেই। একটি দরজা থেকে শুরু করুন:", "Nothing yet. Start from a door:")} <Link href="/dashboard/citizen#intake">citizen</Link> · <Link href="/dashboard/udc/intake/new">UDC</Link> · <Link href="/device/ivr">IVR</Link> · <Link href="/device/ussd">USSD</Link>
              </p>
            ) : null}
            <ul className={styles.list}>
              {visible.map((i) => {
                const s = i.kind === "application" ? i.session : i.session;
                const name = i.kind === "application" ? i.app.data.applicant.fullName : i.session.draft.applicant.fullName;
                return (
                  <li key={i.id}>
                    <button type="button" className={styles.listItem} aria-current={selected?.id === i.id} onClick={() => select(i.id)}>
                      <span className={styles.mono}>{i.id}</span>
                      <span>
                        <span className={styles.badge}>{i.kind === "application" ? i.app.channel.code : i.session.channel}</span>
                        <span className={`${styles.badge} ${i.kind === "application" ? styles.badgeDark : ""}`}>
                          {i.kind === "application" ? i.app.status : s?.step}
                        </span>
                      </span>
                      <span className={styles.hint}>
                        {name ?? tx("(নাম নেই)", "(no name yet)")} · {new Date(i.at).toLocaleString()}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>{selected ? <Detail item={selected} tab={tab} setTab={setTab} /> : <p className={styles.hint}>{tx("বাম দিক থেকে একটি রেকর্ড বাছুন।", "Pick a record on the left.")}</p>}</div>
        </div>
      ) : null}
    </>
  );
}

function Detail({ item, tab, setTab }: { item: Item; tab: Tab; setTab: (t: Tab) => void }) {
  const db = useDlasDb();
  const { tx } = useTx();
  const session = item.kind === "application" ? item.session : item.session;
  const app = item.kind === "application" ? item.app : undefined;
  const provenance = app?.provenance ?? session?.provenance ?? {};
  const auditList = app?.audit ?? session?.audit ?? [];
  const tasks = db.tasks.filter((t) => (app && t.applicationId === app.applicationId) || (session && t.sessionId === session.sessionId));
  const messages = db.outbox.filter((m) => (app && m.applicationId === app.applicationId) || (session && m.sessionId === session.sessionId));
  const stepIdx = session ? INTAKE_STEPS.indexOf(session.step) : INTAKE_STEPS.length - 1;
  const stageIdx = app ? PIPELINE.indexOf(app.stage) : -1;
  const json = app ?? session;

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>{item.kind === "application" ? tx("আবেদন রেকর্ড", "Application record") : tx("ইনটেক সেশন (জমা হয়নি)", "Intake session (not submitted)")}</p>
      <h2 className={styles.cardTitle} style={{ marginBottom: "var(--s-2)" }}>
        <span className={styles.mono}>{item.id}</span>
      </h2>
      <p className={styles.hint}>
        {tx("চ্যানেল", "Channel")}: <strong>{app?.channel.code ?? session?.channel}</strong> · {tx("প্রবেশ", "entry")}: {app?.channel.entryPoint ?? session?.entryPoint}
        {(app?.channel.simulated ?? session?.simulated) ? ` · ${tx("সিমুলেটেড গেটওয়ে", "simulated gateway")}` : ""} · session {session?.sessionId ?? app?.channel.sessionId}
      </p>

      <p className={styles.sectionTitle}>{tx("ইনটেক ধাপ", "Intake step")}</p>
      <div className={styles.pipeline}>
        {INTAKE_STEPS.map((s, i) => (
          <span key={s} className={`${styles.pipeStep} ${i < stepIdx ? styles.pipeDone : ""} ${i === stepIdx ? styles.pipeNow : ""}`}>
            {s}
          </span>
        ))}
        {session?.step === "ABANDONED" ? <span className={`${styles.pipeStep} ${styles.pipeNow}`}>ABANDONED</span> : null}
      </div>
      <p className={styles.sectionTitle}>{tx("কেস ব্যাকবোন পর্যায়", "Case backbone stage")}</p>
      <div className={styles.pipeline}>
        {PIPELINE.map((s, i) => (
          <span key={s} className={`${styles.pipeStep} ${i < stageIdx ? styles.pipeDone : ""} ${i === stageIdx ? styles.pipeNow : ""}`}>
            {s}
          </span>
        ))}
      </div>
      {app ? (
        <p className={styles.hint}>
          status <strong>{app.status}</strong> · office {app.routing.office} · {tx("প্রস্তাবিত", "suggested")} {app.routing.recommendedPriority} ({tx("পরামর্শমূলক", "advisory")}) · humanDecision {app.routing.humanDecision ? "set" : "null"} · caseId {app.caseId ?? "null"} · v{app.version}
        </p>
      ) : null}
      {(app?.validation ?? session?.lastValidation) ? (
        <div className={`${styles.notice} ${(app?.validation ?? session?.lastValidation)!.valid ? styles.noticeOk : styles.noticeErr}`}>
          validation: {(app?.validation ?? session?.lastValidation)!.valid ? "valid" : "INVALID"}
          {(app?.validation ?? session?.lastValidation)!.missing.length ? ` · missing: ${(app?.validation ?? session?.lastValidation)!.missing.join(", ")}` : ""}
          {(app?.validation ?? session?.lastValidation)!.warnings.length ? ` · warnings: ${(app?.validation ?? session?.lastValidation)!.warnings.map((w) => w.code).join(", ")}` : ""}
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist" style={{ marginTop: "var(--s-4)" }}>
        {(
          [
            ["json", "JSON"],
            ["provenance", `provenance (${Object.keys(provenance).length})`],
            ["audit", `audit (${auditList.length})`],
            ["tasks", `tasks (${tasks.length})`],
            ["messages", `messages (${messages.length})`],
            ["transcript", `transcript (${session?.transcript.length ?? 0})`],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" className={styles.tab} aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === "json" ? <pre className={`${styles.json} ${styles.jsonTall}`}>{JSON.stringify(json, null, 2)}</pre> : null}

      {tab === "provenance" ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>field</th>
                <th>source</th>
                <th>method</th>
                <th>by</th>
                <th>at</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(provenance)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([path, p]) => (
                  <tr key={path}>
                    <td className={styles.mono}>{path}</td>
                    <td>
                      <span className={styles.badge}>{p.source}</span>
                      {p.note ? <div className={styles.hint}>{p.note}</div> : null}
                    </td>
                    <td>{p.method}</td>
                    <td>{p.by}</td>
                    <td>{new Date(p.at).toLocaleTimeString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>at</th>
                <th>actor</th>
                <th>action</th>
                <th>detail</th>
              </tr>
            </thead>
            <tbody>
              {auditList.map((a) => (
                <tr key={a.seq}>
                  <td>{a.seq}</td>
                  <td>{new Date(a.at).toLocaleTimeString()}</td>
                  <td>
                    {a.actor}
                    <div className={styles.hint}>{a.role}</div>
                  </td>
                  <td className={styles.mono}>{a.action}</td>
                  <td className={styles.mono} style={{ whiteSpace: "pre-wrap" }}>
                    {a.detail ? JSON.stringify(a.detail) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "tasks" ? <pre className={styles.json}>{JSON.stringify(tasks, null, 2)}</pre> : null}
      {tab === "messages" ? <pre className={styles.json}>{JSON.stringify(messages, null, 2)}</pre> : null}
      {tab === "transcript" ? (
        session?.transcript.length ? (
          <ul className={styles.transcript}>
            {session.transcript.map((l, i) => (
              <li key={i} className={l.from === "SYSTEM" ? styles.lineSys : styles.lineUser} style={{ whiteSpace: "pre-wrap" }}>
                {l.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>{tx("এই দরজায় কথোপকথন নেই (ফর্ম)।", "No conversation for this door (form-based).")}</p>
        )
      ) : null}
    </div>
  );
}

/** Browse any localStorage key — the DLAS DB, the legacy helpline store, drafts… */
function StorageBrowser({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  const { tx } = useTx();
  useDlasDb(); // re-render on DB changes
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }
  } catch {
    /* storage blocked */
  }
  keys.sort();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(selected);
  } catch {
    raw = null;
  }
  let pretty = raw ?? tx("(খালি)", "(empty)");
  try {
    if (raw) pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* not JSON */
  }
  return (
    <div className={styles.debugLayout}>
      <ul className={styles.list}>
        {keys.map((k) => (
          <li key={k}>
            <button type="button" className={styles.listItem} aria-current={k === selected} onClick={() => onSelect(k)}>
              <span className={styles.mono}>{k}</span>
              <span className={styles.hint}>{(window.localStorage.getItem(k) ?? "").length.toLocaleString()} bytes</span>
            </button>
          </li>
        ))}
      </ul>
      <pre className={`${styles.json} ${styles.jsonTall}`}>{pretty}</pre>
    </div>
  );
}

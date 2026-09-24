"use client";

/* ------------------------------------------------------------------ *
 *  Citizen view of a T3 related-incident group.
 *   • CitizenGroupCard   (case page) — the incident, how many others are
 *     linked (never their names or details), the shared evidence.
 *   • CitizenGroupAlerts (home)      — "your case is linked with others".
 *  lib/dlas/incident-groups.ts citizenGroupView()
 * ------------------------------------------------------------------ */

import { useI18n } from "@/lib/i18n";
import { DOC_TYPES, FileStore, citizenGroupView, formatDateTime, label, useDlasDb } from "@/lib/dlas";
import { useCitizenApplication, useCitizenApplications } from "@/lib/dlas/citizen-view";
import ui from "@/components/dlao/dlao.module.css";

function openEvidence(id: string) {
  const f = FileStore.get(id);
  if (!f) return;
  const w = window.open();
  if (w) w.document.write(f.mime.startsWith("image/") ? `<img src="${f.dataUrl}" style="max-width:100%">` : `<iframe src="${f.dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
}

export function CitizenGroupCard({ applicationId }: { applicationId: string }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const db = useDlasDb();
  const a = useCitizenApplication(applicationId);
  const g = a ? citizenGroupView(db, a) : null;
  if (!g) return null;
  return (
    <section id="incident-group" aria-label={tx("সংযুক্ত কেস গ্রুপ", "Linked case group")} style={{ margin: "var(--s-5) 0" }}>
      <div className={`${ui.banner} ${ui.bannerWarn}`}>
        <span className={ui.bannerIcon} aria-hidden>
          🔗
        </span>
        <div style={{ flex: 1 }}>
          <strong>
            {tx("আপনার কেস একটি গ্রুপে যুক্ত", "Your case is linked to a group")}: {g.title}
          </strong>
          <div>
            {[g.incidentDate, g.place].filter(Boolean).join(" · ")}
            {g.description ? ` — ${g.description}` : ""}
          </div>
          <div style={{ marginTop: 4 }}>
            {tx(`একই ঘটনায় আরও ${g.otherApplicants} জনের কেস এই গ্রুপে আছে। অফিস একসাথে কাজ করবে, সাধারণ প্রমাণ একবারই জমা হয়। কারও ব্যক্তিগত তথ্য অন্যরা দেখেন না — আপনার কেস ও ফলাফল আপনার নিজের থাকে।`, `${g.otherApplicants} other ${g.otherApplicants === 1 ? "person's case is" : "people's cases are"} in this group for the same incident. The office works on them together and common evidence is submitted once. No one sees anyone else's personal details — your case and its outcome stay your own.`)}
          </div>
          <div style={{ fontSize: "0.85rem", opacity: 0.75, marginTop: 2 }}>
            {tx("যুক্ত করা হয়েছে", "Linked")} {formatDateTime(g.linkedAt, lang)}
          </div>
          {g.sharedEvidence.length ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {g.sharedEvidence.map((e) => (
                <li key={e.evidenceId}>
                  📎 {e.title} · {label(DOC_TYPES, e.docType, lang)} · {formatDateTime(e.uploadedAt, lang)}{" "}
                  {e.preview === "STORED" ? (
                    <button type="button" className={ui.textBtn} onClick={() => openEvidence(e.evidenceId)}>
                      {tx("দেখুন", "View")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function CitizenGroupAlerts() {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const db = useDlasDb();
  const apps = useCitizenApplications();
  const linked = apps.map((a) => ({ a, g: citizenGroupView(db, a) })).filter((x) => x.g);
  if (!linked.length) return null;
  return (
    <div style={{ display: "grid", gap: 8, margin: "var(--s-3) 0" }}>
      {linked.map(({ a, g }) => (
        <a key={a.applicationId} href={`#cases/${encodeURIComponent(a.applicationId)}`} className={`${ui.banner} ${ui.bannerWarn}`} style={{ textDecoration: "none", color: "inherit" }}>
          <span className={ui.bannerIcon} aria-hidden>
            🔗
          </span>
          <div>
            <strong>
              {tx("একই ঘটনার কেস গ্রুপ", "Same-incident case group")}: {g!.title}
            </strong>{" "}
            · {a.caseId ?? a.applicationId}
            <div>
              {tx(`আরও ${g!.otherApplicants} জনের কেসের সাথে যুক্ত · সাধারণ প্রমাণ ${g!.sharedEvidence.length}টি`, `Linked with ${g!.otherApplicants} other case(s) · ${g!.sharedEvidence.length} shared evidence`)} →
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

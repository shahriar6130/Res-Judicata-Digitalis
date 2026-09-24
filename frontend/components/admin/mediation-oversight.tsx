"use client";

/* ------------------------------------------------------------------ *
 *  DBLA mediation oversight (Feature 12) — /dashboard/admin#mediation.
 *  National, read-only: every mediation case in every district, where it
 *  stands in the lifecycle and whose checkpoint it is waiting on.
 *  No decision can be taken here. Caucus content is never read.
 * ------------------------------------------------------------------ */

import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, mediationLifecycle, useDlasDb, type LifecycleLane } from "@/lib/dlas";
import { CheckpointBadge, LANE } from "@/components/demo/lifecycle-timeline";
import css from "./admin-workspace.module.css";

export function AdminMediationOversight() {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const db = useDlasDb();
  const rows = db.applications
    .filter((a) => a.mediation)
    .map((a) => ({ a, lc: mediationLifecycle(a, db.tasks) }))
    .sort((x, y) => y.a.updatedAt.localeCompare(x.a.updatedAt));
  const waiting = (lane: LifecycleLane) => rows.filter((r) => r.lc.current?.lane === lane).length;
  const lanes: LifecycleLane[] = ["OFFICER", "MEDIATOR", "PARTY", "CLO", "LAWYER"];
  const districts = new Set(rows.map((r) => r.a.data.applicant.district));

  return (
    <section className={css.panel}>
      <div className={css.panelHead}>
        <div>
          <p className={css.kicker}>{tx("DBLA · জাতীয় তত্ত্বাবধান · শুধু দেখা", "DBLA · NATIONAL OVERSIGHT · READ-ONLY")}</p>
          <h2>{tx("মধ্যস্থতার জীবনচক্র — সব জেলা", "Mediation lifecycle — all districts")}</h2>
        </div>
        <a href="/demo/mediation">{tx("শুরু থেকে শেষ ডেমো →", "End-to-end demo →")}</a>
      </div>
      <p className={css.subtle}>
        {rows.length} {tx("টি মধ্যস্থতা কেস", "mediation cases")} · {districts.size} {tx("জেলা", "district(s)")} · {rows.filter((r) => r.lc.complete).length} {tx("সম্পন্ন", "complete")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 16px" }}>
        {lanes.map((l) => (
          <span key={l} style={{ border: `1px solid ${LANE[l].color}`, color: LANE[l].color, borderRadius: 999, padding: "4px 10px", fontSize: "0.8rem", fontWeight: 600 }}>
            {tx("অপেক্ষায়", "Waiting on")} {LANE[l][lang === "bn" ? "bn" : "en"]}: {waiting(l)}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={css.empty}>{tx("এখনো কোনো মধ্যস্থতা কেস নেই।", "No mediation cases yet.")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: 8 }}>{tx("কেস", "Case")}</th>
                <th style={{ padding: 8 }}>{tx("জেলা", "District")}</th>
                <th style={{ padding: 8 }}>{tx("শাখা", "Branch")}</th>
                <th style={{ padding: 8 }}>{tx("বর্তমান ধাপ", "Current stage")}</th>
                <th style={{ padding: 8 }}>{tx("চেকপয়েন্ট", "Checkpoint")}</th>
                <th style={{ padding: 8 }}>{tx("অগ্রগতি", "Progress")}</th>
                <th style={{ padding: 8 }}>{tx("সর্বশেষ", "Last update")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, lc }) => {
                const done = lc.stages.filter((s) => s.state === "DONE").length;
                const cur = lc.current;
                return (
                  <tr key={a.applicationId} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: 8, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{a.caseId ?? a.applicationId}</td>
                    <td style={{ padding: 8 }}>{a.data.applicant.district ?? "—"}</td>
                    <td style={{ padding: 8 }}>{lc.branchKnown ? (lc.branch === "FAILURE" ? tx("ব্যর্থতা → রেফারেল", "Failure → referral") : tx("নিষ্পত্তি", "Settlement")) : tx("চলমান", "In mediation")}</td>
                    <td style={{ padding: 8 }}>
                      {cur ? (
                        <>
                          <span style={{ color: LANE[cur.lane].color, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.06em" } as CSSProperties}>{LANE[cur.lane][lang === "bn" ? "bn" : "en"]}</span>
                          <div>{cur.title[lang === "bn" ? "bn" : "en"]}</div>
                        </>
                      ) : (
                        tx("সম্পন্ন", "Complete")
                      )}
                    </td>
                    <td style={{ padding: 8 }}>{cur ? <CheckpointBadge c={cur.checkpoint} /> : <CheckpointBadge c="COMPLETED" />}</td>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                      {done}/{lc.stages.length}
                    </td>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>{formatDateTime(a.updatedAt, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

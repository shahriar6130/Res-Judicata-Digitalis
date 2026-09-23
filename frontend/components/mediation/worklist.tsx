"use client";

/* ------------------------------------------------------------------ *
 *  Mediator worklist — every mediation matter assigned to the
 *  mediator, each opening the SAME Case ID used by the DLAO and
 *  citizen pages at /mediator/cases/[caseId]. Rendered both as the
 *  /mediator page and as the mediator role's dashboard delegation
 *  (operational-role-dashboard.tsx) — one implementation, not two.
 * ------------------------------------------------------------------ */

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, MediationService } from "@/lib/shakkho";
import { LanguageToggle } from "@/components/language-toggle";
import styles from "./mediation.module.css";

export function MediatorWorklist() {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const matters = MediationService.list(envelope);
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);

  return (
    <main className={styles.page}>
      <div className={styles.langRow}>
        <LanguageToggle />
      </div>
      <div className={styles.pageHeader}>
        <span className={styles.eyebrow}>{say("মধ্যস্থতাকারী", "Mediator")}</span>
        <h1 className={styles.title}>{say("কর্মতালিকা — সক্রিয় বিষয়সমূহ", "Worklist — active matters")}</h1>
        <p className={styles.intro}>{say("প্রতিটি বিষয় একটি বিদ্যমান, গৃহীত কেসের সাথে সংযুক্ত — একই কেস আইডি ডিএলএও এবং নাগরিক পৃষ্ঠায়ও ব্যবহৃত হয়।", "Every matter is linked to an existing, accepted case — the same Case ID used on the DLAO and citizen pages.")}</p>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{say("রেফারেন্স", "Reference")}</th>
            <th>{say("কেস আইডি", "Case ID")}</th>
            <th>{say("বিষয়ের ধরন", "Category")}</th>
            <th>{say("অবস্থা", "State")}</th>
            <th>{say("সর্বশেষ আপডেট", "Last updated")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {matters.length === 0 && (
            <tr><td colSpan={6}>{say("কোনো মধ্যস্থতা বিষয় নেই।", "No mediation matters yet.")}</td></tr>
          )}
          {matters.map((m) => (
            <tr key={m.matterId}>
              <td>{m.mediationReference}</td>
              <td>{m.caseId}</td>
              <td>{m.matterCategory}</td>
              <td><span className={styles.pill}>{m.state}</span></td>
              <td>{new Date(m.updatedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}</td>
              <td><Link href={`/mediator/cases/${m.caseId}`} className={styles.backLink}>{say("খুলুন →", "Open →")}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

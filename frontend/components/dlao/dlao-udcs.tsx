"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import {
  DISTRICTS,
  UdcOversightService,
  label,
  udcApprovalStatus,
  useCurrentOfficer,
  useDistrictUdcOperators,
} from "@/lib/dlas";
import ui from "./dlao.module.css";
import styles from "./dlao-udcs.module.css";

export function DistrictUdcManagement() {
  const { lang } = useI18n();
  const officer = useCurrentOfficer();
  const operators = useDistrictUdcOperators();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const pending = operators.filter((operator) => udcApprovalStatus(operator) === "PENDING").length;
  const approved = operators.filter((operator) => udcApprovalStatus(operator) === "APPROVED").length;
  const rejected = operators.filter((operator) => udcApprovalStatus(operator) === "REJECTED").length;

  function run(action: () => void, success: string) {
    try {
      action();
      setFeedback(success);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <header className={ui.queuePlainHead}>
        <span className={ui.heroKicker}>{tx("জেলা ইউডিসি তদারকি", "DISTRICT UDC OVERSIGHT")}</span>
        <h1 className={ui.queueTitle}>{tx("ইউডিসি অনুমোদন", "UDC approvals")}</h1>
        <p className={ui.heroDescription}>
          {tx(
            `${label(DISTRICTS, officer?.district ?? null, "bn")} জেলার নিবন্ধিত ইউডিসি অপারেটর দেখুন এবং অনুমোদন দিন। অন্য জেলার অপারেটর এখানে দেখা বা পরিবর্তন করা যাবে না।`,
            `Review registered UDC operators in ${label(DISTRICTS, officer?.district ?? null, "en")} district. Operators from other districts cannot be viewed or changed here.`,
          )}
        </p>
      </header>

      <section className={styles.summary} aria-label={tx("অনুমোদনের সারসংক্ষেপ", "Approval summary")}>
        <div className={styles.summaryItem}><strong>{pending}</strong><span>{tx("অপেক্ষমাণ", "Pending")}</span></div>
        <div className={styles.summaryItem}><strong>{approved}</strong><span>{tx("অনুমোদিত", "Approved")}</span></div>
        <div className={styles.summaryItem}><strong>{rejected}</strong><span>{tx("প্রত্যাখ্যাত", "Rejected")}</span></div>
      </section>

      <div className={styles.toolbar}>
        <p>{tx(`${operators.length} জন অপারেটর এই জেলার আওতায়`, `${operators.length} operator(s) in this district`)}</p>
        <Button
          onClick={() => {
            try {
              const count = UdcOversightService.approveAllPending();
              setFeedback(tx(`${count} জন ইউডিসি অনুমোদিত হয়েছে`, `${count} UDC operator(s) approved`));
            } catch (error) {
              setFeedback(error instanceof Error ? error.message : String(error));
            }
          }}
          disabled={pending === 0}
        >
          {tx("সব অপেক্ষমাণ অনুমোদন করুন", "Approve all pending")}
        </Button>
      </div>

      {feedback ? <div className={styles.feedback} role="status">{feedback}</div> : null}

      <section className={styles.list} aria-label={tx("ইউডিসি অপারেটর তালিকা", "UDC operator list")}>
        {operators.length === 0 ? (
          <p className={styles.empty}>{tx("এই জেলায় কোনো নিবন্ধিত ইউডিসি অপারেটর নেই।", "No registered UDC operators were found in this district.")}</p>
        ) : operators.map((operator) => {
          const status = udcApprovalStatus(operator);
          return (
            <article className={styles.card} key={operator.operatorId}>
              <div className={styles.identity}>
                <h2>{operator.name}</h2>
                <p>{operator.centre}</p>
                <span className={`${styles.status} ${status === "APPROVED" ? styles.approved : status === "REJECTED" ? styles.rejected : styles.pending}`}>
                  {status === "APPROVED" ? tx("অনুমোদিত", "Approved") : status === "REJECTED" ? tx("প্রত্যাখ্যাত", "Rejected") : tx("অপেক্ষমাণ", "Pending")}
                </span>
              </div>
              <dl className={styles.meta}>
                <div><dt>{tx("অপারেটর আইডি", "Operator ID")}</dt><dd>{operator.operatorId}</dd></div>
                <div><dt>{tx("মোবাইল", "Mobile")}</dt><dd>{operator.phone}</dd></div>
                <div><dt>{tx("নিবন্ধন", "Registered")}</dt><dd>{new Date(operator.createdAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}</dd></div>
                <div><dt>{tx("সর্বশেষ লগইন", "Last login")}</dt><dd>{operator.lastLoginAt ? new Date(operator.lastLoginAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB") : "—"}</dd></div>
              </dl>
              <div className={styles.actions}>
                {operator.approval?.at ? (
                  <p className={styles.decisionNote}>
                    {tx("সর্বশেষ সিদ্ধান্ত", "Last decision")}: {operator.approval.byName ?? "—"} · {new Date(operator.approval.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
                    {operator.approval.reason ? ` · ${operator.approval.reason}` : ""}
                  </p>
                ) : null}
                <textarea
                  value={reasons[operator.operatorId] ?? ""}
                  onChange={(event) => setReasons((current) => ({ ...current, [operator.operatorId]: event.target.value }))}
                  placeholder={tx("প্রত্যাখ্যানের কারণ (প্রত্যাখ্যানের জন্য আবশ্যক)", "Rejection reason (required to reject)")}
                  aria-label={tx(`${operator.name}-এর সিদ্ধান্তের কারণ`, `Decision reason for ${operator.name}`)}
                />
                <div className={styles.buttonRow}>
                  <Button
                    onClick={() => run(() => UdcOversightService.approve(operator.operatorId), tx(`${operator.name} অনুমোদিত হয়েছে`, `${operator.name} approved`))}
                    disabled={status === "APPROVED"}
                  >
                    {tx("অনুমোদন", "Approve")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => run(() => UdcOversightService.reject(operator.operatorId, reasons[operator.operatorId] ?? ""), tx(`${operator.name} প্রত্যাখ্যাত হয়েছে`, `${operator.name} rejected`))}
                    disabled={status === "REJECTED" || !(reasons[operator.operatorId] ?? "").trim()}
                  >
                    {tx("প্রত্যাখ্যান", "Reject")}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

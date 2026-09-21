"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ConversationalIntakeService,
  IntakeSessionService,
  RepresentationService,
  SafeContactService,
  ensureSeeded,
  useHelplineStore,
  RiponScript,
} from "@/lib/shakkho";
import { Phone, ChevronRight } from "@/components/icons";
import { IconButton } from "@/components/helpline/primitives/icon-button";
import { SimulationTag } from "@/components/helpline/primitives/simulation-tag";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import helplineStyles from "@/components/helpline/helpline.module.css";
import styles from "./citizen-ripon-call.module.css";

export function CitizenRiponCallPanel({ sessionId }: { sessionId: string }) {
  const { lang, t } = useI18n();
  const envelope = useHelplineStore();
  const session = envelope.sessions.find((s) => s.id === sessionId);
  const record = session?.applicationId
    ? envelope.records.find((r) => r.applicationId === session.applicationId)
    : undefined;
  const [draft, setDraft] = useState("");
  const [ripOnState, setRipOnState] = useState(() =>
    RiponScript.initial(),
  );

  const safeContact = useMemo(
    () => (record ? SafeContactService.evaluate(record) : null),
    [record],
  );

  useEffect(() => {
    ensureSeeded();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.turns.length === 0) {
      IntakeSessionService.start({ actor: "t5", applicationId: session.applicationId ?? "TEMP-MOY-01" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) {
    return (
      <main id="helpline-main" className={helplineStyles.page}>
        <SkipLink targetId="helpline-main" />
        <h1 className={helplineStyles.pageTitle}>{t("helplineMainHeading")}</h1>
        <p className={helplineStyles.empty}>{t("helplineRecordNotFound")}</p>
      </main>
    );
  }

  function send(text: string) {
    if (!session) return;
    if (!text.trim()) return;

    if (text.trim() === "0") {
      // Press-0 → human handoff + DLAO bridge.
      ConversationalIntakeService.nextTurn({
        sessionId: session!.id,
        actor: "caller",
        lastUtterance: { bn: "০", en: "0" },
      });
      IntakeSessionService.requestHandoff({
        sessionId: session!.id,
        reason: "press_0",
        targetRole: "dlao",
        actor: "caller",
      });
      return;
    }

    // Push the caller's reply into the call simulator's intake as well.
    ConversationalIntakeService.nextTurn({
      sessionId: session!.id,
      actor: "caller",
      lastUtterance: { bn: text, en: text },
    });

    // Drive the deterministic Ripon script in parallel so the right
    // rail record updates live.
    setRipOnState((s) => RiponScript.feed(s, text));
  }

  const riponRecord = {
    ...record,
    facts: { ...record?.facts, ...ripOnState.facts },
    urgencyIndicators: ripOnState.indicators.length
      ? [...(record?.urgencyIndicators ?? []), ...ripOnState.indicators]
      : record?.urgencyIndicators ?? [],
  };

  return (
    <>
      <SkipLink targetId="helpline-main" />
      <main id="helpline-main" className={helplineStyles.page}>
        <header className={helplineStyles.pageHeader}>
          <span className={helplineStyles.pageEyebrow}>
            {lang === "bn" ? "১৬৬৯৯ · নাগরিক পক্ষ" : "16699 · citizen side"}
          </span>
          <h1 className={helplineStyles.pageTitle}>
            {lang === "bn" ? "টি-৫ হেল্পলাইন কল" : "T5 helpline call"}
          </h1>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <SimulationTag kind="voice" label={lang === "bn" ? "সিমুলেটেড কল" : "Simulated call"} />
          </div>
        </header>

        <section className={helplineStyles.callGrid}>
          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "কল নিয়ন্ত্রণ" : "Call controls"}</h2>
            <div className={helplineStyles.dialpad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                <button key={k} type="button" onClick={() => setDraft((d) => d + k)}>
                  {k}
                </button>
              ))}
            </div>
            <div className={helplineStyles.callerInputRow}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "বলুন বা টাইপ করুন… (যেকোনো সময় ০ চাপুন)"
                    : "Speak or type… (press 0 anytime)"
                }
                className={helplineStyles.callerInput}
              />
              <IconButton
                Icon={ChevronRight}
                onClick={() => {
                  send(draft);
                  setDraft("");
                }}
                size="md"
                className={helplineStyles.callerSendBtn}
              >
                {lang === "bn" ? "পাঠান" : "Send"}
              </IconButton>
            </div>
            <IconButton Icon={Phone} onClick={() => send("0")}>
              {lang === "bn" ? "মানব এজেন্টকে ডাকুন (0)" : "Call human agent (0)"}
            </IconButton>
          </div>

          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "ট্রান্সক্রিপ্ট" : "Transcript"}</h2>
            <div className={helplineStyles.transcript}>
              {ripOnState.history.map((turn, i) => (
                <div
                  key={i}
                  className={`${helplineStyles.turn} ${turn.speaker === "caller" ? helplineStyles.caller : ""}`}
                >
                  <div className={helplineStyles.turnHead}>
                    <span>{turn.speaker === "t5" ? "T5" : lang === "bn" ? "কলার (রিপন)" : "Caller (Ripon)"}</span>
                  </div>
                  <p className={helplineStyles.turnBody}>{lang === "bn" ? turn.text.bn : turn.text.en}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={helplineStyles.callColumn}>
            <h2>{lang === "bn" ? "অস্থায়ী রেকর্ড" : "Draft record"}</h2>
            <ul className={helplineStyles.provenanceList}>
              {Object.entries(riponRecord.facts ?? {}).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <span>{v?.value ?? "—"}</span>
                </li>
              ))}
            </ul>
            {ripOnState.indicators.length > 0 ? (
              <div className={styles.urgencyPills}>
                {ripOnState.indicators.map((ind, i) => (
                  <span key={i} className={styles.urgentPill}>
                    {ind.code} · {ind.weight}
                  </span>
                ))}
              </div>
            ) : null}
            {safeContact && !safeContact.cleared ? (
              <p className={helplineStyles.uncertainBanner}>
                {lang === "bn"
                  ? "নিরাপদ যোগাযোগের সময় পাওয়া যায়নি — দয়া করে বলুন।"
                  : "Safe contact time missing — please provide one."}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}

void RepresentationService;

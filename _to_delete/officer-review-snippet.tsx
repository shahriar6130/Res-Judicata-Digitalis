/* ------------------------------ officer review → send the case to ------------------------------ */

type Dest = "GRAM_ADALAT" | "MEDIATION" | "LAWYER";

const DESTS: { code: Dest; icon: string; title: { bn: string; en: string }; text: { bn: string; en: string }; next: { bn: string; en: string } }[] = [
  {
    code: "GRAM_ADALAT",
    icon: "🏛",
    title: { bn: "গ্রাম আদালত", en: "Gram Adalat" },
    text: { bn: "ইউনিয়ন পর্যায়ের ছোট স্থানীয় বিরোধ, গ্রাম আদালতের এখতিয়ারে।", en: "Small local disputes within the village court's jurisdiction, at union level." },
    next: { bn: "পরবর্তী: গ্রাম আদালতে রেফারেল কাজ খুলবে ও আবেদনকারীকে জানানো হবে।", en: "Next: a Gram Adalat referral task opens and the applicant is told." },
  },
  {
    code: "MEDIATION",
    icon: "🤝",
    title: { bn: "মধ্যস্থতা", en: "Mediation" },
    text: { bn: "মামলা-পূর্ব বা আদালত-প্রেরিত মধ্যস্থতা — উভয় পক্ষ নিরাপদে বসতে পারলে।", en: "Pre-case or court-referred mediation — when both parties can safely sit together." },
    next: { bn: "পরবর্তী: মধ্যস্থতাকারী নিয়োগ — যোগ্যতা যাচাই, প্রস্তাব, নিশ্চিতকরণ।", en: "Next: mediator assignment — eligibility check, recommend, confirm." },
  },
  {
    code: "LAWYER",
    icon: "⚖",
    title: { bn: "প্যানেল আইনজীবী নিয়োগ", en: "Lawyer assignment" },
    text: { bn: "আদালতে প্রতিনিধিত্ব, মামলা দায়ের বা সুরক্ষা আদেশ।", en: "Court representation, filing a claim or seeking protection." },
    next: { bn: "পরবর্তী: প্যানেল আইনজীবী শর্টলিস্ট ও প্রস্তাব।", en: "Next: panel lawyer shortlist and offer." },
  },
];

const MEDIATION_KINDS: PathwayStatus[] = ["MANDATORY_PRE_CASE_MEDIATION", "MEDIATION_AVAILABLE", "COURT_REFERRED_MEDIATION"];

/** Which of the three destinations a pathway status belongs to (null = outside them, e.g. police referral). */
function destOf(status: PathwayStatus, target: ReferralTarget | null): Dest | null {
  if (isMediationStatus(status)) return "MEDIATION";
  if (status === "LAWYER_ASSISTANCE" || status === "URGENT_ESCALATION") return "LAWYER";
  if (status === "OTHER_REFERRAL" && target === "GRAM_ADALAT") return "GRAM_ADALAT";
  return null;
}

function OfficerReview({ a, run, draft, system, ruleTarget }: { a: ApplicationRecord; run: Run; draft: Patch; system: PathwayStatus; ruleTarget: ReferralTarget | null }) {
  const { lang, tx } = useTx();
  const suggested = destOf(system, ruleTarget);
  const [dest, setDest] = useState<Dest | "OTHER" | "INFO" | null>(null);
  const [kind, setKind] = useState<PathwayStatus>(isMediationStatus(system) ? system : draft.courtStatus === "REFERRED_FOR_MEDIATION" ? "COURT_REFERRED_MEDIATION" : "MEDIATION_AVAILABLE");
  const [other, setOther] = useState<ReferralTarget | null>(ruleTarget && ruleTarget !== "GRAM_ADALAT" ? ruleTarget : null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const violence = a.data.urgency.flags.length > 0 || a.data.matter.category === "VIOLENCE";

  // The pathway status (and referral target) the officer's choice records.
  const chosen: { status: PathwayStatus; target: ReferralTarget | null } | null =
    dest === "GRAM_ADALAT" ? { status: "OTHER_REFERRAL", target: "GRAM_ADALAT" }
    : dest === "MEDIATION" ? { status: kind, target: null }
    : dest === "LAWYER" ? { status: system === "URGENT_ESCALATION" ? "URGENT_ESCALATION" : "LAWYER_ASSISTANCE", target: null }
    : dest === "OTHER" && other ? { status: "OTHER_REFERRAL", target: other }
    : null;
  const followsSystem = !!chosen && chosen.status === system;
  const send = () => {
    if (!chosen) return;
    run(() => void (followsSystem ? PathwayService.confirm(a.applicationId, draft, reason, chosen.target) : PathwayService.change(a.applicationId, draft, chosen.status, chosen.target, reason)));
  };
  const pick = (d: typeof dest) => {
    setDest(d);
    setReason("");
  };
  const title = dest && dest !== "OTHER" && dest !== "INFO" ? DESTS.find((x) => x.code === dest)!.title[lang] : dest === "OTHER" ? tx("অন্য সেবা", "another service") : "";

  return (
    <>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        {tx("সিস্টেম পথ চূড়ান্ত করে না। কেস কোথায় যাবে তা আপনি বেছে নিন — আপনার পরিচয়, সময় ও কারণ রেকর্ড হবে।", "The system never finalises the pathway. You choose where the case goes — your identity, time and reason are recorded.")}
      </p>
      <p style={{ margin: "0 0 var(--s-3)" }}>
        <span className={ui.suggestBadge}>{tx("সিস্টেমের প্রস্তাব", "SYSTEM SUGGESTION")}</span> {statusLabel(system, lang)}
        {suggested ? ` → ${DESTS.find((x) => x.code === suggested)!.title[lang]}` : system === "REQUIRES_OFFICER_REVIEW" ? ` — ${tx("নিয়মে মেলেনি, আপনি বেছে নিন", "no rule fits, you choose")}` : ` — ${tx("তিনটি পথের বাইরে", "outside the three pathways")}`}
      </p>

      <div className={ui.sectionHead} style={{ marginBottom: 8 }}>
        {tx("কেসটি কোথায় যাবে?", "Send the case to")}
      </div>
      <div role="radiogroup" aria-label={tx("কেসটি কোথায় যাবে", "Send the case to")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: "var(--s-3)" }}>
        {DESTS.map((d) => {
          const on = dest === d.code;
          return (
            <button key={d.code} type="button" role="radio" aria-checked={on} onClick={() => pick(d.code)} className={ui.option} style={{ alignItems: "flex-start", textAlign: "left", padding: "14px 16px", borderWidth: on ? 2 : 1, borderColor: on ? "var(--ink)" : undefined, background: on ? "var(--white)" : undefined, boxShadow: on ? "0 2px 10px rgba(0,0,0,0.08)" : undefined }}>
              <span style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 26 }} aria-hidden>
                  {d.icon}
                </span>
                {suggested === d.code ? <span className={ui.suggestBadge}>{tx("প্রস্তাবিত", "SUGGESTED")}</span> : null}
              </span>
              <span className={ui.optionTitle} style={{ fontSize: "1.05rem", marginTop: 6 }}>
                {on ? "● " : "○ "}
                {d.title[lang]}
              </span>
              <span className={ui.optionText}>{d.text[lang]}</span>
              <span className={ui.optionText} style={{ marginTop: 6, fontWeight: 600 }}>
                {d.next[lang]}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: "var(--s-3)", fontSize: "var(--t-small)" }}>
        <button type="button" onClick={() => pick(dest === "INFO" ? null : "INFO")} aria-pressed={dest === "INFO"} style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer", font: "inherit", fontWeight: dest === "INFO" ? 700 : 400 }}>
          ? {tx("সিদ্ধান্তের আগে আরও তথ্য চাই", "Request more information before deciding")}
        </button>
        <button type="button" onClick={() => pick(dest === "OTHER" ? null : "OTHER")} aria-pressed={dest === "OTHER"} style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer", font: "inherit", color: "var(--dlo-muted)", fontWeight: dest === "OTHER" ? 700 : 400 }}>
          {tx("অন্য সেবায় রেফার (পুলিশ, ওসিসি, শ্রম, সমাজসেবা)", "Refer to another service (police, OCC, labour, social services)")}
        </button>
      </div>

      {dest === "MEDIATION" ? (
        <div style={{ marginBottom: "var(--s-3)" }}>
          <span className={styles.label}>{tx("মধ্যস্থতার ধরন", "Type of mediation")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {MEDIATION_KINDS.map((k) => (
              <label key={k} className={styles.check} style={{ border: `1px solid ${kind === k ? "var(--ink)" : "var(--line)"}`, borderRadius: 8, padding: "6px 10px" }}>
                <input type="radio" name="mediation-kind" checked={kind === k} onChange={() => setKind(k)} />
                <span>
                  {statusLabel(k, lang)}
                  {k === system ? ` · ${tx("প্রস্তাবিত", "suggested")}` : ""}
                </span>
              </label>
            ))}
          </div>
          {violence ? (
            <p style={{ color: "var(--red)", margin: "8px 0 0" }}>
              ! {tx("জরুরি/সহিংসতার সংকেত আছে — অপর পক্ষের সাথে মধ্যস্থতা আবেদনকারীর জন্য অনিরাপদ হতে পারে। কারণে নিরাপত্তা বিবেচনা লিখুন।", "Urgency / violence signals on record — mediation with the other party may be unsafe. Record your safety reasoning.")}
            </p>
          ) : null}
        </div>
      ) : null}

      {dest === "OTHER" ? (
        <label className={styles.field} style={{ maxWidth: 360, marginBottom: "var(--s-3)" }}>
          <span className={styles.label}>{tx("কোথায় রেফার", "Refer to")}</span>
          <select className={styles.select} value={other ?? ""} onChange={(e) => setOther((e.target.value || null) as ReferralTarget | null)}>
            <option value="">{tx("— বেছে নিন —", "— choose —")}</option>
            {REFERRAL_TARGETS.filter((t) => t.code !== "GRAM_ADALAT").map((t) => (
              <option key={t.code} value={t.code}>
                {t.label[lang]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {dest ? (
        <>
          <label className={styles.field}>
            <span className={styles.label}>
              {dest === "INFO" ? tx("কী তথ্য দরকার (কমপক্ষে ১০ অক্ষর)", "What information is needed (at least 10 characters)") : followsSystem ? tx("কারণ — সিস্টেমের প্রস্তাব নিশ্চিত করছেন (কমপক্ষে ১০ অক্ষর)", "Reason — you are confirming the system's suggestion (at least 10 characters)") : tx("কারণ — সিস্টেমের প্রস্তাব থেকে ভিন্ন (কমপক্ষে ১০ অক্ষর)", "Reason — you are choosing differently from the system (at least 10 characters)")}
            </span>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {dest === "INFO" ? (
            <label className={styles.check} style={{ marginTop: 8 }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>{tx("আবেদনকারীকে নিরাপদ এসএমএস পাঠান (সিমুলেটেড)", "Tell the applicant by safe SMS (simulated)")}</span>
            </label>
          ) : null}
          <div className={ui.bar}>
            {dest === "INFO" ? (
              <Button variant="secondary" disabled={reason.trim().length < 10} onClick={() => run(() => void PathwayService.requestInfo(a.applicationId, draft, reason, notify))}>
                {tx("তথ্য চান ও কাজ খুলুন", "Request information & open task")}
              </Button>
            ) : (
              <Button disabled={!chosen || reason.trim().length < 10} onClick={send}>
                {tx(`${title}-এ পাঠান →`, `Send to ${title} →`)}
              </Button>
            )}
            <span className={styles.hint}>{reason.trim().length}/10</span>
            {chosen && dest !== "INFO" ? <span className={styles.hint}>{followsSystem ? tx("রেকর্ড: প্রস্তাব নিশ্চিত", "Recorded as: suggestion confirmed") : tx("রেকর্ড: কর্মকর্তা পরিবর্তন করেছেন", "Recorded as: changed by the officer")}</span> : null}
          </div>
        </>
      ) : null}
    </>
  );
}


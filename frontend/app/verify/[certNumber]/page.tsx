"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import styles from "../verify.module.css";

/**
 * Public, no-auth, no-login verification page.
 * ---------------------------------------------------------
 * URL: /verify/<certificateNumber>
 *
 * Always renders a hardcoded demo certificate (MNT-001 —
 * maintenance happy path) regardless of the URL param. The
 * `certNumber` is shown back to the user as proof that the
 * URL is read.
 *
 * The "Verify" button recomputes SHA-256 hashes of every
 * clause body from the canonical text (Bn + En joined with a
 * NUL separator) and compares against the recorded hashes.
 *
 * A small tamper toggle lets the visitor flip one clause to
 * see how the verifier reports a mismatch. Pressing "Reset
 * demo" restores the original.
 */

type Party = {
  role: "applicant" | "respondent" | "mediator";
  name: string;
  selfSigHash: string;
  signedAt: string;
  offline: boolean;
};

type Clause = {
  id: string;
  indexLabel: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  recordedHash: string;
};

type LegalBasis = {
  id: string;
  actNameBn: string;
  actNameEn: string;
  section: string;
  excerptBn: string;
  excerptEn: string;
};

const CERT = {
  certificateNumber: "SH-CERT-2026-00042",
  certifiedBy: {
    nameBn: "নাসরিন আখতার",
    nameEn: "Nasrin Akhter",
    roleBn: "প্রধান জেলা আইনি সহায়তা কর্মকর্তা",
    roleEn: "Chief Legal Aid Officer",
  },
  matterId: "MNT-001",
  category: "maintenance" as const,
  frozenAt: "2026-09-22T11:34:17Z",
  policyVersion: "T7-v0.4.2",
};

const PARTIES: Party[] = [
  {
    role: "applicant",
    name: "ফাতেমা বেগম / Fatema Begum",
    selfSigHash: "7d38c4a1f9e02b3e8a6b51d2c4e9f08a1234abcd5678ef90123456789abcdef01",
    signedAt: "2026-09-22T11:30:42Z",
    offline: false,
  },
  {
    role: "respondent",
    name: "মোঃ আবদুল্লাহ / Md. Abdullah",
    selfSigHash: "4a2e91b6dcff3c7e1b09a23456789abcdef0123456789abcdef0123456789ab",
    signedAt: "2026-09-22T11:31:58Z",
    offline: false,
  },
  {
    role: "mediator",
    name: "আনিসুর রহমান / Anisur Rahman",
    selfSigHash: "cb1f55d2a8e07f9c3b4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b",
    signedAt: "2026-09-22T11:34:09Z",
    offline: false,
  },
];

const CLAUSES: Clause[] = [
  {
    id: "CLAUSE-01",
    indexLabel: "01",
    titleBn: "পক্ষসমূহের পরিচিতি",
    titleEn: "Identification of the parties",
    bodyBn:
      "পক্ষ ১: ফাতেমা বেগম, স্বামী: মোঃ আবদুল্লাহ, ঠিকানা: গ্রাম: পশ্চিম পাড়া, ডাকঘর: শ্যামপুর, উপজেলা: সদর, জেলা: জয়পুরহাট।\nপক্ষ ২: মোঃ আবদুল্লাহ, পিতা: মোঃ হাসান আলী, ঠিকানা: একই।",
    bodyEn:
      "Party 1: Fatema Begum, husband: Md. Abdullah, address: Village: Paschim Para, PO: Shyampur, Upazila: Sadar, District: Joypurhat.\nParty 2: Md. Abdullah, father: Md. Hasan Ali, address: same.",
    recordedHash: "5e8f1c7a3b2d4e6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
  },
  {
    id: "CLAUSE-02",
    indexLabel: "02",
    titleBn: "বিবাদের সারসংক্ষেপ",
    titleEn: "Recital of the dispute",
    bodyBn:
      "পক্ষ ২ গত ১৪ (চৌদ্দ) মাস যাবৎ পক্ষ ১ এবং তাদের দুই নাবালক সন্তানের ভরণপোষণ প্রদান করা হতে বিরত থেকেছেন। পক্ষ ২ এর মাসিক আয় আনুমানিক ৳২৫,০০০।",
    bodyEn:
      "Party 2 has, for the past 14 (fourteen) months, refrained from providing maintenance to Party 1 and their two minor children. Party 2's monthly income is approximately BDT 25,000.",
    recordedHash: "8a2c9f4d6e1b3c5a7f9d0e2b4c6a8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2",
  },
  {
    id: "CLAUSE-03",
    indexLabel: "03",
    titleBn: "মাসিক ভরণপোষণের অংক",
    titleEn: "Monthly maintenance quantum",
    bodyBn:
      "পক্ষ ২ প্রতি মাসে পক্ষ ১ ও দুই সন্তানের জন্য সর্বমোট ৳৮,০০০ (আট হাজার) টাকা প্রদান করবেন।",
    bodyEn:
      "Party 2 shall pay Party 1 a total of BDT 8,000 (eight thousand) per month for the support of Party 1 and the two children.",
    recordedHash: "1f3b5d7e9a2c4e6f8b0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2a",
  },
  {
    id: "CLAUSE-04",
    indexLabel: "04",
    titleBn: "প্রথম পরিশোধের তারিখ",
    titleEn: "First payment date",
    bodyBn:
      "প্রথম কিস্তি ০৫ অক্টোবর ২০২৬ তারিখে প্রদেয়। পরবর্তী কিস্তিগুলো প্রতি মাসের ০৫ (পাঁচ) তারিখে প্রদেয়।",
    bodyEn:
      "The first instalment shall be due on 05 October 2026. Subsequent instalments shall be due on the 5th (fifth) day of each month.",
    recordedHash: "2b4d6f8a0c2e4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f",
  },
  {
    id: "CLAUSE-05",
    indexLabel: "05",
    titleBn: "বার্ষিক বৃদ্ধি",
    titleEn: "Annual escalation",
    bodyBn:
      "ভরণপোষণের অংক প্রতি বছর ১ জানুয়ারি তারিখে ৫% (পাঁচ শতাংশ) হারে বৃদ্ধি পাবে, স্বয়ংক্রিয়ভাবে।",
    bodyEn:
      "The maintenance quantum shall automatically increase by 5% (five percent) on 1 January each year.",
    recordedHash: "3c5e7a9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5",
  },
  {
    id: "CLAUSE-06",
    indexLabel: "06",
    titleBn: "ডিফল্ট প্রতিকার",
    titleEn: "Default remedy",
    bodyBn:
      "পক্ষ ২ কোনো মাসে নির্ধারিত তারিখের মধ্যে পরিশোধ না করলে, অবশিষ্ট পাওনা ১২% সুদসহ আদায়যোগ্য হবে এবং পক্ষ ১ জেলা আইনি সহায়তা কার্যালয়ে অভিযোগ দায়ের করতে পারবেন।",
    bodyEn:
      "Should Party 2 fail to pay by the due date in any month, the outstanding amount shall be recoverable with interest at 12%, and Party 1 may lodge a complaint with the District Legal Aid Office.",
    recordedHash: "4d6f8b0c2e4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a6c8e0d2f4a",
  },
  {
    id: "CLAUSE-07",
    indexLabel: "07",
    titleBn: "এখতিয়ার",
    titleEn: "Jurisdiction",
    bodyBn:
      "এই চুক্তির ব্যাখ্যা ও প্রয়োগ সংক্রান্ত যেকোনো বিরোধ জয়পুরহাট জেলা আদালতের এখতিয়ারাধীন।",
    bodyEn:
      "Any dispute concerning the interpretation or enforcement of this settlement shall fall within the jurisdiction of the District Court of Joypurhat.",
    recordedHash: "5e8f1c7a3b2d4e6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e2",
  },
];

const LEGAL_BASIS: LegalBasis[] = [
  {
    id: "LBR-002",
    actNameBn: "আইনি সহায়তা সেবা আইন ২০২৬",
    actNameEn: "Legal Aid Services Act 2026",
    section: "§12, §15",
    excerptBn: "…মধ্যস্থতার মাধ্যমে নিষ্পত্তিকৃত বিরোধ আইনগতভাবে স্বীকৃত…",
    excerptEn: "…disputes resolved through mediation shall be legally recognised…",
  },
  {
    id: "LBR-004",
    actNameBn: "পারিবারিক আদালত অধ্যাদেশ ১৯৮৫",
    actNameEn: "Family Courts Ordinance 1985",
    section: "§13",
    excerptBn: "…পারিবারিক বিরোধে ভরণপোষণ নির্ধারণ…",
    excerptEn: "…determination of maintenance in family disputes…",
  },
  {
    id: "LBR-005",
    actNameBn: "মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১",
    actNameEn: "Muslim Family Laws Ordinance 1961",
    section: "§9",
    excerptBn: "…স্বামী কর্তৃক স্ত্রী ও সন্তানের ভরণপোষণ বাধ্যতামূলক…",
    excerptEn: "…maintenance of wife and children by husband is obligatory…",
  },
];

// -- helpers ---------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * E-signature simulation.
 *
 * Generates an ECDSA P-256 keypair in the browser, signs the canonical
 * document text (which is also what the recorded document hash is computed
 * from), then verifies the signature against the public key. The whole
 * thing runs client-side via Web Crypto — no network, no third party.
 *
 * The result is purely demonstrative: it shows the visitor how a real
 * digital signature would be created and checked against the certificate
 * they are looking at.
 */
type EsigState = {
  publicKeyJwk: JsonWebKey;
  signatureHex: string;
  documentHashHex: string;
  valid: boolean;
  algorithm: "ECDSA-P256-SHA256";
};

async function simulateEsign(
  documentText: string,
): Promise<EsigState> {
  // 1. Generate an ECDSA P-256 keypair.
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable so we can export the public key as JWK
    ["sign", "verify"],
  );

  // 2. Hash the canonical document text (SHA-256), then sign that hash.
  const docHashBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(documentText),
  );
  const signatureBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    docHashBuf,
  );

  // 3. Verify the signature against the same hash + public key.
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.publicKey,
    signatureBuf,
    docHashBuf,
  );

  // 4. Export the public key as JWK so the visitor can see it.
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  return {
    publicKeyJwk,
    signatureHex: bufToHex(signatureBuf),
    documentHashHex: bufToHex(docHashBuf),
    valid,
    algorithm: "ECDSA-P256-SHA256",
  };
}

/**
 * Canonical clause text — must match the production T7 contract.
 * Title and body are joined with U+0001 SOH so collisions cannot be
 * manufactured by trimming newlines or spaces.
 */
function canonicalClauseText(c: { titleBn: string; titleEn: string; bodyBn: string; bodyEn: string }): string {
  return [c.titleBn, c.titleEn, c.bodyBn, c.bodyEn].join("\u0001");
}

function canonicalDocumentText(clauses: Clause[]): string {
  return clauses
    .map((c) => canonicalClauseText(c))
    .join("\u0002"); // STX separator between clauses
}

// -- page ------------------------------------------------------------------

export default function VerifierPage({
  params,
}: {
  params: Promise<{ certNumber: string }>;
}) {
  // Next.js 15+: `params` is a Promise — must be unwrapped with React.use().
  const { certNumber } = use(params);
  const { lang, setLang, t } = useI18n();

  // Mutable copy of clauses for the tamper demo. Reset button restores.
  const [tamperedClauses, setTamperedClauses] = useState<Clause[]>(CLAUSES);
  const tamperedRef = useMemo(() => tamperedClauses, [tamperedClauses]);

  const [verifyState, setVerifyState] = useState<"idle" | "running" | "ok" | "fail">(
    "idle",
  );
  const [mismatchedClauseIds, setMismatchedClauseIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [docHashHex, setDocHashHex] = useState<string | null>(null);

  // E-signature simulation state.
  const [esigState, setEsigState] = useState<"idle" | "running" | "done">(
    "idle",
  );
  const [esig, setEsig] = useState<EsigState | null>(null);

  // Recompute document hash whenever clauses change.
  useEffect(() => {
    let cancelled = false;
    sha256Hex(canonicalDocumentText(tamperedRef)).then((h) => {
      if (!cancelled) setDocHashHex(h);
    });
    return () => {
      cancelled = true;
    };
  }, [tamperedRef]);

  async function handleVerify() {
    setVerifyState("running");
    setMismatchedClauseIds([]);
    // Tiny artificial pause so the running state is visible.
    await new Promise((r) => setTimeout(r, 350));
    const mismatches: string[] = [];
    for (const c of tamperedClauses) {
      const recomputed = await sha256Hex(canonicalClauseText(c));
      if (recomputed !== c.recordedHash) {
        mismatches.push(c.id);
      }
    }
    setMismatchedClauseIds(mismatches);
    setVerifyState(mismatches.length === 0 ? "ok" : "fail");
  }

  function handleTamperOne() {
    // Flip bodyBn on clause 5 (the one with '5%' annual escalation).
    setTamperedClauses((prev) =>
      prev.map((c) =>
        c.id === "CLAUSE-05"
          ? {
              ...c,
              bodyBn: c.bodyBn.replace("৫%", "৮%"),
              bodyEn: c.bodyEn.replace("5%", "8%"),
            }
          : c,
      ),
    );
    setVerifyState("idle");
    setMismatchedClauseIds([]);
  }

  function handleReset() {
    setTamperedClauses(CLAUSES);
    setVerifyState("idle");
    setMismatchedClauseIds([]);
  }

  async function handleCopyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available; do nothing — leave button as-is.
    }
  }

  async function handleSimulateEsign() {
    setEsigState("running");
    // Tiny artificial pause so the running state is visible.
    await new Promise((r) => setTimeout(r, 250));
    const result = await simulateEsign(canonicalDocumentText(tamperedRef));
    setEsig(result);
    setEsigState("done");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Shakkho">
          <span className={styles.brandEyebrow}>সাক্ষ্য</span>
          <span>{lang === "bn" ? "সাক্ষ্য" : "Shakkho"}</span>
        </Link>
        <div className={styles.langRow}>
          <button
            type="button"
            onClick={() => setLang("bn")}
            className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}
            aria-pressed={lang === "bn"}
          >
            বাংলা
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}
            aria-pressed={lang === "en"}
          >
            English
          </button>
        </div>
      </header>

      <div className={styles.banner} role="status">
        <strong>{t("verifierBanner")}</strong>
        <span>{t("verifierBannerSub")}</span>
      </div>

      <main className={styles.main} id="verifier-main">
        <section className={styles.header}>
          <span className={styles.eyebrow}>{t("verifierEyebrow")}</span>
          <h1 className={styles.title}>{t("verifierTitle")}</h1>
          <p className={styles.intro}>{t("verifierIntro")}</p>
        </section>

        {/* Certificate metadata ----------------------------------------- */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{CERT.certificateNumber}</h2>
            <span className={`${styles.statusPill} ${styles.statusPillIdle}`}>
              <span className={`${styles.badge} ${styles.badgeProto}`}>
                {t("verifierAssuranceBadgeProto")}
              </span>
            </span>
          </div>
          <div className={styles.card}>
            <div className={styles.kvGrid}>
              <div className={styles.kvLabel}>{t("verifierCertNumber")}</div>
              <div className={styles.kvValueMono}>{certNumber}</div>

              <div className={styles.kvLabel}>{t("verifierCertifiedBy")}</div>
              <div className={styles.kvValue}>
                {lang === "bn"
                  ? `${CERT.certifiedBy.nameBn} · ${CERT.certifiedBy.roleBn}`
                  : `${CERT.certifiedBy.nameEn} · ${CERT.certifiedBy.roleEn}`}
              </div>

              <div className={styles.kvLabel}>{t("verifierMatter")}</div>
              <div className={styles.kvValue}>{CERT.matterId}</div>

              <div className={styles.kvLabel}>{t("verifierCategory")}</div>
              <div className={styles.kvValue}>
                {CERT.category === "maintenance"
                  ? t("verifierCatMaintenance")
                  : CERT.category === "property"
                    ? t("verifierCatProperty")
                    : t("verifierCatLabour")}
              </div>

              <div className={styles.kvLabel}>{t("verifierFrozenAt")}</div>
              <div className={styles.kvValueMono}>{CERT.frozenAt}</div>

              <div className={styles.kvLabel}>{t("verifierPolicyVersion")}</div>
              <div className={styles.kvValueMono}>{CERT.policyVersion}</div>

              <div className={styles.kvLabel}>{t("verifierDocumentHash")}</div>
              <div className={styles.kvValueMono}>
                {docHashHex ?? "—"}
                <div className={styles.tamperHint} style={{ marginTop: "var(--s-1)" }}>
                  {t("verifierDocumentHashExplain")}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Parties ------------------------------------------------------- */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("verifierPartiesHeading")}</h2>
            <span className={styles.sectionSub}>{PARTIES.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.partiesTable}>
              <thead>
                <tr>
                  <th>{t("verifierPartyRole")}</th>
                  <th>{t("verifierPartyName")}</th>
                  <th>{t("verifierPartySelfSig")}</th>
                  <th>{t("verifierPartySignedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {PARTIES.map((p) => {
                  const roleLabel =
                    p.role === "applicant"
                      ? t("verifierRoleApplicant")
                      : p.role === "respondent"
                        ? t("verifierRoleRespondent")
                        : t("verifierRoleMediator");
                  return (
                    <tr key={p.role}>
                      <td>
                        {roleLabel}
                        <div style={{ marginTop: "var(--s-1)" }}>
                          <span
                            className={`${styles.badge} ${
                              p.offline ? styles.badgeOffline : styles.badgeOnline
                            }`}
                          >
                            {p.offline ? t("verifierPartyOffline") : t("verifierPartyOnline")}
                          </span>
                        </div>
                      </td>
                      <td>{p.name}</td>
                      <td className="hash">{p.selfSigHash}</td>
                      <td className="hash">{p.signedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Clauses ------------------------------------------------------- */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("verifierClausesHeading")}</h2>
            <span className={styles.sectionSub}>{tamperedClauses.length}</span>
          </div>
          <ul className={styles.clauseList}>
            {tamperedClauses.map((c) => {
              const isMismatched = mismatchedClauseIds.includes(c.id);
              const itemClass = isMismatched
                ? styles.clauseItemTampered
                : verifyState === "ok"
                  ? styles.clauseItemOk
                  : styles.clauseItemUnknown;
              const pillClass = isMismatched
                ? styles.statusPillFail
                : verifyState === "ok"
                  ? styles.statusPillOk
                  : styles.statusPillIdle;
              const pillLabel = isMismatched
                ? t("verifierVerifyFail")
                : verifyState === "ok"
                  ? t("verifierVerifyOk")
                  : t("verifierVerifyIdle");
              return (
                <li key={c.id} className={`${styles.clauseItem} ${itemClass}`}>
                  <div className={styles.clauseHead}>
                    <span className={styles.clauseIndex}>
                      {c.id} · {c.indexLabel}
                    </span>
                    <span className={`${styles.statusPill} ${pillClass}`}>{pillLabel}</span>
                  </div>
                  <div className={styles.clauseTitleBn}>{c.titleBn}</div>
                  <div className={styles.clauseTitleEn}>{c.titleEn}</div>
                  <div className={styles.clauseBody}>
                    <div className={styles.clauseBodyBn}>{c.bodyBn}</div>
                    <div className={styles.clauseBodyEn}>{c.bodyEn}</div>
                  </div>
                  <div className={styles.clauseFoot}>
                    <span className={styles.clauseHashLabel}>
                      {t("verifierDocumentHash")}
                    </span>
                    <span className={styles.clauseHash}>{c.recordedHash}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Legal basis --------------------------------------------------- */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("verifierLegalBasisHeading")}</h2>
            <span className={styles.sectionSub}>{LEGAL_BASIS.length}</span>
          </div>
          <div className={styles.card}>
            <ul className={styles.legalList}>
              {LEGAL_BASIS.map((lb) => (
                <li key={lb.id} className={styles.legalItem}>
                  <span className={styles.legalId}>{lb.id}</span>
                  <span>
                    <span className={styles.legalAct}>
                      {lang === "bn" ? lb.actNameBn : lb.actNameEn}
                    </span>
                    <div className={styles.legalActEn}>
                      &ldquo;{lang === "bn" ? lb.excerptBn : lb.excerptEn}&rdquo;
                    </div>
                  </span>
                  <span className={styles.legalSection}>{lb.section}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Verify action ------------------------------------------------- */}
        <section className={styles.section}>
          <div
            className={`${styles.verifyResult} ${
              verifyState === "ok"
                ? styles.verifyResultOk
                : verifyState === "fail"
                  ? styles.verifyResultFail
                  : styles.verifyResultIdle
            }`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {verifyState === "running"
                ? t("verifierVerifyRunning")
                : verifyState === "ok"
                  ? t("verifierVerifyOk")
                  : verifyState === "fail"
                    ? t("verifierVerifyFail")
                    : t("verifierVerifyIdle")}
            </strong>
            <span className={styles.verifyResultSmall}>
              {t("verifierVerifyTamperedHint")}
            </span>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={handleVerify}>
              {t("verifierVerifyAction")}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleTamperOne}
            >
              {lang === "bn" ? "১টি ধারা পরিবর্তন করে দেখুন" : "Try tampering with one clause"}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={handleReset}
            >
              {t("verifierResetTamper")}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={handleCopyLink}
            >
              {copied ? t("verifierCopied") : t("verifierCopyLink")}
            </button>
          </div>
          <div className={styles.tamperHint}>
            {t("verifierAssuranceBadgeExplain")}
          </div>
        </section>

        {/* E-signature simulation --------------------------------------- */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {lang === "bn" ? "ই-স্বাক্ষর সিমুলেশন" : "E-signature simulation"}
            </h2>
            <span
              className={`${styles.statusPill} ${
                esigState === "done"
                  ? esig?.valid
                    ? styles.statusPillOk
                    : styles.statusPillFail
                  : styles.statusPillIdle
              }`}
            >
              {esigState === "running"
                ? lang === "bn"
                  ? "চলছে…"
                  : "Running…"
                : esigState === "done"
                  ? esig?.valid
                    ? lang === "bn"
                      ? "বৈধ"
                      : "Valid"
                    : lang === "bn"
                      ? "অবৈধ"
                      : "Invalid"
                  : lang === "bn"
                    ? "প্রস্তুত"
                    : "Idle"}
            </span>
          </div>

          <div className={styles.card}>
            <p className={styles.intro}>
              {lang === "bn"
                ? "ব্রাউজারে একটি নতুন ECDSA P-256 কী-জোড় তৈরি হবে, ক্যানোনিক্যাল নথির টেক্সট স্বাক্ষরিত হবে এবং স্বাক্ষরটি পুনরায় যাচাই করা হবে — সম্পূর্ণ অফলাইনে।"
                : "A fresh ECDSA P-256 keypair is generated in your browser, the canonical document text is signed, and the signature is verified — fully offline."}
            </p>

            <div className={styles.actions} style={{ marginTop: "var(--s-3)" }}>
              <button
                type="button"
                className={styles.btn}
                onClick={handleSimulateEsign}
                disabled={esigState === "running"}
              >
                {esigState === "running"
                  ? lang === "bn"
                    ? "স্বাক্ষর করা হচ্ছে…"
                    : "Signing…"
                  : lang === "bn"
                    ? "ই-স্বাক্ষর সিমুলেট করুন"
                    : "Simulate e-signature"}
              </button>
            </div>

            {esig && (
              <div className={styles.kvGrid} style={{ marginTop: "var(--s-4)" }}>
                <div className={styles.kvLabel}>
                  {lang === "bn" ? "অ্যালগরিদম" : "Algorithm"}
                </div>
                <div className={styles.kvValueMono}>{esig.algorithm}</div>

                <div className={styles.kvLabel}>
                  {lang === "bn" ? "নথির হ্যাশ (SHA-256)" : "Document hash (SHA-256)"}
                </div>
                <div className={styles.kvValueMono}>{esig.documentHashHex}</div>

                <div className={styles.kvLabel}>
                  {lang === "bn" ? "স্বাক্ষর (স্বাক্ষরিত ডের)" : "Signature (signed DER)"}
                </div>
                <div className={styles.kvValueMono}>{esig.signatureHex}</div>

                <div className={styles.kvLabel}>
                  {lang === "bn" ? "পাবলিক কী (JWK)" : "Public key (JWK)"}
                </div>
                <div className={styles.kvValueMono} style={{ wordBreak: "break-all" }}>
                  {JSON.stringify(esig.publicKeyJwk)}
                </div>

                <div className={styles.kvLabel}>
                  {lang === "bn" ? "যাচাই ফলাফল" : "Verification result"}
                </div>
                <div className={styles.kvValue}>
                  {esig.valid ? (
                    <span
                      className={`${styles.badge} ${styles.badgeOnline}`}
                    >
                      {lang === "bn"
                        ? "✓ স্বাক্ষর বৈধ"
                        : "✓ Signature valid"}
                    </span>
                  ) : (
                    <span
                      className={`${styles.badge} ${styles.badgeOffline}`}
                    >
                      {lang === "bn"
                        ? "✗ স্বাক্ষর অবৈধ"
                        : "✗ Signature invalid"}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className={styles.tamperHint} style={{ marginTop: "var(--s-3)" }}>
              {lang === "bn"
                ? "দ্রষ্টব্য: এটি একটি ডেমো সিমুলেশন। প্রতিটি ক্লিকে একটি নতুন কী-জোড় তৈরি হয় এবং পূর্ববর্তী স্বাক্ষর আর বৈধ থাকে না — এটিই প্রমাণ করে যে কীটি সত্যিই কাজ করছে।"
                : "Note: this is a demo simulation. Each click generates a new keypair, so the previous signature is no longer valid — which is itself proof the key machinery works."}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>{t("verifierFooter")}</div>
        <div className={styles.footerLinks}>
          <Link href="/">{t("verifierShakkhoBranding")}</Link>
          <span aria-hidden="true">·</span>
          <span>{certNumber}</span>
        </div>
      </footer>
    </div>
  );
}

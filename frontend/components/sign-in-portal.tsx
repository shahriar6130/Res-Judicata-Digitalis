"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./sign-in-portal.module.css";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { LanguageToggle } from "@/components/language-toggle";
import { LawMark } from "@/components/law-mark";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import { PORTAL_ART } from "@/lib/portal-art";
import type { Role } from "@/lib/roles";
import { CitizenAuth, DISTRICTS, DlaoAuth, LawyerAuth, MATTERS, MEDIATION_CASE_TYPES, MediatorAuth, UdcAuth, type MatterCategory, type MediationCaseType } from "@/lib/dlas";

/* ------------------------------------------------------------------ *
 *  Rotated vertical role label that sits near the bottom-right of the
 *  left image panel. One short word per portal — the same word that
 *  used to live in the black "CITIZEN" badge above the Sign in heading
 *  now reads as a quiet editorial caption on the photograph.
 *
 *  The word is rendered as a single span (not character-stacked) and
 *  rotated -90deg, so visually the letters read from top to bottom as
 *  the reverse of the source word:
 *
 *      CITIZEN → N E Z I T I C
 *      DLO     → O L D
 *      LAWYER  → R E Y W A L
 *
 *  This matches the brief: do not stack the letters, just rotate the
 *  word as one element.
 * ------------------------------------------------------------------ */
function rotatedLabelFor(roleId: Role["id"]): { en: string; bn: string } {
  switch (roleId) {
    case "citizen":
      return { en: "CITIZEN", bn: "নাগরিক" };
    case "dlo":
      return { en: "DLO", bn: "ডিএলও" };
    case "mediator":
      return { en: "LALO", bn: "এলএএলও" };
    case "udc":
      return { en: "UDC", bn: "ইউডিসি" };
    case "lawyer":
      return { en: "LAWYER", bn: "আইনজীবী" };
    case "helpline":
      return { en: "16699", bn: "১৬৬৯৯" };
    case "receiving-authority":
      return { en: "AUTHORITY", bn: "কর্তৃপক্ষ" };
    case "case-support":
      return { en: "CASE SUPPORT", bn: "মামলা সহায়তা" };
    case "supervisor":
      return { en: "SUPERVISOR", bn: "তত্ত্বাবধায়ক" };
    case "finance":
      return { en: "FINANCE", bn: "অর্থ" };
    case "appeal":
      return { en: "APPEAL", bn: "আপিল" };
    case "committee":
      return { en: "COMMITTEE", bn: "কমিটি" };
    case "auditor":
      return { en: "AUDITOR", bn: "নিরীক্ষক" };
    case "admin":
      return { en: "ADMIN", bn: "প্রশাসক" };
  }
}

type SignInPortalProps = {
  role: Role;
};

export function SignInPortal({ role }: SignInPortalProps) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const art = PORTAL_ART[role.id] ?? PORTAL_ART.citizen;
  const isDlo = role.id === "dlo";
  const isLawyer = role.id === "lawyer";
  const isUdc = role.id === "udc";
  const isMediator = role.id === "mediator";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim()) {
      setError(t("errorIdentifier"));
      return;
    }
    if (!password) {
      setError(t("errorPassword"));
      return;
    }
    setError(null);
    setPending(true);
    try {
      router.push(role.home);
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.location.assign(role.home);
    }
  }

  return (
    <main
      className={[
        styles.page,
        art.side === "right" ? styles.pageArtRight : "",
        role.id === "citizen" ? styles.pageCitizen : "",
        role.id === "dlo" ? styles.pageDlo : "",
        role.id === "lawyer" ? styles.pageLawyer : "",
        isUdc ? styles.pageUdc : "",
        role.id === "admin" ? styles.pageAdmin : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.art}>
        <div className={styles.artTop}>
          <Wordmark variant="onDark" />
          <LanguageToggle onDark />
        </div>
        <LawMark image={art.image} />
        <RotatedRoleLabel role={role} lang={lang} />
        {isDlo || isLawyer || isUdc ? (
          <div className={styles.artCaption}>
            <span>{isUdc ? (lang === "bn" ? "কমিউনিটি সেবা" : "COMMUNITY SERVICE") : isDlo ? (lang === "bn" ? "অফিসের পর্যালোচনা" : "OFFICE REVIEW") : (lang === "bn" ? "মামলার প্রতিনিধিত্ব" : "CASE REPRESENTATION")}</span>
            <strong>{isUdc ? (lang === "bn" ? "মানুষের পাশে, প্রতিটি ধাপে" : "Helping people at every step") : isDlo ? (lang === "bn" ? "যাচাই থেকে সিদ্ধান্ত" : "From review to decision") : (lang === "bn" ? "নিয়োগ থেকে শুনানি" : "From assignment to hearing")}</strong>
          </div>
        ) : null}
      </div>

      <section className={styles.panel}>
        <div className={styles.shell}>
          <div className={styles.header}>
            {isDlo || isLawyer || isUdc ? <p className={styles.roleIdentity}>
              <span className={styles.roleIdentityDot} aria-hidden="true" />
              {isUdc ? (lang === "bn" ? "ইউনিয়ন ডিজিটাল সেন্টার" : "UNION DIGITAL CENTRE") : isDlo ? (lang === "bn" ? "জেলা লিগ্যাল এইড অফিস" : "DISTRICT LEGAL AID OFFICE") : (lang === "bn" ? "প্যানেল আইনজীবী" : "PANEL LAWYER")}
            </p> : null}
            <h1 className={styles.title}>{isUdc ? (lang === "bn" ? "উদ্যোক্তা প্রবেশ" : "UDC operator access") : isDlo ? (lang === "bn" ? "কর্মকর্তা প্রবেশ" : "Officer access") : isLawyer ? (lang === "bn" ? "আইনজীবী প্রবেশ" : "Lawyer access") : isMediator ? (lang === "bn" ? "মধ্যস্থতাকারী প্রবেশ" : "Mediator access") : t("signInTitle")}</h1>
            <p className={styles.supporting}>{isUdc ? (lang === "bn" ? "সহায়তাপ্রাপ্ত আবেদন শুরু করুন, চলমান খসড়া ও সিঙ্কের কাজ দেখুন।" : "Start assisted applications and manage your drafts and sync work.") : isDlo ? (lang === "bn" ? "আপনার অফিসের আবেদন যাচাই করুন এবং সিদ্ধান্ত নথিভুক্ত করুন।" : "Review your office applications and record decisions.") : isLawyer ? (lang === "bn" ? "নিয়োগপ্রাপ্ত মামলা ও শুনানির প্রতিবেদন পরিচালনা করুন।" : "Manage assigned cases and hearing reports.") : isMediator ? (lang === "bn" ? "লিগ্যাল এইড অফিসার আপনাকে যে মামলা নিয়োগ দেন, সেখানে মধ্যস্থতা পরিচালনা করুন।" : "Conduct mediation on the cases the Legal Aid Officer assigns to you.") : role.description[lang]}</p>
          </div>

          {role.id === "citizen" ? (
            <CitizenAuthForm home={role.home} />
          ) : role.id === "udc" ? (
            <UdcAuthForm home={role.home} />
          ) : role.id === "dlo" ? (
            <>
              <DlaoAuthForm home={role.home} />
              <p style={{ marginTop: 16, fontSize: 14 }}>
                <a href="/dlo-stuff">{lang === "bn" ? "অফিস স্টাফ? এখানে লগইন করুন →" : "Office staff? Log in here →"}</a>
              </p>
            </>
          ) : role.id === "lawyer" ? (
            <LawyerAuthForm home={role.home} />
          ) : role.id === "mediator" ? (
            <MediatorAuthForm home={role.home} />
          ) : (
          <form
            className={styles.form}
            onSubmit={handleSubmit}
            action={role.home}
            method="GET"
          >
            <Field
              id="identifier"
              label={t("mobileNumber")}
              name="identifier"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("mobilePlaceholder")}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />

            <Field
              id="password"
              label={t("passwordLabel")}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error ? (
              <p role="alert" className={styles.formError}>
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? t("signingIn") : t("signInAction")}
            </Button>
          </form>
          )}
        </div>

        <footer className={styles.footer}>{t("footer")}</footer>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ *
 *  Rotated vertical role label — sits inside the left `.art` panel
 *  near the bottom-right edge. Rendered as a single span rotated
 *  -90deg so the original word reads as its reverse vertically.
 *
 *  No background, no border, no container — it sits on the photograph
 *  as a quiet editorial caption. The vignette layer above it keeps
 *  the text legible without obscuring Lady Justice.
 * ------------------------------------------------------------------ */
function RotatedRoleLabel({
  role,
  lang,
}: {
  role: Role;
  lang: "bn" | "en";
}) {
  const label = rotatedLabelFor(role.id);
  return (
    <span
      className={styles.rotatedRole}
      aria-label={label[lang]}
      // The text itself is the rotated label — no separate screen
      // reader copy, no badge, no border, no background.
    >
      {label[lang]}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 *  Citizen: simple sign-up (name + mobile) and login (mobile only).
 *  Accounts live in the shared record store (lib/dlas/citizen-auth.ts).
 * ------------------------------------------------------------------ */
function CitizenAuthForm({ home }: { home: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);

  const messages: Record<string, string> = {
    INVALID_NAME: tx("আপনার নাম লিখুন।", "Enter your name."),
    INVALID_PHONE: tx("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন (01XXXXXXXXX)।", "Enter a valid 11-digit mobile number (01XXXXXXXXX)."),
    PHONE_TAKEN: tx("এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This number already has an account — log in instead."),
    NOT_FOUND: tx("এই নম্বরে কোনো অ্যাকাউন্ট নেই — সাইন আপ করুন।", "No account for this number — sign up first."),
  };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = mode === "login" ? CitizenAuth.login(phone) : CitizenAuth.signUp(name, phone);
    if (!r.ok) {
      setError(messages[r.error]);
      if (r.error === "PHONE_TAKEN") setMode("login");
      if (r.error === "NOT_FOUND") setMode("signup");
      return;
    }
    setError(null);
    setPending(true);
    router.push(home);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div role="tablist" style={{ display: "flex", gap: "var(--s-2)" }}>
        <Button type="button" variant={mode === "login" ? "primary" : "secondary"} role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
          {tx("লগইন", "Log in")}
        </Button>
        <Button type="button" variant={mode === "signup" ? "primary" : "secondary"} role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
          {tx("সাইন আপ", "Sign up")}
        </Button>
      </div>

      {mode === "signup" ? (
        <Field
          id="citizen-name"
          label={tx("আপনার নাম", "Your name")}
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      ) : null}

      <Field
        id="citizen-phone"
        label={t("mobileNumber")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("mobilePlaceholder")}
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />

      {error ? (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : mode === "login" ? t("signInAction") : tx("অ্যাকাউন্ট খুলুন", "Create account")}
      </Button>
    </form>
  );
}


/* ------------------------------------------------------------------ *
 *  UDC entrepreneur: sign-up (name + mobile + centre + district),
 *  login (mobile only). Accounts: dlas.db.v1.udcOperators.
 * ------------------------------------------------------------------ */
function UdcAuthForm({ home }: { home: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [centre, setCentre] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);

  const messages: Record<string, string> = {
    INVALID_NAME: tx("আপনার নাম লিখুন।", "Enter your name."),
    INVALID_PHONE: tx("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন (01XXXXXXXXX)।", "Enter a valid 11-digit mobile number (01XXXXXXXXX)."),
    INVALID_CENTRE: tx("ইউডিসি কেন্দ্রের নাম লিখুন।", "Enter your UDC centre name."),
    INVALID_DISTRICT: tx("জেলা বাছাই করুন।", "Choose your district."),
    PHONE_TAKEN: tx("এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This number already has an account — log in instead."),
    NOT_FOUND: tx("এই নম্বরে কোনো অ্যাকাউন্ট নেই — সাইন আপ করুন।", "No account for this number — sign up first."),
  };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = mode === "login" ? UdcAuth.login(phone) : UdcAuth.signUp({ name, phone, centre, district });
    if (!r.ok) {
      setError(messages[r.error]);
      if (r.error === "PHONE_TAKEN") setMode("login");
      if (r.error === "NOT_FOUND") setMode("signup");
      return;
    }
    setError(null);
    setPending(true);
    router.push(home);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div role="tablist" style={{ display: "flex", gap: "var(--s-2)" }}>
        <Button type="button" variant={mode === "login" ? "primary" : "secondary"} role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
          {tx("লগইন", "Log in")}
        </Button>
        <Button type="button" variant={mode === "signup" ? "primary" : "secondary"} role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
          {tx("সাইন আপ", "Sign up")}
        </Button>
      </div>

      {mode === "signup" ? (
        <Field id="udc-name" label={tx("আপনার নাম", "Your name")} name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      ) : null}

      <Field
        id="udc-phone"
        label={t("mobileNumber")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("mobilePlaceholder")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {mode === "signup" ? (
        <>
          <Field id="udc-centre" label={tx("ইউডিসি কেন্দ্রের নাম", "UDC centre name")} name="centre" type="text" value={centre} onChange={(e) => setCentre(e.target.value)} />
          <div className={styles.field ?? ""} style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            <label htmlFor="udc-district">{tx("জেলা", "District")}</label>
            <select id="udc-district" value={district} onChange={(e) => setDistrict(e.target.value)} style={{ padding: "var(--control-pad-y) var(--control-pad-x)", border: "var(--control-border)", borderRadius: "var(--control-radius)", font: "inherit", background: "var(--white)" }}>
              <option value="">{tx("বাছাই করুন", "Select")}</option>
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label[lang]}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : mode === "login" ? t("signInAction") : tx("অ্যাকাউন্ট খুলুন", "Create account")}
      </Button>
    </form>
  );
}


/* ------------------------------------------------------------------ *
 *  DLAO / SCLAC / LLAC officer: sign-up (name + mobile + office),
 *  login (mobile only). Accounts: dlas.db.v1.officers.
 * ------------------------------------------------------------------ */
function DlaoAuthForm({ home }: { home: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [officeType, setOfficeType] = useState<"DLAO" | "SCLAC" | "LLAC">("DLAO");
  const [authorityRole, setAuthorityRole] = useState<"LEGAL_AID_OFFICER" | "CHIEF_LEGAL_AID_OFFICER">("LEGAL_AID_OFFICER");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const selectStyle = { padding: "var(--control-pad-y) var(--control-pad-x)", border: "var(--control-border)", borderRadius: "var(--control-radius)", font: "inherit", background: "var(--white)" } as const;

  const messages: Record<string, string> = {
    INVALID_NAME: tx("আপনার নাম লিখুন।", "Enter your name."),
    INVALID_PHONE: tx("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন (01XXXXXXXXX)।", "Enter a valid 11-digit mobile number (01XXXXXXXXX)."),
    INVALID_DISTRICT: tx("অফিসের জেলা বাছাই করুন।", "Choose your office district."),
    PHONE_TAKEN: tx("এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This number already has an account — log in instead."),
    NOT_FOUND: tx("এই নম্বরে কোনো অ্যাকাউন্ট নেই — সাইন আপ করুন।", "No account for this number — sign up first."),
  };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = mode === "login" ? DlaoAuth.login(phone) : DlaoAuth.signUp({ name, phone, officeType, district, authorityRole });
    if (!r.ok) {
      setError(messages[r.error]);
      if (r.error === "PHONE_TAKEN") setMode("login");
      if (r.error === "NOT_FOUND") setMode("signup");
      return;
    }
    setError(null);
    setPending(true);
    router.push(home);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div role="tablist" style={{ display: "flex", gap: "var(--s-2)" }}>
        <Button type="button" variant={mode === "login" ? "primary" : "secondary"} role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
          {tx("লগইন", "Log in")}
        </Button>
        <Button type="button" variant={mode === "signup" ? "primary" : "secondary"} role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
          {tx("সাইন আপ", "Sign up")}
        </Button>
      </div>

      {mode === "signup" ? (
        <Field id="dlao-name" label={tx("আপনার নাম", "Your name")} name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      ) : null}

      <Field
        id="dlao-phone"
        label={t("mobileNumber")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("mobilePlaceholder")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {mode === "signup" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            <label htmlFor="dlao-authority-role">{tx("দায়িত্ব", "Authority role")}</label>
            <select id="dlao-authority-role" value={authorityRole} onChange={(e) => setAuthorityRole(e.target.value as typeof authorityRole)} style={selectStyle}>
              <option value="LEGAL_AID_OFFICER">{tx("লিগ্যাল এইড কর্মকর্তা", "Legal Aid Officer")}</option>
              <option value="CHIEF_LEGAL_AID_OFFICER">{tx("চিফ লিগ্যাল এইড কর্মকর্তা", "Chief Legal Aid Officer")}</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            <label htmlFor="dlao-office">{tx("অফিস", "Office")}</label>
            <select id="dlao-office" value={officeType} onChange={(e) => setOfficeType(e.target.value as "DLAO" | "SCLAC" | "LLAC")} style={selectStyle}>
              <option value="DLAO">{tx("জেলা লিগ্যাল এইড অফিস (DLAO)", "District Legal Aid Office (DLAO)")}</option>
              <option value="SCLAC">{tx("সুপ্রিম কোর্ট লিগ্যাল এইড কমিটি (SCLAC)", "Supreme Court Legal Aid Committee (SCLAC)")}</option>
              <option value="LLAC">{tx("শ্রমিক আইনগত সহায়তা সেল (LLAC)", "Labour Legal Aid Cell (LLAC)")}</option>
            </select>
          </div>
          {officeType !== "SCLAC" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
              <label htmlFor="dlao-district">{tx("জেলা", "District")}</label>
              <select id="dlao-district" value={district} onChange={(e) => setDistrict(e.target.value)} style={selectStyle}>
                <option value="">{tx("বাছাই করুন", "Select")}</option>
                {DISTRICTS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label[lang]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : mode === "login" ? t("signInAction") : tx("অ্যাকাউন্ট খুলুন", "Create account")}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 *  Panel lawyer: sign-up (name + mobile + district panel + bar
 *  enrolment no. + practice areas) and login (mobile only).
 *  Accounts live in dlas.db.v1.lawyers (lib/dlas/lawyer.ts).
 * ------------------------------------------------------------------ */
function MediatorAuthForm({ home }: { home: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [qualification, setQualification] = useState("");
  const [types, setTypes] = useState<MediationCaseType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const selectStyle = { padding: "var(--control-pad-y) var(--control-pad-x)", border: "var(--control-border)", borderRadius: "var(--control-radius)", font: "inherit", background: "var(--white)" } as const;
  const messages: Record<string, string> = {
    INVALID_NAME: tx("আপনার পূর্ণ নাম লিখুন।", "Enter your full name."),
    INVALID_PHONE: tx("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন (01XXXXXXXXX)।", "Enter a valid 11-digit mobile number (01XXXXXXXXX)."),
    INVALID_DISTRICT: tx("জেলা বাছাই করুন।", "Choose your district."),
    INVALID_QUALIFICATION: tx("আপনার যোগ্যতা লিখুন।", "Enter your qualification."),
    NO_CASE_TYPES: tx("অন্তত একটি মামলার ধরন বাছাই করুন।", "Choose at least one case type."),
    PHONE_TAKEN: tx("এই নম্বর রেজিস্ট্রিতে আছে — লগইন করুন।", "This number is already in the registry — log in instead."),
    NOT_FOUND: tx("এই নম্বর মধ্যস্থতাকারী রেজিস্ট্রিতে নেই — নিবন্ধন করুন বা অফিসে যোগাযোগ করুন।", "This number is not in the mediator registry — register, or contact the legal aid office."),
  };
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = mode === "login" ? MediatorAuth.login(phone) : MediatorAuth.signUp({ name, phone, district, qualification, caseTypes: types });
    if (!r.ok) {
      setError(messages[r.error]);
      if (r.error === "PHONE_TAKEN") setMode("login");
      if (r.error === "NOT_FOUND") setMode("signup");
      return;
    }
    setError(null);
    setPending(true);
    router.push(home);
  }
  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div role="tablist" style={{ display: "flex", gap: "var(--s-2)" }}>
        <Button type="button" variant={mode === "login" ? "primary" : "secondary"} role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
          {tx("লগইন", "Log in")}
        </Button>
        <Button type="button" variant={mode === "signup" ? "primary" : "secondary"} role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
          {tx("নিবন্ধন", "Register")}
        </Button>
      </div>
      {mode === "signup" ? <Field id="med-name" label={tx("পূর্ণ নাম", "Full name")} name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /> : null}
      <Field id="med-phone" label={t("mobileNumber")} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("mobilePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} />
      {mode === "signup" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            <label htmlFor="med-district">{tx("জেলা", "District")}</label>
            <select id="med-district" value={district} onChange={(e) => setDistrict(e.target.value)} style={selectStyle}>
              <option value="">{tx("বাছাই করুন", "Select")}</option>
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label[lang]}
                </option>
              ))}
            </select>
          </div>
          <Field id="med-qual" label={tx("যোগ্যতা / প্রশিক্ষণ", "Qualification / training")} name="qualification" type="text" value={qualification} onChange={(e) => setQualification(e.target.value)} />
          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            <legend style={{ marginBottom: "var(--s-2)" }}>{tx("যে ধরনের বিরোধে মধ্যস্থতা করেন", "Disputes you mediate")}</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
              {MEDIATION_CASE_TYPES.map((m) => {
                const on = types.includes(m.code);
                return (
                  <Button key={m.code} type="button" variant={on ? "primary" : "secondary"} aria-pressed={on} onClick={() => setTypes(on ? types.filter((x) => x !== m.code) : [...types, m.code])}>
                    {m.label[lang]}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <p style={{ fontSize: 14, margin: 0 }}>{tx("নিবন্ধনের পর অবস্থা “যাচাই বাকি” থাকবে — লিগ্যাল এইড অফিসার সনদ যাচাই করে সক্রিয় করবেন।", "After registering you stay “Pending verification” until the Legal Aid Officer verifies your certificate and activates you.")}</p>
        </>
      ) : null}
      {error ? (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : mode === "login" ? t("signInAction") : tx("নিবন্ধন করুন", "Register")}
      </Button>
    </form>
  );
}

function LawyerAuthForm({ home }: { home: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [bar, setBar] = useState("");
  const [areas, setAreas] = useState<MatterCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const selectStyle = { padding: "var(--control-pad-y) var(--control-pad-x)", border: "var(--control-border)", borderRadius: "var(--control-radius)", font: "inherit", background: "var(--white)" } as const;

  const messages: Record<string, string> = {
    INVALID_NAME: tx("আপনার নাম লিখুন।", "Enter your name."),
    INVALID_PHONE: tx("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন (01XXXXXXXXX)।", "Enter a valid 11-digit mobile number (01XXXXXXXXX)."),
    INVALID_DISTRICT: tx("আপনি কোন জেলার প্যানেলে আছেন বাছাই করুন।", "Choose the district panel you are on."),
    INVALID_BAR_NO: tx("বার কাউন্সিল সনদ নম্বর লিখুন।", "Enter your Bar Council enrolment number."),
    PHONE_TAKEN: tx("এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন।", "This number already has an account — log in instead."),
    NOT_FOUND: tx("এই নম্বরে কোনো অ্যাকাউন্ট নেই — সাইন আপ করুন।", "No account for this number — sign up first."),
  };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const r = mode === "login" ? LawyerAuth.login(phone) : LawyerAuth.signUp({ name, phone, district, barEnrolmentNo: bar, practiceAreas: areas });
    if (!r.ok) {
      setError(messages[r.error]);
      if (r.error === "PHONE_TAKEN") setMode("login");
      if (r.error === "NOT_FOUND") setMode("signup");
      return;
    }
    setError(null);
    setPending(true);
    router.push(home);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div role="tablist" style={{ display: "flex", gap: "var(--s-2)" }}>
        <Button type="button" variant={mode === "login" ? "primary" : "secondary"} role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
          {tx("লগইন", "Log in")}
        </Button>
        <Button type="button" variant={mode === "signup" ? "primary" : "secondary"} role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
          {tx("সাইন আপ", "Sign up")}
        </Button>
      </div>

      {mode === "signup" ? (
        <Field id="lawyer-name" label={tx("আপনার নাম", "Your name")} name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      ) : null}

      <Field
        id="lawyer-phone"
        label={t("mobileNumber")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("mobilePlaceholder")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {mode === "signup" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            <label htmlFor="lawyer-district">{tx("জেলা প্যানেল", "District panel")}</label>
            <select id="lawyer-district" value={district} onChange={(e) => setDistrict(e.target.value)} style={selectStyle}>
              <option value="">{tx("বাছাই করুন", "Select")}</option>
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label[lang]}
                </option>
              ))}
            </select>
          </div>
          <Field id="lawyer-bar" label={tx("বার কাউন্সিল সনদ নম্বর", "Bar Council enrolment no.")} name="bar" type="text" value={bar} onChange={(e) => setBar(e.target.value)} />
          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            <legend style={{ marginBottom: "var(--s-2)" }}>{tx("যে ধরনের মামলা করেন (ঐচ্ছিক)", "Practice areas (optional)")}</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
              {MATTERS.filter((m) => m.code !== "OTHER").map((m) => {
                const on = areas.includes(m.code);
                return (
                  <Button key={m.code} type="button" variant={on ? "primary" : "secondary"} aria-pressed={on} onClick={() => setAreas(on ? areas.filter((x) => x !== m.code) : [...areas, m.code])}>
                    {m.label[lang]}
                  </Button>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}

      {error ? (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : mode === "login" ? t("signInAction") : tx("অ্যাকাউন্ট খুলুন", "Create account")}
      </Button>
    </form>
  );
}

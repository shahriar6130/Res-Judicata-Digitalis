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
import { CitizenAuth, DISTRICTS, UdcAuth } from "@/lib/dlas";

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
      </div>

      <section className={styles.panel}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <h1 className={styles.title}>{t("signInTitle")}</h1>
            <p className={styles.supporting}>{role.description[lang]}</p>
          </div>

          {role.id === "citizen" ? (
            <CitizenAuthForm home={role.home} />
          ) : role.id === "udc" ? (
            <UdcAuthForm home={role.home} />
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

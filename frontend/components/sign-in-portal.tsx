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
              type={role.id === "citizen" ? "text" : "tel"}
              inputMode={role.id === "citizen" ? "text" : "tel"}
              autoComplete={role.id === "citizen" ? "username" : "tel"}
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
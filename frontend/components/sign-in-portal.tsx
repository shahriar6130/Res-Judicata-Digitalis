"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./sign-in-portal.module.css";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { LanguageToggle } from "@/components/language-toggle";
import { LawMark } from "@/components/law-mark";
import { PortalLinks } from "@/components/portal-links";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import { PORTAL_ART } from "@/lib/portal-art";
import type { Role } from "@/lib/roles";

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
      </div>

      <section className={styles.panel}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <p className={styles.roleChip}>
              <span
                className={styles.eyebrowDot}
                style={{ background: art.accent }}
                aria-hidden="true"
              />
              {role.name[lang]}
            </p>
            <h1 className={styles.title}>{t("signInTitle")}</h1>
            <p className={styles.supporting}>{role.description[lang]}</p>
          </div>

          <form
            className={styles.form}
            onSubmit={handleSubmit}
            action={role.home}
            method="GET"
          >
            {role.id === "citizen" ? (
              <div className={styles.quickFillBox}>
                <div className={styles.quickFillInfo}>
                  <span className={styles.quickFillTag}>
                    {lang === "bn" ? "দ্রুত টেস্ট লগইন" : "Quick test login"}
                  </span>
                  <span className={styles.quickFillCreds}>
                    {lang === "bn"
                      ? 'মোবাইল: "a" · পাসওয়ার্ড: "a"'
                      : 'Mobile: "a" · Password: "a"'}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--s-2)" }}>
                  <button
                    type="button"
                    className={styles.quickFillBtn}
                    onClick={() => {
                      setIdentifier("a");
                      setPassword("a");
                      setError(null);
                    }}
                  >
                    {lang === "bn" ? "পূরণ করুন" : "Auto-fill"}
                  </button>
                  <button
                    type="button"
                    className={styles.quickFillBtn}
                    onClick={() => {
                      setIdentifier("a");
                      setPassword("a");
                      setError(null);
                      try {
                        router.push(role.home);
                      } catch {
                        // Fallback
                      }
                      if (typeof window !== "undefined") {
                        window.location.assign(role.home);
                      }
                    }}
                  >
                    {lang === "bn" ? "সরাসরি প্রবেশ" : "Quick enter"}
                  </button>
                </div>
              </div>
            ) : null}

            <Field
              id="identifier"
              label={t("mobileNumber")}
              name="identifier"
              type={role.id === "citizen" ? "text" : "tel"}
              inputMode={role.id === "citizen" ? "text" : "tel"}
              autoComplete={role.id === "citizen" ? "username" : "tel"}
              placeholder={role.id === "citizen" ? "a" : t("mobilePlaceholder")}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />

            <Field
              id="password"
              label={t("passwordLabel")}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={role.id === "citizen" ? "a" : undefined}
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

          <PortalLinks current={role} />
        </div>

        <footer className={styles.footer}>{t("footer")}</footer>
      </section>
    </main>
  );
}
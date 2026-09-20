"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./sign-in-portal.module.css";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { LanguageToggle } from "@/components/language-toggle";
import { PortalLinks } from "@/components/portal-links";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/roles";

const LawMark = dynamic(
  () => import("@/components/law-mark").then((module) => module.LawMark),
  { ssr: false },
);

type SignInPortalProps = {
  role: Role;
};

export function SignInPortal({ role }: SignInPortalProps) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    startTransition(() => router.push(role.home));
  }

  return (
    <main className={styles.page}>
      <div className={styles.art}>
        <div className={styles.artTop}>
          <Wordmark onDark />
          <LanguageToggle onDark />
        </div>
        <LawMark />
      </div>

      <section className={styles.panel}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <p className={styles.eyebrow}>{role.name[lang]}</p>
            <h1 className={styles.title}>{t("signInTitle")}</h1>
            <p className={styles.supporting}>{role.description[lang]}</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
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

          <PortalLinks current={role} />
        </div>

        <footer className={styles.footer}>{t("footer")}</footer>
      </section>
    </main>
  );
}
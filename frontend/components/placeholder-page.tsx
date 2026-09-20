"use client";

import Link from "next/link";
import styles from "./placeholder-page.module.css";
import { Button } from "@/components/button";
import { LanguageToggle } from "@/components/language-toggle";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/roles";

type PlaceholderPageProps = {
  role: Role;
  portalHref: string;
};

export function PlaceholderPage({ role, portalHref }: PlaceholderPageProps) {
  const { lang, t } = useI18n();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.headerRow}>
          <Wordmark />
          <LanguageToggle />
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>{role.name[lang]}</h1>
          <p className={styles.supporting}>{role.description[lang]}</p>
        </div>

        <p className={styles.placeholder}>{t("workspacePlaceholder")}</p>

        <Link href={portalHref} className={styles.back}>
          <Button variant="secondary">{t("backToSignIn")}</Button>
        </Link>
      </div>
    </main>
  );
}
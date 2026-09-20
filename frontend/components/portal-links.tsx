"use client";

import Link from "next/link";
import styles from "./portal-links.module.css";
import { useI18n } from "@/lib/i18n";
import { ROLES, type Role } from "@/lib/roles";

type PortalLinksProps = {
  current: Role;
};

export function PortalLinks({ current }: PortalLinksProps) {
  const { lang, t } = useI18n();

  return (
    <div className={styles.block}>
      <p className={styles.label}>{t("portalLinks")}</p>
      <nav className={styles.nav} aria-label={t("portalLinks")}>
        {ROLES.map((role) => {
          const isCurrent = role.id === current.id;
          if (isCurrent) {
            return (
              <span key={role.id} className={`${styles.item} ${styles.current}`} aria-current="page">
                {role.name[lang]}
              </span>
            );
          }
          return (
            <Link key={role.id} href={role.path} className={styles.item}>
              {role.name[lang]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
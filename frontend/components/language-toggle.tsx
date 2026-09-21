"use client";

import styles from "./language-toggle.module.css";
import { LANGS, useI18n } from "@/lib/i18n";

type LanguageToggleProps = {
  onDark?: boolean;
};

export function LanguageToggle({ onDark = false }: LanguageToggleProps) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={[styles.bar, onDark ? styles.onDark : ""]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Language"
    >
      {LANGS.map((option) => {
        const active = lang === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={[styles.item, active ? styles.active : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setLang(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
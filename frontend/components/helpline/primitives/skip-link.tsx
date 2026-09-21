"use client";

import { useI18n } from "@/lib/i18n";

export function SkipLink({ targetId }: { targetId: string }) {
  const { t } = useI18n();
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: "absolute",
        left: -9999,
        top: 0,
        padding: "8px 12px",
        background: "var(--black)",
        color: "var(--white)",
        zIndex: 100,
      }}
      onFocus={(event) => {
        event.currentTarget.style.left = "var(--s-3)";
        event.currentTarget.style.top = "var(--s-3)";
      }}
      onBlur={(event) => {
        event.currentTarget.style.left = "-9999px";
      }}
    >
      {t("helplineSkipLink")}
    </a>
  );
}

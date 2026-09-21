"use client";

/* ------------------------------------------------------------------ *
 *  IconButton — small helper used across helpline panels.
 *
 *  Wraps an existing button so every action visually starts with an
 *  icon. Two style variants: "default" (white surface) and "danger"
 *  (red). The label still ships inside the same button, so screen
 *  readers announce it normally.
 * ------------------------------------------------------------------ */

import type { ComponentType, ReactNode, SVGProps } from "react";
import styles from "../helpline.module.css";

export type IconComponent = ComponentType<
  { size?: number; "aria-hidden"?: boolean } & SVGProps<SVGSVGElement>
>;

interface IconButtonProps {
  Icon: IconComponent;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "default" | "danger";
  size?: "sm" | "md";
  className?: string;
}

export function IconButton({
  Icon,
  children,
  onClick,
  type = "button",
  variant = "default",
  size = "md",
  className,
}: IconButtonProps) {
  const combined = [
    styles.iconButton,
    variant === "danger" ? styles.iconButtonDanger : "",
    size === "sm" ? styles.iconButtonSm : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={combined} onClick={onClick}>
      <span className={styles.iconButtonIcon} aria-hidden>
        <Icon size={size === "sm" ? 14 : 16} />
      </span>
      <span className={styles.iconButtonLabel}>{children}</span>
    </button>
  );
}

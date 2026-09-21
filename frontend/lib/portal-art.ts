import type { StaticImageData } from "next/image";
import justiceStrongImage from "@/assets/justice-stands-strong-stockcake.jpg";
import justiceWideImage from "@/assets/d15c298b-bf1a-4ae1-950b-084b2ab5e34c.png";
import type { RoleId } from "@/lib/roles";

export type ArtSide = "left" | "right";

export type PortalArt = {
  image: StaticImageData;
  side: ArtSide;
  /** CSS variable from tokens.css — the role accent. */
  accent: string;
};

/**
 * Every sign-in portal gets its own art treatment so the entry points are
 * easy to tell apart: the two law-mark images alternate across the left and
 * right sides, and each role carries its own accent dot next to the role name.
 */
export const PORTAL_ART: Record<RoleId, PortalArt> = {
  citizen: { image: justiceStrongImage, side: "left", accent: "var(--accent-citizen)" },
  dlo: { image: justiceWideImage, side: "right", accent: "var(--accent-dlo)" },
  lawyer: { image: justiceWideImage, side: "left", accent: "var(--accent-lawyer)" },
  admin: { image: justiceStrongImage, side: "right", accent: "var(--accent-admin)" },
};
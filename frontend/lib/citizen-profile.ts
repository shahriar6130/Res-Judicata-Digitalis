import { useCurrentCitizen } from "./dlas/citizen-view";

/* ------------------------------------------------------------------ *
 *  Single source of identity for the citizen-facing experience.
 *  The home greeting AND the sidebar profile panel both consume this
 *  hook. When real auth lands, only `useCitizenProfile()` changes —
 *  every component that reads it stays untouched.
 * ------------------------------------------------------------------ */

export type CitizenProfile = {
  nameBn: string;
  nameEn: string;
  roleBn: string;
  roleEn: string;
  /** Initials shown in the sidebar profile avatar circle. */
  initials: string;
};

/**
 * The logged-in citizen (sign-up name + phone, lib/dlas/citizen-auth.ts).
 * Falls back to a neutral "Citizen" label when nobody is logged in —
 * never to the demo person.
 */
export function useCitizenProfile(): CitizenProfile {
  const me = useCurrentCitizen();
  if (!me) {
    return { nameBn: "নাগরিক", nameEn: "Citizen", roleBn: "নাগরিক", roleEn: "Citizen", initials: "?" };
  }
  const initials =
    me.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  return { nameBn: me.name, nameEn: me.name, roleBn: "নাগরিক", roleEn: "Citizen", initials };
}

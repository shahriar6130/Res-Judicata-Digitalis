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
 * Hardcoded for the prototype. Values mirror the canonical demo case
 * (CASE_007 complainant) so the chrome and the case data feel like
 * the same person's story.
 */
export const CITIZEN_PROFILE: CitizenProfile = {
  nameBn: "রহিমা বেগম",
  nameEn: "Rahima Begum",
  roleBn: "নাগরিক",
  roleEn: "Citizen",
  initials: "RB",
};

/**
 * Hook form so callers can be swapped to a real auth context later
 * without changing the call sites.
 */
export function useCitizenProfile(): CitizenProfile {
  return CITIZEN_PROFILE;
}
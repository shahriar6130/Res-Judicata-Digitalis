/* ------------------------------------------------------------------ *
 *  District Legal Aid Officer profile — surfaced at the bottom of the
 *  sidebar so the operator always sees who they are signed in as.
 *
 *  Mirrors `citizen-profile.ts`: a single hardcoded record for the
 *  prototype, plus a hook so future real-auth wiring stays a one-file
 *  change.
 * ------------------------------------------------------------------ */

export type DloProfile = {
  nameBn: string;
  nameEn: string;
  roleBn: string;
  roleEn: string;
  /** Initials shown in the sidebar profile avatar circle. */
  initials: string;
};

/**
 * Hardcoded for the prototype. When real auth lands, only this constant
 * (and the hook below) needs to change — every consumer stays the same.
 */
export const DLO_PROFILE: DloProfile = {
  nameBn: "মোঃ আরিফ হোসেন",
  nameEn: "Md. Arif Hossain",
  roleBn: "জেলা আইনি সহায়তা কর্মকর্তা",
  roleEn: "District Legal Aid Officer",
  initials: "AH",
};

export function useDloProfile(): DloProfile {
  return DLO_PROFILE;
}

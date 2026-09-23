import { DISTRICTS, useCurrentOfficer } from "./dlas";
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
/** The logged-in officer (dlas.db.v1.officers). Neutral placeholder when logged out. */
export function useDloProfile(): DloProfile {
  const me = useCurrentOfficer();
  if (!me) return { nameBn: "লগইন করা হয়নি", nameEn: "Not logged in", roleBn: "কর্মকর্তা", roleEn: "Officer", initials: "?" };
  const d = DISTRICTS.find((x) => x.code === me.district);
  const roleEn = me.officeType === "SCLAC" ? "SCLAC officer" : `${me.officeType} officer${d ? ` · ${d.label.en}` : ""}`;
  const roleBn = me.officeType === "SCLAC" ? "SCLAC কর্মকর্তা" : `${me.officeType} কর্মকর্তা${d ? ` · ${d.label.bn}` : ""}`;
  const initials = me.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return { nameBn: me.name, nameEn: me.name, roleBn, roleEn, initials };
}

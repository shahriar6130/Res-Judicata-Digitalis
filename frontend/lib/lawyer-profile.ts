import { DISTRICTS, useCurrentLawyer } from "./dlas";
import type { DloProfile } from "./dlo-profile";

/** The logged-in panel lawyer (dlas.db.v1.lawyers). Neutral placeholder when logged out. */
export function useLawyerProfile(): DloProfile {
  const me = useCurrentLawyer();
  if (!me) return { nameBn: "লগইন করা হয়নি", nameEn: "Not logged in", roleBn: "প্যানেল আইনজীবী", roleEn: "Panel lawyer", initials: "?" };
  const d = DISTRICTS.find((x) => x.code === me.district);
  const initials = me.name.replace(/^adv\.?\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return {
    nameBn: me.name,
    nameEn: me.name,
    roleBn: `প্যানেল আইনজীবী${d ? ` · ${d.label.bn}` : ""}`,
    roleEn: `Panel lawyer${d ? ` · ${d.label.en}` : ""}`,
    initials,
  };
}

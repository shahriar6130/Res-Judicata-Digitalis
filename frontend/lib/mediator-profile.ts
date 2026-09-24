import { DISTRICTS, useCurrentMediator } from "./dlas";
import type { DloProfile } from "./dlo-profile";

/** The logged-in mediator (dlas.db.v1.mediators). Neutral placeholder when logged out. */
export function useMediatorProfile(): DloProfile {
  const me = useCurrentMediator();
  if (!me) return { nameBn: "লগইন করা হয়নি", nameEn: "Not logged in", roleBn: "মধ্যস্থতাকারী", roleEn: "Mediator", initials: "?" };
  const d = DISTRICTS.find((x) => x.code === me.district);
  const initials = me.name.replace(/^md\.?\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return {
    nameBn: me.name,
    nameEn: me.name,
    roleBn: `মধ্যস্থতাকারী${d ? ` · ${d.label.bn}` : ""}`,
    roleEn: `Mediator${d ? ` · ${d.label.en}` : ""}`,
    initials,
  };
}

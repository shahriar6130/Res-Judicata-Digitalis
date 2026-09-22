/* ------------------------------------------------------------------ *
 *  UDC entrepreneur profile — surfaced at the bottom of the sidebar.
 *
 *  Hardcoded for the prototype. The image is an inline SVG avatar so
 *  no external request is required.
 * ------------------------------------------------------------------ */

export type UdcProfile = {
  nameBn: string;
  nameEn: string;
  roleBn: string;
  roleEn: string;
  initials: string;
  /** Office / hub identifier — visible in the sidebar profile panel. */
  officeBn: string;
  officeEn: string;
  /** Inline SVG avatar — a stylised portrait rendered from initials. */
  avatarSvg: string;
};

function buildAvatarSvg(initials: string, bg: string, fg: string): string {
  // Lightweight, deterministic SVG avatar — 64×64, no network call.
  const safe = initials.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2) || "U";
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='100%' height='100%'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${bg}'/>
        <stop offset='100%' stop-color='${fg}'/>
      </linearGradient>
    </defs>
    <circle cx='32' cy='32' r='32' fill='url(#g)'/>
    <circle cx='32' cy='25' r='10' fill='rgba(255,255,255,0.85)'/>
    <path d='M12 60 C 14 44, 50 44, 52 60 Z' fill='rgba(255,255,255,0.85)'/>
    <text x='32' y='29' text-anchor='middle' font-family='Helvetica, Arial, sans-serif' font-weight='700' font-size='12' fill='${bg}'>${safe}</text>
  </svg>`;
}

export const UDC_PROFILE: UdcProfile = {
  nameBn: "মোঃ রহমান",
  nameEn: "Md. Rahman",
  roleBn: "UDC উদ্যোক্তা",
  roleEn: "UDC entrepreneur",
  initials: "MR",
  officeBn: "খাগড়াছড়ি সদর হাব",
  officeEn: "Khagrachari Sadar Hub",
  avatarSvg: buildAvatarSvg("MR", "#0b6cb8", "#1a1a1a"),
};

export function useUdcProfile(): UdcProfile {
  return UDC_PROFILE;
}
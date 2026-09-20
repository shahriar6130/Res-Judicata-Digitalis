import type { SVGProps } from "react";

/**
 * Judge's gavel, drawn with flat facets (no gradients) so it reads as a
 * dimensional steel mark on black while staying inside the design system.
 * Colors come from the gavel tokens in app/tokens.css.
 */
export function Gavel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 72 72"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g transform="rotate(-32 36 36)">
        <rect
          x="33.5"
          y="28"
          width="5"
          height="34"
          rx="2.5"
          fill="var(--gavel-handle)"
        />
        <rect x="22" y="14" width="28" height="15" rx="5" fill="var(--gavel-head)" />
        <rect x="22" y="14" width="28" height="4" rx="2" fill="var(--gavel-top)" />
        <rect x="22" y="25" width="28" height="4" rx="2" fill="var(--gavel-shadow)" />
        <rect x="27" y="14" width="3" height="15" fill="var(--gavel-band)" />
        <rect x="44" y="14" width="3" height="15" fill="var(--gavel-band)" />
      </g>
    </svg>
  );
}
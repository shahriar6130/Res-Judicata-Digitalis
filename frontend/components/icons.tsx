/* ------------------------------------------------------------------ *
 *  Inline SVG icons used by the citizen complaint wizard.
 *  All monochrome, 24x24 viewBox, currentColor. Stroke 1.6.
 *  Lucide-style line icons. No third-party deps.
 * ------------------------------------------------------------------ */

type IconProps = {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
};

const wrap = (size: number, className: string | undefined, hidden: boolean | undefined, path: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={hidden ?? true}
  >
    {path}
  </svg>
);

export function Mic({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </>,
  );
}

export function MicOff({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M9 9v5a3 3 0 0 0 5.12 2.12" />
      <path d="M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M19 11a7 7 0 0 1-.11 1.23" />
      <path d="M5 11a7 7 0 0 0 13.05 3.5" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
      <path d="M2 2l20 20" />
    </>,
  );
}

export function Check({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(size, className, hidden, <path d="M4 12l5 5L20 6" />);
}

export function User({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  );
}

export function Users({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <circle cx="17" cy="6" r="2.5" />
      <path d="M22 18a5 5 0 0 0-7-4.6" />
    </>,
  );
}

export function HelpingHand({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M11 12.5l-1.5-1.5a2 2 0 1 1 2.8-2.8l3 3" />
      <path d="M13.5 9.5l1.5 1.5a2 2 0 1 1-2.8 2.8l-3-3" />
      <path d="M8 16l-3 3" />
      <path d="M16 8l3-3" />
      <path d="M3 21l5-5" />
      <path d="M21 3l-5 5" />
    </>,
  );
}

export function Calendar({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>,
  );
}

export function Lock({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>,
  );
}

export function Moon({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  );
}

export function Clock({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  );
}

export function ChevronLeft({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(size, className, hidden, <path d="M15 6l-6 6 6 6" />);
}

export function ChevronRight({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(size, className, hidden, <path d="M9 6l6 6-6 6" />);
}

export function ChevronDown({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(size, className, hidden, <path d="M6 9l6 6 6-6" />);
}

export function AlertCircle({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </>,
  );
}

export function Shield({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </>,
  );
}

export function FileText({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </>,
  );
}

export function Bell({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>,
  );
}

export function MapPin({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z" />
      <circle cx="12" cy="9" r="3" />
    </>,
  );
}

export function Briefcase({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M2 13h20" />
    </>,
  );
}

export function MessageCircle({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4l-5 3 2-4.5a8.4 8.4 0 1 1 12-6.9z" />
    </>,
  );
}

export function ArrowLeft({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(size, className, hidden, <path d="M19 12H5M12 19l-7-7 7-7" />);
}

export function Copy({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>,
  );
}

export function Play({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(size, className, hidden, <path d="M6 4l14 8-14 8z" />);
}

export function Home({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>,
  );
}

export function Building({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M10 21v-3h4v3" />
    </>,
  );
}

export function Phone({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  );
}

export function Cog({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.86a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.13.31.21.65.21 1v.09c0 .32-.08.63-.21.91z" />
    </>,
  );
}

export function LogOut({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>,
  );
}

export function MoreVertical({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </>,
  );
}

export function Scale({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="M5 7l-3 7a4 4 0 0 0 6 0z" />
      <path d="M19 7l3 7a4 4 0 0 1-6 0z" />
      <path d="M8 21h8" />
    </>,
  );
}

export function Mail({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>,
  );
}

export function X({ size = 24, className, "aria-hidden": hidden }: IconProps) {
  return wrap(
    size,
    className,
    hidden,
    <>
      <path d="M18 6 6 18M6 6l12 12" />
    </>,
  );
}

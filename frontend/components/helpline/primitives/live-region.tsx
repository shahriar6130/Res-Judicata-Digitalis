"use client";

import type { ReactNode } from "react";

interface LiveRegionProps {
  politeness?: "polite" | "assertive";
  role?: "log" | "alert" | "status";
  atomic?: boolean;
  id?: string;
  children: ReactNode;
}

export function LiveRegion({
  politeness = "polite",
  role = "log",
  atomic = false,
  id,
  children,
}: LiveRegionProps) {
  return (
    <div id={id} aria-live={politeness} aria-atomic={atomic ? "true" : "false"} role={role}>
      {children}
    </div>
  );
}

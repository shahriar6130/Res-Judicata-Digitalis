"use client";

import { getRole } from "@/lib/roles";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function DloDashboard() {
  const role = getRole("dlo");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
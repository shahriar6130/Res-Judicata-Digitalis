"use client";

import { getRole } from "@/lib/roles";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function CitizenDashboard() {
  const role = getRole("citizen");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
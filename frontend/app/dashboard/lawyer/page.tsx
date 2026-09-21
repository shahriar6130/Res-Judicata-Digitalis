"use client";

import { getRole } from "@/lib/roles";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function LawyerDashboard() {
  const role = getRole("lawyer");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
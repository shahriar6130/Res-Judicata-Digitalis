"use client";

import { getRole } from "@/lib/roles";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function AdminDashboard() {
  const role = getRole("admin");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
import { notFound } from "next/navigation";
import { RoleDashboard } from "@/components/role-dashboard";
import { findRole, ROLES } from "@/lib/roles";

export function generateStaticParams() {
  return ROLES.map((role) => ({ role: role.id }));
}

export default async function ExtendedRoleDashboard({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleId } = await params;
  const role = findRole(roleId);
  if (!role) notFound();
  return <RoleDashboard role={role.id} />;
}

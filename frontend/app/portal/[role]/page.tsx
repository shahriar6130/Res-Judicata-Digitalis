import { notFound } from "next/navigation";
import { SignInPortal } from "@/components/sign-in-portal";
import { findRole, ROLES } from "@/lib/roles";

export function generateStaticParams() {
  return ROLES.filter((role) => role.path.startsWith("/portal/")).map((role) => ({ role: role.id }));
}

export default async function RoleSignIn({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleId } = await params;
  const role = findRole(roleId);
  if (!role || !role.path.startsWith("/portal/")) notFound();
  return <SignInPortal role={role} />;
}

import { SignInPortal } from "@/components/sign-in-portal";
import { findRole } from "@/lib/roles";

export default function UdcLoginPage() {
  const role = findRole("udc");
  if (!role) return null;
  return <SignInPortal role={role} />;
}

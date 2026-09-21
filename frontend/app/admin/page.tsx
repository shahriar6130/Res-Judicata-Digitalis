import { SignInPortal } from "@/components/sign-in-portal";
import { getRole } from "@/lib/roles";

export default function AdminSignIn() {
  return <SignInPortal role={getRole("admin")} />;
}
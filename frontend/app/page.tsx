import { SignInPortal } from "@/components/sign-in-portal";
import { getRole } from "@/lib/roles";

export default function CitizenSignIn() {
  return <SignInPortal role={getRole("citizen")} />;
}
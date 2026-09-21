import { SignInPortal } from "@/components/sign-in-portal";
import { getRole } from "@/lib/roles";

export default function LawyerSignIn() {
  return <SignInPortal role={getRole("lawyer")} />;
}
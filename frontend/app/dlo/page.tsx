import { SignInPortal } from "@/components/sign-in-portal";
import { getRole } from "@/lib/roles";

export default function DloSignIn() {
  return <SignInPortal role={getRole("dlo")} />;
}
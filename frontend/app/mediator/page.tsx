import { SignInPortal } from "@/components/sign-in-portal";
import { getRole } from "@/lib/roles";

export default function MediatorSignIn() {
  return <SignInPortal role={getRole("mediator")} />;
}

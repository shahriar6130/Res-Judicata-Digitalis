import { PlaceholderPage } from "@/components/placeholder-page";
import { getRole } from "@/lib/roles";

export default function CitizenHome() {
  const role = getRole("citizen");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
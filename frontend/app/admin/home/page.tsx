import { PlaceholderPage } from "@/components/placeholder-page";
import { getRole } from "@/lib/roles";

export default function AdminHome() {
  const role = getRole("admin");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
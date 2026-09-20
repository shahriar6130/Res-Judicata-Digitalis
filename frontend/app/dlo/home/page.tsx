import { PlaceholderPage } from "@/components/placeholder-page";
import { getRole } from "@/lib/roles";

export default function DloHome() {
  const role = getRole("dlo");
  return <PlaceholderPage role={role} portalHref={role.path} />;
}
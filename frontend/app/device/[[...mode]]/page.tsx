import { notFound } from "next/navigation";
import { DevicePage } from "@/components/dlas/device-page";

export const metadata = { title: "Device · IVR 16699 & USSD *16699#" };

export function generateStaticParams() {
  return [{ mode: [] }, { mode: ["ivr"] }, { mode: ["ussd"] }];
}

/** /device → IVR, /device/ivr, /device/ussd */
export default async function Device({ params }: { params: Promise<{ mode?: string[] }> }) {
  const { mode } = await params;
  const m = mode?.[0] ?? "ivr";
  if ((mode?.length ?? 0) > 1 || (m !== "ivr" && m !== "ussd")) notFound();
  return <DevicePage mode={m} />;
}

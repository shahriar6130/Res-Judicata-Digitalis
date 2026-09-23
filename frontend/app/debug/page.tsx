import { Suspense } from "react";
import { DebugPage } from "@/components/dlas/debug-page";

export const metadata = { title: "Debug · DLAS shared record" };

export default function Debug() {
  return (
    <Suspense fallback={null}>
      <DebugPage />
    </Suspense>
  );
}

import { redirect } from "next/navigation";

/** /dlo/infer — the DLAO case-transfer inbox lives in the DLO dashboard. */
export default function DloTransfers() {
  redirect("/dashboard/dlo#transfers");
}

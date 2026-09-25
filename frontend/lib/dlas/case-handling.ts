/* ------------------------------------------------------------------ *
 *  Which office handles a case (pure — no store imports, so dlao.ts,
 *  lawyer.ts and mediator-assignment.ts can all use it without cycles).
 *
 *  By default the applicant's district office. After a DLAO → DLAO
 *  transfer is ACCEPTED, the receiving office handles it — access, the
 *  mediator panel and the panel-lawyer shortlist all follow. The
 *  applicant's own district (what they told us) is never rewritten.
 * ------------------------------------------------------------------ */

import type { ApplicationRecord, DistrictCode } from "./schema";

export function acceptedTransfer(a: Pick<ApplicationRecord, "transfers">) {
  return [...(a.transfers ?? [])].reverse().find((t) => t.status === "ACCEPTED") ?? null;
}

export function handlingDistrict(a: Pick<ApplicationRecord, "transfers" | "data">): DistrictCode | null {
  return acceptedTransfer(a)?.toDistrict ?? a.data.applicant.district;
}

export function pendingTransfer(a: Pick<ApplicationRecord, "transfers">) {
  return (a.transfers ?? []).find((t) => t.status === "PENDING") ?? null;
}

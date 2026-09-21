"use client";

import { CitizenRiponCallPanel } from "@/components/citizen/helpline/citizen-ripon-call.panel";

export default function CitizenHelplineCallPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return <CitizenRiponCallPanel sessionId={params.sessionId} />;
}

import { UdcStatusVisitPanel } from "@/components/udc/panels/status-visit.panel";

export default async function UdcStatusVisitSessionPage(
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  return <UdcStatusVisitPanel sessionId={sessionId} />;
}
import { UdcLetterAccessPanel } from "@/components/udc/panels/letter-access.panel";

export default async function UdcLetterAccessPage(
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  return <UdcLetterAccessPanel sessionId={sessionId} />;
}
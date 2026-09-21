import { UdcWorkspace } from "@/components/udc/workspace";

interface Params {
  params: Promise<{ temporaryId: string }>;
}

export default async function UdcIntakePage({ params }: Params) {
  const { temporaryId } = await params;
  if (typeof window === "undefined") {
    return <UdcWorkspace role="udc" />;
  }
  void temporaryId;
  return <UdcWorkspace role="udc" />;
}

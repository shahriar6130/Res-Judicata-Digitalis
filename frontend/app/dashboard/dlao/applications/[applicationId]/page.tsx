"use client";

import { DlaoVerificationPage } from "@/components/dlao/verification/dlao-verification.page";

export default function DlaoApplicationPage({
  params,
}: {
  params: { applicationId: string };
}) {
  return <DlaoVerificationPage applicationId={params.applicationId} />;
}

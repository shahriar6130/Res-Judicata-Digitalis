"use client";

import { HelplineWorkspace } from "@/components/helpline/workspace";
import { useEffect } from "react";

export default function HelplineRecordPage({
  params,
}: {
  params: { applicationId: string };
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.hash = `record/${params.applicationId}`;
    }
  }, [params.applicationId]);
  return <HelplineWorkspace />;
}

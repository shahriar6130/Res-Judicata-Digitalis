"use client";

import { use, useEffect } from "react";
import { ensureSeeded } from "@/lib/shakkho";
import MediatorCaseWorkspace from "@/components/mediation/case-workspace";

export default function MediatorCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  useEffect(() => {
    ensureSeeded();
  }, []);
  return <MediatorCaseWorkspace caseId={caseId} />;
}

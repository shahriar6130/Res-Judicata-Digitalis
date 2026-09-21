"use client";

import { AgentWorkspacePanel } from "@/components/helpline/panels/agent-workspace.panel";

export default function HelplineAgentHandoffPage({
  params,
}: {
  params: { handoffId: string };
}) {
  return <AgentWorkspacePanel initialHandoffId={params.handoffId} />;
}

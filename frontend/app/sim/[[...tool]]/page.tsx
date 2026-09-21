import { SimulatorPanel } from "@/components/simulator-panel";

export default async function SimulatorPage({ params }: { params: Promise<{ tool?: string[] }> }) {
  const { tool } = await params;
  return <SimulatorPanel tool={tool?.[0]} />;
}

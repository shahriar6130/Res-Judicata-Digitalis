import { CloSettlementReview } from "@/components/dlao/clo-settlement-review";

export default async function CloSettlementReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <CloSettlementReview applicationId={decodeURIComponent(applicationId)} />;
}

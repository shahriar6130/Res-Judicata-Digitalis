import { MediationFailureReview } from "@/components/dlao/mediation-failure-review";

export default async function MediationFailureReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <MediationFailureReview applicationId={decodeURIComponent(applicationId)} />;
}

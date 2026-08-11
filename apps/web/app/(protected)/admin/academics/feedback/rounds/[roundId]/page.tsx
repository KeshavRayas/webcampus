import { FeedbackRoundDetailView } from "@/modules/feedback/feedback-round-detail-view";

export default async function FeedbackRoundDetailPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  return <FeedbackRoundDetailView roundId={roundId} />;
}

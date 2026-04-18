import { RcaResultsClient } from "./RcaResultsClient";

interface PageProps {
  params: Promise<{ incidentId: string }>;
}

export default async function RcaResultsPage({ params }: PageProps) {
  const { incidentId } = await params;
  return <RcaResultsClient incidentId={incidentId} />;
}

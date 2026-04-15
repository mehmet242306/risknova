import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SharedRiskAnalysisView } from "./SharedRiskAnalysisView";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedRiskAnalysisPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  // Fetch assessment by share token
  const { data: assessment } = await supabase
    .from("risk_assessments")
    .select("*")
    .eq("share_token", token)
    .eq("is_shared", true)
    .is("deleted_at", null)
    .single();

  if (!assessment) {
    notFound();
  }

  // Fetch rows
  const { data: rows } = await supabase
    .from("risk_assessment_rows")
    .select("*")
    .eq("assessment_id", assessment.id)
    .is("deleted_at", null)
    .order("sort_order");

  // Fetch findings
  const { data: findings } = await supabase
    .from("risk_assessment_findings")
    .select("*")
    .eq("assessment_id", assessment.id)
    .is("deleted_at", null)
    .order("sort_order");

  // Fetch images + signed URLs
  const { data: images } = await supabase
    .from("risk_assessment_images")
    .select("*")
    .eq("assessment_id", assessment.id)
    .order("sort_order");

  const imageUrls: Record<string, string> = {};
  if (images && images.length > 0) {
    const paths = images.map((i) => i.storage_path);
    const { data: signedUrls } = await supabase.storage
      .from("risk-images")
      .createSignedUrls(paths, 3600);
    if (signedUrls) {
      for (let i = 0; i < images.length; i++) {
        if (signedUrls[i]?.signedUrl) {
          imageUrls[images[i].id] = signedUrls[i].signedUrl;
        }
      }
    }
  }

  // Fetch company info
  let companyName = "";
  let companySector = "";
  let companyHazardClass = "";
  if (assessment.company_workspace_id) {
    const { data: ws } = await supabase
      .from("company_workspaces")
      .select("company_identity_id, display_name")
      .eq("id", assessment.company_workspace_id)
      .single();
    if (ws) {
      const { data: ci } = await supabase
        .from("company_identities")
        .select("official_name, sector, hazard_class")
        .eq("id", ws.company_identity_id)
        .single();
      companyName = ci?.official_name || ws.display_name || "";
      companySector = ci?.sector || "";
      companyHazardClass = ci?.hazard_class || "";
    }
  }

  return (
    <SharedRiskAnalysisView
      assessment={assessment}
      rows={rows || []}
      findings={findings || []}
      images={images || []}
      imageUrls={imageUrls}
      companyName={companyName}
      companySector={companySector}
      companyHazardClass={companyHazardClass}
    />
  );
}

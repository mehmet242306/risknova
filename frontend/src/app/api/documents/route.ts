import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCompatError } from "@/lib/osgb/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import { createServiceClient, parseJsonBody } from "@/lib/security/server";

const createDocumentSchema = z.object({
  companyWorkspaceId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  groupKey: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(250),
  contentJson: z.record(z.string(), z.unknown()),
  variablesData: z.record(z.string(), z.unknown()).optional().default({}),
  status: z
    .enum(["taslak", "hazir", "onay_bekliyor", "revizyon", "arsiv"])
    .optional()
    .default("taslak"),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, createDocumentSchema);
  if (!parsed.ok) return parsed.response;

  const service = createServiceClient();
  const payload = parsed.data;

  if (payload.companyWorkspaceId) {
    const { data: workspaceRow, error: workspaceError } = await service
      .from("company_workspaces")
      .select("id")
      .eq("id", payload.companyWorkspaceId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (workspaceError) {
      return NextResponse.json({ error: workspaceError.message }, { status: 500 });
    }

    if (!workspaceRow?.id) {
      return NextResponse.json(
        { error: "Secilen firma workspace kaydi bulunamadi." },
        { status: 404 },
      );
    }
  }

  const baseInsertPayload = {
    organization_id: auth.organizationId,
    company_workspace_id: payload.companyWorkspaceId ?? null,
    template_id: payload.templateId ?? null,
    group_key: payload.groupKey,
    title: payload.title,
    content_json: payload.contentJson,
    variables_data: payload.variablesData ?? {},
    status: payload.status,
    version: 1,
    prepared_by: auth.userProfileId,
  };

  let insertResult = await service
    .from("editor_documents")
    .insert({
      ...baseInsertPayload,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select("*")
    .single();

  if (insertResult.error && isCompatError(insertResult.error.message)) {
    insertResult = await service
      .from("editor_documents")
      .insert(baseInsertPayload)
      .select("*")
      .single();
  }

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document: insertResult.data });
}

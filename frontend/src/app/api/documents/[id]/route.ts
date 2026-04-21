import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCompatError } from "@/lib/osgb/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import { createServiceClient, parseJsonBody } from "@/lib/security/server";

const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(250).optional(),
    contentJson: z.record(z.string(), z.unknown()).optional(),
    variablesData: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["taslak", "hazir", "onay_bekliyor", "revizyon", "arsiv"]).optional(),
    version: z.number().int().min(1).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.contentJson !== undefined ||
      value.variablesData !== undefined ||
      value.status !== undefined ||
      value.version !== undefined,
    { message: "Guncellenecek en az bir alan gonderilmelidir." },
  );

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, updateDocumentSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Dokuman kimligi eksik." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: existingDocument, error: existingError } = await service
    .from("editor_documents")
    .select("id, organization_id")
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existingDocument?.id) {
    return NextResponse.json({ error: "Dokuman bulunamadi." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.contentJson !== undefined) updates.content_json = parsed.data.contentJson;
  if (parsed.data.variablesData !== undefined) updates.variables_data = parsed.data.variablesData;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.version !== undefined) updates.version = parsed.data.version;

  let updateResult = await service
    .from("editor_documents")
    .update({
      ...updates,
      updated_by: auth.userId,
    })
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .select("*")
    .single();

  if (updateResult.error && isCompatError(updateResult.error.message)) {
    updateResult = await service
      .from("editor_documents")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select("*")
      .single();
  }

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  if (parsed.data.version !== undefined && parsed.data.contentJson !== undefined) {
    let versionInsert = await service.from("editor_document_versions").insert({
      document_id: id,
      version: parsed.data.version,
      content_json: parsed.data.contentJson,
      changed_by: auth.userProfileId,
      change_reason: "manual_save",
      created_by: auth.userId,
      updated_by: auth.userId,
    });

    if (versionInsert.error && isCompatError(versionInsert.error.message)) {
      versionInsert = await service.from("editor_document_versions").insert({
        document_id: id,
        version: parsed.data.version,
        content_json: parsed.data.contentJson,
        changed_by: auth.userProfileId,
        change_reason: "manual_save",
      });
    }

    if (versionInsert.error) {
      return NextResponse.json(
        {
          error:
            "Dokuman guncellendi ancak surum gecmisi kaydedilemedi: " +
            versionInsert.error.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, document: updateResult.data });
}

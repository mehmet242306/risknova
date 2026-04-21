import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  hasOsgbManagementAccess,
} from "@/lib/account/account-routing";
import { isCompatError } from "@/lib/osgb/server";
import {
  createServiceClient,
  logSecurityEventWithContext,
  parseJsonBody,
} from "@/lib/security/server";

const bodySchema = z
  .object({
    assignmentStatus: z.enum(["active", "suspended", "ended"]).optional(),
    canView: z.boolean().optional(),
    canCreateRisk: z.boolean().optional(),
    canEditRisk: z.boolean().optional(),
    canApprove: z.boolean().optional(),
    canSign: z.boolean().optional(),
    startsOn: z.string().trim().optional(),
    endsOn: z.string().trim().optional(),
  })
  .refine(
    (input) =>
      input.assignmentStatus !== undefined ||
      input.canView !== undefined ||
      input.canCreateRisk !== undefined ||
      input.canEditRisk !== undefined ||
      input.canApprove !== undefined ||
      input.canSign !== undefined ||
      input.startsOn !== undefined ||
      input.endsOn !== undefined,
    {
      message: "Guncellenecek en az bir alan gonderilmelidir.",
    },
  );

function normalizeDate(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { assignmentId } = await context.params;
  if (!assignmentId) {
    return NextResponse.json({ error: "Gorevlendirme kimligi eksik." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Giris gerekli." }, { status: 401 });
  }

  const accountContext = await getAccountContextForUser(user.id);
  if (
    accountContext.accountType !== "osgb" ||
    !accountContext.organizationId ||
    !hasOsgbManagementAccess(accountContext)
  ) {
    return NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: assignmentRow, error: assignmentError } = await service
    .from("workspace_assignments")
    .select("id, organization_id, company_workspace_id, user_id, professional_role, assignment_status")
    .eq("id", assignmentId)
    .eq("organization_id", accountContext.organizationId)
    .maybeSingle();

  if (assignmentError && !isCompatError(assignmentError.message)) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }

  if (!assignmentRow?.id) {
    return NextResponse.json({ error: "Gorevlendirme kaydi bulunamadi." }, { status: 404 });
  }

  const startsOn =
    parsed.data.startsOn !== undefined ? normalizeDate(parsed.data.startsOn) : undefined;
  const endsOn = parsed.data.endsOn !== undefined ? normalizeDate(parsed.data.endsOn) : undefined;

  if (parsed.data.startsOn !== undefined && startsOn === null && parsed.data.startsOn.trim()) {
    return NextResponse.json(
      { error: "Baslangic tarihi YYYY-AA-GG formatinda olmali." },
      { status: 400 },
    );
  }

  if (parsed.data.endsOn !== undefined && endsOn === null && parsed.data.endsOn.trim()) {
    return NextResponse.json(
      { error: "Bitis tarihi YYYY-AA-GG formatinda olmali." },
      { status: 400 },
    );
  }

  const nextStatus = parsed.data.assignmentStatus ?? assignmentRow.assignment_status;
  const updatePayload: Record<string, unknown> = {};

  if (parsed.data.assignmentStatus !== undefined) {
    updatePayload.assignment_status = parsed.data.assignmentStatus;
  }
  if (parsed.data.canView !== undefined) {
    updatePayload.can_view = parsed.data.canView;
  }
  if (parsed.data.canCreateRisk !== undefined) {
    updatePayload.can_create_risk = parsed.data.canCreateRisk;
  }
  if (parsed.data.canEditRisk !== undefined) {
    updatePayload.can_edit_risk = parsed.data.canEditRisk;
  }
  if (parsed.data.canApprove !== undefined) {
    updatePayload.can_approve = parsed.data.canApprove;
  }
  if (parsed.data.canSign !== undefined) {
    updatePayload.can_sign = parsed.data.canSign;
  }
  if (startsOn !== undefined) {
    updatePayload.starts_on = startsOn;
  }
  if (endsOn !== undefined) {
    updatePayload.ends_on = endsOn;
  }

  if (parsed.data.assignmentStatus === "active" && parsed.data.endsOn === undefined) {
    updatePayload.ends_on = null;
  }

  if (parsed.data.assignmentStatus === "ended" && parsed.data.endsOn === undefined) {
    updatePayload.ends_on = new Date().toISOString().slice(0, 10);
  }

  const { error: updateError } = await service
    .from("workspace_assignments")
    .update(updatePayload)
    .eq("id", assignmentRow.id);

  if (updateError && !isCompatError(updateError.message)) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    const { error: activityError } = await service.from("workspace_activity_logs").insert({
      organization_id: accountContext.organizationId,
      company_workspace_id: assignmentRow.company_workspace_id,
      actor_user_id: user.id,
      event_type: "workspace.assignment.updated",
      event_payload: {
        assignment_id: assignmentRow.id,
        assigned_user_id: assignmentRow.user_id,
        professional_role: assignmentRow.professional_role,
        assignment_status: nextStatus,
        updated_fields: Object.keys(updatePayload),
      },
    });

    if (activityError && !isCompatError(activityError.message)) {
      console.error("[osgb.assignments.patch] activity log failed:", activityError.message);
    }
  } catch (error) {
    console.error("[osgb.assignments.patch] activity log failed:", error);
  }

  await logSecurityEventWithContext({
    eventType: "osgb.assignment.updated",
    endpoint: `/api/osgb/assignments/${assignmentId}`,
    userId: user.id,
    organizationId: accountContext.organizationId,
    severity: "info",
    details: {
      assignmentId: assignmentRow.id,
      companyWorkspaceId: assignmentRow.company_workspace_id,
      assignedUserId: assignmentRow.user_id,
      updatedFields: Object.keys(updatePayload),
      assignmentStatus: nextStatus,
    },
  });

  return NextResponse.json({
    ok: true,
    message:
      nextStatus === "active"
        ? "Gorevlendirme yeniden aktif edildi."
        : nextStatus === "suspended"
          ? "Gorevlendirme askiya alindi."
          : nextStatus === "ended"
            ? "Gorevlendirme sonlandirildi."
            : "Gorevlendirme guncellendi.",
  });
}

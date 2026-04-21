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

const bodySchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { taskId } = await context.params;
  if (!taskId) {
    return NextResponse.json({ error: "Gorev kimligi eksik." }, { status: 400 });
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
  const { data: taskRow, error: taskError } = await service
    .from("workspace_tasks")
    .select("id, title, status, organization_id, company_workspace_id")
    .eq("id", taskId)
    .eq("organization_id", accountContext.organizationId)
    .maybeSingle();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (!taskRow?.id) {
    return NextResponse.json({ error: "Gorev kaydi bulunamadi." }, { status: 404 });
  }

  const { error: updateError } = await service
    .from("workspace_tasks")
    .update({ status: parsed.data.status })
    .eq("id", taskId)
    .eq("organization_id", accountContext.organizationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    const { error: activityError } = await service.from("workspace_activity_logs").insert({
      organization_id: accountContext.organizationId,
      company_workspace_id: taskRow.company_workspace_id,
      actor_user_id: user.id,
      event_type: "workspace.task.status_changed",
      event_payload: {
        task_id: taskId,
        title: taskRow.title,
        from_status: taskRow.status,
        to_status: parsed.data.status,
      },
    });

    if (activityError && !isCompatError(activityError.message)) {
      console.error("[osgb.tasks.patch] activity log failed:", activityError.message);
    }
  } catch (error) {
    console.error("[osgb.tasks.patch] activity log failed:", error);
  }

  await logSecurityEventWithContext({
    eventType: "osgb.task.status_changed",
    endpoint: `/api/osgb/tasks/${taskId}`,
    userId: user.id,
    organizationId: accountContext.organizationId,
    severity: "info",
    details: {
      taskId,
      fromStatus: taskRow.status,
      toStatus: parsed.data.status,
    },
  });

  return NextResponse.json({
    ok: true,
    taskId,
    message: "Gorev durumu guncellendi.",
  });
}

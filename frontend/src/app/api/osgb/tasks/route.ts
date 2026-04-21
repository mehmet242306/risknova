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
  companyWorkspaceId: z.string().uuid("Gecerli bir firma secin."),
  title: z.string().trim().min(2, "Gorev basligi zorunludur.").max(180),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().trim().optional(),
  assigneeUserIds: z.array(z.string().uuid()).max(12).default([]),
});

function normalizeDueDate(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Giris gerekli." }, { status: 401 });
  }

  const context = await getAccountContextForUser(user.id);
  if (
    context.accountType !== "osgb" ||
    !context.organizationId ||
    !hasOsgbManagementAccess(context)
  ) {
    return NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 });
  }

  const service = createServiceClient();
  const dueDate = normalizeDueDate(parsed.data.dueDate);

  if (parsed.data.dueDate && !dueDate) {
    return NextResponse.json(
      { error: "Son tarih YYYY-AA-GG formatinda olmali." },
      { status: 400 },
    );
  }

  const { data: workspaceRow, error: workspaceError } = await service
    .from("company_workspaces")
    .select("id, display_name")
    .eq("id", parsed.data.companyWorkspaceId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  }

  if (!workspaceRow?.id) {
    return NextResponse.json({ error: "Firma kaydi bulunamadi." }, { status: 404 });
  }

  const uniqueAssigneeIds = Array.from(new Set(parsed.data.assigneeUserIds));
  if (uniqueAssigneeIds.length > 0) {
    const { data: assignmentRows, error: assignmentError } = await service
      .from("workspace_assignments")
      .select("user_id")
      .eq("organization_id", context.organizationId)
      .eq("company_workspace_id", parsed.data.companyWorkspaceId)
      .eq("assignment_status", "active")
      .in("user_id", uniqueAssigneeIds);

    if (assignmentError && !isCompatError(assignmentError.message)) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }

    const allowedUserIds = new Set(
      ((assignmentRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    );

    const invalidAssignee = uniqueAssigneeIds.find((id) => !allowedUserIds.has(id));
    if (invalidAssignee) {
      return NextResponse.json(
        { error: "Secilen personel bu firmaya aktif olarak atanmis degil." },
        { status: 400 },
      );
    }
  }

  const { data: taskRow, error: taskError } = await service
    .from("workspace_tasks")
    .insert({
      organization_id: context.organizationId,
      company_workspace_id: parsed.data.companyWorkspaceId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: "open",
      priority: parsed.data.priority,
      due_date: dueDate,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (uniqueAssigneeIds.length > 0) {
    const { error: taskAssignmentError } = await service
      .from("workspace_task_assignments")
      .insert(
        uniqueAssigneeIds.map((userId) => ({
          task_id: taskRow.id,
          user_id: userId,
        })),
      );

    if (taskAssignmentError && !isCompatError(taskAssignmentError.message)) {
      return NextResponse.json({ error: taskAssignmentError.message }, { status: 500 });
    }
  }

  try {
    const { error: activityError } = await service.from("workspace_activity_logs").insert({
      organization_id: context.organizationId,
      company_workspace_id: parsed.data.companyWorkspaceId,
      actor_user_id: user.id,
      event_type: "workspace.task.created",
      event_payload: {
        task_id: taskRow.id,
        title: parsed.data.title,
        priority: parsed.data.priority,
        due_date: dueDate,
        assignee_count: uniqueAssigneeIds.length,
      },
    });

    if (activityError && !isCompatError(activityError.message)) {
      console.error("[osgb.tasks.create] activity log failed:", activityError.message);
    }
  } catch (error) {
    console.error("[osgb.tasks.create] activity log failed:", error);
  }

  await logSecurityEventWithContext({
    eventType: "osgb.task.created",
    endpoint: "/api/osgb/tasks",
    userId: user.id,
    organizationId: context.organizationId,
    severity: "info",
    details: {
      companyWorkspaceId: parsed.data.companyWorkspaceId,
      taskId: taskRow.id,
      assigneeCount: uniqueAssigneeIds.length,
    },
  });

  return NextResponse.json({
    ok: true,
    taskId: taskRow.id,
    message: `${workspaceRow.display_name || "Firma"} icin gorev olusturuldu.`,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/security/server";
import {
  getAccountContextForUser,
  resolveAccountSurface,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

function isCompatError(message: string | undefined | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
  }

  const context = await getAccountContextForUser(user.id);
  const service = createServiceClient();

  let usage = null;
  if (context.organizationId) {
    const [
      { data: planLimits, error: planLimitsError },
      { data: workspaceCount, error: workspaceCountError },
      { data: staffCount, error: staffCountError },
    ] = await Promise.all([
      service.rpc("current_plan_limits", {
        p_organization_id: context.organizationId,
      }),
      service.rpc("active_company_workspace_count", {
        p_organization_id: context.organizationId,
      }),
      service.rpc("active_account_staff_count", {
        p_organization_id: context.organizationId,
      }),
    ]);

    if (
      [planLimitsError, workspaceCountError, staffCountError].some(
        (error) => error && !isCompatError(error.message),
      )
    ) {
      return NextResponse.json(
        { error: "Hesap kullanim bilgisi okunamadi." },
        { status: 500 },
      );
    }

    const planRow = Array.isArray(planLimits) ? planLimits[0] ?? null : planLimits;
    usage = {
      maxActiveWorkspaces: planRow?.max_active_workspaces ?? null,
      maxActiveStaffSeats: planRow?.max_active_staff_seats ?? null,
      hasPersonnelModule: planRow?.has_personnel_module ?? false,
      hasTaskTracking: planRow?.has_task_tracking ?? false,
      hasAnnouncements: planRow?.has_announcements ?? false,
      contactRequired: planRow?.contact_required ?? false,
      activeWorkspaceCount:
        typeof workspaceCount === "number" ? workspaceCount : 0,
      activeStaffCount: typeof staffCount === "number" ? staffCount : 0,
    };
  }

  return NextResponse.json({
    ok: true,
    context,
    surface: resolveAccountSurface(context),
    redirectPath: resolvePostLoginPath(context),
    usage,
  });
}

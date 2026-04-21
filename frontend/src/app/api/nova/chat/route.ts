import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supabase/api-auth";
import {
  getAccountContextForUser,
  hasOsgbManagementAccess,
} from "@/lib/account/account-routing";
import { enforceRateLimit, parseJsonBody, resolveAiDailyLimit } from "@/lib/security/server";
import { createServiceClient } from "@/lib/security/server";
import {
  normalizeNovaAgentResponse,
  novaChatRequestSchema,
  type NovaAgentResponse,
} from "@/lib/nova/agent";
import { assertNovaFeatureEnabled } from "@/lib/nova/governance";

function isCompatError(message: string | undefined | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractWorkspaceIdFromCurrentPage(currentPage: string | undefined) {
  if (!currentPage) return null;

  try {
    const url = new URL(currentPage, "http://localhost");
    const workspaceId =
      url.searchParams.get("workspaceId") ??
      url.searchParams.get("companyWorkspaceId") ??
      null;

    return isUuid(workspaceId) ? workspaceId : null;
  } catch {
    return null;
  }
}

function isOsgbManagerSurface(currentPage: string | undefined | null) {
  const normalized = String(currentPage ?? "").toLowerCase();
  return normalized.includes("/osgb") || normalized.includes("surface=osgb-manager");
}

function isPlatformAdminSurface(currentPage: string | undefined | null) {
  const normalized = String(currentPage ?? "").toLowerCase();
  return normalized.includes("/platform-admin") || normalized.includes("surface=platform-admin");
}

function isEnterpriseSurface(currentPage: string | undefined | null) {
  const normalized = String(currentPage ?? "").toLowerCase();
  return normalized.includes("/enterprise") || normalized.includes("surface=enterprise");
}

async function buildPlatformAdminContextNote(params: {
  currentPage?: string;
}) {
  const service = createServiceClient();
  const page = String(params.currentPage ?? "/platform-admin").split("?")[0] || "/platform-admin";

  const [
    openErrorsResult,
    criticalErrorsResult,
    criticalAlertsResult,
    pendingQueueResult,
    riskDraftResult,
    documentApprovalResult,
    activeWorkspaceResult,
    healthChecksResult,
  ] = await Promise.all([
    service
      .from("error_logs")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
    service
      .from("error_logs")
      .select("id", { count: "exact", head: true })
      .eq("level", "critical")
      .is("resolved_at", null),
    service
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_resolved", false)
      .eq("level", "critical"),
    service
      .from("task_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("risk_assessments")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    service
      .from("editor_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "onay_bekliyor"),
    service
      .from("company_workspaces")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    service
      .from("health_checks")
      .select("component_key,status,checked_at")
      .order("checked_at", { ascending: false })
      .limit(8),
  ]);

  for (const error of [
    openErrorsResult.error,
    criticalErrorsResult.error,
    criticalAlertsResult.error,
    pendingQueueResult.error,
    riskDraftResult.error,
    documentApprovalResult.error,
    activeWorkspaceResult.error,
    healthChecksResult.error,
  ]) {
    if (error && !isCompatError(error.message)) {
      throw new Error(error.message);
    }
  }

  const degradedComponents = ((healthChecksResult.data ?? []) as Array<{
    component_key: string;
    status: "healthy" | "degraded" | "down";
    checked_at: string;
  }>)
    .filter((row) => row.status !== "healthy")
    .slice(0, 4)
    .map((row) => `${row.component_key}:${row.status}`);

  return [
    "Platform admin context:",
    `- current_page: ${page}`,
    `- active_workspaces: ${activeWorkspaceResult.count ?? 0}`,
    `- open_errors: ${openErrorsResult.count ?? 0}`,
    `- critical_errors: ${criticalErrorsResult.count ?? 0}`,
    `- critical_alerts: ${criticalAlertsResult.count ?? 0}`,
    `- pending_queue: ${pendingQueueResult.count ?? 0}`,
    `- draft_risk_assessments: ${riskDraftResult.count ?? 0}`,
    `- pending_document_approvals: ${documentApprovalResult.count ?? 0}`,
    `- degraded_components: ${degradedComponents.length > 0 ? degradedComponents.join(", ") : "none"}`,
    "- behavior: ic operasyon ve platform sagligi perspektifiyle cevap ver; tenant icerigi yazmak yerine global eksik, aksaklik, hata ve oncelikleri ozetle.",
    "- behavior: risk analizi, dokuman omurgasi, hata loglari ve kuyruk sinyalleri arasindaki baglantiyi kur.",
  ].join("\n");
}

async function buildOsgbManagerContextNote(params: {
  organizationId: string;
  companyWorkspaceId: string | null;
  currentPage?: string;
}) {
  const service = createServiceClient();
  const page = String(params.currentPage ?? "/solution-center").split("?")[0] || "/solution-center";

  const companyPromise = params.companyWorkspaceId
    ? service
        .from("company_workspaces")
        .select(
          `
          id,
          display_name,
          company_identities (
            official_name
          )
        `,
        )
        .eq("organization_id", params.organizationId)
        .eq("id", params.companyWorkspaceId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const taskQuery = service
    .from("workspace_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId);
  const overdueTaskQuery = service
    .from("workspace_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .lt("due_date", new Date().toISOString().slice(0, 10))
    .in("status", ["open", "in_progress"]);
  const assignmentQuery = service
    .from("workspace_assignments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .eq("assignment_status", "active");
  const documentQuery = service
    .from("editor_documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .eq("status", "onay_bekliyor");

  if (params.companyWorkspaceId) {
    taskQuery.eq("company_workspace_id", params.companyWorkspaceId);
    overdueTaskQuery.eq("company_workspace_id", params.companyWorkspaceId);
    assignmentQuery.eq("company_workspace_id", params.companyWorkspaceId);
    documentQuery.eq("company_workspace_id", params.companyWorkspaceId);
  }

  const [
    companyResult,
    openTasksResult,
    overdueTasksResult,
    assignmentsResult,
    pendingDocumentsResult,
  ] = await Promise.all([
    companyPromise,
    taskQuery,
    overdueTaskQuery,
    assignmentQuery,
    documentQuery,
  ]);

  for (const error of [
    companyResult.error,
    openTasksResult.error,
    overdueTasksResult.error,
    assignmentsResult.error,
    pendingDocumentsResult.error,
  ]) {
    if (error && !isCompatError(error.message)) {
      throw new Error(error.message);
    }
  }

  const companyRow = companyResult.data as
    | {
        display_name?: string | null;
        company_identities?:
          | { official_name?: string | null }
          | Array<{ official_name?: string | null }>
          | null;
      }
    | null;
  const identity = Array.isArray(companyRow?.company_identities)
    ? companyRow?.company_identities[0]
    : companyRow?.company_identities;
  const companyLabel =
    companyRow?.display_name ||
    identity?.official_name ||
    (params.companyWorkspaceId ? "secili firma" : "tum portfoy");

  return [
    "OSGB manager context:",
    `- current_page: ${page}`,
    `- scope: ${companyLabel}`,
    `- open_tasks: ${openTasksResult.count ?? 0}`,
    `- overdue_tasks: ${overdueTasksResult.count ?? 0}`,
    `- active_assignments: ${assignmentsResult.count ?? 0}`,
    `- pending_document_approvals: ${pendingDocumentsResult.count ?? 0}`,
    "- behavior: yonetici perspektifiyle cevap ver; personel yuk dagilimi, atama bosluklari, geciken isler ve belge/onay riski uzerine odaklan.",
    params.companyWorkspaceId
      ? "- constraint: kullanici firma secimi yapmis durumda; varsayilan olarak yalnizca bu firma kapsaminda analiz yap."
      : "- constraint: kullanici portfoy seviyesinde; firma bazli ozet verirken acikca hangi firmadan bahsettigini soyle.",
  ].join("\n");
}

async function buildEnterpriseContextNote(params: {
  organizationId: string;
  companyWorkspaceId: string | null;
  currentPage?: string;
}) {
  const service = createServiceClient();
  const page = String(params.currentPage ?? "/solution-center").split("?")[0] || "/solution-center";

  const workspaceQuery = service
    .from("company_workspaces")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .eq("status", "active");
  const taskQuery = service
    .from("workspace_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId);
  const documentQuery = service
    .from("editor_documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .eq("status", "onay_bekliyor");

  if (params.companyWorkspaceId) {
    taskQuery.eq("company_workspace_id", params.companyWorkspaceId);
    documentQuery.eq("company_workspace_id", params.companyWorkspaceId);
  }

  const [workspaceResult, taskResult, documentResult] = await Promise.all([
    workspaceQuery,
    taskQuery,
    documentQuery,
  ]);

  for (const error of [workspaceResult.error, taskResult.error, documentResult.error]) {
    if (error && !isCompatError(error.message)) {
      throw new Error(error.message);
    }
  }

  return [
    "Enterprise context:",
    `- current_page: ${page}`,
    `- active_workspaces: ${workspaceResult.count ?? 0}`,
    `- open_tasks: ${taskResult.count ?? 0}`,
    `- pending_document_approvals: ${documentResult.count ?? 0}`,
    params.companyWorkspaceId
      ? "- scope: kullanici secili kurumsal firma/workspace baglaminda."
      : "- scope: kullanici kurumsal portfoy seviyesinde.",
    "- behavior: cevaplarini kurumsal yonetim perspektifiyle ver; standardizasyon, lokasyonlar arasi tutarlilik, dokuman onaylari ve raporlama onceliklerine odaklan.",
  ].join("\n");
}

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL tanimli degil.");
  }
  return value.replace(/\/+$/, "");
}

function getPublishableKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY veya NEXT_PUBLIC_SUPABASE_ANON_KEY tanimli degil.",
    );
  }

  return value;
}

function resolveWorkspaceCountryCode(
  rawWorkspace:
    | { country_code?: string | null }
    | { country_code?: string | null }[]
    | null
    | undefined,
) {
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;
  return workspace?.country_code ?? "TR";
}

async function resolveWorkspaceFallback(
  client: SupabaseClient,
  userId: string,
) {
  const { data } = await client
    .from("nova_workspace_members")
    .select(
      `
      workspace:nova_workspaces!inner (
        id,
        country_code
      )
    `,
    )
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = data as
    | {
        workspace?:
          | { id?: string | null; country_code?: string | null }
          | { id?: string | null; country_code?: string | null }[]
          | null;
      }
    | null;

  const rawWorkspace = row?.workspace as
    | { id?: string | null; country_code?: string | null }
    | { id?: string | null; country_code?: string | null }[]
    | null
    | undefined;
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;

  return {
    workspaceId: workspace?.id ?? null,
    jurisdictionCode: workspace?.country_code ?? "TR",
  };
}

async function resolveAuthFromAccessToken(accessToken: string) {
  const tokenClient = createSupabaseClient(getSupabaseUrl(), getPublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error,
  } = await tokenClient.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  // tokenClient RLS passes (auth.uid() === user.id); supabaseServer cookie
  // yoksa RLS profile'i gizliyor ve Nova 401 donuyordu.
  const { data: profile, error: profileError } = await tokenClient
    .from("user_profiles")
    .select(`
      organization_id,
      active_workspace_id,
      active_workspace:nova_workspaces!user_profiles_active_workspace_id_fkey (
        country_code
      )
    `)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError && !profileError.message.includes("active_workspace_id")) {
    return null;
  }

  if (profileError?.message.includes("active_workspace_id")) {
    const { data: orgProfile } = await tokenClient
      .from("user_profiles")
      .select("organization_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!orgProfile?.organization_id) {
      return null;
    }

    const fallback = await resolveWorkspaceFallback(tokenClient, user.id);
    return {
      userId: user.id,
      organizationId: orgProfile.organization_id,
      workspaceId: fallback.workspaceId,
      jurisdictionCode: fallback.jurisdictionCode,
      accessToken,
    };
  }

  if (!profile?.organization_id) {
    return null;
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    workspaceId: profile.active_workspace_id ?? null,
    jurisdictionCode: resolveWorkspaceCountryCode(
      profile.active_workspace as
        | { country_code?: string | null }
        | { country_code?: string | null }[]
        | null
        | undefined,
    ),
    accessToken,
  };
}

async function hasAiUsePermission(accessToken: string) {
  const tokenClient = createSupabaseClient(getSupabaseUrl(), getPublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await tokenClient.rpc("user_has_permission", {
    p_permission_code: "ai.use",
  });

  if (error) {
    return false;
  }

  return data === true;
}

async function hasLegacyNovaManagerAccess(userId: string) {
  try {
    const accountContext = await getAccountContextForUser(userId);
    return accountContext.isPlatformAdmin || hasOsgbManagementAccess(accountContext);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, novaChatRequestSchema);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const supabase = await createClient();
    const internalServiceSecret =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

    let authContext =
      payload.access_token
        ? await resolveAuthFromAccessToken(payload.access_token)
        : null;
    const requestedCompanyWorkspaceId =
      payload.company_workspace_id ??
      extractWorkspaceIdFromCurrentPage(payload.current_page);

    let useInternalNovaAuth = false;

    if (!authContext) {
      const auth = await requirePermission(request, "ai.use");
      if (!auth.ok) return auth.response;

      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();

      const accessToken =
        refreshData.session?.access_token ??
        (await supabase.auth.getSession()).data.session?.access_token ??
        null;

      authContext = {
        userId: auth.userId,
        organizationId: auth.organizationId,
        workspaceId: null,
        jurisdictionCode: "TR",
        accessToken: accessToken ?? "",
      };

      const { data: profile } = await supabase
        .from("user_profiles")
        .select(`
          active_workspace_id,
          active_workspace:nova_workspaces!user_profiles_active_workspace_id_fkey (
            country_code
          )
        `)
        .eq("auth_user_id", auth.userId)
        .maybeSingle();
      if (profile?.active_workspace_id !== undefined) {
        authContext.workspaceId = profile?.active_workspace_id ?? null;
        authContext.jurisdictionCode = resolveWorkspaceCountryCode(
          profile?.active_workspace as
            | { country_code?: string | null }
            | { country_code?: string | null }[]
            | null
            | undefined,
        );
      } else {
        const fallbackClient = createSupabaseClient(getSupabaseUrl(), getPublishableKey(), {
          auth: { persistSession: false, autoRefreshToken: false },
          global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
        });
        const fallback = await resolveWorkspaceFallback(fallbackClient, auth.userId);
        authContext.workspaceId = fallback.workspaceId;
        authContext.jurisdictionCode = fallback.jurisdictionCode;
      }

      useInternalNovaAuth = !accessToken;

      if (useInternalNovaAuth && !internalServiceSecret) {
        return NextResponse.json(
          {
            message:
              "Nova sunucu dogrulama katmani su an hazir degil. Lutfen daha sonra tekrar deneyin.",
            detail: refreshError?.message ?? "internal_auth_secret_missing",
          },
          { status: 500 },
        );
      }
    } else if (
      !(await hasAiUsePermission(payload.access_token!)) &&
      !(await hasLegacyNovaManagerAccess(authContext.userId))
    ) {
      return NextResponse.json(
        { message: "Bu islem icin gerekli yetki bulunmuyor. (ERR_AUTH_006)" },
        { status: 403 },
      );
    }

    const accountContext = await getAccountContextForUser(authContext.userId);
    const contextualHistory = [...payload.history];

    if (
      accountContext.isPlatformAdmin &&
      isPlatformAdminSurface(payload.current_page)
    ) {
      const platformAdminContextNote = await buildPlatformAdminContextNote({
        currentPage: payload.current_page,
      });

      contextualHistory.unshift({
        role: "assistant",
        content: platformAdminContextNote,
      });
    } else if (
      accountContext.accountType === "osgb" &&
      hasOsgbManagementAccess(accountContext) &&
      isOsgbManagerSurface(payload.current_page)
    ) {
      const managerContextNote = await buildOsgbManagerContextNote({
        organizationId: authContext.organizationId,
        companyWorkspaceId: requestedCompanyWorkspaceId,
        currentPage: payload.current_page,
      });

      contextualHistory.unshift({
        role: "assistant",
        content: managerContextNote,
      });
    } else if (
      accountContext.accountType === "enterprise" &&
      isEnterpriseSurface(payload.current_page)
    ) {
      const enterpriseContextNote = await buildEnterpriseContextNote({
        organizationId: authContext.organizationId,
        companyWorkspaceId: requestedCompanyWorkspaceId,
        currentPage: payload.current_page,
      });

      contextualHistory.unshift({
        role: "assistant",
        content: enterpriseContextNote,
      });
    }

    const rolloutResponse = await assertNovaFeatureEnabled({
      featureKey: "nova.agent.chat",
      userId: authContext.userId,
      organizationId: authContext.organizationId,
      workspaceId: payload.workspace_id ?? authContext.workspaceId ?? null,
      fallbackMessage:
        "Nova bu tenant icin kontrollu rollout asamasinda kapali. Lutfen daha sonra tekrar deneyin.",
    });
    if (rolloutResponse) {
      return rolloutResponse;
    }

    const plan = await resolveAiDailyLimit(authContext.userId);
    const rateLimitResponse = await enforceRateLimit(request, {
      userId: authContext.userId,
      organizationId: authContext.organizationId,
      endpoint: "/api/nova/chat",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: {
        feature: "nova_agent",
        context_surface: payload.context_surface,
        mode: payload.mode,
        current_page: payload.current_page ?? null,
        company_workspace_id: requestedCompanyWorkspaceId,
      },
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: getPublishableKey(),
    };

    if (authContext.accessToken) {
      headers.Authorization = `Bearer ${authContext.accessToken}`;
    }

    if (useInternalNovaAuth && internalServiceSecret) {
      headers["x-nova-internal-auth"] = internalServiceSecret;
      headers["x-nova-user-id"] = authContext.userId;
      headers["x-nova-organization-id"] = authContext.organizationId;
    }

    const response = await fetch(`${getSupabaseUrl()}/functions/v1/solution-chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: payload.message,
        organization_id: authContext.organizationId,
        ...(payload.workspace_id || authContext.workspaceId
          ? { workspace_id: payload.workspace_id ?? authContext.workspaceId }
          : {}),
        ...(requestedCompanyWorkspaceId
          ? { company_workspace_id: requestedCompanyWorkspaceId }
          : {}),
        jurisdiction_code: payload.jurisdiction_code ?? authContext.jurisdictionCode ?? "TR",
        ...(payload.session_id ? { session_id: payload.session_id } : {}),
        language: payload.language,
        as_of_date: payload.as_of_date ?? new Date().toISOString().slice(0, 10),
        answer_mode: payload.answer_mode,
        mode: payload.mode,
        context_surface: payload.context_surface,
        confirmation_token: payload.confirmation_token ?? null,
        history: contextualHistory,
      }),
      cache: "no-store",
    });

    const rawText = await response.text();

    try {
      const json = rawText ? JSON.parse(rawText) : {};
      const normalized: NovaAgentResponse = normalizeNovaAgentResponse({
        ...json,
        telemetry: {
          ...(json?.telemetry && typeof json.telemetry === "object" ? json.telemetry : {}),
          gateway_mode: payload.mode,
          context_surface: payload.context_surface,
          plan_key: plan.planKey,
          current_page: payload.current_page ?? null,
          company_workspace_id: requestedCompanyWorkspaceId,
        },
      });
      return NextResponse.json(normalized, { status: response.status });
    } catch {
      return NextResponse.json(
        normalizeNovaAgentResponse({
          type: "safety_block",
          message: rawText || "Nova servisi beklenmeyen bir yanit dondurdu.",
          safety_block: {
            code: "invalid_nova_payload",
            title: "Nova yaniti okunamadi",
            message: rawText || "Nova servisi beklenmeyen bir yanit dondurdu.",
          },
        }),
        { status: response.status },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ message }, { status: 500 });
  }
}

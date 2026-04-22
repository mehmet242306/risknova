import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendCompanyInvitationEmail } from "@/lib/mailer";
import { createServiceClient, parseJsonBody } from "@/lib/security/server";

const bodySchema = z.object({
  email: z.string().trim().email("Gecerli bir e-posta girin."),
  // owner is intentionally excluded — ownership is transferred, not invited.
  invitedRole: z
    .enum(["admin", "manager", "editor", "viewer"])
    .optional()
    .default("viewer"),
  message: z.string().trim().max(2000).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(60).optional().default(14),
});

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Sahip";
    case "admin":
      return "Yonetici";
    case "manager":
      return "Mudur";
    case "editor":
      return "Editor";
    case "viewer":
      return "Goruntuleyici";
    default:
      return role;
  }
}

type CompanyIdentityJoin = { official_name: string | null } | { official_name: string | null }[] | null;

function extractIdentityName(value: CompanyIdentityJoin): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.official_name ?? null;
  return value.official_name ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyWorkspaceId } = await params;

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase configuration missing" },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: workspace, error: workspaceError } = await service
    .from("company_workspaces")
    .select(
      "id, company_identity_id, organization_id, display_name, company_identities!inner(official_name)",
    )
    .eq("id", companyWorkspaceId)
    .maybeSingle();

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  }
  if (!workspace?.id) {
    return NextResponse.json({ error: "Firma kaydi bulunamadi." }, { status: 404 });
  }

  const { data: canManage, error: canManageError } = await supabase.rpc(
    "can_manage_company_invitations",
    { p_company_identity_id: workspace.company_identity_id },
  );

  if (canManageError) {
    return NextResponse.json({ error: canManageError.message }, { status: 500 });
  }
  if (!canManage) {
    return NextResponse.json(
      { error: "Bu firma icin davet gonderme yetkiniz yok." },
      { status: 403 },
    );
  }

  const inviteeEmail = parsed.data.email.toLowerCase();
  const expiresInDays = parsed.data.expiresInDays ?? 14;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data: invitation, error: inviteError } = await service
    .from("company_invitations")
    .insert({
      company_identity_id: workspace.company_identity_id,
      company_workspace_id: workspace.id,
      inviter_user_id: user.id,
      invitee_email: inviteeEmail,
      invited_role: parsed.data.invitedRole,
      message: parsed.data.message ?? null,
      expires_at: expiresAt.toISOString(),
      status: "pending",
    })
    .select("id, invited_role, invitee_email, expires_at, status")
    .single();

  if (inviteError || !invitation) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Davet kaydi olusturulamadi." },
      { status: 500 },
    );
  }

  const { data: inviterProfile } = await service
    .from("user_profiles")
    .select("full_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const inviterName =
    inviterProfile?.full_name?.trim() ||
    inviterProfile?.email ||
    user.email ||
    "Bir kullanici";

  const identityName = extractIdentityName(
    workspace.company_identities as CompanyIdentityJoin,
  );
  const companyName =
    workspace.display_name?.trim() || identityName?.trim() || "Firma";

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  const inviteUrl = `${origin}/invite/${invitation.id}`;

  let delivery: { delivered: boolean; mode: "resend" | "preview"; reason?: string };
  try {
    delivery = await sendCompanyInvitationEmail({
      to: inviteeEmail,
      companyName,
      inviterName,
      inviteUrl,
      roleLabel: roleLabel(parsed.data.invitedRole),
      message: parsed.data.message ?? null,
      expiresAtLabel: new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(expiresAt),
    });
  } catch (e) {
    delivery = {
      delivered: false,
      mode: "preview",
      reason: e instanceof Error ? e.message : "Email teslim edilemedi.",
    };
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      id: invitation.id,
      invitedRole: invitation.invited_role,
      inviteeEmail: invitation.invitee_email,
      expiresAt: invitation.expires_at,
      status: invitation.status,
      inviteUrl,
    },
    delivery,
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  enforceRateLimitWithContext,
  logSecurityEventWithContext,
} from "@/lib/security/server";
import {
  listSessions,
  parseDeviceInfo,
  registerSession,
} from "@/lib/session-tracker";
import { sendSuspiciousLoginEmail } from "@/lib/mailer";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext =
    String(formData.get("next") ?? "/dashboard").trim() || "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";

  if (!email || !password) {
    redirect("/login?error=E-posta ve sifre zorunludur.");
  }

  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "unknown";
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "0.0.0.0";

  let knownUserId: string | null = null;
  let knownOrganizationId: string | null = null;

  try {
    const service = createServiceClient();
    const { data: knownProfile } = await service
      .from("user_profiles")
      .select("auth_user_id, organization_id")
      .eq("email", email)
      .maybeSingle();

    knownUserId = knownProfile?.auth_user_id ?? null;
    knownOrganizationId = knownProfile?.organization_id ?? null;
  } catch (lookupError) {
    console.warn("[login] profile lookup failed:", lookupError);
  }

  if (knownUserId) {
    const rateLimitResponse = await enforceRateLimitWithContext({
      userId: knownUserId,
      organizationId: knownOrganizationId,
      endpoint: "/auth/login",
      scope: "auth",
      limit: 10,
      windowSeconds: 15 * 60,
      ipAddress,
      userAgent,
      metadata: { email },
    });

    if (rateLimitResponse) {
      redirect("/login?error=Cok fazla giris denemesi yaptiniz. Lutfen 15 dakika sonra tekrar deneyin.");
    }
  }

  try {
    const service = createServiceClient();
    const { data: lockoutData, error: lockoutError } = await service.rpc(
      "get_login_lockout",
      {
        p_email: email,
        p_user_id: knownUserId,
      },
    );

    if (!lockoutError) {
      const lockoutRow = Array.isArray(lockoutData) ? lockoutData[0] : lockoutData;
      if (lockoutRow?.is_locked) {
        redirect(
          `/login?error=${encodeURIComponent("Hesap gecici olarak kilitlendi. Lutfen daha sonra tekrar deneyin.")}`,
        );
      }
    }
  } catch (lockoutCheckError) {
    console.warn("[login] lockout check failed:", lockoutCheckError);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const raw = error.message.toLowerCase();

    let message = "Giriş başarısız. Bilgilerini kontrol et.";
    if (raw.includes("email not confirmed")) {
      message = "E-posta adresini doğrulaman gerekiyor.";
    } else if (raw.includes("invalid login credentials")) {
      message = "E-posta veya şifre hatalı.";
    }

    await logSecurityEventWithContext({
      eventType: "auth.login_failed",
      severity: "warning",
      endpoint: "/auth/login",
      userId: knownUserId,
      organizationId: knownOrganizationId,
      ipAddress,
      userAgent,
      details: { email, reason: raw.slice(0, 180) },
    });

    try {
      const service = createServiceClient();
      await service.rpc("register_login_failure", {
        p_email: email,
        p_user_id: knownUserId,
        p_organization_id: knownOrganizationId,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      });
    } catch (lockoutWriteError) {
      console.warn("[login] register_login_failure failed:", lockoutWriteError);
    }

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const accessToken = data.session?.access_token;
  const signedInUser = data.user;
  const backendBaseUrl =
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

  if (signedInUser && accessToken) {
    try {
      const service = createServiceClient();
      await service.rpc("clear_login_failures", {
        p_email: email,
        p_user_id: signedInUser.id,
      });
    } catch (lockoutClearError) {
      console.warn("[login] clear_login_failures failed:", lockoutClearError);
    }

    const existingSessions = await listSessions(supabase, signedInUser.id);
    const deviceInfo = parseDeviceInfo(userAgent);
    const knownSession = existingSessions.find(
      (session) =>
        session.ip_address === ipAddress && session.device_info === deviceInfo,
    );

    await registerSession(
      supabase,
      signedInUser.id,
      accessToken,
      userAgent,
      ipAddress,
    );

    if (!knownSession && signedInUser.email) {
      await sendSuspiciousLoginEmail({
        to: signedInUser.email,
        deviceInfo,
        ipAddress,
        occurredAt: new Date().toLocaleString("tr-TR"),
      });
    }

    await logSecurityEventWithContext({
      eventType: "auth.login_succeeded",
      severity: "info",
      endpoint: "/auth/login",
      userId: signedInUser.id,
      organizationId: knownOrganizationId,
      ipAddress,
      userAgent,
      details: {
        deviceInfo,
        suspicious: !knownSession,
      },
    });
  }

  if (accessToken) {
    try {
      await fetch(`${backendBaseUrl}/api/v1/audit-events/login`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
    } catch (auditError) {
      console.error("Login audit log request failed:", auditError);
    }
  }

  const { data: assuranceData, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  revalidatePath("/", "layout");

  if (
    !assuranceError &&
    assuranceData?.nextLevel === "aal2" &&
    assuranceData.currentLevel !== "aal2"
  ) {
    const resolvedNext = signedInUser
      ? resolvePostLoginPath(await getAccountContextForUser(signedInUser.id))
      : next;
    redirect(`/auth/mfa-challenge?next=${encodeURIComponent(resolvedNext)}`);
  }

  if (!signedInUser) {
    redirect(next);
  }

  redirect(resolvePostLoginPath(await getAccountContextForUser(signedInUser.id)));
}

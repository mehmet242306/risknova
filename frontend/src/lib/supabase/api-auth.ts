/**
 * API Auth Helpers — Parça B Güvenlik Katmanı
 *
 * Next.js API route'ları için yeniden kullanılabilir auth/RBAC helper'ları.
 * Adım 0.5 Parça B kapsamında yazıldı (2026-04-11).
 *
 * Kullanım deseni:
 * ```ts
 * // Sadece authenticated kullanıcıya izin ver (ORTA risk route'lar)
 * export async function POST(req: NextRequest) {
 *   const auth = await requireAuth(req);
 *   if (!auth.ok) return auth.response;
 *   // auth.userId, auth.organizationId kullanılabilir
 * }
 *
 * // Sadece super admin'e izin ver (KRİTİK risk route'lar)
 * export async function POST(req: NextRequest) {
 *   const auth = await requireSuperAdmin(req);
 *   if (!auth.ok) return auth.response;
 * }
 *
 * // Hedef org'un üyesi mi? (import-employees gibi özel durumlar)
 * export async function POST(req: NextRequest) {
 *   const body = await req.json();
 *   const auth = await requireOrgMember(req); // kullanıcının kendi org'unu döner
 *   if (!auth.ok) return auth.response;
 *   // auth.organizationId GÜVENİLİR — client body'sinden değil, user_profiles'tan
 * }
 * ```
 *
 * Güvenlik ilkeleri:
 * - JWT doğrulama: anon key client (kullanıcının kendi token'ıyla)
 * - Super admin RPC: service role (güvenilir lookup için)
 * - Tenant filtreleme: user_profiles'tan service role ile okunur
 * - Client body'sindeki organization_id değerine ASLA güvenilmez
 * - Her hata 401/403 + Türkçe mesaj + ERR kodu, sessiz fail yok
 * - Tüm Supabase çağrıları 5 saniye timeout ile korunur
 *
 * Referans: docs/database-hardening-plan.md §13.2 Parça B, §19.3, §20
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ============================================================================
// Sabitler
// ============================================================================

/** Tüm Supabase çağrıları için maksimum bekleme süresi */
const AUTH_TIMEOUT_MS = 5000;

// ============================================================================
// Tipler
// ============================================================================

/**
 * Başarılı doğrulama sonucu.
 * - userId: Supabase auth user id (auth.users.id)
 * - organizationId: user_profiles.organization_id
 * - userProfileId: user_profiles.id
 * - isSuperAdmin: sadece requireSuperAdmin başarılıysa true
 */
export type AuthOk = {
  ok: true;
  userId: string;
  organizationId: string;
  userProfileId: string;
  isSuperAdmin: boolean;
};

/**
 * Başarısız doğrulama sonucu. response hazır, doğrudan `return` edilir.
 */
export type AuthFail = {
  ok: false;
  code: AuthErrorCode;
  response: NextResponse;
};

export type AuthResult = AuthOk | AuthFail;

export type AuthErrorCode =
  | "unauthorized_no_token"
  | "unauthorized_invalid_token"
  | "forbidden_profile_missing"
  | "forbidden_not_super_admin"
  | "forbidden_wrong_organization"
  | "server_error_supabase_unavailable";

// ============================================================================
// Hata tanımları (kod + mesaj + HTTP status)
// ============================================================================

/**
 * Her hata kodu için kullanıcıya gösterilecek mesaj, dahili ERR kodu ve HTTP status.
 * ERR kodları destek için — kullanıcı bu kodu bildirebilir, biz log'da ararız.
 */
const AUTH_ERRORS: Record<
  AuthErrorCode,
  { message: string; errCode: string; status: 401 | 403 | 500 }
> = {
  unauthorized_no_token: {
    message: "Oturum bulunamadı. Lütfen giriş yapın.",
    errCode: "ERR_AUTH_001",
    status: 401,
  },
  unauthorized_invalid_token: {
    message: "Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.",
    errCode: "ERR_AUTH_002",
    status: 401,
  },
  forbidden_profile_missing: {
    message:
      "Kullanıcı profiliniz bulunamadı. Lütfen yönetici ile iletişime geçin. (ERR_AUTH_003)",
    errCode: "ERR_AUTH_003",
    status: 403,
  },
  forbidden_not_super_admin: {
    message: "Bu işlem için süper admin yetkisi gerekli. (ERR_AUTH_004)",
    errCode: "ERR_AUTH_004",
    status: 403,
  },
  forbidden_wrong_organization: {
    message: "Bu organizasyona erişim yetkiniz yok. (ERR_AUTH_005)",
    errCode: "ERR_AUTH_005",
    status: 403,
  },
  server_error_supabase_unavailable: {
    message:
      "Sunucu hatası: kimlik doğrulama servisi geçici olarak kullanılamıyor. Lütfen tekrar deneyin. (ERR_AUTH_500)",
    errCode: "ERR_AUTH_500",
    status: 500,
  },
};

// ============================================================================
// Dahili yardımcılar
// ============================================================================

/**
 * Timestamped, context-aware error logger.
 * Format: [api-auth] [2026-04-11T12:34:56.789Z] [user=xxx] <message> <error>
 */
function logAuth(
  message: string,
  context: { userId?: string; error?: unknown } = {}
): void {
  const ts = new Date().toISOString();
  const userPart = context.userId ? ` [user=${context.userId}]` : "";
  const errorPart = context.error !== undefined ? context.error : "";
  // eslint-disable-next-line no-console
  console.error(`[api-auth] [${ts}]${userPart} ${message}`, errorPart);
}

/**
 * Promise'ı timeout ile sarmalar. ms süresi içinde dönmezse Error('timeout_<label>') fırlatır.
 * Finally blokunda timer temizlenir — memory leak yok.
 */
async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  errorLabel: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`timeout_${errorLabel}`)),
      ms
    );
  });
  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * Standart hata response oluşturur — kod + mesaj + HTTP status.
 * Client tarafı hata kodunu (errCode) kullanıcıya gösterebilir ya da destek için kopyalayabilir.
 */
function authErrorResponse(code: AuthErrorCode): NextResponse {
  const def = AUTH_ERRORS[code];
  return NextResponse.json(
    {
      error: code,
      errCode: def.errCode,
      message: def.message,
    },
    { status: def.status }
  );
}

/**
 * Anon key Supabase client oluşturur, kullanıcının JWT'sini Authorization header olarak geçirir.
 */
function createAnonClient(token: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Service role Supabase client. SADECE kontrollü, kimliği doğrulanmış kullanıcılar
 * için RPC çağrıları ve profile lookup amacıyla kullanılır. RLS bypass eder.
 */
function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Request'ten Bearer token çeker, anon client ile doğrular.
 * Döner: { userId } veya hata kodu.
 */
async function getAuthenticatedUser(
  req: NextRequest
): Promise<
  | { ok: true; userId: string }
  | {
      ok: false;
      code:
        | "unauthorized_no_token"
        | "unauthorized_invalid_token"
        | "server_error_supabase_unavailable";
    }
> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { ok: false, code: "unauthorized_no_token" };
  }

  const anonClient = createAnonClient(token);
  if (!anonClient) {
    logAuth("createAnonClient failed — env vars missing?");
    return { ok: false, code: "server_error_supabase_unavailable" };
  }

  try {
    const {
      data: { user },
      error,
    } = await withTimeout(
      anonClient.auth.getUser(),
      AUTH_TIMEOUT_MS,
      "auth_getuser"
    );

    if (error || !user) {
      return { ok: false, code: "unauthorized_invalid_token" };
    }

    return { ok: true, userId: user.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("timeout_")) {
      logAuth("auth.getUser() timed out", { error: msg });
      return { ok: false, code: "server_error_supabase_unavailable" };
    }
    logAuth("auth.getUser() unexpected error", { error: err });
    return { ok: false, code: "unauthorized_invalid_token" };
  }
}

/**
 * Kullanıcının user_profiles kaydını service role ile çeker.
 * Orphan user (auth'da var, profile yok) durumu null döner.
 */
async function resolveUserProfile(
  userId: string
): Promise<
  | { profileId: string; organizationId: string | null }
  | { error: "not_found" }
  | { error: "supabase_unavailable" }
> {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    logAuth("createServiceClient failed — SUPABASE_SERVICE_ROLE_KEY missing?", {
      userId,
    });
    return { error: "supabase_unavailable" };
  }

  try {
    const { data, error } = await withTimeout(
      serviceClient
        .from("user_profiles")
        .select("id, organization_id")
        .eq("auth_user_id", userId)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      AUTH_TIMEOUT_MS,
      "resolve_profile"
    );

    if (error) {
      logAuth("resolveUserProfile query error", { userId, error });
      return { error: "supabase_unavailable" };
    }

    if (!data) {
      return { error: "not_found" };
    }

    return {
      profileId: data.id,
      organizationId: data.organization_id ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("timeout_")) {
      logAuth("resolveUserProfile timed out", { userId, error: msg });
    } else {
      logAuth("resolveUserProfile unexpected error", { userId, error: err });
    }
    return { error: "supabase_unavailable" };
  }
}

/**
 * is_super_admin(uid) RPC çağrısı. Service role kullanır.
 */
async function checkIsSuperAdmin(
  userId: string
): Promise<{ ok: true; isSuperAdmin: boolean } | { ok: false }> {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    logAuth("createServiceClient failed for is_super_admin check", { userId });
    return { ok: false };
  }

  try {
    const { data, error } = await withTimeout(
      serviceClient.rpc("is_super_admin", { uid: userId }),
      AUTH_TIMEOUT_MS,
      "rpc_is_super_admin"
    );

    if (error) {
      logAuth("is_super_admin RPC error", { userId, error });
      return { ok: false };
    }

    return { ok: true, isSuperAdmin: data === true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("timeout_")) {
      logAuth("is_super_admin RPC timed out", { userId, error: msg });
    } else {
      logAuth("is_super_admin RPC unexpected error", { userId, error: err });
    }
    return { ok: false };
  }
}

// ============================================================================
// Dışa açılan 3 helper
// ============================================================================

/**
 * Sadece authenticated kullanıcıya izin verir. Profile yoksa 403 döner.
 *
 * Başarılı durumda: userId, organizationId, userProfileId dolu, isSuperAdmin=false.
 *
 * Hata kodları:
 * - 401 unauthorized_no_token (ERR_AUTH_001): Authorization header yok
 * - 401 unauthorized_invalid_token (ERR_AUTH_002): Token geçersiz/süresi dolmuş
 * - 403 forbidden_profile_missing (ERR_AUTH_003): Orphan user veya organizationId null
 * - 500 server_error_supabase_unavailable (ERR_AUTH_500): Supabase erişilemiyor/timeout
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const userResult = await getAuthenticatedUser(req);

  if (!userResult.ok) {
    return {
      ok: false,
      code: userResult.code,
      response: authErrorResponse(userResult.code),
    };
  }

  const profile = await resolveUserProfile(userResult.userId);

  if ("error" in profile) {
    if (profile.error === "not_found") {
      // Orphan user
      return {
        ok: false,
        code: "forbidden_profile_missing",
        response: authErrorResponse("forbidden_profile_missing"),
      };
    }
    // supabase_unavailable
    return {
      ok: false,
      code: "server_error_supabase_unavailable",
      response: authErrorResponse("server_error_supabase_unavailable"),
    };
  }

  // Profile var ama organizationId null olabilir (veri tutarsızlığı) → profile missing muamelesi
  if (profile.organizationId === null) {
    logAuth("user_profiles.organization_id is NULL for authenticated user", {
      userId: userResult.userId,
    });
    return {
      ok: false,
      code: "forbidden_profile_missing",
      response: authErrorResponse("forbidden_profile_missing"),
    };
  }

  return {
    ok: true,
    userId: userResult.userId,
    organizationId: profile.organizationId,
    userProfileId: profile.profileId,
    isSuperAdmin: false,
  };
}

/**
 * Super admin yetkisi gerektirir.
 *
 * Hata kodları (requireAuth'un hepsine ek olarak):
 * - 403 forbidden_not_super_admin (ERR_AUTH_004): Kullanıcı super admin değil
 */
export async function requireSuperAdmin(req: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult;

  const superCheck = await checkIsSuperAdmin(authResult.userId);

  if (!superCheck.ok) {
    return {
      ok: false,
      code: "server_error_supabase_unavailable",
      response: authErrorResponse("server_error_supabase_unavailable"),
    };
  }

  if (!superCheck.isSuperAdmin) {
    return {
      ok: false,
      code: "forbidden_not_super_admin",
      response: authErrorResponse("forbidden_not_super_admin"),
    };
  }

  return { ...authResult, isSuperAdmin: true };
}

/**
 * Kullanıcının belirli bir organizasyona üye olduğunu doğrular.
 *
 * targetOrgId parametresi:
 * - Verilmezse: kullanıcının kendi org'unu döner
 * - Verilirse: kullanıcının bu org'a üye olduğunu doğrular, değilse 403
 *
 * ÖNEMLİ: import-employees gibi route'larda, client body'sindeki organization_id
 * değeri ASLA doğrudan kullanılmamalı. Bu helper'dan dönen auth.organizationId
 * kullanılmalı — o değer user_profiles'tan gelir ve güvenilirdir.
 *
 * Hata kodları:
 * - requireAuth'un hepsi
 * - 403 forbidden_wrong_organization (ERR_AUTH_005): targetOrgId kullanıcının org'u değil
 */
export async function requireOrgMember(
  req: NextRequest,
  targetOrgId?: string
): Promise<AuthResult> {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult;

  // requireAuth zaten organizationId === null durumunu 403 ile reddeder

  if (targetOrgId && targetOrgId !== authResult.organizationId) {
    return {
      ok: false,
      code: "forbidden_wrong_organization",
      response: authErrorResponse("forbidden_wrong_organization"),
    };
  }

  return authResult;
}

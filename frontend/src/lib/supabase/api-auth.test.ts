/**
 * api-auth.ts için unit testler (Vitest).
 *
 * Kapsam:
 * - requireAuth: 11 senaryo
 * - requireSuperAdmin: 5 senaryo
 * - requireOrgMember: 6 senaryo
 * - timeout protection: 2 senaryo
 * TOPLAM: 24 test
 *
 * Mock stratejisi:
 * - @supabase/supabase-js mock'lanır
 * - createClient çağrısı URL+key argümanlarına göre anon veya service client döndürür
 * - Her mock client'ın auth.getUser, from, rpc metotları ayrı ayrı set edilebilir
 * - Her test kendi davranışını belirler, beforeEach temiz state ile başlar
 *
 * Referans: docs/database-hardening-plan.md §13.2 Parça B, §20
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mock setup — @supabase/supabase-js
// ============================================================================

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

// Mock'tan sonra import et ki mock devreye girsin
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireSuperAdmin,
  requireOrgMember,
} from "./api-auth";

// ============================================================================
// Test sabitleri (gerçek DB değerleriyle uyumlu)
// ============================================================================

const VALID_USER_ID = "f0c09ad3-c0b0-4c39-b2a1-aa1bcaf8b01d";
const VALID_PROFILE_ID = "8b768009-af63-4d8f-9d41-3aee2add5f7c";
const VALID_ORG_ID = "6cb4ceca-89ee-4b13-b62d-f1abc9fd5768";
const OTHER_ORG_ID = "11111111-2222-3333-4444-555555555555";

// ============================================================================
// Mock client helpers
// ============================================================================

type MockClient = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

function createEmptyMockClient(): MockClient {
  return {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  };
}

/**
 * Query chain builder: .select(...).eq(...).order(...).limit(...).maybeSingle() zincirini simüle eder.
 * Zincirdeki her method chainable (return this), son çağrı sonucu döner.
 */
function buildQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

/**
 * Test için NextRequest oluşturur.
 * authHeader: Authorization header değeri; undefined → header yok
 */
function createReq(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers,
  });
}

// ============================================================================
// Global mock state (her test fresh start)
// ============================================================================

let mockAnonClient: MockClient;
let mockServiceClient: MockClient;
let mockCookieClient: MockClient;

beforeEach(() => {
  // Env var stub'ları
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon_test_key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service_test_key");

  // Fresh mock client'lar
  mockAnonClient = createEmptyMockClient();
  mockServiceClient = createEmptyMockClient();
  mockCookieClient = createEmptyMockClient();
  mockCookieClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });

  // createClient argümanına göre doğru client'ı dön
  vi.mocked(createClient).mockImplementation((_url: string, key: string) => {
    if (key === "service_test_key") {
      return mockServiceClient as never;
    }
    return mockAnonClient as never;
  });
  vi.mocked(createServerClient).mockReturnValue(mockCookieClient as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ============================================================================
// Yardımcı — happy path için mock'ları hazırla
// ============================================================================

function mockHappyPath(
  options: {
    userId?: string;
    profile?: { id: string; organization_id: string } | null;
    isSuperAdmin?: boolean;
  } = {}
) {
  const userId = options.userId ?? VALID_USER_ID;
  const profile =
    options.profile === undefined
      ? { id: VALID_PROFILE_ID, organization_id: VALID_ORG_ID }
      : options.profile;
  const isSuperAdmin = options.isSuperAdmin ?? false;

  mockAnonClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });

  mockServiceClient.from.mockReturnValue(
    buildQueryChain({ data: profile, error: null })
  );

  mockServiceClient.rpc.mockResolvedValue({
    data: isSuperAdmin,
    error: null,
  });
}

// ============================================================================
// TEST SUITE 1 — requireAuth
// ============================================================================

describe("requireAuth", () => {
  it("returns 401 ERR_AUTH_001 when authorization header is missing", async () => {
    const req = createReq(); // no header
    const result = await requireAuth(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unauthorized_no_token");
    expect(result.response.status).toBe(401);

    const body = await result.response.json();
    expect(body.error).toBe("unauthorized_no_token");
    expect(body.errCode).toBe("ERR_AUTH_001");
    expect(body.message).toContain("Oturum");
  });

  it("returns 401 ERR_AUTH_002 when token is invalid", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });

    const req = createReq("Bearer invalid_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unauthorized_invalid_token");
    expect(result.response.status).toBe(401);

    const body = await result.response.json();
    expect(body.errCode).toBe("ERR_AUTH_002");
  });

  it("returns ok=true with organizationId when token is valid and profile exists", async () => {
    mockHappyPath();
    const req = createReq("Bearer valid_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userId).toBe(VALID_USER_ID);
    expect(result.organizationId).toBe(VALID_ORG_ID);
    expect(result.userProfileId).toBe(VALID_PROFILE_ID);
    expect(result.isSuperAdmin).toBe(false);
  });

  it("accepts same-origin session cookie when authorization header is missing", async () => {
    mockCookieClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({
        data: { id: VALID_PROFILE_ID, organization_id: VALID_ORG_ID },
        error: null,
      })
    );

    const req = createReq();
    const result = await requireAuth(req);

    expect(result.ok).toBe(true);
    expect(createServerClient).toHaveBeenCalled();
  });

  it("returns 403 ERR_AUTH_003 when user_profiles row does not exist (orphan user)", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    // Profile not found — maybeSingle returns { data: null }
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({ data: null, error: null })
    );

    const req = createReq("Bearer valid_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden_profile_missing");
    expect(result.response.status).toBe(403);

    const body = await result.response.json();
    expect(body.errCode).toBe("ERR_AUTH_003");
  });

  it("returns 403 ERR_AUTH_003 when profile exists but organization_id is NULL", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({
        data: { id: VALID_PROFILE_ID, organization_id: null },
        error: null,
      })
    );

    const req = createReq("Bearer valid_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden_profile_missing");
  });

  it("returns 500 ERR_AUTH_500 when NEXT_PUBLIC_SUPABASE_URL env var is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const req = createReq("Bearer any_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error_supabase_unavailable");
    expect(result.response.status).toBe(500);

    const body = await result.response.json();
    expect(body.errCode).toBe("ERR_AUTH_500");
  });

  it("uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable_test_key");
    mockHappyPath();

    const req = createReq("Bearer valid_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(true);
    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "publishable_test_key",
      expect.objectContaining({
        global: {
          headers: { Authorization: "Bearer valid_token" },
        },
      })
    );
  });

  it("returns 500 ERR_AUTH_500 when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const req = createReq("Bearer valid_token");
    const result = await requireAuth(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error_supabase_unavailable");
  });

  // --- Bearer prefix toleransı ---

  it("accepts 'Bearer' prefix (uppercase B)", async () => {
    mockHappyPath();
    const result = await requireAuth(createReq("Bearer valid_token"));
    expect(result.ok).toBe(true);
  });

  it("accepts 'bearer' prefix (lowercase)", async () => {
    mockHappyPath();
    const result = await requireAuth(createReq("bearer valid_token"));
    expect(result.ok).toBe(true);
  });

  it("accepts 'BEARER' prefix (all uppercase)", async () => {
    mockHappyPath();
    const result = await requireAuth(createReq("BEARER valid_token"));
    expect(result.ok).toBe(true);
  });

  it("handles extra whitespace around token", async () => {
    mockHappyPath();
    const result = await requireAuth(createReq("Bearer   valid_token   "));
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// TEST SUITE 2 — requireSuperAdmin
// ============================================================================

describe("requireSuperAdmin", () => {
  it("propagates 401 when requireAuth fails (no token)", async () => {
    const req = createReq();
    const result = await requireSuperAdmin(req);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unauthorized_no_token");
    expect(result.response.status).toBe(401);
  });

  it("returns full AuthOk with all fields populated for valid super admin user", async () => {
    mockHappyPath({ isSuperAdmin: true });
    const result = await requireSuperAdmin(createReq("Bearer valid_token"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Tüm alanların birlikte doğrulanması (Mehmet'in ek testi)
    expect(result.userId).toBe(VALID_USER_ID);
    expect(result.organizationId).toBe(VALID_ORG_ID);
    expect(result.userProfileId).toBe(VALID_PROFILE_ID);
    expect(result.isSuperAdmin).toBe(true);
  });

  it("returns 403 ERR_AUTH_004 when RPC returns false", async () => {
    mockHappyPath({ isSuperAdmin: false });
    const result = await requireSuperAdmin(createReq("Bearer valid_token"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden_not_super_admin");
    expect(result.response.status).toBe(403);

    const body = await result.response.json();
    expect(body.errCode).toBe("ERR_AUTH_004");
  });

  it("returns 500 ERR_AUTH_500 when RPC returns error", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({
        data: { id: VALID_PROFILE_ID, organization_id: VALID_ORG_ID },
        error: null,
      })
    );
    mockServiceClient.rpc.mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });

    const result = await requireSuperAdmin(createReq("Bearer valid_token"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error_supabase_unavailable");
  });

  it("returns 403 ERR_AUTH_003 when user is orphan (no profile)", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({ data: null, error: null })
    );

    const result = await requireSuperAdmin(createReq("Bearer valid_token"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden_profile_missing");
  });
});

// ============================================================================
// TEST SUITE 3 — requireOrgMember
// ============================================================================

describe("requireOrgMember", () => {
  it("propagates 401 when requireAuth fails", async () => {
    const result = await requireOrgMember(createReq());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unauthorized_no_token");
  });

  it("returns user's own org when targetOrgId is not provided", async () => {
    mockHappyPath();
    const result = await requireOrgMember(createReq("Bearer valid_token"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.organizationId).toBe(VALID_ORG_ID);
  });

  it("returns ok=true when targetOrgId matches user's org", async () => {
    mockHappyPath();
    const result = await requireOrgMember(
      createReq("Bearer valid_token"),
      VALID_ORG_ID
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.organizationId).toBe(VALID_ORG_ID);
  });

  it("returns 403 ERR_AUTH_005 when targetOrgId is a different org (body inject attack)", async () => {
    mockHappyPath();
    // Simulates: malicious client sends organization_id: OTHER_ORG_ID in body
    const result = await requireOrgMember(
      createReq("Bearer valid_token"),
      OTHER_ORG_ID
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden_wrong_organization");
    expect(result.response.status).toBe(403);

    const body = await result.response.json();
    expect(body.errCode).toBe("ERR_AUTH_005");
  });

  it("returns 403 ERR_AUTH_003 when user is orphan", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({ data: null, error: null })
    );

    const result = await requireOrgMember(createReq("Bearer valid_token"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden_profile_missing");
  });

  it("returns 403 ERR_AUTH_003 when targetOrgId is provided but user's org_id is null", async () => {
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({
        data: { id: VALID_PROFILE_ID, organization_id: null },
        error: null,
      })
    );

    const result = await requireOrgMember(
      createReq("Bearer valid_token"),
      VALID_ORG_ID
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // requireAuth zaten profile_missing döner (organizationId null kontrolü)
    expect(result.code).toBe("forbidden_profile_missing");
  });
});

// ============================================================================
// TEST SUITE 4 — Timeout koruması
// ============================================================================

describe("timeout protection", () => {
  it("returns 500 when auth.getUser() takes longer than 5 seconds", async () => {
    vi.useFakeTimers();

    // getUser never resolves
    mockAnonClient.auth.getUser.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const req = createReq("Bearer valid_token");
    const resultPromise = requireAuth(req);

    // Advance time past 5 second timeout
    await vi.advanceTimersByTimeAsync(5_001);

    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error_supabase_unavailable");
    expect(result.response.status).toBe(500);
  });

  it("returns 500 when is_super_admin RPC takes longer than 5 seconds", async () => {
    vi.useFakeTimers();

    // Auth getUser resolves quickly
    mockAnonClient.auth.getUser.mockResolvedValue({
      data: { user: { id: VALID_USER_ID } },
      error: null,
    });
    mockServiceClient.from.mockReturnValue(
      buildQueryChain({
        data: { id: VALID_PROFILE_ID, organization_id: VALID_ORG_ID },
        error: null,
      })
    );
    // But RPC hangs
    mockServiceClient.rpc.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const req = createReq("Bearer valid_token");
    const resultPromise = requireSuperAdmin(req);

    await vi.advanceTimersByTimeAsync(5_001);

    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("server_error_supabase_unavailable");
  });
});

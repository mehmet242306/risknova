import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { validateStrongPassword as validateStrongPasswordBase } from "@/lib/security/password";

type RateLimitScope = "api" | "ai" | "auth";

type RateLimitOptions = {
  userId: string;
  organizationId?: string | null;
  endpoint: string;
  scope: RateLimitScope;
  limit: number;
  windowSeconds: number;
  planKey?: string | null;
  metadata?: Record<string, unknown>;
};

type UploadedFileOptions = {
  allowedMimeTypes: string[];
  maxBytes: number;
  allowedExtensions?: string[];
};

type SecurityEventOptions = {
  userId?: string | null;
  organizationId?: string | null;
  tenantId?: string | null;
  endpoint?: string | null;
  severity?: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
};

const MAGIC_HEADERS: Array<{ mime: string; bytes: number[] }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
];

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error("Supabase service role ortam degiskenleri eksik.");
  }

  return createSupabaseAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "0.0.0.0"
  );
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")?.trim() || "unknown";
}

export function sanitizePlainText(input: string, maxLength = 4000) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/[<>]/g, " ")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeRichText(input: string, maxLength = 12000) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeObjectStrings<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizePlainText(value, 12000) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObjectStrings(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeObjectStrings(item),
      ]),
    ) as T;
  }

  return value;
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
) {
  try {
    const raw = await request.json();
    const parsed = schema.safeParse(sanitizeObjectStrings(raw));
    if (!parsed.success) {
      return {
        ok: false as const,
        response: NextResponse.json(
          {
            error: "Gecersiz istek verisi.",
            details: z.treeifyError(parsed.error),
          },
          { status: 400 },
        ),
      };
    }

    return { ok: true as const, data: parsed.data };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "JSON govdesi okunamadi." },
        { status: 400 },
      ),
    };
  }
}

function matchesMagicHeader(bytes: Uint8Array, mimeType: string) {
  const candidates = MAGIC_HEADERS.filter((item) => item.mime === mimeType);
  if (candidates.length === 0) {
    return true;
  }

  return candidates.some((candidate) =>
    candidate.bytes.every((value, index) => bytes[index] === value),
  );
}

export async function validateUploadedFile(
  file: File,
  options: UploadedFileOptions,
) {
  const normalizedMime = file.type.trim().toLowerCase();
  const normalizedName = file.name.trim().toLowerCase();

  if (!options.allowedMimeTypes.includes(normalizedMime)) {
    return `Desteklenmeyen dosya turu: ${file.type || "bilinmiyor"}`;
  }

  if (file.size <= 0 || file.size > options.maxBytes) {
    return `Dosya boyutu limiti asildi. Maksimum ${Math.round(options.maxBytes / (1024 * 1024))} MB.`;
  }

  if (
    options.allowedExtensions &&
    !options.allowedExtensions.some((ext) => normalizedName.endsWith(ext))
  ) {
    return "Dosya uzantisi izin verilen tiplerle eslesmiyor.";
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeForSignature =
    normalizedMime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedMime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ? "application/zip"
      : normalizedMime;

  if (!matchesMagicHeader(header, mimeForSignature)) {
    return "Dosya basligi beklenen formatla uyusmuyor.";
  }

  return null;
}

export function buildRateLimitResponse({
  remaining,
  resetAt,
}: {
  remaining: number;
  resetAt: string;
}) {
  return NextResponse.json(
    {
      error: "Cok fazla istek gonderdiniz. Lutfen daha sonra tekrar deneyin.",
      remaining,
      resetAt,
    },
    {
      status: 429,
      headers: {
        "Retry-After": Math.max(
          1,
          Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000),
        ).toString(),
      },
    },
  );
}

export async function logSecurityEvent(
  request: NextRequest,
  eventType: string,
  options: SecurityEventOptions = {},
) {
  return logSecurityEventWithContext({
    eventType,
    endpoint: options.endpoint ?? request.nextUrl.pathname,
    userId: options.userId ?? null,
    organizationId: options.organizationId ?? null,
    tenantId: options.tenantId ?? null,
    severity: options.severity ?? "warning",
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
    details: options.details ?? {},
  });
}

export async function logSecurityEventWithContext({
  eventType,
  endpoint,
  userId,
  organizationId,
  tenantId,
  severity,
  ipAddress,
  userAgent,
  details,
}: {
  eventType: string;
  endpoint?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  tenantId?: string | null;
  severity?: "info" | "warning" | "critical";
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const supabase = createServiceClient();
    await supabase.rpc("log_security_event", {
      p_event_type: eventType,
      p_severity: severity ?? "warning",
      p_endpoint: endpoint ?? null,
      p_user_id: userId ?? null,
      p_organization_id: organizationId ?? null,
      p_tenant_id: tenantId ?? null,
      p_ip_address: ipAddress ?? null,
      p_user_agent: userAgent ?? null,
      p_details: details ?? {},
    });
  } catch (error) {
    console.error("[security] logSecurityEvent failed:", error);
  }
}

export async function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
) {
  return enforceRateLimitWithContext({
    userId: options.userId,
    organizationId: options.organizationId ?? null,
    endpoint: options.endpoint,
    scope: options.scope,
    limit: options.limit,
    windowSeconds: options.windowSeconds,
    planKey: options.planKey ?? null,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
    metadata: options.metadata,
  });
}

export async function enforceRateLimitWithContext(
  options: RateLimitOptions & {
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_user_id: options.userId,
      p_endpoint: options.endpoint,
      p_scope: options.scope,
      p_limit_count: options.limit,
      p_window_seconds: options.windowSeconds,
      p_plan_key: options.planKey ?? null,
      p_organization_id: options.organizationId ?? null,
      p_ip_address: options.ipAddress ?? null,
      p_user_agent: options.userAgent ?? null,
      p_metadata: options.metadata ?? {},
    });

    if (error) {
      console.error("[security] consume_rate_limit RPC failed:", error.message);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;

    if (row.allowed !== true) {
      return buildRateLimitResponse({
        remaining: Number(row.remaining ?? 0),
        resetAt: String(row.reset_at ?? new Date(Date.now() + 60_000).toISOString()),
      });
    }

    return null;
  } catch (error) {
    console.error("[security] enforceRateLimit failed:", error);
    return null;
  }
}

export async function resolveAiDailyLimit(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("resolve_ai_daily_limit", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[security] resolve_ai_daily_limit RPC failed:", error.message);
    return { planKey: "free", dailyLimit: 25 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    planKey: String(row?.plan_key ?? "free"),
    dailyLimit: Number(row?.daily_limit ?? 25),
  };
}

export function validateStrongPassword(password: string) {
  return validateStrongPasswordBase(password);
}

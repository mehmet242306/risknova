import type { NovaAgentResponse } from "@/lib/nova/agent";

const NOVA_REQUEST_TIMEOUT_MS = 45_000;
const FALLBACK_STATUSES = new Set([404, 405, 408, 429, 500, 502, 503, 504]);

type NovaRequestPayload = Record<string, unknown>;

function shouldFallbackFromEndpoint(endpoint: string, status?: number) {
  return (
    endpoint !== "/api/nova/chat" &&
    (status == null || FALLBACK_STATUSES.has(status))
  );
}

async function postJsonWithTimeout(endpoint: string, payload: NovaRequestPayload) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NOVA_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "include",
      redirect: "manual",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const data = (isJson
      ? await response.json().catch(() => ({
          type: "safety_block",
          answer: "Nova yaniti okunamadi.",
        }))
      : {
          type: "safety_block",
          answer:
            response.status >= 300 && response.status < 400
              ? "Nova oturum dogrulamasi icin yeniden yonlendirildi."
              : "Nova API JSON yerine sayfa dondurdu.",
          message:
            response.status >= 300 && response.status < 400
              ? "Nova oturum dogrulamasi icin yeniden yonlendirildi."
              : "Nova API JSON yerine sayfa dondurdu.",
        }) as NovaAgentResponse & { message?: string };

    return { response, data, isJson };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function postNovaAgentRequest(
  primaryEndpoint: string,
  payload: NovaRequestPayload,
): Promise<NovaAgentResponse> {
  const endpoints =
    primaryEndpoint === "/api/nova/legal-chat"
      ? [primaryEndpoint, "/api/nova/chat"]
      : [primaryEndpoint];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const { response, data, isJson } = await postJsonWithTimeout(endpoint, payload);

      if (response.ok && isJson) {
        return data;
      }

      lastError = {
        context: new Response(JSON.stringify(data), { status: response.status }),
      };

      if (shouldFallbackFromEndpoint(endpoint, isJson ? response.status : undefined)) {
        continue;
      }

      throw lastError;
    } catch (error) {
      lastError = error;

      if (shouldFallbackFromEndpoint(endpoint)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("Nova istegi tamamlanamadi.");
}

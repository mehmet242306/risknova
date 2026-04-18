export type KvkkApiErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  name?: string | null;
  status?: number | null;
};

const KVKK_SCHEMA_ERROR_CODES = new Set([
  "42P01",
  "42703",
  "42883",
  "PGRST202",
  "PGRST204",
]);

const KVKK_SCHEMA_ERROR_MARKERS = [
  "does not exist",
  "could not find the function",
  "schema cache",
  "relation",
  "column",
  "function",
];

const KVKK_NETWORK_ERROR_MARKERS = [
  "failed to fetch",
  "networkerror",
  "load failed",
  "fetch failed",
  "the operation was aborted",
  "the user aborted a request",
];

// Error örnekleri (AuthError, TypeError, vb.) message/name alanlarını
// non-enumerable olarak tutar; düz console.error '{}' gösterir.
// Bu yardımcı, hangi tipte gelirse gelsin okunabilir bir kayıt çıkarır.
function normalizeError(error: unknown): Record<string, unknown> {
  if (error == null) return { value: error };

  if (typeof error !== "object") {
    return { value: error };
  }

  const source = error as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys: Array<keyof KvkkApiErrorLike | "stack"> = [
    "name",
    "message",
    "code",
    "status",
    "details",
    "hint",
    "stack",
  ];

  for (const key of keys) {
    const value = source[key as string];
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  }

  // Geriye kalan enumerable alanlar (PostgrestError vb.)
  for (const key of Object.keys(source)) {
    if (!(key in out)) {
      out[key] = source[key];
    }
  }

  return out;
}

export function isKvkkSchemaUnavailableError(error: KvkkApiErrorLike | null | undefined) {
  if (!error) return false;

  if (error.code && KVKK_SCHEMA_ERROR_CODES.has(error.code)) {
    return true;
  }

  const combinedMessage = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  return KVKK_SCHEMA_ERROR_MARKERS.some((marker) => combinedMessage.includes(marker));
}

export function isKvkkNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const normalized = normalizeError(error);
  const message = String(normalized.message ?? "").toLowerCase();
  const name = String(normalized.name ?? "").toLowerCase();

  if (name === "aborterror" || name === "authretryablefetcherror") return true;

  return KVKK_NETWORK_ERROR_MARKERS.some((marker) => message.includes(marker));
}

export function logKvkkApiError(scope: string, error: KvkkApiErrorLike | null | undefined) {
  if (isKvkkSchemaUnavailableError(error)) {
    return;
  }

  const normalized = normalizeError(error);

  // Geçici ağ/abort hataları gürültü; warn olarak göster, error olarak değil.
  if (isKvkkNetworkError(error)) {
    console.warn(scope, "(transient network error)", normalized);
    return;
  }

  console.error(scope, normalized);
}

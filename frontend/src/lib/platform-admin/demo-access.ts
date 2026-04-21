const DEMO_ACCESS_WINDOW_HOURS = 24;

type MetadataRecord = Record<string, unknown> | null | undefined;

export type DemoAccessStatus = "active" | "expired" | "disabled" | "not_demo";

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveMetadataValue(
  userMetadata: MetadataRecord,
  appMetadata: MetadataRecord,
  key: string,
) {
  return userMetadata?.[key] ?? appMetadata?.[key] ?? null;
}

function isValidDateString(value: string | null) {
  return value !== null && !Number.isNaN(new Date(value).getTime());
}

export function buildDemoAccessExpiresAt(referenceDate = new Date()) {
  return new Date(
    referenceDate.getTime() + DEMO_ACCESS_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
}

export function getDemoAccessState(options: {
  userMetadata?: MetadataRecord;
  appMetadata?: MetadataRecord;
  referenceDate?: Date;
}) {
  const { userMetadata, appMetadata, referenceDate = new Date() } = options;
  const demoMode =
    resolveMetadataValue(userMetadata, appMetadata, "demo_mode") === true;
  const accessExpiresAt = readString(
    resolveMetadataValue(userMetadata, appMetadata, "demo_access_expires_at"),
  );
  const accessDisabledAt = readString(
    resolveMetadataValue(userMetadata, appMetadata, "demo_access_disabled_at"),
  );

  const isExpired =
    demoMode &&
    isValidDateString(accessExpiresAt) &&
    new Date(accessExpiresAt!).getTime() <= referenceDate.getTime();

  const isDisabled = demoMode && isValidDateString(accessDisabledAt);

  const status: DemoAccessStatus = !demoMode
    ? "not_demo"
    : isDisabled
      ? "disabled"
      : isExpired
        ? "expired"
        : "active";

  return {
    demoMode,
    accessExpiresAt,
    accessDisabledAt,
    status,
    isBlocked: status === "disabled" || status === "expired",
  };
}

export function isDemoRestrictedAccount(options: {
  userMetadata?: MetadataRecord;
  appMetadata?: MetadataRecord;
}) {
  return getDemoAccessState(options).demoMode;
}

import type { SupabaseClient } from "@supabase/supabase-js";

/** Detect device type from User-Agent */
export function detectDeviceType(ua: string): "web" | "mobile" {
  const mobileRe = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRe.test(ua) ? "mobile" : "web";
}

/** Parse a human-readable device description from User-Agent */
export function parseDeviceInfo(ua: string): string {
  if (!ua) return "Bilinmeyen Cihaz";

  let browser = "Tarayıcı";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return os ? `${browser} - ${os}` : browser;
}

/**
 * Register a session in user_sessions table.
 * Uses UPSERT on (user_id, session_token) so a user can have multiple active devices.
 */
export async function registerSession(
  supabase: SupabaseClient,
  userId: string,
  sessionToken: string,
  userAgent: string,
  ipAddress: string,
) {
  const deviceType = detectDeviceType(userAgent);
  const deviceInfo = parseDeviceInfo(userAgent);

  try {
    await supabase.from("user_sessions").upsert(
      {
        user_id: userId,
        session_token: sessionToken,
        device_type: deviceType,
        device_info: deviceInfo,
        ip_address: ipAddress,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "user_id,session_token" },
    );
  } catch (err) {
    console.error("[session-tracker] Failed to register session:", err);
  }
}

/**
 * Remove current session on logout.
 */
export async function removeSession(supabase: SupabaseClient, userId: string, sessionToken: string) {
  try {
    await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("session_token", sessionToken);
  } catch (err) {
    console.error("[session-tracker] Failed to remove session:", err);
  }
}

export async function listSessions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_sessions")
    .select("id, session_token, device_type, device_info, ip_address, last_active_at, created_at")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false });

  if (error) {
    console.error("[session-tracker] Failed to list sessions:", error);
    return [];
  }

  return data ?? [];
}

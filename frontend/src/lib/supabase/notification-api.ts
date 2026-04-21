/**
 * Notification API - Supabase CRUD
 * Bildirim olusturma, listeleme, okundu isaretleme
 */

import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";
import { fetchAccountContext } from "@/lib/account/account-api";

export type NotificationType = "risk_analysis" | "incident" | "task" | "dof" | "system";
export type NotificationLevel = "info" | "warning" | "critical";

export type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  level: NotificationLevel | string;
  link: string | null;
  actor_name: string | null;
  is_read: boolean;
  created_at: string;
};

const ADMIN_ONLY_LINK_PREFIXES = [
  "/digital-twin",
  "/settings?tab=admin_ai",
  "/settings?tab=audit_logs",
  "/settings?tab=deleted_records",
];

function isAdminOnlyNotification(row: NotificationRow) {
  if (!row.link) return false;
  return ADMIN_ONLY_LINK_PREFIXES.some((prefix) => row.link?.startsWith(prefix));
}

async function resolveIsAdmin() {
  const supabase = createClient();
  if (!supabase) return false;

  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) return false;
  return data === true;
}

async function resolveNotificationScope() {
  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const accountContext = await fetchAccountContext();
  const organizationId = accountContext?.context.organizationId ?? null;
  const surface = accountContext?.surface ?? "standard";

  return {
    supabase,
    userId: user.id,
    organizationId,
    isPlatformAdmin: surface === "platform-admin",
  };
}

export async function createNotification(opts: {
  title: string;
  message: string;
  type: NotificationType;
  level?: NotificationLevel;
  link?: string;
  actorName?: string;
  userId?: string | null;
}): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const accountContext = await fetchAccountContext();
  const scopedOrganizationId = accountContext?.context.organizationId ?? null;
  const auth = scopedOrganizationId
    ? {
        orgId: scopedOrganizationId,
        userId: accountContext?.context.userId ?? opts.userId ?? null,
      }
    : await resolveOrganizationId();
  if (!auth?.orgId || !auth.userId) return;

  await supabase.from("notifications").insert({
    organization_id: auth.orgId,
    user_id: opts.userId ?? auth.userId,
    title: opts.title,
    message: opts.message,
    type: opts.type,
    level: opts.level ?? "info",
    link: opts.link ?? null,
    actor_name: opts.actorName ?? null,
  });
}

export async function listMyNotifications(limit = 50): Promise<NotificationRow[]> {
  const scope = await resolveNotificationScope();
  if (!scope || !scope.organizationId || scope.isPlatformAdmin) return [];

  const { data, error } = await scope.supabase
    .from("notifications")
    .select("id, title, message, type, level, link, actor_name, is_read, created_at")
    .eq("user_id", scope.userId)
    .eq("organization_id", scope.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[notification-api] listMyNotifications:", error.message);
    return [];
  }

  const rows = (data ?? []) as NotificationRow[];
  const isAdmin = await resolveIsAdmin();
  return isAdmin ? rows : rows.filter((row) => !isAdminOnlyNotification(row));
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  const scope = await resolveNotificationScope();
  if (!scope || !scope.organizationId || scope.isPlatformAdmin) return false;

  const { error } = await scope.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", scope.userId)
    .eq("organization_id", scope.organizationId);

  if (error) {
    console.warn("[notification-api] markNotificationAsRead:", error.message);
    return false;
  }

  return true;
}

export async function markAllMyNotificationsAsRead(ids: string[]): Promise<boolean> {
  const scope = await resolveNotificationScope();
  if (!scope || !scope.organizationId || scope.isPlatformAdmin || ids.length === 0) return false;

  const { error } = await scope.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", scope.userId)
    .eq("organization_id", scope.organizationId)
    .in("id", ids);

  if (error) {
    console.warn("[notification-api] markAllMyNotificationsAsRead:", error.message);
    return false;
  }

  return true;
}

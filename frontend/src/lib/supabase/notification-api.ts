/**
 * Notification API - Supabase CRUD
 * Bildirim olusturma, listeleme, okundu isaretleme
 */

import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";

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

  const auth = await resolveOrganizationId();
  if (!auth) return;

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
  const supabase = createClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, type, level, link, actor_name, is_read, created_at")
    .eq("user_id", user.id)
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
  const supabase = createClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.warn("[notification-api] markNotificationAsRead:", error.message);
    return false;
  }

  return true;
}

export async function markAllMyNotificationsAsRead(ids: string[]): Promise<boolean> {
  const supabase = createClient();
  if (!supabase || ids.length === 0) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .in("id", ids);

  if (error) {
    console.warn("[notification-api] markAllMyNotificationsAsRead:", error.message);
    return false;
  }

  return true;
}

/**
 * Notification API — Supabase CRUD
 * Bildirim oluşturma, listeleme, okundu işaretleme
 */

import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";

export type NotificationType = "risk_analysis" | "incident" | "task" | "dof" | "system";
export type NotificationLevel = "info" | "warning" | "critical";

export async function createNotification(opts: {
  title: string;
  message: string;
  type: NotificationType;
  level?: NotificationLevel;
  link?: string;
  actorName?: string;
}): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const auth = await resolveOrganizationId();
  if (!auth) return;

  await supabase.from("notifications").insert({
    organization_id: auth.orgId,
    user_id: null, // tüm org görebilir
    title: opts.title,
    message: opts.message,
    type: opts.type,
    level: opts.level ?? "info",
    link: opts.link ?? null,
    actor_name: opts.actorName ?? null,
  });
}

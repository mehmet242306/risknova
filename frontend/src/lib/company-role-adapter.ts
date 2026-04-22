/**
 * Company Access Role Adapter
 * ---------------------------
 * UI'da tek bir basit 5'li rol modeli (owner/admin/manager/editor/viewer)
 * görünür; arka planda user_roles, platform_admins, workspace_assignments
 * (professional_role) ve company_memberships.membership_role paralel çalışmaya
 * devam eder. Bu dosya, 5'li modeli yüzeye çıkaran label/util helper'larını
 * barındırır.
 *
 * `company_memberships.access_role` 20260422180000 migration'ında eklendi ve
 * invite kabul akışı (accept_company_invitation) bu kolonu doldurur.
 */

export type AccessRole = "owner" | "admin" | "manager" | "editor" | "viewer";

export const ALL_ACCESS_ROLES: AccessRole[] = ["owner", "admin", "manager", "editor", "viewer"];

/**
 * Davet formunda seçilebilen roller. `owner` dışarıda — sahiplik davet yerine
 * transfer işlemiyle devredilir.
 */
export const INVITABLE_ROLES: AccessRole[] = ["admin", "manager", "editor", "viewer"];

export const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  manager: "Müdür",
  editor: "Editör",
  viewer: "Görüntüleyici",
};

export const ACCESS_ROLE_DESCRIPTIONS: Record<AccessRole, string> = {
  owner: "Tüm yetkiler, devredilebilir.",
  admin: "Yönetim, üye davet ve silme yetkisi.",
  manager: "Modül yönetimi, arşivleme ve rapor oluşturma.",
  editor: "İçerik oluşturma ve düzenleme.",
  viewer: "Sadece görüntüleme.",
};

/** Tone mapping for badges (matches premium-icon-badge tones). */
export const ACCESS_ROLE_TONES: Record<AccessRole, "gold" | "cobalt" | "violet" | "emerald" | "slate"> = {
  owner: "gold",
  admin: "cobalt",
  manager: "violet",
  editor: "emerald",
  viewer: "slate",
};

export function accessRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  if (role in ACCESS_ROLE_LABELS) return ACCESS_ROLE_LABELS[role as AccessRole];
  return role;
}

export function isValidAccessRole(role: string | null | undefined): role is AccessRole {
  if (!role) return false;
  return ALL_ACCESS_ROLES.includes(role as AccessRole);
}

export function normalizeAccessRole(role: string | null | undefined): AccessRole {
  return isValidAccessRole(role) ? role : "viewer";
}

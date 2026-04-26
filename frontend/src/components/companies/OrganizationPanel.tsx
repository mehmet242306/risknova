"use client";
import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { InviteProfessionalModal } from "./InviteProfessionalModal";
import { countGranted, type Permissions } from "@/lib/company-share-registry";

/* ── Types ── */
type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  title: string | null;
};

type WorkspaceMember = {
  id: string;
  role: string;
  permissions: Permissions;
  joined_at: string;
  last_active_at: string | null;
  is_active: boolean;
  user_profiles: UserProfile | UserProfile[] | null;
};

type WorkspaceInvitation = {
  id: string;
  invitee_email: string;
  invitee_name: string | null;
  status: string;
  invited_at: string;
  expires_at: string;
  message: string | null;
  custom_permissions: Permissions;
  permission_templates:
    | { id: string; name: string; icon: string }
    | { id: string; name: string; icon: string }[]
    | null;
};

type PermissionTemplate = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string | null;
  sort_order: number;
};

/* ── Helpers ── */
const ROLE_OPTIONS = [
  { value: "owner",  label: "Sahip",          color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "admin",  label: "Yönetici",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "member", label: "Üye",             color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "viewer", label: "Görüntüleyici",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "guest",  label: "Misafir",         color: "bg-secondary text-muted-foreground" },
];

function roleOption(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role) ?? ROLE_OPTIONS[2];
}

function getProfile(m: WorkspaceMember): UserProfile | null {
  if (!m.user_profiles) return null;
  return Array.isArray(m.user_profiles) ? (m.user_profiles[0] ?? null) : m.user_profiles;
}

function getInvTemplate(inv: WorkspaceInvitation) {
  if (!inv.permission_templates) return null;
  return Array.isArray(inv.permission_templates)
    ? (inv.permission_templates[0] ?? null)
    : inv.permission_templates;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function daysLeft(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Avatar ── */
function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url)
    return (
      <Image
        src={url}
        alt={name ?? ""}
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-border"
      />
    );
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-2 ring-border">
      {initials(name)}
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-soft)]">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({
  title,
  count,
  action,
  children,
  empty,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {count !== undefined && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children ?? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

/* ── Main component ── */
export function OrganizationPanel({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  /* inline member editing */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [roleUpdating, setRoleUpdating] = useState(false);

  /* member removal confirm */
  const [removingId, setRemovingId] = useState<string | null>(null);

  /* ── Load ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    const qMembers = supabase
      .from("workspace_members")
      .select("id, role, permissions, joined_at, last_active_at, is_active, user_profiles(id, full_name, email, avatar_url, title)")
      .eq("company_workspace_id", companyId)
      .eq("is_active", true)
      .order("joined_at");

    const qInvitations = supabase
      .from("workspace_invitations")
      .select("id, invitee_email, invitee_name, status, invited_at, expires_at, message, custom_permissions, permission_templates(id, name, icon)")
      .eq("company_workspace_id", companyId)
      .eq("status", "pending")
      .order("invited_at", { ascending: false });

    const qTemplates = supabase
      .from("permission_templates")
      .select("id, name, description, icon, color, sort_order")
      .order("sort_order");

    const [{ data: mems }, { data: invs }, { data: tmpls }] = await Promise.all([
      qMembers, qInvitations, qTemplates,
    ]);

    setMembers((mems as WorkspaceMember[]) ?? []);
    setInvitations((invs as WorkspaceInvitation[]) ?? []);
    setTemplates((tmpls as PermissionTemplate[]) ?? []);
    setLoading(false);
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadData(); }, [loadData]);

  /* ── Role update ── */
  const handleRoleUpdate = useCallback(async (memberId: string) => {
    const supabase = createClient();
    if (!supabase) return;
    setRoleUpdating(true);
    await supabase.from("workspace_members").update({ role: editRole }).eq("id", memberId);
    setEditingId(null);
    setRoleUpdating(false);
    void loadData();
  }, [editRole, loadData]);

  /* ── Remove member ── */
  const handleRemove = useCallback(async (memberId: string) => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("workspace_members").update({ is_active: false }).eq("id", memberId);
    setRemovingId(null);
    void loadData();
  }, [loadData]);

  /* ── Cancel invitation ── */
  const handleCancelInvite = useCallback(async (id: string) => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("workspace_invitations").update({ status: "cancelled" }).eq("id", id);
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const pendingCount = invitations.filter((i) => daysLeft(i.expires_at) >= 0).length;

  return (
    <div className="space-y-5">
      {/* ── Stats ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="👥" label="Aktif Üye"    value={members.length}   sub="Bu firmaya erişimli" />
        <StatCard icon="📨" label="Bekleyen Davet" value={pendingCount}  sub="Kabul bekleniyor" />
        <StatCard icon="🔑" label="Yetki Şablonu" value={templates.length} sub="Tanımlı rol" />
      </div>

      {/* ── Aktif Üyeler ── */}
      <Section
        title="Aktif Üyeler"
        count={members.length}
        action={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Davet Gönder
          </button>
        }
        empty="Henüz aktif üye bulunmuyor. Davet göndererek ekip oluşturun."
      >
        {members.length > 0 ? (
          <div className="divide-y divide-border">
            {members.map((m) => {
              const profile = getProfile(m);
              const role = roleOption(m.role);
              const isEditing = editingId === m.id;
              const isRemoving = removingId === m.id;
              const grantedCount = countGranted(m.permissions);

              return (
                <div key={m.id} className="group px-5 py-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={profile?.full_name ?? null} url={profile?.avatar_url ?? null} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {profile?.full_name ?? profile?.email ?? "Bilinmeyen Kullanıcı"}
                        </p>
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${role.color}`}>
                          {role.label}
                        </span>
                        {grantedCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">{grantedCount} izin</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {profile?.title && <span>{profile.title} · </span>}
                        {profile?.email ?? "E-posta yok"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Katıldı: {fmtDate(m.joined_at)}
                        {m.last_active_at && ` · Son aktif: ${fmtDate(m.last_active_at)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { setEditingId(isEditing ? null : m.id); setEditRole(m.role); }}
                        className="rounded-lg px-2.5 py-1.5 text-xs border border-border text-foreground hover:bg-secondary transition-colors"
                      >
                        {isEditing ? "İptal" : "Düzenle"}
                      </button>
                      {isRemoving ? (
                        <>
                          <button type="button" onClick={() => void handleRemove(m.id)} className="rounded-lg px-2 py-1.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 transition-colors">Çıkar</button>
                          <button type="button" onClick={() => setRemovingId(null)} className="rounded-lg px-2 py-1.5 text-xs border border-border text-muted-foreground hover:bg-secondary transition-colors">İptal</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemovingId(m.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                          title="Erişimi kaldır"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline role editor */}
                  {isEditing && (
                    <div className="mt-3 ml-14 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
                      <label className="text-xs font-medium text-muted-foreground shrink-0">Rol:</label>
                      <select
                        className="h-8 flex-1 rounded-lg border border-border bg-card px-2 text-xs text-foreground dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleRoleUpdate(m.id)}
                        disabled={roleUpdating}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60 transition-colors"
                      >
                        {roleUpdating ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </Section>

      {/* ── Bekleyen Davetler ── */}
      <Section
        title="Bekleyen Davetler"
        count={invitations.length}
        empty="Bekleyen davet yok."
      >
        {invitations.length > 0 ? (
          <div className="divide-y divide-border">
            {invitations.map((inv) => {
              const tmpl = getInvTemplate(inv);
              const left = daysLeft(inv.expires_at);
              const expired = left < 0;
              const grantedCount = countGranted(inv.custom_permissions);

              return (
                <div key={inv.id} className="group flex items-start gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {inv.invitee_name && (
                        <p className="text-sm font-semibold text-foreground">{inv.invitee_name}</p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{inv.invitee_email}</p>
                      {tmpl && (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-secondary text-muted-foreground">
                          {tmpl.icon} {tmpl.name}
                        </span>
                      )}
                      {grantedCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">{grantedCount} izin</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span>Gönderildi: {fmtDate(inv.invited_at)}</span>
                      {expired ? (
                        <span className="text-red-500 dark:text-red-400">Süresi doldu</span>
                      ) : (
                        <span className={left <= 2 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                          {left} gün kaldı
                        </span>
                      )}
                    </div>
                    {inv.message && (
                      <p className="mt-1 text-xs text-muted-foreground italic">&quot;{inv.message}&quot;</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCancelInvite(inv.id)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground border border-border opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
                  >
                    İptal
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </Section>

      {/* ── Erişim Şablonları ── */}
      <Section title="Erişim Şablonları" count={templates.length}>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4 hover:bg-secondary/60 transition-colors"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: tmpl.color ? `${tmpl.color}20` : undefined }}
              >
                {tmpl.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{tmpl.name}</p>
                {tmpl.description && (
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground line-clamp-2">{tmpl.description}</p>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-4">Şablon yükleniyor...</p>
          )}
        </div>
      </Section>

      {/* ── Davet Modalı ── */}
      <InviteProfessionalModal
        open={inviteOpen}
        companyId={companyId}
        onClose={() => { setInviteOpen(false); void loadData(); }}
      />
    </div>
  );
}

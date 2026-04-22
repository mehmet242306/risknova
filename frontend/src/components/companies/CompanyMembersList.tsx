"use client";

import { useCallback, useEffect, useState } from "react";
import { Users2, Shield, UserCheck, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PremiumIconBadge } from "@/components/ui/premium-icon-badge";
import {
  ACCESS_ROLE_LABELS,
  ALL_ACCESS_ROLES,
  accessRoleLabel,
  normalizeAccessRole,
  type AccessRole,
} from "@/lib/company-role-adapter";

type MemberRow = {
  id: string;
  user_id: string;
  access_role: AccessRole;
  membership_role: string | null;
  status: string;
  employment_type: string | null;
  created_at: string;
  approved_at: string | null;
  full_name: string | null;
  email: string | null;
};

function roleBadgeTone(role: AccessRole): string {
  switch (role) {
    case "owner":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
    case "admin":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
    case "manager":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200";
    case "editor":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
    case "viewer":
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(iso));
}

export function CompanyMembersList({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      setError("Veritabanı bağlantısı kurulamadı.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data: memberships, error: membershipsErr } = await supabase
      .from("company_memberships")
      .select(
        "id, user_id, access_role, membership_role, employment_type, status, created_at, approved_at",
      )
      .eq("company_workspace_id", companyId)
      .is("deleted_at", null)
      .neq("status", "rejected")
      .order("created_at", { ascending: true });

    if (membershipsErr) {
      setError(membershipsErr.message);
      setLoading(false);
      return;
    }

    const rawMemberships = memberships ?? [];
    const authIds = rawMemberships.map((m) => m.user_id).filter(Boolean);
    const profilesMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (authIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", authIds);
      (profiles ?? []).forEach((p) => {
        profilesMap.set(p.auth_user_id as string, {
          full_name: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
        });
      });
    }

    const merged: MemberRow[] = rawMemberships.map((m) => ({
      id: m.id as string,
      user_id: m.user_id as string,
      access_role: normalizeAccessRole(m.access_role as string | null),
      membership_role: (m.membership_role as string | null) ?? null,
      status: (m.status as string) ?? "active",
      employment_type: (m.employment_type as string | null) ?? null,
      created_at: m.created_at as string,
      approved_at: (m.approved_at as string | null) ?? null,
      full_name: profilesMap.get(m.user_id as string)?.full_name ?? null,
      email: profilesMap.get(m.user_id as string)?.email ?? null,
    }));

    setMembers(merged);

    const me = merged.find((m) => m.user_id === user?.id);
    setCanManage(me?.access_role === "owner" || me?.access_role === "admin");

    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(membershipId: string, newRole: AccessRole) {
    setSavingId(membershipId);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setSavingId(null);
      return;
    }
    const { error: updateErr } = await supabase
      .from("company_memberships")
      .update({ access_role: newRole })
      .eq("id", membershipId);
    setSavingId(null);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    await load();
  }

  return (
    <div className="rounded-[1.7rem] border border-border/80 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <PremiumIconBadge icon={Users2} tone="cobalt" size="sm" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">Firma Üyeleri ve Erişim Rolleri</h3>
          <p className="text-xs text-muted-foreground">
            Davet kabul edilen üyeler ve erişim seviyeleri. 5'li rol modeli: Sahip / Yönetici / Müdür / Editör / Görüntüleyici.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
          Üyeler yükleniyor…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
          Henüz üye yok. Yukarıdaki formdan e-posta ile davet gönderebilirsiniz.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const label = m.full_name?.trim() || m.email || "Kullanıcı";
            const initial = label.charAt(0).toUpperCase();
            const isSelf = m.user_id === currentUserId;
            const isOwner = m.access_role === "owner";
            const editable = canManage && !isSelf && !isOwner;
            return (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                      {isSelf && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">SİZ</span>
                      )}
                    </div>
                    {m.email && m.email !== label && (
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck size={10} /> {m.status === "active" ? "Aktif" : m.status}
                      </span>
                      {m.employment_type && (
                        <span className="inline-flex items-center gap-1">
                          <Shield size={10} /> {m.employment_type}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} /> {formatDateShort(m.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {editable ? (
                    <select
                      value={m.access_role}
                      disabled={savingId === m.id}
                      onChange={(e) => changeRole(m.id, e.target.value as AccessRole)}
                      className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 disabled:opacity-50"
                    >
                      {ALL_ACCESS_ROLES.filter((r) => r !== "owner").map((r) => (
                        <option key={r} value={r}>
                          {ACCESS_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleBadgeTone(m.access_role)}`}
                    >
                      {accessRoleLabel(m.access_role)}
                    </span>
                  )}
                  {savingId === m.id && (
                    <span className="text-[10px] text-muted-foreground">Kaydediliyor…</span>
                  )}
                </div>
              </div>
            );
          })}
          {!canManage && members.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Rol değiştirmek için yönetici/sahip yetkisi gerekir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

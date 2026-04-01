"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  auth_user_id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  title: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Organization = {
  id: string;
  name: string;
  city: string | null;
};

type Prefs = {
  theme: "light" | "dark" | "system";
  language: "tr" | "en";
  email_notifications: boolean;
  push_notifications: boolean;
};

type Tab = "profile" | "security" | "preferences" | "activity";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Süper Yönetici",
  platform_admin: "Platform Yöneticisi",
  organization_admin: "Kuruluş Yöneticisi",
  osgb_manager: "OSGB Müdürü",
  ohs_specialist: "İSG Uzmanı",
  workplace_physician: "İşyeri Hekimi",
  dsp: "DSP",
  viewer: "Görüntüleyici",
};

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profil Bilgileri" },
  { id: "security", label: "Güvenlik" },
  { id: "preferences", label: "Tercihler" },
  { id: "activity", label: "Aktivite" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5fc1]/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#0b5fc1]" : "bg-slate-300 dark:bg-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
          "transform transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProfileClient() {
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({
    theme: "system",
    language: "tr",
    email_notifications: true,
    push_notifications: false,
  });

  // Form fields
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");

  // Security fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Activity data
  const [activityStats, setActivityStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
  const [recentTasks, setRecentTasks] = useState<Array<{
    id: string;
    title: string;
    status: string;
    start_date: string;
    end_date: string | null;
    updated_at: string;
    category_name: string | null;
    category_color: string | null;
    category_icon: string | null;
  }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "completed" | "pending" | "overdue">("all");

  // ─── Load profile data ───────────────────────────────────────────────────

  useEffect(() => {
    loadProfile();
    // Apply saved theme on mount
    const saved = localStorage.getItem("risknova-theme") as "light" | "dark" | "system" | null;
    if (saved) applyTheme(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "activity") void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activityFilter]);

  // System mode listener
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(e.matches ? "dark" : "light");
      root.setAttribute("data-theme", e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [prefs.theme]);

  async function loadProfile() {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setAuthUser(user);

      const [profileRes, prefsRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("*, organizations(id,name,city)")
          .eq("auth_user_id", user.id)
          .single(),
        supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileRes.data) {
        const p = profileRes.data as UserProfile & { organizations: Organization | null };
        setProfile(p);
        setFullName(p.full_name ?? "");
        setTitle(p.title ?? "");
        setPhone(p.phone ?? "");
        if (p.organizations) setOrg(p.organizations);

        // Fetch roles
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("roles(code)")
          .eq("user_profile_id", p.id);
        if (roleData) {
          const codes = (roleData as Array<{ roles: { code: string } | { code: string }[] | null }>)
            .map((r) => {
              if (!r.roles) return undefined;
              if (Array.isArray(r.roles)) return r.roles[0]?.code;
              return (r.roles as { code: string }).code;
            })
            .filter(Boolean) as string[];
          setRoles(codes);
        }
      }

      if (prefsRes.data) {
        setPrefs({
          theme: prefsRes.data.theme ?? "system",
          language: prefsRes.data.language ?? "tr",
          email_notifications: prefsRes.data.email_notifications ?? true,
          push_notifications: prefsRes.data.push_notifications ?? false,
        });
      }
    } catch (err) {
      console.error("[ProfileClient] loadProfile error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Avatar upload ───────────────────────────────────────────────────────

  async function handleAvatarUpload(file: File) {
    if (!profile || !authUser) return;
    setAvatarUploading(true);
    setFeedback(null);
    const supabase = createClient();
    if (!supabase) { setAvatarUploading(false); return; }

    try {
      const ext = file.name.split(".").pop();
      const path = `${authUser.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from("user_profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateErr) throw updateErr;

      setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
      setFeedback({ type: "success", msg: "Fotoğraf güncellendi." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Yükleme başarısız.";
      setFeedback({ type: "error", msg });
    } finally {
      setAvatarUploading(false);
    }
  }

  // ─── Save profile info ───────────────────────────────────────────────────

  async function handleProfileSave() {
    if (!profile) return;
    setSaving(true);
    setFeedback(null);
    const supabase = createClient();
    if (!supabase) { setSaving(false); return; }

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ full_name: fullName, title: title || null, phone: phone || null })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, full_name: fullName, title, phone } : prev);
      setFeedback({ type: "success", msg: "Profil bilgileri kaydedildi." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kayıt başarısız.";
      setFeedback({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  }

  // ─── Change password ─────────────────────────────────────────────────────

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", msg: "Yeni şifreler eşleşmiyor." });
      return;
    }
    if (newPassword.length < 8) {
      setFeedback({ type: "error", msg: "Şifre en az 8 karakter olmalı." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const supabase = createClient();
    if (!supabase) { setSaving(false); return; }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ type: "success", msg: "Şifre başarıyla güncellendi." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Şifre güncellenemedi.";
      setFeedback({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  }

  // ─── Save preferences ────────────────────────────────────────────────────

  async function handlePreferencesSave() {
    if (!authUser) return;
    setSaving(true);
    setFeedback(null);
    const supabase = createClient();
    if (!supabase) { setSaving(false); return; }

    try {
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: authUser.id,
            theme: prefs.theme,
            language: prefs.language,
            email_notifications: prefs.email_notifications,
            push_notifications: prefs.push_notifications,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;

      // Theme & language are already applied on click via handleThemeChange/handleLanguageChange
      setFeedback({ type: "success", msg: "Tercihler kaydedildi." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kayıt başarısız.";
      setFeedback({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  }

  // ─── Load activity ───────────────────────────────────────────────────────

  async function loadActivity() {
    setActivityLoading(true);
    const supabase = createClient();
    if (!supabase) { setActivityLoading(false); return; }
    try {
      // Build filtered task query
      let taskQuery = supabase
        .from("isg_tasks")
        .select("id, title, status, start_date, end_date, updated_at, isg_task_categories(name, color, icon)")
        .order("updated_at", { ascending: false })
        .limit(10);

      if (activityFilter === "completed") taskQuery = taskQuery.eq("status", "completed");
      else if (activityFilter === "pending") taskQuery = taskQuery.in("status", ["planned", "in_progress"]);
      else if (activityFilter === "overdue") taskQuery = taskQuery.eq("status", "overdue");

      const [{ data: tasks }, { count: total }, { count: completed }, { count: planned }, { count: overdue }] =
        await Promise.all([
          taskQuery,
          supabase.from("isg_tasks").select("id", { count: "exact", head: true }),
          supabase.from("isg_tasks").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("isg_tasks").select("id", { count: "exact", head: true }).in("status", ["planned", "in_progress"]),
          supabase.from("isg_tasks").select("id", { count: "exact", head: true }).eq("status", "overdue"),
        ]);

      setActivityStats({
        total: total ?? 0,
        completed: completed ?? 0,
        pending: planned ?? 0,
        overdue: overdue ?? 0,
      });

      if (tasks) {
        setRecentTasks(
          tasks.map((t) => {
            const cat = Array.isArray(t.isg_task_categories) ? t.isg_task_categories[0] : t.isg_task_categories;
            return {
              id: t.id,
              title: t.title,
              status: t.status,
              start_date: t.start_date,
              end_date: t.end_date,
              updated_at: t.updated_at,
              category_name: cat?.name ?? null,
              category_color: cat?.color ?? null,
              category_icon: cat?.icon ?? null,
            };
          }),
        );
      }
    } catch (err) {
      console.error("[ProfileClient] loadActivity error:", err);
    } finally {
      setActivityLoading(false);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function initials(name: string | null | undefined, email: string) {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  }

  function applyTheme(theme: "light" | "dark" | "system") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    const effective: "light" | "dark" = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    root.classList.add(effective);
    root.setAttribute("data-theme", effective);
    localStorage.setItem("risknova-theme", theme);
    setPrefs((p) => ({ ...p, theme }));
  }

  function formatDate(iso: string | undefined) {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(iso));
  }

  // ─── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <span className="text-sm text-muted-foreground">Profil yükleniyor...</span>
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name || authUser?.email || "Kullanıcı";
  const email = profile?.email || authUser?.email || "";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-card)]">
        <div className="bg-[linear-gradient(135deg,#0b5fc1_0%,#2788ff_50%,#97c51f_100%)] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-2xl font-bold text-[#0b5fc1] shadow-xl">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initials(profile?.full_name, email)}</span>
                )}
              </div>

              {/* Upload overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#0b5fc1] text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                title="Fotoğraf değiştir"
              >
                {avatarUploading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Name / meta */}
            <div className="flex-1 pb-1">
              <h1 className="text-2xl font-bold text-white drop-shadow-md">{displayName}</h1>
              <p className="mt-0.5 text-sm text-white/90">{email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile?.title && (
                  <span className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {profile.title}
                  </span>
                )}
                {roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                  >
                    {ROLE_LABELS[r] ?? r}
                  </span>
                ))}
                {org && (
                  <span className="inline-flex items-center gap-1 text-xs text-white/80">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                    {org.name}{org.city ? `, ${org.city}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="hidden shrink-0 text-right text-xs text-white/80 sm:block">
              <div>Üyelik: {formatDate(profile?.created_at)}</div>
              <div>Güncelleme: {formatDate(profile?.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>


      {/* ── Feedback ── */}
      {feedback && (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm font-medium",
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400",
          ].join(" ")}
        >
          {feedback.msg}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-2xl border border-border bg-secondary/50 p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setFeedback(null); }}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all",
              tab === id
                ? "bg-card text-foreground shadow-[var(--shadow-soft)]"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          TAB: Profil Bilgileri
      ══════════════════════════════════════════════ */}
      {tab === "profile" && (
        <div className="space-y-4">
          {/* Personal info form */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-5 text-lg font-semibold text-foreground">Kişisel Bilgiler</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Ad Soyad</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ad Soyad"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Unvan / Pozisyon</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="İSG Uzmanı"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">E-posta</label>
                <input
                  value={email}
                  disabled
                  className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-muted-foreground opacity-70 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Telefon</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+90 5xx xxx xx xx"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0b5fc1] px-5 text-sm font-medium text-white shadow-lg hover:bg-[#0a4fa8] disabled:opacity-60 transition-colors"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Kaydediliyor...
                  </>
                ) : "Kaydet"}
              </button>
            </div>
          </div>

          {/* Org info */}
          {org && (
            <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
              <h2 className="mb-5 text-lg font-semibold text-foreground">Kuruluş Bilgileri</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Kuruluş Adı</label>
                  <input value={org.name} disabled className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-muted-foreground opacity-70 cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Şehir</label>
                  <input value={org.city ?? "—"} disabled className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-muted-foreground opacity-70 cursor-not-allowed" />
                </div>
              </div>
            </div>
          )}

          {/* Roles */}
          {roles.length > 0 && (
            <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Roller ve Yetkiler</h2>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {ROLE_LABELS[r] ?? r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Güvenlik
      ══════════════════════════════════════════════ */}
      {tab === "security" && (
        <div className="space-y-4">
          {/* Password change */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-5 text-lg font-semibold text-foreground">Şifre Değiştir</h2>
            <div className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Mevcut Şifre</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={saving || !newPassword || !confirmPassword}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0b5fc1] px-5 text-sm font-medium text-white shadow-lg hover:bg-[#0a4fa8] disabled:opacity-60 transition-colors"
              >
                {saving ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </button>
            </div>
          </div>

          {/* 2FA */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">İki Faktörlü Kimlik Doğrulama</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hesabınıza ekstra bir güvenlik katmanı ekleyin.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Yakında
              </span>
            </div>
          </div>

          {/* Active sessions */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Aktif Oturumlar</h2>
            <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">Mevcut Oturum</div>
                  <div className="text-xs text-muted-foreground">Bu cihaz · Şu an aktif</div>
                </div>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Aktif</span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-[1.75rem] border border-red-200 bg-card p-6 shadow-[var(--shadow-card)] dark:border-red-900/40 sm:p-7">
            <h2 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">Tehlikeli Bölge</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Hesabınızı silerseniz tüm verileriniz kalıcı olarak kaldırılır ve bu işlem geri alınamaz.
            </p>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
            >
              Hesabı Sil
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Tercihler
      ══════════════════════════════════════════════ */}
      {tab === "preferences" && (
        <div className="space-y-4">
          {/* Theme picker */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-5 text-lg font-semibold text-foreground">Tema</h2>
            <div className="grid grid-cols-3 gap-3">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    console.log("Tema tıklandı:", t);
                    const root = document.documentElement;
                    root.classList.remove("light", "dark");
                    const effective: "light" | "dark" = t === "system"
                      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
                      : t;
                    root.classList.add(effective);
                    root.setAttribute("data-theme", effective);
                    localStorage.setItem("risknova-theme", t);
                    setPrefs((prev) => ({ ...prev, theme: t }));
                    console.log("Tema uygulandı:", effective, "classList:", root.className);
                  }}
                  className={[
                    "cursor-pointer rounded-2xl border-2 p-4 text-center transition-all",
                    prefs.theme === t
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30 shadow-md"
                      : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-secondary/50",
                  ].join(" ")}
                >
                  <div className="mx-auto mb-2 text-2xl">
                    {t === "light" && "☀️"}
                    {t === "dark" && "🌙"}
                    {t === "system" && "💻"}
                  </div>
                  <div className="text-sm font-medium">
                    {t === "light" && "Açık"}
                    {t === "dark" && "Koyu"}
                    {t === "system" && "Sistem"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-5 text-lg font-semibold text-foreground">Dil</h2>
            <div className="flex gap-3">
              {(["tr", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    console.log("Dil tıklandı:", lang);
                    setPrefs((prev) => ({ ...prev, language: lang }));
                    localStorage.setItem("risknova-language", lang);
                  }}
                  className={[
                    "cursor-pointer flex items-center gap-2.5 rounded-2xl border-2 px-5 py-3 text-sm font-medium transition-all",
                    prefs.language === lang
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30 shadow-md"
                      : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-secondary/50",
                  ].join(" ")}
                >
                  <span className="text-lg">{lang === "tr" ? "🇹🇷" : "🇬🇧"}</span>
                  {lang === "tr" ? "Türkçe" : "English"}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-5 text-lg font-semibold text-foreground">Bildirimler</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">E-posta Bildirimleri</div>
                  <div className="text-xs text-muted-foreground">Görev hatırlatmaları ve güncellemeler</div>
                </div>
                <Toggle
                  checked={prefs.email_notifications}
                  onChange={(v) => setPrefs((p) => ({ ...p, email_notifications: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Push Bildirimleri</div>
                  <div className="text-xs text-muted-foreground">Tarayıcı anlık bildirimleri</div>
                </div>
                <Toggle
                  checked={prefs.push_notifications}
                  onChange={(v) => setPrefs((p) => ({ ...p, push_notifications: v }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePreferencesSave}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0b5fc1] px-5 text-sm font-medium text-white shadow-lg hover:bg-[#0a4fa8] disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Kaydediliyor...
                </>
              ) : "Tercihleri Kaydet"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Aktivite
      ══════════════════════════════════════════════ */}
      {tab === "activity" && (
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              { key: "all" as const, label: "Toplam Görev", value: activityStats.total, icon: "📋", color: "text-blue-500", ring: "ring-blue-400/40" },
              { key: "completed" as const, label: "Tamamlanan", value: activityStats.completed, icon: "✅", color: "text-green-500", ring: "ring-green-400/40" },
              { key: "pending" as const, label: "Bekleyen", value: activityStats.pending, icon: "⏳", color: "text-amber-500", ring: "ring-amber-400/40" },
              { key: "overdue" as const, label: "Geciken", value: activityStats.overdue, icon: "🚨", color: "text-red-500", ring: "ring-red-400/40" },
            ]).map(({ key, label, value, icon, color, ring }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivityFilter(key)}
                className={[
                  "rounded-[1.75rem] border bg-card p-5 shadow-[var(--shadow-card)] text-left transition-all cursor-pointer",
                  activityFilter === key
                    ? `border-primary/60 ring-2 ${ring} bg-primary/5`
                    : "border-border hover:border-primary/30 hover:bg-secondary/40",
                ].join(" ")}
              >
                <div className={`text-2xl ${color}`}>{icon}</div>
                <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </button>
            ))}
          </div>

          {/* Son İşlemler */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Son İşlemler</h2>
              {activityFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setActivityFilter("all")}
                  className="text-xs text-primary hover:underline"
                >
                  Filtreyi Kaldır
                </button>
              )}
            </div>
            {activityLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-border border-t-primary" />
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="text-4xl">📊</div>
                <p className="text-sm font-medium text-muted-foreground">Henüz aktivite kaydı yok</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  ISG görevleri oluşturmaya başladığınızda aktiviteleriniz burada görünecek.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTasks.map((task) => {
                  const statusMap: Record<string, { label: string; cls: string }> = {
                    planned: { label: "Planlandı", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
                    in_progress: { label: "Devam Ediyor", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
                    completed: { label: "Tamamlandı", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
                    overdue: { label: "Gecikmiş", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                    cancelled: { label: "İptal", cls: "bg-secondary text-muted-foreground" },
                  };
                  const st = statusMap[task.status] ?? statusMap.planned;
                  return (
                    <div key={task.id} className="flex items-center gap-4 py-3.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                        style={{ backgroundColor: task.category_color ? `${task.category_color}20` : undefined }}
                      >
                        {task.category_icon ?? "📌"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {task.category_name && <span>{task.category_name} · </span>}
                          {formatDate(task.start_date)}
                          {task.end_date && ` — ${formatDate(task.end_date)}`}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-lg px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

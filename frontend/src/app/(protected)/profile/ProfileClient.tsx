"use client";

import { useEffect, useRef, useState } from "react";
import { toDataURL } from "qrcode";
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ListTodo,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import { listSessions } from "@/lib/session-tracker";
import { validateStrongPassword } from "@/lib/security/password";
import { createClient } from "@/lib/supabase/client";
import { quickSignOut } from "@/lib/auth/quick-sign-out";
import { PremiumIconBadge, type PremiumIconTone } from "@/components/ui/premium-icon-badge";
import { ProfileConsentTab } from "./ProfileConsentTab";
import type { User } from "@supabase/supabase-js";

function resolveTaskBadge(categoryName: string | null, title: string): { icon: React.ElementType; tone: PremiumIconTone } {
  const haystack = `${categoryName ?? ""} ${title}`.toLocaleLowerCase("tr-TR");
  if (/(egitim|eğitim|training)/.test(haystack)) return { icon: GraduationCap, tone: "teal" };
  if (/(periyodik|kontrol|inspection|muayene)/.test(haystack)) return { icon: ClipboardCheck, tone: "cobalt" };
  if (/(kurul|toplanti|toplantı|meeting)/.test(haystack)) return { icon: Users, tone: "violet" };
  if (/(olay|incident|kaza)/.test(haystack)) return { icon: AlertTriangle, tone: "amber" };
  if (/(aksiyon|dof|duzeltme|düzeltme|action)/.test(haystack)) return { icon: Target, tone: "orange" };
  if (/(risk)/.test(haystack)) return { icon: ShieldAlert, tone: "risk" };
  if (/(dokuman|doküman|document|form)/.test(haystack)) return { icon: FileText, tone: "indigo" };
  return { icon: ListTodo, tone: "gold" };
}

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

type Tab = "profile" | "security" | "privacy" | "preferences" | "activity";

type MfaFactor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: "verified" | "unverified" | string;
  created_at: string;
  updated_at: string;
  last_challenged_at?: string;
};

type MfaEnrollment = {
  factorId: string;
  friendlyName: string;
  qrImageSrc: string;
  secret: string;
  uri: string;
};

type AssuranceLevel = "aal1" | "aal2" | null;

type SessionRecord = {
  id: string;
  device_type: string;
  device_info: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  isCurrent: boolean;
};

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

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-black/5 bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_16px_32px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_14px_30px_rgba(0,0,0,0.34)] dark:hover:shadow-[0_18px_34px_rgba(0,0,0,0.4)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/80 bg-background/90 px-5 text-sm font-medium text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-secondary/70 hover:text-primary dark:bg-card/90 dark:shadow-[0_12px_24px_rgba(0,0,0,0.28)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

const PROFILE_TABS: { id: Tab; label: string }[] = [
  ...TABS.slice(0, 2),
  { id: "privacy", label: "Gizlilik ve Onaylar" },
  ...TABS.slice(2),
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
  const [signingOut, setSigningOut] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
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
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailUpdating, setEmailUpdating] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaCurrentLevel, setMfaCurrentLevel] = useState<AssuranceLevel>(null);
  const [mfaNextLevel, setMfaNextLevel] = useState<AssuranceLevel>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [mfaFriendlyName, setMfaFriendlyName] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment | null>(null);

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
      setPendingEmail(user.email ?? "");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentSessionToken = session?.access_token ?? null;

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

      const sessionRows = await listSessions(supabase, user.id);
      setSessions(
        sessionRows.map((item) => ({
          id: item.id,
          device_type: item.device_type,
          device_info: item.device_info ?? null,
          ip_address: item.ip_address ?? null,
          last_active_at: item.last_active_at,
          created_at: item.created_at,
          isCurrent: currentSessionToken === item.session_token,
        })),
      );

      await loadMfaState(supabase);

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

    const passwordError = validateStrongPassword(newPassword);
    if (passwordError) {
      setFeedback({ type: "error", msg: passwordError });
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

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleEmailChange() {
    const supabase = createClient();
    if (!supabase) {
      setFeedback({ type: "error", msg: "E-posta güncelleme servisine bağlanılamadı." });
      return;
    }

    const nextEmail = pendingEmail.trim().toLowerCase();
    const currentEmail = (authUser?.email ?? profile?.email ?? "").trim().toLowerCase();

    if (!nextEmail) {
      setFeedback({ type: "error", msg: "Yeni e-posta adresi boş bırakılamaz." });
      return;
    }

    if (!isValidEmail(nextEmail)) {
      setFeedback({ type: "error", msg: "Geçerli bir e-posta adresi girin." });
      return;
    }

    if (nextEmail === currentEmail) {
      setFeedback({ type: "error", msg: "Yeni e-posta mevcut adresle aynı olamaz." });
      return;
    }

    setEmailUpdating(true);
    setFeedback(null);

    try {
      const origin = window.location.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const { data, error } = await supabase.auth.updateUser(
        { email: nextEmail },
        { emailRedirectTo: `${origin}/auth/confirm?next=/profile` }
      );

      if (error) throw error;
      if (data.user) setAuthUser(data.user);

      setFeedback({
        type: "success",
        msg: `${nextEmail} adresine onay bağlantısı gönderildi. Maili açıp değişikliği tamamlayın.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "E-posta değişikliği başlatılamadı.";
      setFeedback({ type: "error", msg });
    } finally {
      setEmailUpdating(false);
    }
  }

  // ─── Save preferences ────────────────────────────────────────────────────

  async function loadMfaState(existingClient?: ReturnType<typeof createClient>) {
    const supabase = existingClient ?? createClient();
    if (!supabase) return;

    setMfaLoading(true);

    try {
      const [{ data: factorData, error: factorError }, { data: assuranceData, error: assuranceError }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (factorError) throw factorError;
      if (assuranceError) throw assuranceError;

      setMfaFactors((factorData?.all as MfaFactor[] | undefined) ?? []);
      setMfaCurrentLevel(assuranceData?.currentLevel ?? null);
      setMfaNextLevel(assuranceData?.nextLevel ?? null);
    } catch (err) {
      console.error("[ProfileClient] loadMfaState error:", err);
    } finally {
      setMfaLoading(false);
    }
  }

  async function buildMfaQrImageSrc(uri: string, qrCodeSvg: string) {
    try {
      return await toDataURL(uri, {
        width: 220,
        margin: 1,
      });
    } catch (err) {
      console.warn("[ProfileClient] buildMfaQrImageSrc fallback:", err);
      const normalizedSvg = qrCodeSvg.trim();
      if (normalizedSvg.startsWith("data:image/")) {
        return normalizedSvg;
      }
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalizedSvg)}`;
    }
  }

  async function handleMfaEnroll() {
    const supabase = createClient();
    if (!supabase) {
      setFeedback({ type: "error", msg: "İki adımlı doğrulama servisine bağlanılamadı." });
      return;
    }

    setMfaBusy(true);
    setFeedback(null);

    try {
      const friendlyName = mfaFriendlyName.trim() || "Google Authenticator";
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (error) throw error;
      if (!data?.totp) throw new Error("TOTP kurulum verisi alınamadı.");

      const qrImageSrc = await buildMfaQrImageSrc(data.totp.uri, data.totp.qr_code);

      setMfaEnrollment({
        factorId: data.id,
        friendlyName: data.friendly_name ?? friendlyName,
        qrImageSrc,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setMfaCode("");
      await loadMfaState(supabase);
      setFeedback({ type: "success", msg: "Kurulum oluşturuldu. Şimdi kodu doğrulayarak 2FA'yi etkinleştirin." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "İki adımlı doğrulama başlatılamadı.";
      setFeedback({ type: "error", msg });
    } finally {
      setMfaBusy(false);
    }
  }

  async function handleMfaVerify() {
    if (!mfaEnrollment) return;

    const code = mfaCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      setFeedback({ type: "error", msg: "Doğrulama kodu 6 haneli olmalı." });
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setFeedback({ type: "error", msg: "İki adımlı doğrulama servisine bağlanılamadı." });
      return;
    }

    setMfaBusy(true);
    setFeedback(null);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.factorId,
        code,
      });

      if (error) throw error;

      setMfaEnrollment(null);
      setMfaCode("");
      setMfaFriendlyName("");
      await loadMfaState(supabase);
      setFeedback({ type: "success", msg: "İki adımlı doğrulama etkinleştirildi." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Doğrulama başarısız.";
      setFeedback({ type: "error", msg });
    } finally {
      setMfaBusy(false);
    }
  }

  async function handleMfaCancel() {
    if (!mfaEnrollment) return;

    const supabase = createClient();
    if (!supabase) {
      setMfaEnrollment(null);
      return;
    }

    setMfaBusy(true);
    setFeedback(null);

    try {
      await supabase.auth.mfa.unenroll({ factorId: mfaEnrollment.factorId });
    } catch (err) {
      console.error("[ProfileClient] handleMfaCancel warning:", err);
    } finally {
      setMfaEnrollment(null);
      setMfaCode("");
      setMfaBusy(false);
      await loadMfaState(supabase);
    }
  }

  async function handleMfaUnenroll(factorId: string) {
    const supabase = createClient();
    if (!supabase) {
      setFeedback({ type: "error", msg: "İki adımlı doğrulama servisine bağlanılamadı." });
      return;
    }

    setMfaBusy(true);
    setFeedback(null);

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      await loadMfaState(supabase);
      setFeedback({ type: "success", msg: "MFA cihazı kaldırıldı." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "MFA cihazı kaldırılamadı.";
      setFeedback({ type: "error", msg });
    } finally {
      setMfaBusy(false);
    }
  }

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

  async function handleSignOut() {
    setSigningOut(true);
    setFeedback(null);

    try {
      await quickSignOut("/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Oturum kapatılamadı.";
      setFeedback({ type: "error", msg });
      setSigningOut(false);
    }
  }

  async function handleSignOutAllDevices() {
    setSigningOutAll(true);
    setFeedback(null);

    const supabase = createClient();
    if (!supabase) {
      setFeedback({ type: "error", msg: "Oturum servisine bağlanılamadı." });
      setSigningOutAll(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        const { error: deleteError } = await supabase
          .from("user_sessions")
          .delete()
          .eq("user_id", session.user.id);

        if (deleteError) throw deleteError;
      }

      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;

      window.location.replace("/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tüm cihazlardan çıkış yapılamadı.";
      setFeedback({ type: "error", msg });
      setSigningOutAll(false);
    }
  }

  async function loadActivity() {
    setActivityLoading(true);
    const supabase = createClient();
    if (!supabase) { setActivityLoading(false); return; }
    try {
      // Kullanicinin kendi gorev feed'i: atananlar + olusturanlar.
      // Filtre yoksa query tum org'u geri dondurur — profil "Aktivite" sekmesi
      // kisisel olmali.
      // Not: isg_tasks.created_by = auth.users.id, isg_tasks.assigned_to = user_profiles.id.
      // Iki farkli UUID, ikisini de ayri cozmek gerekiyor.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setActivityLoading(false); return; }
      const { data: profileRow } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const profileId = profileRow?.id ?? null;
      const mine = profileId
        ? `assigned_to.eq.${profileId},created_by.eq.${user.id}`
        : `created_by.eq.${user.id}`;

      // Build filtered task query
      let taskQuery = supabase
        .from("isg_tasks")
        .select("id, title, status, start_date, end_date, updated_at, isg_task_categories(name, color, icon)")
        .or(mine)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (activityFilter === "completed") taskQuery = taskQuery.eq("status", "completed");
      else if (activityFilter === "pending") taskQuery = taskQuery.in("status", ["planned", "in_progress"]);
      else if (activityFilter === "overdue") taskQuery = taskQuery.eq("status", "overdue");

      const countBase = () =>
        supabase.from("isg_tasks").select("id", { count: "exact", head: true }).or(mine);

      const [{ data: tasks }, { count: total }, { count: completed }, { count: planned }, { count: overdue }] =
        await Promise.all([
          taskQuery,
          countBase(),
          countBase().eq("status", "completed"),
          countBase().in("status", ["planned", "in_progress"]),
          countBase().eq("status", "overdue"),
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

  function getMfaStatusText() {
    if (mfaCurrentLevel === "aal2") {
      return "Bu oturum ikinci adım doğrulamasıyla korunuyor.";
    }
    if (mfaFactors.some((factor) => factor.status === "verified")) {
      return "İki adımlı doğrulama açık. Bu oturumda henüz ikinci adım tamamlanmadı.";
    }
    if (mfaNextLevel === "aal2") {
      return "Hesabınızda doğrulanmış bir güvenlik cihazı var. Yeni girişlerde ikinci adım istenecek.";
    }
    return "Hesabınız şu anda yalnızca şifre ile korunuyor.";
  }

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
  const email = authUser?.email || profile?.email || "";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-6">

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.94)_52%,rgba(239,246,255,0.9)_100%)] dark:bg-[linear-gradient(135deg,rgba(11,17,32,0.98)_0%,rgba(15,23,42,0.95)_55%,rgba(17,24,39,0.92)_100%)]" />
        <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_68%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_68%)]" />
        <div className="relative px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-card text-2xl font-bold text-primary shadow-xl dark:border-white/10">
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
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/80 bg-primary text-primary-foreground shadow-md transition hover:bg-primary-hover disabled:opacity-60"
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile?.title && (
                  <span className="inline-flex items-center rounded-lg border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                    {profile.title}
                  </span>
                )}
                {roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-lg border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10"
                  >
                    {ROLE_LABELS[r] ?? r}
                  </span>
                ))}
                {org && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                    {org.name}{org.city ? `, ${org.city}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:flex sm:flex-col sm:items-end sm:gap-3">
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
        {PROFILE_TABS.map(({ id, label }) => (
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
                className={primaryButtonClass}
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
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <h2 className="mb-5 text-lg font-semibold text-foreground">E-posta Degistir</h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Mevcut E-posta</label>
                  <input
                    value={email}
                    disabled
                    className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-muted-foreground opacity-70 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Yeni E-posta</label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={pendingEmail}
                    onChange={(e) => setPendingEmail(e.target.value)}
                    placeholder="ornek@firma.com"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleEmailChange}
                  disabled={emailUpdating || !pendingEmail.trim()}
                  className={primaryButtonClass}
                >
                  {emailUpdating ? "Bağlantı Gönderiliyor..." : "Değişikliği Başlat"}
                </button>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground">
                E-posta değişikliği güvenlik nedeniyle onay gerektirir. Yeni adrese giden bağlantıyı açmadan hesap
                e-postası değişmez.
              </div>
            </div>
          </div>

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
                  placeholder="En az 12 karakter, büyük-küçük harf, rakam ve sembol"
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
                className={primaryButtonClass}
              >
                {saving ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </button>
            </div>
          </div>

          {/* 2FA */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">İki Adımlı Kimlik Doğrulama</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Google Authenticator, Authy ve benzeri TOTP uygulamalarıyla çalışır. Kurulum tamamlanınca bu hesap
                    için ikinci adım korunur.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold",
                      mfaFactors.some((factor) => factor.status === "verified")
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-secondary text-muted-foreground",
                    ].join(" ")}
                  >
                    {mfaFactors.some((factor) => factor.status === "verified") ? "2FA Açık" : "2FA Kapalı"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                {getMfaStatusText()}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="mb-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Yeni Cihaz Ekle</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        QR kodunu Google Authenticator ile okutun. İsterseniz cihaza özel bir ad verebilirsiniz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleMfaEnroll}
                      disabled={mfaBusy || !!mfaEnrollment}
                      className={`${primaryButtonClass} w-full sm:w-auto sm:self-start`}
                    >
                      {mfaBusy && !mfaEnrollment ? "Hazırlanıyor..." : "Google Authenticator'ı Bağla"}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Cihaz Adı</label>
                      <input
                        value={mfaFriendlyName}
                        onChange={(e) => setMfaFriendlyName(e.target.value)}
                        placeholder="Örn. Mehmet iPhone"
                        disabled={mfaBusy || !!mfaEnrollment}
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                      Yedekleme kodu desteği yok. Kritik hesaplarda en az iki farklı TOTP cihazı ekleyin.
                    </div>
                  </div>

                  {mfaEnrollment && (
                    <div className="mt-5 space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex flex-col gap-4 md:flex-row">
                        <div className="flex w-full max-w-[220px] items-center justify-center rounded-2xl border border-border bg-white p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mfaEnrollment.qrImageSrc}
                            alt="MFA QR kodu"
                            className="h-44 w-44"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">1. QR kodunu okutun</div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Google Authenticator uygulamasında yeni hesap ekleyin ve bu kodu taratın.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kurulum Anahtarı</label>
                            <input
                              readOnly
                              value={mfaEnrollment.secret}
                              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                            />
                          </div>
                          <details className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                            <summary className="cursor-pointer font-medium text-foreground">Elle kurulum URI&apos;sini göster</summary>
                            <div className="mt-2 break-all">{mfaEnrollment.uri}</div>
                          </details>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-foreground">2. Uygulamadan 6 haneli kodu girin</label>
                          <input
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                            placeholder="123456"
                            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm tracking-[0.25em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleMfaVerify}
                          disabled={mfaBusy || mfaCode.length !== 6}
                          className={primaryButtonClass}
                        >
                          {mfaBusy ? "Doğrulanıyor..." : "Doğrula"}
                        </button>
                        <button
                          type="button"
                          onClick={handleMfaCancel}
                          disabled={mfaBusy}
                          className={secondaryButtonClass}
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Kayıtlı MFA Cihazları</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Bu hesaba bağlı doğrulanmış veya doğrulanmamış tüm TOTP cihazları burada listelenir.
                      </p>
                    </div>
                    {mfaLoading && <span className="text-xs text-muted-foreground">Yükleniyor...</span>}
                  </div>

                  <div className="space-y-3">
                    {mfaFactors.length === 0 && !mfaLoading && (
                      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                        Henüz bağlı bir MFA cihazı yok.
                      </div>
                    )}

                    {mfaFactors.map((factor) => (
                      <div
                        key={factor.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {factor.friendly_name || "Authenticator"}
                            </span>
                            <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {factor.factor_type}
                            </span>
                            <span
                              className={[
                                "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                                factor.status === "verified"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                              ].join(" ")}
                            >
                              {factor.status === "verified" ? "Doğrulandı" : "Bekliyor"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Oluşturma: {formatDate(factor.created_at)}
                            {factor.last_challenged_at ? ` | Son kullanım: ${formatDate(factor.last_challenged_at)}` : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleMfaUnenroll(factor.id)}
                          disabled={mfaBusy}
                          className={secondaryButtonClass}
                        >
                          Kaldır
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active sessions */}
          <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Aktif Oturumlar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hesabınızda açık olan oturumları burada görebilir ve çıkış işlemlerini yönetebilirsiniz.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut || signingOutAll}
                  className={secondaryButtonClass}
                >
                  {signingOut ? "Kapatılıyor..." : "Bu cihazdan çık"}
                </button>
                <button
                  type="button"
                  onClick={handleSignOutAllDevices}
                  disabled={signingOutAll || signingOut}
                  className={secondaryButtonClass}
                >
                  {signingOutAll ? "Kapatılıyor..." : "Tüm cihazlardan çık"}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {sessions.length === 0 && (
                <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-4 text-sm text-muted-foreground">
                  Kayıtlı oturum bulunamadı. Bu cihazdaki oturum aktif görünüyor olabilir.
                </div>
              )}
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/20 px-4 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                    <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {session.device_info || "Bilinmeyen cihaz"}
                      </span>
                      <span
                        className={[
                          "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                          session.isCurrent
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-secondary text-muted-foreground",
                        ].join(" ")}
                      >
                        {session.isCurrent ? "Bu cihaz" : "Diğer cihaz"}
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {session.device_type}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Son aktivite: {formatDate(session.last_active_at)}
                      {session.ip_address ? ` | IP: ${session.ip_address}` : ""}
                      {session.created_at ? ` | Açılış: ${formatDate(session.created_at)}` : ""}
                    </div>
                  </div>
                  {session.isCurrent && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      Aktif
                    </span>
                  )}
                </div>
              ))}
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
      {tab === "privacy" && <ProfileConsentTab />}

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
              className={primaryButtonClass}
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
                  const badge = resolveTaskBadge(task.category_name, task.title);
                  return (
                    <div key={task.id} className="flex items-center gap-4 py-3.5">
                      <PremiumIconBadge icon={badge.icon} tone={badge.tone} size="sm" />
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



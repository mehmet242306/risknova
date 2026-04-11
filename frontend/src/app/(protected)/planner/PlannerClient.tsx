"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: boolean;
};

type CompanyWorkspace = {
  id: string;
  display_name: string;
};

type IsgTask = {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  company_workspace_id: string | null;
  start_date: string;
  end_date: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
  status: "planned" | "in_progress" | "completed" | "overdue" | "cancelled";
  location: string | null;
  reminder_days: number;
  include_in_timesheet: boolean;
  timesheet_hours: number | null;
  hourly_rate: number | null;
};

type CalendarView = "month" | "list";

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Tekrarsız",
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
  quarterly: "3 Aylık",
  biannual: "Altı Aylık",
  annual: "Yıllık",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planlandı",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  overdue: "Gecikmiş",
  cancelled: "İptal Edildi",
};

const STATUS_STYLES: Record<string, string> = {
  planned:     "bg-blue-100  text-blue-700  dark:bg-blue-950  dark:text-blue-300  [&>option]:dark:bg-slate-800 [&>option]:dark:text-white",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 [&>option]:dark:bg-slate-800 [&>option]:dark:text-white",
  completed:   "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 [&>option]:dark:bg-slate-800 [&>option]:dark:text-white",
  overdue:     "bg-red-100   text-red-700   dark:bg-red-950   dark:text-red-300   [&>option]:dark:bg-slate-800 [&>option]:dark:text-white",
  cancelled:   "bg-secondary text-muted-foreground dark:bg-slate-800 dark:text-slate-400 [&>option]:dark:bg-slate-800 [&>option]:dark:text-white",
};

// ─── Calendar helpers ────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ─── TaskModal ───────────────────────────────────────────────────────────────

type TaskModalProps = {
  categories: Category[];
  companies: CompanyWorkspace[];
  task: Partial<IsgTask> | null;
  defaultDate?: string;
  /** When set, the company is fixed (company-scoped view) */
  fixedCompanyId?: string;
  onSave: (task: Partial<IsgTask>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
};

function TaskModal({
  categories, companies, task, defaultDate, fixedCompanyId, onSave, onClose, saving,
}: TaskModalProps) {
  const [form, setForm] = useState<Partial<IsgTask>>({
    title: "",
    description: "",
    category_id: null,
    company_workspace_id: fixedCompanyId ?? null,
    start_date: defaultDate ?? new Date().toISOString().split("T")[0],
    end_date: null,
    recurrence: "none",
    status: "planned",
    location: "",
    reminder_days: 7,
    include_in_timesheet: false,
    timesheet_hours: null,
    hourly_rate: null,
    ...task,
    // if fixed company, always override
    ...(fixedCompanyId ? { company_workspace_id: fixedCompanyId } : {}),
  });

  const set = <K extends keyof IsgTask>(key: K, value: IsgTask[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_32px_80px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {task?.id ? "Görevi Düzenle" : "Yeni Görev"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Başlık *</label>
            <input
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Görev başlığı"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Açıklama</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Görev açıklaması..."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Kategori</label>
              <select
                value={form.category_id ?? ""}
                onChange={(e) => set("category_id", e.target.value || null)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              >
                <option value="">Kategori seçin...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Durum</label>
              <select
                value={form.status ?? "planned"}
                onChange={(e) => set("status", e.target.value as IsgTask["status"])}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Company (only when not fixed) */}
          {!fixedCompanyId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Firma</label>
              <select
                value={form.company_workspace_id ?? ""}
                onChange={(e) => set("company_workspace_id", e.target.value || null)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              >
                <option value="">Firma seçin...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Başlangıç Tarihi *</label>
              <input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => set("start_date", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Bitiş Tarihi</label>
              <input
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => set("end_date", e.target.value || null)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              />
            </div>
          </div>

          {/* Recurrence + Reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tekrar</label>
              <select
                value={form.recurrence ?? "none"}
                onChange={(e) => set("recurrence", e.target.value as IsgTask["recurrence"])}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              >
                {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Hatırlatma (gün önce)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={form.reminder_days ?? 7}
                onChange={(e) => set("reminder_days", parseInt(e.target.value) || 0)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
              />
            </div>
          </div>

          {/* Puantaj */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.include_in_timesheet ?? false}
                onChange={(e) => set("include_in_timesheet", e.target.checked)}
                className="h-4 w-4 rounded border-border text-[#0b5fc1] focus:ring-[#0b5fc1]/40"
              />
              <span className="text-sm font-medium text-foreground">Puantaja Ekle</span>
            </label>
            {form.include_in_timesheet && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Çalışma Süresi (saat)</label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={form.timesheet_hours ?? ""}
                    onChange={(e) => set("timesheet_hours", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Ör: 4.5"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0b5fc1]/40 dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Saat Ücreti (TL) <span className="text-muted-foreground/60">- opsiyonel</span></label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.hourly_rate ?? ""}
                    onChange={(e) => set("hourly_rate", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Ör: 250"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0b5fc1]/40 dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-foreground transition hover:bg-secondary/80"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={saving || !form.title || !form.start_date}
            onClick={() => onSave(form)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b5fc1] px-5 text-sm font-medium text-white shadow-lg hover:bg-[#0a4fa8] disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Kaydediliyor...
              </>
            ) : (task?.id ? "Güncelle" : "Oluştur")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PlannerCore — shared between PlannerClient and CompanyPlannerTab ─────────

export type PlannerCoreProps = {
  /** When set, only tasks for this company_workspace_id are shown/created */
  fixedCompanyId?: string;
  /** Show page-level header with title and "Yeni Görev" button */
  showHeader?: boolean;
};

export function PlannerCore({ fixedCompanyId, showHeader }: PlannerCoreProps) {
  const today = new Date();
  const [view, setView] = useState<CalendarView>("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState<IsgTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<CompanyWorkspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modalTask, setModalTask] = useState<Partial<IsgTask> | null | undefined>(undefined);
  const [modalDate, setModalDate] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");

  // ─── Load data ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    try {
      // Fetch user's organization_id from user_profiles (needed for RLS)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("auth_user_id", user.id)
          .single();
        if (profileData?.organization_id) setOrgId(profileData.organization_id);
      }

      const catQuery = supabase
        .from("isg_task_categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");

      const taskQuery = fixedCompanyId
        ? supabase.from("isg_tasks").select("*").eq("company_workspace_id", fixedCompanyId).order("start_date")
        : supabase.from("isg_tasks").select("*").order("start_date");

      if (fixedCompanyId) {
        const [catRes, taskRes] = await Promise.all([catQuery, taskQuery]);
        if (catRes.data) setCategories(catRes.data as Category[]);
        if (taskRes.data) setTasks(taskRes.data as IsgTask[]);
      } else {
        const compQuery = supabase
          .from("company_workspaces")
          .select("id, display_name")
          .eq("is_archived", false)
          .order("display_name");
        const [catRes, taskRes, compRes] = await Promise.all([catQuery, taskQuery, compQuery]);
        if (catRes.data) setCategories(catRes.data as Category[]);
        if (taskRes.data) setTasks(taskRes.data as IsgTask[]);
        if (compRes.data) setCompanies(compRes.data as CompanyWorkspace[]);
      }
    } catch (err) {
      console.error("[PlannerCore] loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, [fixedCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Save task ─────────────────────────────────────────────────────────

  async function handleSave(form: Partial<IsgTask>) {
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    if (!supabase) { setSaving(false); return; }

    // Re-fetch org_id if we don't have it yet (safety net)
    let currentOrgId = orgId;
    if (!currentOrgId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("auth_user_id", user.id)
          .single();
        currentOrgId = data?.organization_id ?? null;
        if (currentOrgId) setOrgId(currentOrgId);
      }
    }

    if (!currentOrgId) {
      setSaveError("Kuruluş bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        organization_id: currentOrgId,
        title: form.title,
        description: form.description || null,
        category_id: form.category_id || null,
        company_workspace_id: form.company_workspace_id || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        recurrence: form.recurrence ?? "none",
        status: form.status ?? "planned",
        location: form.location || null,
        reminder_days: form.reminder_days ?? 7,
        include_in_timesheet: form.include_in_timesheet ?? false,
        timesheet_hours: form.include_in_timesheet ? (form.timesheet_hours ?? null) : null,
        hourly_rate: form.include_in_timesheet ? (form.hourly_rate ?? null) : null,
      };

      let savedTaskId: string | null = form.id ?? null;

      if (form.id) {
        const { error } = await supabase
          .from("isg_tasks")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("isg_tasks")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedTaskId = inserted?.id ?? null;
      }

      // ── Puantaj entegrasyonu ──
      if (form.include_in_timesheet && form.company_workspace_id && form.start_date) {
        try {
          const taskDate = new Date(form.start_date);
          const tsMonth = taskDate.getMonth() + 1;
          const tsYear = taskDate.getFullYear();

          // Get current user profile id
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("id")
              .eq("auth_user_id", user.id)
              .single();

            if (prof && currentOrgId) {
              // Find or create timesheet for this month
              let { data: ts } = await supabase
                .from("timesheets")
                .select("id")
                .eq("professional_id", prof.id)
                .eq("month", tsMonth)
                .eq("year", tsYear)
                .maybeSingle();

              if (!ts) {
                const { data: newTs } = await supabase
                  .from("timesheets")
                  .insert({ organization_id: currentOrgId, professional_id: prof.id, month: tsMonth, year: tsYear })
                  .select("id")
                  .single();
                ts = newTs;
              }

              if (ts) {
                await supabase.from("timesheet_entries").upsert({
                  timesheet_id: ts.id,
                  company_workspace_id: form.company_workspace_id,
                  entry_date: form.start_date,
                  hours: form.timesheet_hours ?? 8,
                  task_id: savedTaskId,
                }, { onConflict: "timesheet_id,company_workspace_id,entry_date" });

                // Recalc totals
                const { data: allE } = await supabase
                  .from("timesheet_entries")
                  .select("hours")
                  .eq("timesheet_id", ts.id);
                const totalH = (allE ?? []).reduce((s, e) => s + (e.hours ?? 0), 0);
                await supabase.from("timesheets").update({ total_hours: totalH }).eq("id", ts.id);
              }
            }
          }
        } catch (tsErr) {
          console.error("[PlannerCore] timesheet sync error:", tsErr);
          // Don't fail the task save if timesheet sync fails
        }
      }

      setModalTask(undefined);
      await loadData();
    } catch (err: unknown) {
      const supaErr = err as { message?: string; details?: string; code?: string };
      const msg = supaErr.message ?? supaErr.details ?? JSON.stringify(err);
      console.error("[PlannerCore] save error:", JSON.stringify(err, null, 2), "message:", msg);
      setSaveError(msg || "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete task ────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Bu görevi silmek istediğinizden emin misiniz?")) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("isg_tasks").delete().eq("id", id);
    if (error) console.error("[PlannerCore] delete error:", JSON.stringify(error, null, 2));
    await loadData();
  }

  // ─── Quick status change ────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: IsgTask["status"]) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("isg_tasks").update({ status }).eq("id", id);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  }

  // ─── Derived data ───────────────────────────────────────────────────────

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.display_name]));
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategoryId !== "all" && t.category_id !== filterCategoryId) return false;
    if (!fixedCompanyId && filterCompanyId !== "all" && t.company_workspace_id !== filterCompanyId) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    planned: tasks.filter((t) => t.status === "planned").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
  };

  // ─── Month navigation ───────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  function tasksForDate(dateStr: string) {
    return filteredTasks.filter((t) => t.start_date === dateStr);
  }

  function buildCalendarDays() {
    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];
    const firstDay = (firstDayOfMonth(year, month) + 6) % 7; // Mon-first
    const total = daysInMonth(year, month);
    const prevTotal = daysInMonth(year, month === 0 ? 11 : month - 1);

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevTotal - i;
      const m2 = month === 0 ? 11 : month - 1;
      const y2 = month === 0 ? year - 1 : year;
      days.push({ date: `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= total; d++) {
      days.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: true });
    }
    let next = 1;
    while (days.length < 42) {
      const m2 = month === 11 ? 0 : month + 1;
      const y2 = month === 11 ? year + 1 : year;
      days.push({ date: `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(next).padStart(2, "0")}`, day: next++, isCurrentMonth: false });
    }
    return days;
  }

  const todayStr = today.toISOString().split("T")[0];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header (page view) */}
      {showHeader && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">İSG Planlayıcı</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              İş sağlığı ve güvenliği görevlerini planlayın ve takip edin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setModalDate(undefined); setModalTask(null); }}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0b5fc1] px-5 text-sm font-medium text-white shadow-lg hover:bg-[#0a4fa8] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Yeni Görev
          </button>
        </div>
      )}

      {/* "Yeni Görev" button for embedded (company tab) view */}
      {!showHeader && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setModalDate(undefined); setModalTask(null); }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#0b5fc1] px-4 text-sm font-medium text-white shadow-lg hover:bg-[#0a4fa8] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Yeni Görev
          </button>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { key: "total",       label: "Toplam",        color: "text-foreground",                                    bg: "bg-secondary/50" },
          { key: "planned",     label: "Planlandı",     color: "text-blue-600 dark:text-blue-400",                  bg: "bg-blue-50 dark:bg-blue-900/20" },
          { key: "in_progress", label: "Devam Ediyor",  color: "text-amber-600 dark:text-amber-400",               bg: "bg-amber-50 dark:bg-amber-900/20" },
          { key: "completed",   label: "Tamamlandı",    color: "text-green-600 dark:text-green-400",               bg: "bg-green-50 dark:bg-green-900/20" },
          { key: "overdue",     label: "Gecikmiş",      color: "text-red-600 dark:text-red-400",                   bg: "bg-red-50 dark:bg-red-900/20" },
        ].map(({ key, label, color, bg }) => (
          <div key={key} className={`rounded-2xl border border-border ${bg} px-4 py-3`}>
            <div className={`text-2xl font-bold ${color}`}>{stats[key as keyof typeof stats]}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category filter */}
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
        >
          <option value="all">Tüm Kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
        >
          <option value="all">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Company filter — only in global view */}
        {!fixedCompanyId && companies.length > 0 && (
          <select
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
            className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:text-white dark:border-slate-600 [&>option]:bg-white [&>option]:text-foreground dark:[&>option]:bg-slate-800 dark:[&>option]:text-white"
          >
            <option value="all">Tüm Firmalar</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex gap-1 rounded-xl border border-border bg-secondary/50 p-1">
          {(["month", "list"] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {v === "month" ? "Takvim" : "Liste"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      )}

      {/* ── Month calendar ── */}
      {!loading && view === "month" && (
        <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-foreground">{MONTH_NAMES[month]} {year}</h2>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {buildCalendarDays().map(({ date, day, isCurrentMonth }, idx) => {
              const dayTasks = tasksForDate(date);
              const isToday = date === todayStr;
              return (
                <div
                  key={date}
                  className={[
                    "min-h-[100px] cursor-pointer border-b border-r border-border p-1.5 transition hover:bg-secondary/30",
                    idx % 7 === 6 ? "border-r-0" : "",
                    !isCurrentMonth ? "opacity-40" : "",
                  ].join(" ")}
                  onClick={() => { setModalDate(date); setModalTask(null); }}
                >
                  <div className={[
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-primary text-white" : "text-foreground",
                  ].join(" ")}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => {
                      const cat = t.category_id ? catMap[t.category_id] : null;
                      return (
                        <div
                          key={t.id}
                          onClick={(e) => { e.stopPropagation(); setModalDate(undefined); setModalTask(t); }}
                          className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white transition hover:brightness-110"
                          style={{ background: cat?.color ?? "#6B7280" }}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="px-1.5 text-[10px] text-muted-foreground">+{dayTasks.length - 3} daha</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {!loading && view === "list" && (
        <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-card)]">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-5xl">📋</div>
              <p className="font-medium text-muted-foreground">Henüz görev yok</p>
              <p className="text-sm text-muted-foreground">Yukarıdaki "Yeni Görev" butonuna tıklayın.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTasks.map((task) => {
                const cat = task.category_id ? catMap[task.category_id] : null;
                const companyName = task.company_workspace_id ? companyMap[task.company_workspace_id] : null;
                return (
                  <div key={task.id} className="flex items-start gap-4 px-6 py-4 hover:bg-secondary/20 transition">
                    <div
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ background: cat?.color ?? "#6B7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{task.title}</span>
                        {cat && (
                          <span className="text-xs text-muted-foreground">{cat.icon} {cat.name}</span>
                        )}
                        {companyName && !fixedCompanyId && (
                          <span className="inline-flex items-center rounded-lg bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {companyName}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{task.start_date}</span>
                        {task.recurrence !== "none" && <span>· {RECURRENCE_LABELS[task.recurrence]}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as IsgTask["status"])}
                        className={[
                          "rounded-xl border-0 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40",
                          STATUS_STYLES[task.status],
                        ].join(" ")}
                      >
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setModalDate(undefined); setModalTask(task); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Category legend */}
      {!loading && categories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {categories.filter((c) => c.is_default).map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              <span className="text-xs text-muted-foreground">{c.icon} {c.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Task Modal */}
      {modalTask !== undefined && (
        <TaskModal
          categories={categories}
          companies={companies}
          task={modalTask}
          defaultDate={modalDate}
          fixedCompanyId={fixedCompanyId}
          onSave={handleSave}
          onClose={() => setModalTask(undefined)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Page-level wrapper ───────────────────────────────────────────────────────

export default function PlannerClient() {
  return <PlannerCore showHeader />;
}

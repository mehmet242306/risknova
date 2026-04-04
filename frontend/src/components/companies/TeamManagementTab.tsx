"use client";
import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ── */
type TeamCategory = {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  sort_order: number;
};

type TeamMember = {
  id: string;
  organization_id: string;
  company_workspace_id: string;
  category_id: string | null;
  full_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  cert_number: string | null;
  cert_expiry: string | null;
  notes: string | null;
  is_active: boolean;
};

const EMPTY_FORM = {
  full_name: "",
  title: "",
  phone: "",
  email: "",
  cert_number: "",
  cert_expiry: "",
  notes: "",
  is_active: true,
  category_id: "",
};
type MemberForm = typeof EMPTY_FORM;

/* ── Cert expiry helpers ── */
function certStatus(expiry: string | null): "none" | "valid" | "expiring" | "expired" {
  if (!expiry) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry);
  const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

function certDaysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((new Date(expiry).getTime() - today.getTime()) / 86400000);
}

function CertBadge({ expiry }: { expiry: string | null }) {
  const status = certStatus(expiry);
  const days = certDaysLeft(expiry);
  if (status === "none") return null;
  if (status === "expired")
    return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Süresi Doldu</span>;
  if (status === "expiring")
    return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{days} gün kaldı</span>;
  return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Geçerli</span>;
}

/* ── Member form (inline or modal) ── */
function MemberFormFields({
  form,
  onChange,
  categories,
  showCategory,
}: {
  form: MemberForm;
  onChange: (patch: Partial<MemberForm>) => void;
  categories: TeamCategory[];
  showCategory: boolean;
}) {
  const inp = "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:text-white dark:border-slate-600";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Ad Soyad *</label>
        <input className={inp} value={form.full_name} onChange={(e) => onChange({ full_name: e.target.value })} placeholder="Ad Soyad" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Ünvan / Görev</label>
        <input className={inp} value={form.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="İSG Uzmanı" />
      </div>
      {showCategory && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Kategori</label>
          <select
            className={`${inp} [&>option]:dark:bg-slate-800 [&>option]:dark:text-white`}
            value={form.category_id}
            onChange={(e) => onChange({ category_id: e.target.value })}
          >
            <option value="">Seçiniz</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefon</label>
        <input className={inp} value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="0500 000 00 00" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">E-posta</label>
        <input className={inp} type="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="ad@sirket.com" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Sertifika / Belge No</label>
        <input className={inp} value={form.cert_number} onChange={(e) => onChange({ cert_number: e.target.value })} placeholder="ISG-2024-001" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Sertifika Bitiş</label>
        <input className={inp} type="date" value={form.cert_expiry} onChange={(e) => onChange({ cert_expiry: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Notlar</label>
        <textarea
          className="h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:text-white dark:border-slate-600"
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Ek bilgi..."
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <input
          id="member-active"
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => onChange({ is_active: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <label htmlFor="member-active" className="text-sm text-foreground">Aktif üye</label>
      </div>
    </div>
  );
}

/* ── Member card ── */
function MemberCard({
  member,
  category,
  onEdit,
  onDelete,
}: {
  member: TeamMember;
  category: TeamCategory | undefined;
  onEdit: (m: TeamMember) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = certStatus(member.cert_expiry);

  return (
    <div
      className={`group relative rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
        !member.is_active ? "opacity-60" : ""
      } ${
        status === "expired"
          ? "border-red-300 dark:border-red-800"
          : status === "expiring"
          ? "border-amber-300 dark:border-amber-800"
          : "border-border"
      }`}
    >
      {/* Category color strip */}
      {category && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{ backgroundColor: category.color }}
        />
      )}

      <div className="pl-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {category && <span className="text-base leading-none">{category.icon}</span>}
              <p className="text-sm font-semibold text-foreground truncate">{member.full_name}</p>
            </div>
            {member.title && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">{member.title}</p>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(member)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Düzenle"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {confirmDelete ? (
              <>
                <button type="button" onClick={() => onDelete(member.id)} className="rounded-lg px-2 py-1 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200">Sil</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-2 py-1 text-[10px] font-medium bg-secondary text-muted-foreground hover:bg-secondary/80">İptal</button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="Sil"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-2.5 space-y-1">
          {member.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{member.phone}</span>
            </div>
          )}
          {member.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{member.email}</span>
            </div>
          )}
        </div>

        {/* Cert status */}
        {member.cert_expiry && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {member.cert_number && (
              <span className="text-[10px] text-muted-foreground font-mono">{member.cert_number}</span>
            )}
            <CertBadge expiry={member.cert_expiry} />
          </div>
        )}

        {/* Inactive badge */}
        {!member.is_active && (
          <div className="mt-2">
            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-secondary text-muted-foreground">Pasif</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modal backdrop ── */
function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export function TeamManagementTab({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName?: string;
}) {
  const [categories, setCategories] = useState<TeamCategory[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [orgId, setOrgId] = useState<string | null>(null);

  // Add member modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<MemberForm>({ ...EMPTY_FORM });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit member modal
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState<MemberForm>({ ...EMPTY_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Personnel quick-add (from company personnel)
  type PersonnelQuick = { id: string; name: string; title: string; phone: string; email: string };
  const [personnel, setPersonnel] = useState<PersonnelQuick[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // New category modal
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#6B7280");
  const [catIcon, setCatIcon] = useState("👤");
  const [catSaving, setCatSaving] = useState(false);

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    // Get organization_id from user_profiles
    const { data: { user } } = await supabase.auth.getUser();
    let resolvedOrgId = orgId;
    if (!resolvedOrgId && user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("auth_user_id", user.id)
        .single();
      if (profile?.organization_id) {
        resolvedOrgId = profile.organization_id as string;
        setOrgId(resolvedOrgId);
      }
    }

    const qCats = supabase
      .from("team_categories")
      .select("id, name, color, icon, is_default, sort_order")
      .order("sort_order");

    const qMembers = supabase
      .from("team_members")
      .select("id, organization_id, company_workspace_id, category_id, full_name, title, phone, email, cert_number, cert_expiry, notes, is_active")
      .eq("company_workspace_id", companyId)
      .order("full_name");

    const [{ data: cats }, { data: mems }] = await Promise.all([qCats, qMembers]);

    let loadedCats = (cats as TeamCategory[]) ?? [];

    // Varsayılan kategorileri otomatik oluştur (yoksa)
    const defaultCats = [
      { name: "Risk Değerlendirme Ekibi", color: "#DC2626", icon: "🎯", sort_order: 1 },
      { name: "İSG Uzmanı", color: "#3B82F6", icon: "🛡️", sort_order: 2 },
      { name: "İşyeri Hekimi", color: "#10B981", icon: "⚕️", sort_order: 3 },
      { name: "Acil Durum Ekip Lideri", color: "#F97316", icon: "🚨", sort_order: 4 },
    ];
    const missingDefaults = defaultCats.filter((d) => !loadedCats.some((c) => c.name === d.name));
    if (missingDefaults.length > 0) {
      const inserts = missingDefaults.map((d) => ({
        ...d,
        is_default: true,
        organization_id: resolvedOrgId || orgId,
      }));
      const { data: newCats } = await supabase.from("team_categories").insert(inserts).select("id, name, color, icon, is_default, sort_order");
      if (newCats) loadedCats = [...loadedCats, ...(newCats as TeamCategory[])].sort((a, b) => a.sort_order - b.sort_order);
    }

    setCategories(loadedCats);
    setMembers((mems as TeamMember[]) ?? []);
    setLoading(false);
  }, [companyId, orgId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadData(); }, [loadData]);

  // Firma personelini yukle (ekip uyesi olarak eklemek icin)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!supabase) return;

      // companyId = workspace id, personnel company_identity_id ile bagli
      const { data: ws } = await supabase
        .from("company_workspaces")
        .select("company_identity_id")
        .eq("id", companyId)
        .single();

      if (!ws?.company_identity_id) return;

      const { data } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, position_title, phone, email")
        .eq("company_identity_id", ws.company_identity_id)
        .order("first_name");

      if (data) {
        setPersonnel(data.map((p: { id: string; first_name: string; last_name: string; position_title: string; phone: string; email: string }) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          title: p.position_title || "",
          phone: p.phone || "",
          email: p.email || "",
        })));
      }
    })();
  }, [companyId]);

  /* ── Filtered members ── */
  const filteredMembers =
    selectedCategoryId === "all"
      ? members
      : members.filter((m) => m.category_id === selectedCategoryId);

  const uncategorized = filteredMembers.filter((m) => !m.category_id);

  // Members grouped by category
  const grouped = categories
    .filter((c) => selectedCategoryId === "all" || selectedCategoryId === c.id)
    .map((c) => ({
      category: c,
      members: filteredMembers.filter((m) => m.category_id === c.id),
    }))
    .filter((g) => g.members.length > 0);

  /* ── Add member ── */
  const openAdd = useCallback((categoryId?: string) => {
    setAddForm({
      ...EMPTY_FORM,
      category_id: categoryId ?? (selectedCategoryId === "all" ? "" : selectedCategoryId),
    });
    setAddError(null);
    setAddOpen(true);
  }, [selectedCategoryId]);

  // Toplu personelden ekle
  const handleBulkAdd = useCallback(async () => {
    if (bulkSelected.size === 0 || !orgId) return;
    const supabase = createClient();
    if (!supabase) return;
    setBulkSaving(true);

    const existingNames = new Set(members.map((m) => m.full_name.toLowerCase()));
    const toAdd = personnel.filter((p) => bulkSelected.has(p.id) && !existingNames.has(p.name.toLowerCase()));

    const catId = selectedCategoryId === "all" ? null : selectedCategoryId;

    for (const p of toAdd) {
      await supabase.from("team_members").insert({
        organization_id: orgId,
        company_workspace_id: companyId,
        category_id: catId,
        full_name: p.name,
        title: p.title || null,
        phone: p.phone || null,
        email: p.email || null,
        is_active: true,
      });
    }

    setBulkSaving(false);
    setBulkSelected(new Set());
    setBulkMode(false);
    void loadData();
  }, [bulkSelected, orgId, personnel, members, selectedCategoryId, companyId, loadData]);

  const handleAdd = useCallback(async () => {
    if (!addForm.full_name.trim()) { setAddError("Ad Soyad zorunludur."); return; }
    if (!orgId) { setAddError("Organizasyon bilgisi alınamadı."); return; }
    const supabase = createClient();
    if (!supabase) { setAddError("Bağlantı hatası."); return; }
    setAddSaving(true);
    setAddError(null);
    const { error } = await supabase.from("team_members").insert({
      organization_id: orgId,
      company_workspace_id: companyId,
      category_id: addForm.category_id || null,
      full_name: addForm.full_name.trim(),
      title: addForm.title.trim() || null,
      phone: addForm.phone.trim() || null,
      email: addForm.email.trim() || null,
      cert_number: addForm.cert_number.trim() || null,
      cert_expiry: addForm.cert_expiry || null,
      notes: addForm.notes.trim() || null,
      is_active: addForm.is_active,
    });
    if (error) { setAddError(error.message); setAddSaving(false); return; }
    setAddOpen(false);
    setAddSaving(false);
    void loadData();
  }, [addForm, companyId, orgId, loadData]);

  /* ── Edit member ── */
  const openEdit = useCallback((m: TeamMember) => {
    setEditMember(m);
    setEditForm({
      full_name: m.full_name,
      title: m.title ?? "",
      phone: m.phone ?? "",
      email: m.email ?? "",
      cert_number: m.cert_number ?? "",
      cert_expiry: m.cert_expiry ?? "",
      notes: m.notes ?? "",
      is_active: m.is_active,
      category_id: m.category_id ?? "",
    });
    setEditError(null);
  }, []);

  const handleEdit = useCallback(async () => {
    if (!editMember) return;
    if (!editForm.full_name.trim()) { setEditError("Ad Soyad zorunludur."); return; }
    const supabase = createClient();
    if (!supabase) { setEditError("Bağlantı hatası."); return; }
    setEditSaving(true);
    setEditError(null);
    const { error } = await supabase.from("team_members").update({
      category_id: editForm.category_id || null,
      full_name: editForm.full_name.trim(),
      title: editForm.title.trim() || null,
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      cert_number: editForm.cert_number.trim() || null,
      cert_expiry: editForm.cert_expiry || null,
      notes: editForm.notes.trim() || null,
      is_active: editForm.is_active,
    }).eq("id", editMember.id);
    if (error) { setEditError(error.message); setEditSaving(false); return; }
    setEditMember(null);
    setEditSaving(false);
    void loadData();
  }, [editMember, editForm, loadData]);

  /* ── Delete member ── */
  const handleDelete = useCallback(async (id: string) => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("team_members").delete().eq("id", id);
    void loadData();
  }, [loadData]);

  /* ── Add category ── */
  const handleAddCategory = useCallback(async () => {
    if (!catName.trim() || !orgId) return;
    const supabase = createClient();
    if (!supabase) return;
    setCatSaving(true);
    const { data } = await supabase.from("team_categories").insert({
      organization_id: orgId,
      name: catName.trim(),
      color: catColor,
      icon: catIcon,
      is_default: false,
    }).select("id").single();
    if (data?.id) setSelectedCategoryId(data.id);
    setCatOpen(false);
    setCatName(""); setCatColor("#6B7280"); setCatIcon("👤");
    setCatSaving(false);
    void loadData();
  }, [catName, catColor, catIcon, orgId, loadData]);

  /* ── Cert warning summary ── */
  const expiredCount = members.filter((m) => certStatus(m.cert_expiry) === "expired").length;
  const expiringCount = members.filter((m) => certStatus(m.cert_expiry) === "expiring").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.is_active).length;

  return (
    <div className="space-y-5">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="section-title text-base">Ekip Yönetimi</h2>
          {companyName && <p className="mt-0.5 text-xs text-muted-foreground">{companyName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Toplam: <strong className="text-foreground">{totalMembers}</strong></span>
            <span className="text-muted-foreground">Aktif: <strong className="text-foreground">{activeMembers}</strong></span>
          </div>
          {expiredCount > 0 && (
            <span className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              ⚠ {expiredCount} sertifika süresi dolmuş
            </span>
          )}
          {expiringCount > 0 && (
            <span className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              ⏰ {expiringCount} sertifika yakında dolacak
            </span>
          )}
          {personnel.length > 0 && (
            <button
              type="button"
              onClick={() => { setBulkMode(true); setBulkSelected(new Set()); }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Personelden Ekle
            </button>
          )}
          <button
            type="button"
            onClick={() => openAdd()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Üye Ekle
          </button>
        </div>
      </div>

      {/* ── Yatay kategori filtreleri ── */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-soft)]">
        <button
          type="button"
          onClick={() => setSelectedCategoryId("all")}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedCategoryId === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
        >
          Tümü
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{members.length}</span>
        </button>

        {categories.map((cat) => {
          const count = members.filter((m) => m.category_id === cat.id).length;
          const active = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(active ? "all" : cat.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "text-white"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
              style={active ? { backgroundColor: cat.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: active ? "#fff" : cat.color }} />
              {cat.name}
              {count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-muted"}`}>{count}</span>}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => { setCatOpen(true); }}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Kategori Ekle
        </button>
      </div>

      {/* ── Üye listesi ── */}
      <div className="space-y-6">
        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl">👥</div>
            <p className="text-sm font-medium text-foreground">Henüz ekip üyesi yok</p>
            <p className="mt-1 text-xs text-muted-foreground">İSG ekibini oluşturmak için üye ekleyin.</p>
            <button
              type="button"
              onClick={() => openAdd()}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              İlk Üyeyi Ekle
            </button>
          </div>
        ) : (
          <>
            {grouped.map(({ category, members: catMembers }) => (
              <div key={category.id}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                    <h3 className="text-sm font-semibold text-foreground">
                      {category.icon} {category.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">({catMembers.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAdd(category.id)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Ekle
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catMembers.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      category={category}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}

            {uncategorized.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-border" />
                  <h3 className="text-sm font-semibold text-foreground">Kategorisiz</h3>
                  <span className="text-xs text-muted-foreground">({uncategorized.length})</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {uncategorized.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      category={undefined}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add member modal ── */}
      {addOpen && (
        <Modal
          title="Ekip Üyesi Ekle"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary">İptal</button>
              <button type="button" onClick={() => void handleAdd()} disabled={addSaving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
                {addSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </>
          }
        >
          {addError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">{addError}</p>}

          {/* Personelden hizli doldurma */}
          {personnel.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Personelden Doldur</p>
              <select
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground [&>option]:dark:bg-slate-800 [&>option]:dark:text-white"
                value=""
                onChange={(e) => {
                  const p = personnel.find((pp) => pp.id === e.target.value);
                  if (p) {
                    setAddForm((f) => ({
                      ...f,
                      full_name: p.name,
                      title: p.title || f.title,
                      phone: p.phone || f.phone,
                      email: p.email || f.email,
                    }));
                  }
                }}
              >
                <option value="">Personel seç (bilgileri otomatik doldurur)</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.title ? ` — ${p.title}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <MemberFormFields
            form={addForm}
            onChange={(p) => setAddForm((f) => ({ ...f, ...p }))}
            categories={categories}
            showCategory
          />
        </Modal>
      )}

      {/* ── Edit member modal ── */}
      {editMember && (
        <Modal
          title="Üyeyi Düzenle"
          onClose={() => setEditMember(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditMember(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary">İptal</button>
              <button type="button" onClick={() => void handleEdit()} disabled={editSaving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
                {editSaving ? "Kaydediliyor..." : "Güncelle"}
              </button>
            </>
          }
        >
          {editError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">{editError}</p>}
          <MemberFormFields
            form={editForm}
            onChange={(p) => setEditForm((f) => ({ ...f, ...p }))}
            categories={categories}
            showCategory
          />
        </Modal>
      )}

      {/* ── Bulk add from personnel modal ── */}
      {bulkMode && (
        <Modal
          title="Personelden Ekip Üyesi Ekle"
          onClose={() => setBulkMode(false)}
          footer={
            <>
              <button type="button" onClick={() => setBulkMode(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary">İptal</button>
              <button
                type="button"
                onClick={() => void handleBulkAdd()}
                disabled={bulkSaving || bulkSelected.size === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {bulkSaving ? "Ekleniyor..." : `${bulkSelected.size} Kişiyi Ekle`}
              </button>
            </>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Firma personelinden ekip üyesi olarak eklemek istediklerinizi seçin. Zaten ekipte olan kişiler işaretlenmiştir.
          </p>

          {/* Tümünü seç */}
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const existingNames = new Set(members.map((m) => m.full_name.toLowerCase()));
                const available = personnel.filter((p) => !existingNames.has(p.name.toLowerCase()));
                if (bulkSelected.size === available.length) {
                  setBulkSelected(new Set());
                } else {
                  setBulkSelected(new Set(available.map((p) => p.id)));
                }
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {bulkSelected.size > 0 ? "Seçimi Kaldır" : "Tümünü Seç"}
            </button>
            <span className="text-xs text-muted-foreground">{bulkSelected.size} seçili</span>
          </div>

          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {personnel.map((p) => {
              const alreadyInTeam = members.some((m) => m.full_name.toLowerCase() === p.name.toLowerCase());
              const isSelected = bulkSelected.has(p.id);

              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                    alreadyInTeam
                      ? "bg-emerald-50 opacity-60 dark:bg-emerald-950"
                      : isSelected
                        ? "bg-primary/10 border border-primary/30 dark:bg-primary/20"
                        : "hover:bg-secondary"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected || alreadyInTeam}
                    disabled={alreadyInTeam}
                    onChange={() => {
                      if (alreadyInTeam) return;
                      setBulkSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.title || "Görev belirtilmemiş"}
                      {p.phone && ` · ${p.phone}`}
                    </p>
                  </div>
                  {alreadyInTeam && (
                    <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Ekipte</span>
                  )}
                </label>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── Add category modal ── */}
      {catOpen && (
        <Modal
          title="Yeni Kategori"
          onClose={() => setCatOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setCatOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary">İptal</button>
              <button type="button" onClick={() => void handleAddCategory()} disabled={catSaving || !catName.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
                {catSaving ? "Kaydediliyor..." : "Oluştur"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Kategori Adı *</label>
              <input
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:text-white dark:border-slate-600"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="ör. Yangın Söndürme Ekibi"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Renk</label>
                <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-lg border border-border p-1" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">İkon (emoji)</label>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  placeholder="👤"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: catColor }} />
              <span className="text-sm">{catIcon} {catName || "Kategori Adı"}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

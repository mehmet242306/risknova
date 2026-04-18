"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, X, Users, UserPlus, Building2 } from "lucide-react";
import { fetchPersonnelFromSupabase, type PersonnelRecord } from "@/lib/supabase/personnel-api";

export type PickedPerson = {
  id?: string;
  fullName: string;
  phone?: string;
  email?: string;
  positionTitle?: string;
  department?: string;
  isManual: boolean;
};

interface PersonnelPickerProps {
  companyId: string | null;
  selected: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
  mode: "affected" | "witness";
  label?: string;
}

export function PersonnelPicker({ companyId, selected, onChange, mode, label }: PersonnelPickerProps) {
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<PickedPerson>({ fullName: "", isManual: true });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Personeli yükle
  useEffect(() => {
    if (!companyId) { setPersonnel([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchPersonnelFromSupabase(companyId)
      .then((list) => { if (!cancelled) setPersonnel(list ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  // Dış tıklama ile dropdown kapansın
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id).filter(Boolean)), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = personnel.filter((p) => !selectedIds.has(p.id));
    if (!q) return list.slice(0, 20);
    return list.filter((p) => {
      const full = `${p.firstName} ${p.lastName} ${p.positionTitle ?? ""} ${p.department ?? ""}`.toLowerCase();
      return full.includes(q);
    }).slice(0, 20);
  }, [personnel, search, selectedIds]);

  function addFromPersonnel(p: PersonnelRecord) {
    onChange([
      ...selected,
      {
        id: p.id,
        fullName: `${p.firstName} ${p.lastName}`.trim(),
        phone: p.phone || undefined,
        email: p.email || undefined,
        positionTitle: p.positionTitle || undefined,
        department: p.department || undefined,
        isManual: false,
      },
    ]);
    setSearch("");
    setDropdownOpen(false);
  }

  function removeAt(index: number) {
    onChange(selected.filter((_, i) => i !== index));
  }

  function addManual() {
    if (!manualForm.fullName.trim()) return;
    onChange([...selected, { ...manualForm, fullName: manualForm.fullName.trim(), isManual: true }]);
    setManualForm({ fullName: "", isManual: true });
    setManualOpen(false);
  }

  return (
    <div ref={wrapperRef} className="space-y-3">
      {label && <label className="block text-sm font-medium text-foreground">{label}</label>}

      {/* Seçili kişiler listesi */}
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((person, index) => (
            <div key={index} className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${person.isManual ? "bg-amber-500/15" : "bg-primary/15"}`}>
                {person.isManual ? <UserPlus className="size-3.5 text-amber-600" /> : <Building2 className="size-3.5 text-primary" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{person.fullName}</span>
                  {person.isManual && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">Manuel</span>}
                </div>
                {(person.positionTitle || person.department) && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[person.positionTitle, person.department].filter(Boolean).join(" — ")}
                  </div>
                )}
                {mode === "witness" && (person.phone || person.email) && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[person.phone, person.email].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => removeAt(index)} className="shrink-0 text-muted-foreground hover:text-danger">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Seçim kontrolleri */}
      <div className="space-y-2">
        {/* Personel arama */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-input px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder={companyId ? (loading ? "Personel yükleniyor..." : "Firma personelinden seç veya ara...") : "Önce firma seçin"}
              disabled={!companyId || loading}
              className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" /> {personnel.length}
            </span>
          </div>

          {dropdownOpen && companyId && !loading && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {search ? "Eşleşen personel bulunamadı" : personnel.length === 0 ? "Firmada kayıtlı personel yok" : "Tümü seçildi"}
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addFromPersonnel(p)}
                    className="flex w-full items-start gap-3 border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-muted/50"
                  >
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded bg-primary/10">
                      <Building2 className="size-3 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[p.positionTitle, p.department].filter(Boolean).join(" — ") || "—"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Manuel ekleme */}
        {!manualOpen ? (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-3.5" /> Manuel Ekle (personel dışından)
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <input
              type="text"
              value={manualForm.fullName}
              onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })}
              placeholder="Ad Soyad"
              className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground"
            />
            {mode === "witness" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={manualForm.phone ?? ""}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="Telefon (opsiyonel)"
                  className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground"
                />
                <input
                  type="email"
                  value={manualForm.email ?? ""}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="E-posta (opsiyonel)"
                  className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addManual}
                disabled={!manualForm.fullName.trim()}
                className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => { setManualOpen(false); setManualForm({ fullName: "", isManual: true }); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

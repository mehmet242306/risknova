"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANY_TYPE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  type CompanyRelationship,
  type CompanyType,
  type RelationshipType,
} from "@/lib/company-types";
import {
  getCompanyIdentityId,
  fetchCompanyRelationships,
  createCompanyRelationship,
  updateCompanyRelationship,
  deleteCompanyRelationship,
  fetchCompanyPickerList,
} from "@/lib/supabase/company-api";

type PickerCompany = {
  identity_id: string;
  workspace_id: string;
  name: string;
  company_type: string;
};

export default function CompanyRelationshipsTab({
  companyId,
  companyName,
  companyType,
}: {
  companyId: string;
  companyName: string;
  companyType: string;
}) {
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [relations, setRelations] = useState<CompanyRelationship[]>([]);
  const [companies, setCompanies] = useState<PickerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formRelType, setFormRelType] = useState<RelationshipType>("asil_alt_isveren");
  const [formWorksite, setFormWorksite] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDirection, setFormDirection] = useState<"parent" | "child">("child");

  const load = useCallback(async () => {
    setLoading(true);
    const idId = await getCompanyIdentityId(companyId);
    if (!idId) {
      setLoading(false);
      return;
    }
    setIdentityId(idId);

    const [rels, comps] = await Promise.all([
      fetchCompanyRelationships(idId),
      fetchCompanyPickerList(),
    ]);
    setRelations(rels);
    setCompanies(comps.filter((c) => c.identity_id !== idId));
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Smart defaults based on company type
  useEffect(() => {
    if (companyType === "asil_isveren") {
      setFormDirection("child");
    } else if (companyType === "alt_isveren" || companyType === "alt_yuklenici") {
      setFormDirection("parent");
    }
  }, [companyType]);

  const parentRels = relations.filter((r) => r.child_company_id === identityId);
  const childRels = relations.filter((r) => r.parent_company_id === identityId);

  const resetForm = () => {
    setFormCompanyId("");
    setFormRelType("asil_alt_isveren");
    setFormWorksite("");
    setFormStartDate("");
    setFormEndDate("");
    setFormNotes("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!identityId || !formCompanyId) return;
    setSaving(true);

    const ok = await createCompanyRelationship({
      parent_company_id: formDirection === "parent" ? formCompanyId : identityId,
      child_company_id: formDirection === "parent" ? identityId : formCompanyId,
      relationship_type: formRelType,
      worksite: formWorksite || undefined,
      contract_start_date: formStartDate || undefined,
      contract_end_date: formEndDate || undefined,
      notes: formNotes || undefined,
    });

    if (ok) {
      resetForm();
      void load();
    }
    setSaving(false);
  };

  const handleToggleActive = async (rel: CompanyRelationship) => {
    await updateCompanyRelationship(rel.id, { is_active: !rel.is_active });
    void load();
  };

  const handleDelete = async (id: string) => {
    await deleteCompanyRelationship(id);
    void load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Yukleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Firma Iliskileri</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Asil isveren, taseron ve alt yuklenici iliskilerini yonetin.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Iptal" : "Yeni Iliski Ekle"}
        </Button>
      </div>

      {/* Add Relationship Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-sm font-semibold text-foreground mb-4">Yeni Iliski Olustur</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Iliski Yonu</label>
              <select
                value={formDirection}
                onChange={(e) => setFormDirection(e.target.value as "parent" | "child")}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="child">Bu firma UST firma (asil isveren)</option>
                <option value="parent">Bu firma ALT firma (taseron/yuklenici)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {formDirection === "child" ? "Alt Firma" : "Ust Firma"}
              </label>
              <select
                value={formCompanyId}
                onChange={(e) => setFormCompanyId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">Firma Secin...</option>
                {companies.map((c) => (
                  <option key={c.identity_id} value={c.identity_id}>
                    {c.name} ({COMPANY_TYPE_LABELS[c.company_type as CompanyType] || c.company_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Iliski Turu</label>
              <select
                value={formRelType}
                onChange={(e) => setFormRelType(e.target.value as RelationshipType)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="asil_alt_isveren">Asil Isveren - Alt Isveren</option>
                <option value="asil_alt_yuklenici">Asil Isveren - Alt Yuklenici</option>
                <option value="osgb_hizmet">OSGB Hizmet Iliskisi</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Santiye / Isyeri</label>
              <Input
                value={formWorksite}
                onChange={(e) => setFormWorksite(e.target.value)}
                placeholder="Ornegin: Merkez Santiye"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sozlesme Baslangic</label>
              <Input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sozlesme Bitis</label>
              <Input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">Notlar</label>
            <Textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Iliski hakkinda notlar..."
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleCreate} disabled={!formCompanyId || saving}>
              {saving ? "Kaydediliyor..." : "Iliski Olustur"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Iptal</Button>
          </div>
        </div>
      )}

      {/* Parent companies (this company is child) */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Ust Firmalar
          <span className="text-xs text-muted-foreground font-normal">
            ({companyName} bu firmalarin alt isvereni/yuklenicisi)
          </span>
        </h3>
        <div className="mt-4 space-y-3">
          {parentRels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Ust firma iliskisi bulunmuyor.</p>
          ) : (
            parentRels.map((rel) => (
              <RelationCard key={rel.id} rel={rel} side="parent" onToggle={handleToggleActive} onDelete={handleDelete} />
            ))
          )}
        </div>
      </section>

      {/* Child companies (this company is parent) */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Alt Firmalar
          <span className="text-xs text-muted-foreground font-normal">
            ({companyName} bu firmalarin asil isvereni)
          </span>
        </h3>
        <div className="mt-4 space-y-3">
          {childRels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Alt firma iliskisi bulunmuyor.</p>
          ) : (
            childRels.map((rel) => (
              <RelationCard key={rel.id} rel={rel} side="child" onToggle={handleToggleActive} onDelete={handleDelete} />
            ))
          )}
        </div>
      </section>

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200/80">
            <strong>Mevzuat:</strong> 4857 sayili Is Kanunu md.2 ve 6331 sayili ISG Kanunu md.22
            geregince asil isveren, alt isverenin isciligine iliskin yukumluluklerden birlikte sorumludur.
            Alt isverenlik iliskisi ayni isyerinde yurutulmelidir.
          </div>
        </div>
      </div>
    </div>
  );
}

function RelationCard({
  rel,
  side,
  onToggle,
  onDelete,
}: {
  rel: CompanyRelationship;
  side: "parent" | "child";
  onToggle: (r: CompanyRelationship) => void;
  onDelete: (id: string) => void;
}) {
  const partnerName = side === "parent" ? rel.parent_name : rel.child_name;
  const relLabel = RELATIONSHIP_TYPE_LABELS[rel.relationship_type as RelationshipType] || rel.relationship_type;

  return (
    <div className={`rounded-lg border p-4 ${rel.is_active ? "border-border bg-secondary/30" : "border-border/50 bg-muted/20 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{partnerName}</span>
            <Badge variant="accent" className="text-[10px]">{relLabel}</Badge>
            {!rel.is_active && <Badge variant="neutral" className="text-[10px]">Pasif</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {rel.worksite && <span>Santiye: {rel.worksite}</span>}
            {rel.contract_start_date && <span>Baslangic: {rel.contract_start_date}</span>}
            {rel.contract_end_date && <span>Bitis: {rel.contract_end_date}</span>}
          </div>
          {rel.notes && <p className="mt-1.5 text-xs text-muted-foreground">{rel.notes}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(rel)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={rel.is_active ? "Pasif yap" : "Aktif yap"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {rel.is_active ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => onDelete(rel.id)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Sil"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

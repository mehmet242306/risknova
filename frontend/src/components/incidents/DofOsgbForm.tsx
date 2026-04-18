"use client";

import { Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { exportDofPdf } from "@/lib/dof-pdf-template";
import type { CorrectiveActionAiSuggestion } from "@/lib/incidents/ai";

export type DofFormType = "duzeltici" | "onleyici" | "ramak_kala" | "kaza" | "uygunsuzluk" | "tehlike";
export type DofResult = "kaldirildi" | "kaldirilmadi" | "";

export interface DofOsgbExtra {
  formuDolduran?: { adSoyad: string; tc: string; firma: string; imza: string };
  formuTuru?: DofFormType[];
  formuTarihi?: string;
  formuYeri?: string;
  formuTanimi?: string;
  formuOnaylayan?: { adSoyad: string; tc: string; firmaGorev: string; imza: string; aksiyon: string; termin: string };
  sonuc?: DofResult;
  formuKapatan?: { adSoyad: string; tc: string; firmaGorev: string; imza: string };
}

export type DofFormData = CorrectiveActionAiSuggestion & DofOsgbExtra;

const FORM_TYPES: { key: DofFormType; label: string }[] = [
  { key: "duzeltici", label: "Düzeltici Faaliyet" },
  { key: "onleyici", label: "Önleyici Faaliyet" },
  { key: "ramak_kala", label: "Ramak Kala" },
  { key: "kaza", label: "Kaza" },
  { key: "uygunsuzluk", label: "Uygunsuzluk" },
  { key: "tehlike", label: "Tehlike" },
];

interface DofOsgbFormProps {
  index: number;
  data: DofFormData;
  onChange: (patch: Partial<DofFormData>) => void;
  onRemove: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] border-t border-border">
      <div className="border-r border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground">{label}</div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function TextField({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded border border-border bg-input px-2 text-xs text-foreground"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded border border-border bg-input px-2 py-1.5 text-xs leading-5 text-foreground"
    />
  );
}

export function DofOsgbForm({ index, data, onChange, onRemove }: DofOsgbFormProps) {
  const dolduran = data.formuDolduran ?? { adSoyad: "", tc: "", firma: "", imza: "" };
  const onaylayan = data.formuOnaylayan ?? { adSoyad: "", tc: "", firmaGorev: "", imza: "", aksiyon: "", termin: "" };
  const kapatan = data.formuKapatan ?? { adSoyad: "", tc: "", firmaGorev: "", imza: "" };
  const formTuru = data.formuTuru ?? [];
  const sonuc = data.sonuc ?? "";

  function handleExportPdf() {
    exportDofPdf([data], `Düzeltici Önleyici Faaliyet Formu #${index + 1}`);
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border bg-card">
      {/* Başlık */}
      <div className="flex items-center justify-between border-b-2 border-border bg-[var(--gold)]/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">DÜZELTİCİ ÖNLEYİCİ FAALİYET FORMU #{index + 1}</span>
          <Badge variant={data.priority === "Kritik" ? "danger" : data.priority === "Yüksek" ? "warning" : "neutral"}>
            {data.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleExportPdf} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Download className="size-3.5" /> PDF
          </button>
          <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-danger hover:underline">
            <Trash2 className="size-3.5" /> Sil
          </button>
        </div>
      </div>

      {/* FORMU DOLDURAN */}
      <div className="border-b border-border bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        FORMU DOLDURANIN (Bu bölüm bildirimi yapan kişi tarafından doldurulacaktır)
      </div>
      <Row label="Adı Soyadı">
        <TextField value={dolduran.adSoyad} onChange={(v) => onChange({ formuDolduran: { ...dolduran, adSoyad: v } })} />
      </Row>
      <Row label="T.C. Kimlik No">
        <TextField value={dolduran.tc} onChange={(v) => onChange({ formuDolduran: { ...dolduran, tc: v } })} />
      </Row>
      <Row label="Firması">
        <TextField value={dolduran.firma} onChange={(v) => onChange({ formuDolduran: { ...dolduran, firma: v } })} />
      </Row>
      <Row label="İmzası">
        <TextField value={dolduran.imza} onChange={(v) => onChange({ formuDolduran: { ...dolduran, imza: v } })} placeholder="(dijital imza / ad-soyad)" />
      </Row>

      {/* FORMUN */}
      <div className="border-b border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        FORMUN
      </div>
      <Row label="Türü">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {FORM_TYPES.map((t) => {
            const checked = formTuru.includes(t.key);
            return (
              <label key={t.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...formTuru, t.key]
                      : formTuru.filter((x) => x !== t.key);
                    onChange({ formuTuru: next });
                  }}
                  className="size-3.5"
                />
                {t.label}
              </label>
            );
          })}
        </div>
      </Row>
      <Row label="Tarihi">
        <TextField type="date" value={data.formuTarihi ?? ""} onChange={(v) => onChange({ formuTarihi: v })} />
      </Row>
      <Row label="Yeri">
        <TextField value={data.formuYeri ?? ""} onChange={(v) => onChange({ formuYeri: v })} placeholder="Lokasyon/birim" />
      </Row>
      <Row label="Tanımı">
        <TextArea value={data.formuTanimi ?? ""} onChange={(v) => onChange({ formuTanimi: v })} placeholder="Olay/uygunsuzluk tanımı" />
      </Row>
      <Row label="Kök Nedeni">
        <TextArea value={data.root_cause} onChange={(v) => onChange({ root_cause: v })} />
      </Row>
      <Row label="Çözüm Önerisi">
        <TextArea
          value={[data.corrective_action, data.preventive_action].filter(Boolean).join("\n\n")}
          onChange={(v) => {
            const parts = v.split(/\n\n+/);
            onChange({ corrective_action: parts[0] ?? "", preventive_action: parts.slice(1).join("\n\n") });
          }}
          placeholder="Düzeltici faaliyet (kısa vade) + Önleyici faaliyet (uzun vade)"
          rows={4}
        />
      </Row>

      {/* FORMU ONAYLAYAN */}
      <div className="border-b border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        FORMU ONAYLAYAN YETKİLİNİN (Bu bölüm yetkili/işveren tarafından doldurulacaktır)
      </div>
      <Row label="Adı Soyadı">
        <TextField value={onaylayan.adSoyad} onChange={(v) => onChange({ formuOnaylayan: { ...onaylayan, adSoyad: v } })} />
      </Row>
      <Row label="T.C. Kimlik No">
        <TextField value={onaylayan.tc} onChange={(v) => onChange({ formuOnaylayan: { ...onaylayan, tc: v } })} />
      </Row>
      <Row label="Firması/Görevi">
        <TextField value={onaylayan.firmaGorev} onChange={(v) => onChange({ formuOnaylayan: { ...onaylayan, firmaGorev: v } })} placeholder={data.suggested_role} />
      </Row>
      <Row label="İmzası">
        <TextField value={onaylayan.imza} onChange={(v) => onChange({ formuOnaylayan: { ...onaylayan, imza: v } })} />
      </Row>
      <Row label="Alınacak Aksiyonlar">
        <TextArea value={onaylayan.aksiyon} onChange={(v) => onChange({ formuOnaylayan: { ...onaylayan, aksiyon: v } })} />
      </Row>
      <Row label="Termin Süresi">
        <TextField value={onaylayan.termin} onChange={(v) => onChange({ formuOnaylayan: { ...onaylayan, termin: v } })} placeholder={`${data.suggested_deadline_days} gün`} />
      </Row>

      {/* SONUÇ */}
      <div className="border-b border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        SONUÇ
      </div>
      <Row label="Durum">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
            <input type="radio" checked={sonuc === "kaldirildi"} onChange={() => onChange({ sonuc: "kaldirildi" })} className="size-3.5" />
            Risk Ortadan Kaldırıldı
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
            <input type="radio" checked={sonuc === "kaldirilmadi"} onChange={() => onChange({ sonuc: "kaldirilmadi" })} className="size-3.5" />
            Risk Ortadan Kaldırılmadı
          </label>
        </div>
      </Row>

      {/* FORMU KAPATAN */}
      <div className="border-b border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        FORMU KAPATAN YETKİLİNİN (Bu bölüm işveren/işveren vekili tarafından doldurulacaktır)
      </div>
      <Row label="Adı Soyadı">
        <TextField value={kapatan.adSoyad} onChange={(v) => onChange({ formuKapatan: { ...kapatan, adSoyad: v } })} />
      </Row>
      <Row label="T.C. Kimlik No">
        <TextField value={kapatan.tc} onChange={(v) => onChange({ formuKapatan: { ...kapatan, tc: v } })} />
      </Row>
      <Row label="Firması/Görevi">
        <TextField value={kapatan.firmaGorev} onChange={(v) => onChange({ formuKapatan: { ...kapatan, firmaGorev: v } })} />
      </Row>
      <Row label="İmzası">
        <TextField value={kapatan.imza} onChange={(v) => onChange({ formuKapatan: { ...kapatan, imza: v } })} />
      </Row>
    </div>
  );
}

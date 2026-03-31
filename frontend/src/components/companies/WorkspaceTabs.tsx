"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyRecord } from "@/lib/company-directory";
import { getGuidedTasks, getOverallRiskState } from "@/lib/workplace-status";

export type WTab = "overview" | "structure" | "risk" | "people" | "personnel" | "planner" | "tracking" | "documents" | "organization" | "history" | "digital_twin";

function pbv(p: string): "danger" | "warning" | "neutral" {
  if (p === "high") return "danger";
  if (p === "medium") return "warning";
  return "neutral";
}

function Sec({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="section-title text-base">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const FC = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground";

/* ── OVERVIEW ── */
export function OverviewTab({ company, upd, risk, tasks, setTab }: {
  company: CompanyRecord;
  upd: (p: Partial<CompanyRecord>) => void;
  risk: ReturnType<typeof getOverallRiskState> | null;
  tasks: ReturnType<typeof getGuidedTasks>;
  setTab: (t: WTab) => void;
}) {
  return (
    <>
      <Sec title={"Bug\u00FCn Ne Yapmal\u0131y\u0131m?"} desc={"Firmaya \u00F6zel \u00F6ncelikli g\u00F6revler."}>
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{t.title}</p>
                <Badge variant={pbv(t.priority)} className="text-[9px]">
                  {t.priority === "high" ? "Y\u00FCksek" : t.priority === "medium" ? "Orta" : "D\u00FC\u015F\u00FCk"}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-5">{t.description}</p>
              <button type="button" onClick={() => setTab((t.href?.replace("#", "") || "overview") as WTab)} className="mt-2 text-xs font-medium text-primary hover:underline">{t.actionLabel}</button>
            </div>
          ))}
        </div>
      </Sec>

      {risk && (
        <Sec title={"Genel Risk Durumu"}>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { l: "Yap\u0131sal", v: risk.structural },
              { l: "Kapsam", v: risk.coverage },
              { l: "Olgunluk", v: risk.maturity },
              { l: "Risk Bask\u0131s\u0131", v: risk.openPressure },
            ].map((m) => (
              <div key={m.l} className="rounded-lg border border-border p-3 text-center">
                <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{m.l}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{m.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-6">{risk.description}</p>
        </Sec>
      )}

      <Sec title="Firma Bilgileri" desc={"Temel kimlik ve ileti\u015Fim."}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-xs font-medium text-muted-foreground">{"Firma Ad\u0131"}</label><Input value={company.name} onChange={(e) => upd({ name: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"K\u0131sa Ad"}</label><Input value={company.shortName} onChange={(e) => upd({ shortName: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"T\u00FCr"}</label><select value={company.kind} onChange={(e) => upd({ kind: e.target.value })} className={FC}><option>{"\u00D6zel Sekt\u00F6r"}</option><option>Kamu Kurumu</option><option>Belediye</option><option>{"STK / Vak\u0131f"}</option></select></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"Sekt\u00F6r"}</label><Input value={company.sector} onChange={(e) => upd({ sector: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">NACE Kodu</label><Input value={company.naceCode} onChange={(e) => upd({ naceCode: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"Tehlike S\u0131n\u0131f\u0131"}</label><select value={company.hazardClass} onChange={(e) => upd({ hazardClass: e.target.value })} className={FC}><option value="">{"Se\u00E7iniz"}</option><option>Az Tehlikeli</option><option>Tehlikeli</option><option>{"\u00C7ok Tehlikeli"}</option></select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Adres</label><Input value={company.address} onChange={(e) => upd({ address: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"İl"}</label><Input value={company.city} onChange={(e) => upd({ city: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"İlçe"}</label><Input value={company.district} onChange={(e) => upd({ district: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Telefon</label><Input value={company.phone} onChange={(e) => upd({ phone: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Faks</label><Input value={company.fax} onChange={(e) => upd({ fax: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">E-posta</label><Input value={company.email} onChange={(e) => upd({ email: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"Yetkili Ki\u015Fi"}</label><Input value={company.contactPerson} onChange={(e) => upd({ contactPerson: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"İşveren Unvanı"}</label><Input value={company.employerTitle} onChange={(e) => upd({ employerTitle: e.target.value })} className="mt-1" /></div>
        </div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">SGK Bilgileri</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="text-xs font-medium text-muted-foreground">{"SGK İşyeri Sicil No"}</label><Input value={company.sgkWorkplaceNumber} onChange={(e) => upd({ sgkWorkplaceNumber: e.target.value })} className="mt-1" placeholder="000000.00.000" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Vergi No</label><Input value={company.taxNumber} onChange={(e) => upd({ taxNumber: e.target.value })} className="mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">{"Vergi Dairesi Adı"}</label><Input value={company.taxOffice} onChange={(e) => upd({ taxOffice: e.target.value })} className="mt-1" /></div>
          </div>
        </div>
        <div className="mt-4"><label className="text-xs font-medium text-muted-foreground">Notlar</label><Textarea value={company.notes} onChange={(e) => upd({ notes: e.target.value })} rows={3} className="mt-1" /></div>
      </Sec>

      <Sec title={"Operasyonel Bilgiler"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="text-xs font-medium text-muted-foreground">{"\u00C7al\u0131\u015Fan Say\u0131s\u0131"}</label><Input type="number" value={company.employeeCount} onChange={(e) => upd({ employeeCount: Number(e.target.value) || 0 })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Vardiya Modeli</label><Input value={company.shiftModel} onChange={(e) => upd({ shiftModel: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Son Analiz</label><Input type="date" value={company.lastAnalysisDate} onChange={(e) => upd({ lastAnalysisDate: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Son Denetim</label><Input type="date" value={company.lastInspectionDate} onChange={(e) => upd({ lastInspectionDate: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Son Tatbikat</label><Input type="date" value={company.lastDrillDate} onChange={(e) => upd({ lastDrillDate: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Aktif Profesyonel</label><Input type="number" value={company.activeProfessionals} onChange={(e) => upd({ activeProfessionals: Number(e.target.value) || 0 })} className="mt-1" /></div>
        </div>
      </Sec>
    </>
  );
}

/* ── STRUCTURE ── */
export function StructureTab({ company, upd }: { company: CompanyRecord; upd: (p: Partial<CompanyRecord>) => void }) {
  return (
    <div className="space-y-6">
      <Sec title="Lokasyonlar" desc={"Firman\u0131n fiziksel yerle\u015Fkeleri."}>
        <div className="space-y-2">
          {company.locations.map((loc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={loc} onChange={(e) => { const n = [...company.locations]; n[i] = e.target.value; upd({ locations: n }); }} className="flex-1" />
              <button type="button" onClick={() => upd({ locations: company.locations.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">{"Kald\u0131r"}</button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => upd({ locations: [...company.locations, ""] })}>Lokasyon Ekle</Button>
      </Sec>
      <Sec title={"B\u00F6l\u00FCmler"} desc="Organizasyonel birimler.">
        <div className="space-y-2">
          {company.departments.map((dep, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={dep} onChange={(e) => { const n = [...company.departments]; n[i] = e.target.value; upd({ departments: n }); }} className="flex-1" />
              <button type="button" onClick={() => upd({ departments: company.departments.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">{"Kald\u0131r"}</button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => upd({ departments: [...company.departments, ""] })}>{"B\u00F6l\u00FCm Ekle"}</Button>
      </Sec>
    </div>
  );
}

/* ── RISK ── */
export function RiskTab({ company }: { company: CompanyRecord }) {
  return (
    <Sec title={"Risk ve Saha Y\u00F6netimi"} desc={"Risk analizi, saha bulgular\u0131 ve de\u011Ferlendirme."}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "A\u00E7\u0131k De\u011Ferlendirme", v: company.openRiskAssessments },
          { l: "A\u00E7\u0131k Aksiyon", v: company.openActions },
          { l: "Geciken Aksiyon", v: company.overdueActions },
          { l: "Risk Bask\u0131s\u0131", v: company.openRiskScore },
        ].map((m) => (
          <div key={m.l} className="rounded-lg border border-border p-3.5 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{m.l}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${m.v > 0 ? "text-warning" : "text-foreground"}`}>{m.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <p className="text-sm text-foreground">{"Risk analizi mod\u00FCl\u00FC geli\u015Ftirme a\u015Famas\u0131ndad\u0131r."}</p>
      </div>
    </Sec>
  );
}

/* ── PEOPLE ── */
export function PeopleTab({ company, upd }: { company: CompanyRecord; upd: (p: Partial<CompanyRecord>) => void }) {
  return (
    <Sec title={"Ekip ve Temsil Yap\u0131s\u0131"} desc={"\u0130SG profesyonelleri, \u00E7al\u0131\u015Fan temsilcileri ve destek personeli."}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="text-xs font-medium text-muted-foreground">Aktif Profesyonel</label><Input type="number" value={company.activeProfessionals} onChange={(e) => upd({ activeProfessionals: Number(e.target.value) || 0 })} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">{"\u00C7al\u0131\u015Fan Temsilcisi"}</label><Input type="number" value={company.employeeRepresentativeCount} onChange={(e) => upd({ employeeRepresentativeCount: Number(e.target.value) || 0 })} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Destek Personeli</label><Input type="number" value={company.supportStaffCount} onChange={(e) => upd({ supportStaffCount: Number(e.target.value) || 0 })} className="mt-1" /></div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className="text-xs font-medium text-muted-foreground">{"\u0130\u015Fveren Ad\u0131"}</label><Input value={company.employerName} onChange={(e) => upd({ employerName: e.target.value })} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">{"\u0130\u015Fveren Vekili"}</label><Input value={company.employerRepresentative} onChange={(e) => upd({ employerRepresentative: e.target.value })} className="mt-1" /></div>
      </div>
    </Sec>
  );
}

/* ── TRACKING ── */
export function TrackingTab({ company }: { company: CompanyRecord }) {
  return (
    <Sec title={"Takip ve Metrikler"} desc={"E\u011Fitim, periyodik kontrol ve iyile\u015Ftirme takibi."}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { l: "Tamamlanan E\u011Fitim", v: company.completedTrainingCount },
          { l: "S\u00FCresi Dolan E\u011Fitim", v: company.expiringTrainingCount },
          { l: "Periyodik Kontrol", v: company.periodicControlCount },
          { l: "Geciken Kontrol", v: company.overduePeriodicControlCount },
          { l: "Kapsam Oran\u0131", v: `%${company.completionRate}` },
          { l: "Son 30 G\u00FCn \u0130yile\u015Fme", v: `%${company.last30DayImprovement}` },
        ].map((m) => (
          <div key={m.l} className="rounded-lg border border-border p-3.5 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{m.l}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{m.v}</p>
          </div>
        ))}
      </div>
    </Sec>
  );
}

/* ── DOCUMENTS ── */
export function DocumentsTab({ company }: { company: CompanyRecord }) {
  return (
    <Sec title={"D\u00F6k\u00FCman Y\u00F6netimi"} desc={"Firma d\u00F6k\u00FCmanlar\u0131 ve belge durumu."}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{"Toplam D\u00F6k\u00FCman"}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{company.documentCount}</p>
        </div>
        <div className="rounded-lg border border-border p-3.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{"Risk De\u011Ferlendirme"}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{company.openRiskAssessments}</p>
        </div>
        <div className="rounded-lg border border-border p-3.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Kapsam</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">%{company.completionRate}</p>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-info/30 bg-info/5 p-4">
        <p className="text-sm text-foreground">{"D\u00F6k\u00FCman y\u00F6netimi mod\u00FCl\u00FC geli\u015Ftirme a\u015Famas\u0131ndad\u0131r."}</p>
      </div>
    </Sec>
  );
}

/* ── ORGANIZATION (members/permissions/invitations/requests) ── */
export function OrganizationTab({ company, setInviteOpen }: { company: CompanyRecord; setInviteOpen: (v: boolean) => void }) {
  return (
    <div className="space-y-6">
      <Sec title="Organizasyon" desc={"Firma organizasyon yap\u0131s\u0131, \u00FCyelik ve eri\u015Fim y\u00F6netimi."}>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: "\u00DCyeler", desc: "Firmaya eri\u015Fimi olan kullan\u0131c\u0131lar ve rolleri.", icon: "\u{1F465}", action: "Yak\u0131nda" },
            { title: "\u0130zinler", desc: "Mod\u00FCl bazl\u0131 eri\u015Fim ve yetki kontrol\u00FC.", icon: "\u{1F512}", action: "Yak\u0131nda" },
            { title: "Davetler", desc: "G\u00F6nderilen ve bekleyen profesyonel davetleri.", icon: "\u{1F4E8}", action: "Davet G\u00F6nder" },
            { title: "Talepler", desc: "Firmaya kat\u0131lma talepleri ve onay s\u00FCreci.", icon: "\u{1F4CB}", action: "Yak\u0131nda" },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-secondary/20 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-5">{item.desc}</p>
                  <button
                    type="button"
                    onClick={item.title === "Davetler" ? () => setInviteOpen(true) : undefined}
                    disabled={item.title !== "Davetler"}
                    className="mt-2 text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                  >
                    {item.action}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Sec>
      <Sec title={"Payla\u015F\u0131m ve Eri\u015Fim"} desc={"Firma verileri \u00FCzerindeki payla\u015F\u0131m ve eri\u015Fim kontrolleri."}>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground leading-6">{"Payla\u015F\u0131m ve eri\u015Fim y\u00F6netimi mod\u00FCl\u00FC geli\u015Ftirme a\u015Famas\u0131ndad\u0131r. Firma verileri \u00FCzerinde granular eri\u015Fim kontrol\u00FC yak\u0131nda aktif olacakt\u0131r."}</p>
        </div>
      </Sec>
    </div>
  );
}

/* ── HISTORY ── */
export function HistoryTab() {
  const items = [
    { d: "Mehmet Y.", r: "\u0130SG Uzman\u0131", a: "Risk analizi g\u00FCncellendi", t: "2 saat \u00F6nce" },
    { d: "Ay\u015Fe K.", r: "\u0130\u015Fveren Vekili", a: "Acil durum plan\u0131 onayland\u0131", t: "D\u00FCn" },
    { d: "Sistem", r: "Otomatik", a: "Periyodik kontrol hat\u0131rlatmas\u0131", t: "2 g\u00FCn \u00F6nce" },
    { d: "Ali R.", r: "\u0130SG Uzman\u0131", a: "Saha denetimi tamamland\u0131", t: "1 hafta \u00F6nce" },
  ];
  return (
    <Sec title={"Ge\u00E7mi\u015F ve Denetim \u0130zi"} desc={"Firma \u00FCzerindeki t\u00FCm i\u015Flemler ve de\u011Fi\u015Fiklik ge\u00E7mi\u015Fi."}>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{item.d.charAt(0)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{item.d}</p>
                <span className="text-[10px] text-muted-foreground">{item.t}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{item.r}</p>
              <p className="mt-0.5 text-xs text-foreground">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </Sec>
  );
}

/* ── DIGITAL TWIN ── */
export function DigitalTwinTab() {
  return (
    <Sec title={"Dijital \u0130kiz"} desc={"Firman\u0131n dijital temsili ve sim\u00FClasyon ortam\u0131."}>
      <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">{"\u{1F916}"}</div>
        <h3 className="mt-4 text-base font-semibold text-foreground">{"Dijital \u0130kiz Mod\u00FCl\u00FC"}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{"Firman\u0131n fiziksel yap\u0131s\u0131n\u0131n dijital temsili, risk sim\u00FClasyonlar\u0131 ve senaryo analizleri bu alanda yer alacakt\u0131r."}</p>
        <Badge variant="neutral" className="mt-3">{"Geli\u015Ftirme A\u015Famas\u0131nda"}</Badge>
      </div>
    </Sec>
  );
}

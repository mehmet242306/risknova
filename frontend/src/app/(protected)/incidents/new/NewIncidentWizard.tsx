"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadCompanyDirectory,
  type CompanyRecord,
} from "@/lib/company-directory";
import { fetchPersonnelFromSupabase } from "@/lib/supabase/personnel-api";
import {
  createIncident,
  saveIncidentPersonnel,
  addWitness,
  type IncidentType,
  type IncidentRecord,
  type PersonnelOutcome,
} from "@/lib/supabase/incident-api";
import {
  ShieldAlert, AlertTriangle, Stethoscope, ArrowLeft, ArrowRight,
  Check, Building2, User, FileText, Heart, Users, Sparkles,
  Search, Plus, Trash2, Skull, ClipboardCheck, GitBranch,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PersonnelEntry = {
  localId: string;
  personnelId: string | null;
  name: string;
  tc: string;
  department: string;
  position: string;
  outcome: PersonnelOutcome;
  // Yaralanma
  injuryType: string;
  injuryBodyPart: string;
  injuryCauseEvent: string;
  injuryCauseTool: string;
  workDisability: boolean;
  daysLost: number;
  // Tıbbi müdahale
  medicalIntervention: boolean;
  medicalPerson: string;
  medicalLocation: string;
  medicalCity: string;
  medicalDate: string;
};

type WitnessEntry = { fullName: string; tcIdentity: string; phone: string; email: string };

const STEPS = [
  { key: "type", label: "Olay Tipi", icon: FileText },
  { key: "company", label: "Firma", icon: Building2 },
  { key: "personnel", label: "Personel", icon: User },
  { key: "details", label: "Olay Detayları", icon: FileText },
  { key: "injury", label: "Yaralanma / Tıbbi", icon: Heart },
  { key: "witnesses", label: "Şahitler", icon: Users },
  { key: "review", label: "Değerlendirme", icon: Sparkles },
];

const outcomeLabels: Record<PersonnelOutcome, string> = {
  injured: "Yaralı",
  deceased: "Hayatını Kaybetti",
  unharmed: "Zarar Görmedi",
  unknown: "Belirsiz",
};

const outcomeColors: Record<PersonnelOutcome, string> = {
  injured: "warning",
  deceased: "danger",
  unharmed: "success",
  unknown: "neutral",
};

const typeLabels: Record<IncidentType, string> = {
  work_accident: "İş Kazası",
  near_miss: "Ramak Kala",
  occupational_disease: "Meslek Hastalığı",
};

const typeBadgeVariant: Record<IncidentType, "danger" | "warning" | "accent"> = {
  work_accident: "danger",
  near_miss: "warning",
  occupational_disease: "accent",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NewIncidentWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedIncidentId, setSavedIncidentId] = useState<string | null>(null);

  // Step 0: Type
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);

  // Step 1: Company
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");

  // Step 2: Personnel (çoklu)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availablePersonnel, setAvailablePersonnel] = useState<any[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelEntry[]>([]);
  const [personnelSearch, setPersonnelSearch] = useState("");

  // Step 3: Details
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [incidentDepartment, setIncidentDepartment] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("");
  const [shiftEndTime, setShiftEndTime] = useState("");
  const [workStartTime, setWorkStartTime] = useState("");
  const [generalActivity, setGeneralActivity] = useState("");
  const [specificActivity, setSpecificActivity] = useState("");
  const [toolUsed, setToolUsed] = useState("");
  const [description, setDescription] = useState("");

  // Step 5: Witnesses
  const [witnesses, setWitnesses] = useState<WitnessEntry[]>([]);

  // Step 6: Review
  const [dofRequired, setDofRequired] = useState(false);
  const [ishikawaRequired, setIshikawaRequired] = useState(false);
  const [accidentCauseDescription, setAccidentCauseDescription] = useState("");

  useEffect(() => { setCompanies(loadCompanyDirectory()); }, []);

  const [personnelLoading, setPersonnelLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId) { setAvailablePersonnel([]); return; }
    setPersonnelLoading(true);
    fetchPersonnelFromSupabase(selectedCompanyId).then((data) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAvailablePersonnel((data ?? []) as any);
      setPersonnelLoading(false);
    }).catch(() => setPersonnelLoading(false));
  }, [selectedCompanyId]);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
    (c.shortName ?? "").toLowerCase().includes(companySearch.toLowerCase()),
  );

  const filteredPersonnel = availablePersonnel.filter((p) => {
    const q = personnelSearch.toLowerCase();
    return (p.firstName ?? "").toLowerCase().includes(q) || (p.lastName ?? "").toLowerCase().includes(q) || (p.tcIdentityNumber ?? "").includes(q);
  });

  // Personel ekleme
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addPersonnelFromList(p: any) {
    if (selectedPersonnel.some((sp) => sp.personnelId === p.id)) return;
    setSelectedPersonnel([...selectedPersonnel, {
      localId: crypto.randomUUID(),
      personnelId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      tc: p.tcIdentityNumber ?? "",
      department: p.department ?? "",
      position: p.positionTitle ?? "",
      outcome: "injured",
      injuryType: "", injuryBodyPart: "", injuryCauseEvent: "", injuryCauseTool: "",
      workDisability: false, daysLost: 0,
      medicalIntervention: false, medicalPerson: "", medicalLocation: "", medicalCity: "", medicalDate: "",
    }]);
  }

  function addManualPersonnel() {
    setSelectedPersonnel([...selectedPersonnel, {
      localId: crypto.randomUUID(),
      personnelId: null,
      name: "", tc: "", department: "", position: "",
      outcome: "injured",
      injuryType: "", injuryBodyPart: "", injuryCauseEvent: "", injuryCauseTool: "",
      workDisability: false, daysLost: 0,
      medicalIntervention: false, medicalPerson: "", medicalLocation: "", medicalCity: "", medicalDate: "",
    }]);
  }

  function updatePersonnel(localId: string, patch: Partial<PersonnelEntry>) {
    setSelectedPersonnel(selectedPersonnel.map((p) => p.localId === localId ? { ...p, ...patch } : p));
  }

  function removePersonnel(localId: string) {
    setSelectedPersonnel(selectedPersonnel.filter((p) => p.localId !== localId));
  }

  // Witness helpers
  function addWitnessEntry() { setWitnesses([...witnesses, { fullName: "", tcIdentity: "", phone: "", email: "" }]); }
  function updateWitnessEntry(idx: number, field: keyof WitnessEntry, value: string) {
    const copy = [...witnesses]; copy[idx] = { ...copy[idx], [field]: value }; setWitnesses(copy);
  }
  function removeWitnessEntry(idx: number) { setWitnesses(witnesses.filter((_, i) => i !== idx)); }

  // Save
  async function handleSave() {
    if (!incidentType || !selectedCompanyId) return;
    setSaving(true);

    const record: Partial<IncidentRecord> = {
      incidentType,
      companyWorkspaceId: selectedCompanyId,
      personnelId: selectedPersonnel[0]?.personnelId ?? null,
      incidentDate: incidentDate || null,
      incidentTime: incidentTime || null,
      incidentLocation: incidentLocation || null,
      incidentDepartment: incidentDepartment || null,
      shiftStartTime: shiftStartTime || null,
      shiftEndTime: shiftEndTime || null,
      workStartTime: workStartTime || null,
      generalActivity: generalActivity || null,
      specificActivity: specificActivity || null,
      toolUsed: toolUsed || null,
      description: description || null,
      accidentCauseDescription: accidentCauseDescription || null,
      dofRequired,
      ishikawaRequired,
      status: "reported",
    };

    const created = await createIncident(record);
    if (created) {
      // Çoklu personel kaydet
      if (selectedPersonnel.length > 0) {
        await saveIncidentPersonnel(created.id, selectedPersonnel.map((p) => ({
          personnelId: p.personnelId,
          personnelName: p.name,
          personnelTc: p.tc || null,
          personnelDepartment: p.department || null,
          personnelPosition: p.position || null,
          outcome: p.outcome,
          injuryType: p.injuryType || null,
          injuryBodyPart: p.injuryBodyPart || null,
          injuryCauseEvent: p.injuryCauseEvent || null,
          injuryCauseTool: p.injuryCauseTool || null,
          workDisability: p.workDisability,
          disabilityStatus: p.workDisability ? "İş göremez" : null,
          daysLost: p.daysLost,
          medicalIntervention: p.medicalIntervention,
          medicalPerson: p.medicalPerson || null,
          medicalLocation: p.medicalLocation || null,
          medicalCity: p.medicalCity || null,
          medicalDistrict: null,
          medicalDate: p.medicalDate || null,
          medicalTime: null,
          notes: null,
        })));
      }

      // Şahitler kaydet
      for (const w of witnesses) {
        if (w.fullName) await addWitness(created.id, { tcIdentity: w.tcIdentity || null, fullName: w.fullName, email: w.email || null, phone: w.phone || null, address: null });
      }

      setSavedIncidentId(created.id);
      setSaving(false);
      // Her zaman post-save ekranına git (DÖF/İshikawa butonlarıyla)
      setStep(STEPS.length);
      return;
    }

    // Kayıt başarısız - hata göster
    setSaving(false);
    alert("Kayıt yapılamadı. Lütfen giriş yaptığınızdan emin olun.");
  }

  const canNext = step === 0 ? !!incidentType : step === 1 ? !!selectedCompanyId : true;

  const deceasedCount = selectedPersonnel.filter((p) => p.outcome === "deceased").length;
  const injuredCount = selectedPersonnel.filter((p) => p.outcome === "injured").length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Yeni Olay Kaydı"
        description="İş kazası, ramak kala veya meslek hastalığı kaydı oluşturun."
        meta={
          <Link href="/incidents" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> Olay Listesine Dön
          </Link>
        }
      />

      {/* Step indicator */}
      {step <= STEPS.length - 1 && (
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button key={s.key} type="button" onClick={() => i < step && setStep(i)} disabled={i > step}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                {done ? <Check className="size-3.5" /> : <StepIcon className="size-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 0: Olay Tipi                                            */}
      {/* ============================================================ */}
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {([
            { type: "work_accident" as const, label: "İş Kazası", desc: "İş yerinde veya iş nedeniyle meydana gelen kaza", icon: ShieldAlert },
            { type: "near_miss" as const, label: "Ramak Kala Olay", desc: "Yaralanma veya hastalık olmadan gerçekleşen tehlikeli durum", icon: AlertTriangle },
            { type: "occupational_disease" as const, label: "Meslek Hastalığı", desc: "İş koşullarından kaynaklanan sağlık sorunu", icon: Stethoscope },
          ]).map((item) => {
            const Icon = item.icon;
            const selected = incidentType === item.type;
            return (
              <button key={item.type} type="button" onClick={() => setIncidentType(item.type)}
                className={`group rounded-2xl border-2 p-6 text-left transition-all ${
                  selected ? "border-primary bg-primary/5 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30"
                }`}>
                <span className={`inline-flex size-12 items-center justify-center rounded-xl ${selected ? "bg-primary/15" : "bg-muted"}`}>
                  <Icon className={`size-6 ${selected ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.5} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: Firma Seçimi                                         */}
      {/* ============================================================ */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Firma Seçimi</CardTitle>
              <CardDescription>Olayın gerçekleştiği firmayı seçin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Firma ara..." value={companySearch} onChange={(e) => setCompanySearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-input pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground" />
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {filteredCompanies.map((c) => (
                  <button key={c.id} type="button" onClick={() => setSelectedCompanyId(c.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      selectedCompanyId === c.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    }`}>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.sector} {c.address && `- ${c.address}`}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Seçili firma detayları */}
          {selectedCompany && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Seçili Firma Bilgileri</p>
                <p className="text-base font-semibold text-foreground">{selectedCompany.name}</p>
                {selectedCompany.shortName && selectedCompany.shortName !== selectedCompany.name && (
                  <p className="text-sm text-muted-foreground">{selectedCompany.shortName}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div><span className="text-muted-foreground">Sektör:</span> <span className="font-medium text-foreground">{selectedCompany.sector || "-"}</span></div>
                  <div><span className="text-muted-foreground">Tehlike Sınıfı:</span> <span className="font-medium text-foreground">{selectedCompany.hazardClass || "-"}</span></div>
                  <div><span className="text-muted-foreground">NACE Kodu:</span> <span className="font-medium text-foreground">{selectedCompany.naceCode || "-"}</span></div>
                  <div><span className="text-muted-foreground">Çalışan Sayısı:</span> <span className="font-medium text-foreground">{selectedCompany.employeeCount || "-"}</span></div>
                  <div><span className="text-muted-foreground">Adres:</span> <span className="font-medium text-foreground">{selectedCompany.address || "-"}</span></div>
                  <div><span className="text-muted-foreground">İl/İlçe:</span> <span className="font-medium text-foreground">{selectedCompany.city || "-"}{selectedCompany.district ? ` / ${selectedCompany.district}` : ""}</span></div>
                  <div><span className="text-muted-foreground">Telefon:</span> <span className="font-medium text-foreground">{selectedCompany.phone || "-"}</span></div>
                  <div><span className="text-muted-foreground">E-posta:</span> <span className="font-medium text-foreground">{selectedCompany.email || "-"}</span></div>
                  <div><span className="text-muted-foreground">SGK Sicil No:</span> <span className="font-medium text-foreground">{selectedCompany.sgkWorkplaceNumber || "-"}</span></div>
                  <div><span className="text-muted-foreground">Vergi No:</span> <span className="font-medium text-foreground">{selectedCompany.taxNumber || "-"}</span></div>
                  <div><span className="text-muted-foreground">Vardiya:</span> <span className="font-medium text-foreground">{selectedCompany.shiftModel || "-"}</span></div>
                  <div><span className="text-muted-foreground">Yetkili:</span> <span className="font-medium text-foreground">{selectedCompany.contactPerson || "-"}</span></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Çoklu Personel Seçimi                                */}
      {/* ============================================================ */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kazaya Karışan Personel</CardTitle>
              <CardDescription>Bir kazada birden fazla kişi etkilenmiş olabilir. Tüm etkilenen personeli ekleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seçilen personeller */}
              {selectedPersonnel.length > 0 && (
                <div className="space-y-2">
                  {selectedPersonnel.map((p) => (
                    <div key={p.localId} className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex-1">
                        {p.personnelId ? (
                          <p className="text-sm font-semibold text-foreground">{p.name}</p>
                        ) : (
                          <Input value={p.name} onChange={(e) => updatePersonnel(p.localId, { name: e.target.value })} placeholder="Ad Soyad" className="h-8 text-sm" />
                        )}
                        <p className="text-xs text-muted-foreground">{p.department} {p.position && `- ${p.position}`}</p>
                      </div>
                      <select value={p.outcome} onChange={(e) => updatePersonnel(p.localId, { outcome: e.target.value as PersonnelOutcome })}
                        className={`h-8 rounded-lg border px-2 text-xs font-medium ${
                          p.outcome === "deceased" ? "border-danger/30 bg-danger/10 text-danger" :
                          p.outcome === "injured" ? "border-warning/30 bg-warning/10 text-warning" :
                          "border-border bg-muted text-foreground"
                        }`}>
                        <option value="injured">Yaralı</option>
                        <option value="deceased">Hayatını Kaybetti</option>
                        <option value="unharmed">Zarar Görmedi</option>
                        <option value="unknown">Belirsiz</option>
                      </select>
                      <button type="button" onClick={() => removePersonnel(p.localId)} className="text-muted-foreground hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {deceasedCount > 0 && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 flex items-center gap-3">
                  <Skull className="size-5 text-danger" />
                  <div>
                    <p className="text-sm font-semibold text-danger">Ölümlü İş Kazası</p>
                    <p className="text-xs text-muted-foreground">{deceasedCount} kişi hayatını kaybetmiştir.</p>
                  </div>
                </div>
              )}

              {/* Firma personelinden ekle */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Personel ara (ad, soyad, TC)..." value={personnelSearch} onChange={(e) => setPersonnelSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-input pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground" />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                {personnelLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Personel listesi yükleniyor...</p>
                ) : availablePersonnel.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">Bu firmada kayıtlı personel bulunamadı.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Manuel olarak personel ekleyebilirsiniz.</p>
                  </div>
                ) : filteredPersonnel.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aramayla eşleşen personel bulunamadı.</p>
                ) : (
                  filteredPersonnel.map((p) => {
                    const alreadyAdded = selectedPersonnel.some((sp) => sp.personnelId === p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => !alreadyAdded && addPersonnelFromList(p)} disabled={alreadyAdded}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition-all ${
                          alreadyAdded ? "border-primary/20 bg-primary/5 opacity-50" : "border-border bg-card hover:border-primary/30"
                        }`}>
                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{p.department} {p.positionTitle && `- ${p.positionTitle}`}</span>
                        {alreadyAdded && <span className="ml-2 text-xs text-primary">(Eklendi)</span>}
                      </button>
                    );
                  })
                )}
                {!personnelLoading && availablePersonnel.length > 0 && (
                  <p className="px-2 pt-2 text-xs text-muted-foreground">{availablePersonnel.length} personel listeleniyor</p>
                )}
              </div>

              <Button variant="outline" onClick={addManualPersonnel}>
                <Plus className="mr-1 size-4" /> Manuel Personel Ekle
              </Button>

              <p className="text-xs text-muted-foreground">
                Ramak kala olaylarda personel eklenmeyebilir.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: Olay Detayları                                       */}
      {/* ============================================================ */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Olay Detayları</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Olay Tarihi" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
              <Input label="Olay Saati" type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} />
              <Input label="İşbaşı Saati" type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Olay Yeri / Lokasyon" value={incidentLocation} onChange={(e) => setIncidentLocation(e.target.value)} placeholder="Üretim hattı, depo, ofis..." />
              <Input label="Bölüm" value={incidentDepartment} onChange={(e) => setIncidentDepartment(e.target.value)} placeholder="Üretim, Bakım, Lojistik..." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Vardiya Başlangıç" type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} />
              <Input label="Vardiya Bitiş" type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} />
            </div>
            <Input label="Genel Faaliyet" value={generalActivity} onChange={(e) => setGeneralActivity(e.target.value)} placeholder="Üretim, bakım-onarım, temizlik..." />
            <Input label="Özel Faaliyet" value={specificActivity} onChange={(e) => setSpecificActivity(e.target.value)} placeholder="Kaynak yapma, yük kaldırma..." />
            <Input label="Kullanılan Araç/Gereç" value={toolUsed} onChange={(e) => setToolUsed(e.target.value)} placeholder="Forklift, merdiven, el aleti..." />
            <Textarea label="Olay Açıklaması" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Olayı detaylı şekilde açıklayın..." />
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* STEP 4: Yaralanma + Tıbbi Müdahale (kişi bazlı)             */}
      {/* ============================================================ */}
      {step === 4 && (
        <div className="space-y-4">
          {selectedPersonnel.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">Personel eklenmedi. Bu adımı atlayabilirsiniz.</p>
              </CardContent>
            </Card>
          ) : (
            selectedPersonnel.map((p, idx) => (
              <Card key={p.localId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {p.name || `Personel ${idx + 1}`}
                      {p.outcome === "deceased" && <Badge variant="danger" className="ml-2">Hayatını Kaybetti</Badge>}
                      {p.outcome === "injured" && <Badge variant="warning" className="ml-2">Yaralı</Badge>}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Yaralanma */}
                  {(p.outcome === "injured" || p.outcome === "deceased") && incidentType !== "occupational_disease" && (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Yaralanma Bilgileri</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input label="Yaranın Türü" value={p.injuryType} onChange={(e) => updatePersonnel(p.localId, { injuryType: e.target.value })} placeholder="Kırık, kesik, yanık..." />
                        <Input label="Vücuttaki Yeri" value={p.injuryBodyPart} onChange={(e) => updatePersonnel(p.localId, { injuryBodyPart: e.target.value })} placeholder="Sağ el, baş..." />
                        <Input label="Neden Olan Olay" value={p.injuryCauseEvent} onChange={(e) => updatePersonnel(p.localId, { injuryCauseEvent: e.target.value })} placeholder="Düşme, çarpma..." />
                        <Input label="Neden Olan Araç" value={p.injuryCauseTool} onChange={(e) => updatePersonnel(p.localId, { injuryCauseTool: e.target.value })} placeholder="Forklift, iskele..." />
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={p.workDisability} onChange={(e) => updatePersonnel(p.localId, { workDisability: e.target.checked })} className="size-4 rounded" />
                        <label className="text-sm font-medium text-foreground">İş göremezlik var mı?</label>
                      </div>
                      {p.workDisability && (
                        <Input label="Kayıp İş Günü" type="number" min={0} value={String(p.daysLost)} onChange={(e) => updatePersonnel(p.localId, { daysLost: Number(e.target.value) })} />
                      )}
                    </>
                  )}

                  {/* Tıbbi Müdahale */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mt-4">Tıbbi Müdahale</p>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={p.medicalIntervention} onChange={(e) => updatePersonnel(p.localId, { medicalIntervention: e.target.checked })} className="size-4 rounded" />
                    <label className="text-sm font-medium text-foreground">Tıbbi müdahale yapıldı mı?</label>
                  </div>
                  {p.medicalIntervention && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input label="Müdahale Yapan" value={p.medicalPerson} onChange={(e) => updatePersonnel(p.localId, { medicalPerson: e.target.value })} />
                      <Input label="Müdahale Yeri" value={p.medicalLocation} onChange={(e) => updatePersonnel(p.localId, { medicalLocation: e.target.value })} placeholder="Hastane, sağlık birimi..." />
                      <Input label="İl" value={p.medicalCity} onChange={(e) => updatePersonnel(p.localId, { medicalCity: e.target.value })} />
                      <Input label="Tarih" type="date" value={p.medicalDate} onChange={(e) => updatePersonnel(p.localId, { medicalDate: e.target.value })} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 5: Şahitler                                            */}
      {/* ============================================================ */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Şahit Bilgileri</CardTitle>
            <CardDescription>Olaya tanık olan kişileri ekleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {witnesses.map((w, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Şahit {idx + 1}</span>
                  <button type="button" onClick={() => removeWitnessEntry(idx)} className="text-xs text-danger hover:underline">Kaldır</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Ad Soyad" value={w.fullName} onChange={(e) => updateWitnessEntry(idx, "fullName", e.target.value)} />
                  <Input label="TC Kimlik No" value={w.tcIdentity} onChange={(e) => updateWitnessEntry(idx, "tcIdentity", e.target.value)} />
                  <Input label="Telefon" value={w.phone} onChange={(e) => updateWitnessEntry(idx, "phone", e.target.value)} />
                  <Input label="E-posta" value={w.email} onChange={(e) => updateWitnessEntry(idx, "email", e.target.value)} />
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addWitnessEntry}><Users className="mr-2 size-4" /> Şahit Ekle</Button>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* STEP 6: Değerlendirme ve Kayıt                              */}
      {/* ============================================================ */}
      {step === 6 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Olay Özeti</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-muted/50 p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Olay Tipi:</span> <Badge variant={incidentType ? typeBadgeVariant[incidentType] : "neutral"}>{incidentType ? typeLabels[incidentType] : "-"}</Badge></div>
                  <div><span className="text-muted-foreground">Firma:</span> <span className="font-medium">{selectedCompany?.name || "-"}</span></div>
                  <div><span className="text-muted-foreground">Etkilenen Personel:</span> <span className="font-medium">{selectedPersonnel.length} kişi</span></div>
                  <div><span className="text-muted-foreground">Tarih:</span> <span className="font-medium">{incidentDate || "-"}</span></div>
                </div>
                {deceasedCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                    <Skull className="size-4 text-danger" />
                    <span className="text-sm font-semibold text-danger">Ölümlü İş Kazası - {deceasedCount} kişi hayatını kaybetti</span>
                  </div>
                )}
                {injuredCount > 0 && (
                  <p className="text-sm text-warning">{injuredCount} kişi yaralandı</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Kaza Sebebi ve Analiz Gereksinimleri</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea label="Kaza Sebebi Açıklaması" value={accidentCauseDescription} onChange={(e) => setAccidentCauseDescription(e.target.value)} placeholder="Kazanın temel sebebini açıklayın..." />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="dofRequired" checked={dofRequired} onChange={(e) => setDofRequired(e.target.checked)} className="size-4 rounded" />
                  <label htmlFor="dofRequired" className="text-sm font-medium text-foreground">DÖF (Düzeltici ve Önleyici Faaliyet) gerekli mi?</label>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="ishikawaRequired" checked={ishikawaRequired} onChange={(e) => setIshikawaRequired(e.target.checked)} className="size-4 rounded" />
                  <label htmlFor="ishikawaRequired" className="text-sm font-medium text-foreground">İshikawa (Balıkkılçığı) analizi gerekli mi?</label>
                </div>
              </div>

              {/* Kayıt sonrası yönlendirme butonları - her zaman görünür */}
              {(dofRequired || ishikawaRequired) && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Kayıt sonrası yönlendirileceksiniz:</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {dofRequired && (
                      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-card p-3">
                        <ClipboardCheck className="size-5 text-[var(--gold)]" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">DÖF + Kök Neden Analizi</p>
                          <p className="text-xs text-muted-foreground">AI destekli İshikawa ve düzeltici faaliyetler</p>
                        </div>
                      </div>
                    )}
                    {ishikawaRequired && (
                      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-card p-3">
                        <GitBranch className="size-5 text-[var(--gold)]" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">İshikawa Diyagramı</p>
                          <p className="text-xs text-muted-foreground">6M balıkkılçığı kök neden analizi</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* POST-SAVE: DÖF/İshikawa Yönlendirme                         */}
      {/* ============================================================ */}
      {step === STEPS.length && savedIncidentId && (
        <div className="space-y-4">
          <Card className="border-2 border-success/30 bg-success/5">
            <CardContent className="flex items-center gap-4 p-6">
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-success/15">
                <Check className="size-6 text-success" />
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">Olay Kaydı Oluşturuldu</p>
                <p className="text-sm text-muted-foreground">{selectedPersonnel.length} personel, {witnesses.length} şahit kaydedildi.</p>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm font-medium text-foreground">Şimdi ne yapmak istersiniz?</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href={`/incidents/${savedIncidentId}/dof`}>
              <Card className="cursor-pointer border-2 border-dashed border-primary/30 transition-all hover:border-primary hover:shadow-[var(--shadow-card)]">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--gold-glow)]">
                    <ClipboardCheck className="size-6 text-[var(--gold)]" strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">DÖF + Kök Neden Analizi Başlat</p>
                    <p className="text-sm text-muted-foreground">AI destekli İshikawa ve düzeltici/önleyici faaliyetler</p>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href={`/incidents/${savedIncidentId}/ishikawa`}>
              <Card className="cursor-pointer border-2 border-dashed border-primary/30 transition-all hover:border-primary hover:shadow-[var(--shadow-card)]">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--gold-glow)]">
                    <GitBranch className="size-6 text-[var(--gold)]" strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">İshikawa Diyagramı Görüntüle</p>
                    <p className="text-sm text-muted-foreground">6M balıkkılçığı görsel kök neden analizi</p>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={`/incidents/${savedIncidentId}`}>
              <Button variant="outline" className="w-full">Olay Detayına Git</Button>
            </Link>
            <Link href="/incidents">
              <Button variant="ghost" className="w-full">Olay Listesine Dön</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step <= STEPS.length - 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft className="mr-1 size-4" /> Geri
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              İleri <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !incidentType || !selectedCompanyId}>
              {saving ? "Kaydediliyor..." : "Kaydet"} <Check className="ml-1 size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

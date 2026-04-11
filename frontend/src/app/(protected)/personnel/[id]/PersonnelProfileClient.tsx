"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "info" | "training" | "accidents" | "nearMiss" | "health" | "ppe" | "documents";

interface PersonnelInfo {
  id: string;
  employeeCode: string;
  tcIdentityNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  nationality: string;
  bloodType: string;
  maritalStatus: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  address: string;
  department: string;
  positionTitle: string;
  location: string;
  hireDate: string;
  terminationDate: string;
  employmentStatus: string;
  employmentType: string;
  shiftType: string;
  educationLevel: string;
  notes: string;
}

interface IncidentRecord {
  id: string;
  incidentType: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  description: string;
  severityLevel: string;
  status: string;
  injuryType: string;
  injuryBodyPart: string;
  daysLost: number | null;
  // from incident_personnel
  outcome: string;
  injuryCauseEvent: string;
}

interface TrainingRecord {
  id: string;
  trainingName: string;
  trainingDate: string;
  duration: string;
  trainer: string;
  status: string;
  certificateNo: string | null;
}

interface HealthExamRecord {
  id: string;
  examType: string;
  examDate: string;
  doctor: string;
  result: string;
  nextExamDate: string | null;
  notes: string;
}

interface PPERecord {
  id: string;
  ppeName: string;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  size: string;
}

interface DocRecord {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  expiryDate: string | null;
}

export function PersonnelProfileClient() {
  const params = useParams();
  const router = useRouter();
  const personnelId = params.id as string;

  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<PersonnelInfo | null>(null);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [healthExams, setHealthExams] = useState<HealthExamRecord[]>([]);
  const [ppeRecords, setPpeRecords] = useState<PPERecord[]>([]);
  const [documents, setDocuments] = useState<DocRecord[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    // ── Personnel info ──
    const { data: pData } = await supabase.from("personnel").select("*").eq("id", personnelId).single();
    if (pData) {
      const p = pData as Record<string, unknown>;
      setPerson({
        id: p.id as string,
        employeeCode: (p.employee_code || "") as string,
        tcIdentityNumber: (p.tc_identity_number || "") as string,
        firstName: (p.first_name || "") as string,
        lastName: (p.last_name || "") as string,
        birthDate: (p.birth_date || "") as string,
        gender: (p.gender || "") as string,
        nationality: (p.nationality || "") as string,
        bloodType: (p.blood_type || "") as string,
        maritalStatus: (p.marital_status || "") as string,
        phone: (p.phone || "") as string,
        email: (p.email || "") as string,
        emergencyContactName: (p.emergency_contact_name || "") as string,
        emergencyContactPhone: (p.emergency_contact_phone || "") as string,
        address: (p.address || "") as string,
        department: (p.department || "") as string,
        positionTitle: (p.position_title || "") as string,
        location: (p.location || "") as string,
        hireDate: (p.hire_date || "") as string,
        terminationDate: (p.termination_date || "") as string,
        employmentStatus: (p.employment_status || "active") as string,
        employmentType: (p.employment_type || "") as string,
        shiftType: (p.shift_type || "") as string,
        educationLevel: (p.education_level || "") as string,
        notes: (p.notes || "") as string,
      });
    }

    // ── Incidents (is kazasi + ramak kala) ──
    // Check both incidents.personnel_id and incident_personnel.personnel_id
    const incidentList: IncidentRecord[] = [];

    // 1) Direct incidents (personnel_id on incidents table)
    const { data: directInc } = await supabase
      .from("incidents")
      .select("*")
      .eq("personnel_id", personnelId)
      .order("incident_date", { ascending: false });

    if (directInc) {
      for (const i of directInc as Record<string, unknown>[]) {
        incidentList.push({
          id: i.id as string,
          incidentType: (i.incident_type || "work_accident") as string,
          incidentDate: (i.incident_date || "") as string,
          incidentTime: (i.incident_time || "") as string,
          incidentLocation: (i.incident_location || "") as string,
          description: (i.description || "") as string,
          severityLevel: (i.severity_level || "") as string,
          status: (i.status || "") as string,
          injuryType: (i.injury_type || "") as string,
          injuryBodyPart: (i.injury_body_part || "") as string,
          daysLost: (i.days_lost ?? null) as number | null,
          outcome: "",
          injuryCauseEvent: (i.injury_cause_event || "") as string,
        });
      }
    }

    // 2) Via incident_personnel join table
    const { data: ipData } = await supabase
      .from("incident_personnel")
      .select("*")
      .eq("personnel_id", personnelId);

    if (ipData && ipData.length > 0) {
      const ipRows = ipData as Record<string, unknown>[];
      const incIds = ipRows.map(ip => ip.incident_id as string).filter(id => !incidentList.some(x => x.id === id));

      if (incIds.length > 0) {
        const { data: joinedInc } = await supabase
          .from("incidents")
          .select("*")
          .in("id", incIds)
          .order("incident_date", { ascending: false });

        if (joinedInc) {
          for (const i of joinedInc as Record<string, unknown>[]) {
            const ipRow = ipRows.find(ip => ip.incident_id === i.id);
            incidentList.push({
              id: i.id as string,
              incidentType: (i.incident_type || "work_accident") as string,
              incidentDate: (i.incident_date || "") as string,
              incidentTime: (i.incident_time || "") as string,
              incidentLocation: (i.incident_location || "") as string,
              description: (i.description || "") as string,
              severityLevel: (i.severity_level || "") as string,
              status: (i.status || "") as string,
              injuryType: (ipRow?.injury_type || i.injury_type || "") as string,
              injuryBodyPart: (ipRow?.injury_body_part || i.injury_body_part || "") as string,
              daysLost: (ipRow?.days_lost ?? i.days_lost ?? null) as number | null,
              outcome: (ipRow?.outcome || "") as string,
              injuryCauseEvent: (ipRow?.injury_cause_event || i.injury_cause_event || "") as string,
            });
          }
        }
      }
    }
    setIncidents(incidentList);

    // ── Trainings ──
    const { data: tData } = await supabase.from("personnel_trainings").select("*").eq("personnel_id", personnelId).order("training_date", { ascending: false });
    if (tData) {
      setTrainings((tData as Record<string, unknown>[]).map(t => ({
        id: t.id as string,
        trainingName: (t.training_name || "") as string,
        trainingDate: (t.training_date || "") as string,
        duration: (t.duration || "") as string,
        trainer: (t.trainer_name || "") as string,
        status: (t.status || "completed") as string,
        certificateNo: (t.certificate_no || null) as string | null,
      })));
    }

    // ── Health exams ──
    const { data: hData } = await supabase.from("personnel_health_exams").select("*").eq("personnel_id", personnelId).order("exam_date", { ascending: false });
    if (hData) {
      setHealthExams((hData as Record<string, unknown>[]).map(h => ({
        id: h.id as string,
        examType: (h.exam_type || "") as string,
        examDate: (h.exam_date || "") as string,
        doctor: (h.doctor_name || "") as string,
        result: (h.result || "") as string,
        nextExamDate: (h.next_exam_date || null) as string | null,
        notes: (h.notes || "") as string,
      })));
    }

    // ── PPE records ──
    const { data: ppData } = await supabase.from("personnel_ppe_records").select("*").eq("personnel_id", personnelId).order("issue_date", { ascending: false });
    if (ppData) {
      setPpeRecords((ppData as Record<string, unknown>[]).map(p => ({
        id: p.id as string,
        ppeName: (p.ppe_name || "") as string,
        issueDate: (p.issue_date || "") as string,
        expiryDate: (p.expiry_date || null) as string | null,
        status: (p.status || "active") as string,
        size: (p.size || "") as string,
      })));
    }

    // ── Documents ──
    const { data: dData } = await supabase.from("personnel_documents").select("*").eq("personnel_id", personnelId).order("created_at", { ascending: false });
    if (dData) {
      setDocuments((dData as Record<string, unknown>[]).map(d => ({
        id: d.id as string,
        name: (d.document_name || "") as string,
        type: (d.document_type || "") as string,
        uploadDate: (d.created_at || "") as string,
        expiryDate: (d.expiry_date || null) as string | null,
      })));
    }

    setLoading(false);
  }, [personnelId]);

  useEffect(() => { loadData(); }, [loadData]);

  function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString("tr-TR") : "—"; }

  const accidentCount = incidents.filter(i => i.incidentType === "work_accident").length;
  const nearMissCount = incidents.filter(i => i.incidentType === "near_miss").length;

  const tabs: { key: Tab; label: string; count?: number; color?: string }[] = [
    { key: "info", label: "Genel Bilgiler" },
    { key: "training", label: "Eğitimler", count: trainings.length },
    { key: "accidents", label: "İş Kazaları", count: accidentCount, color: accidentCount > 0 ? "text-red-600" : undefined },
    { key: "nearMiss", label: "Ramak Kala", count: nearMissCount, color: nearMissCount > 0 ? "text-amber-600" : undefined },
    { key: "health", label: "Sağlık", count: healthExams.length },
    { key: "ppe", label: "KKD Zimmet", count: ppeRecords.length },
    { key: "documents", label: "Belgeler", count: documents.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page-bg,#f8f9fa)]">
        <div className="w-full px-4 py-8 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--card)] border border-[var(--border)]" />)}
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Personel bulunamadı</p>
      </div>
    );
  }

  const statusLabel = person.employmentStatus === "active" ? "Aktif" : person.employmentStatus === "terminated" ? "Ayrılmış" : person.employmentStatus;
  const statusColor = person.employmentStatus === "active"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f9fa)]">
      <div className="w-full px-4 py-8">
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Geri
        </button>

        {/* Profile header */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold)] text-xl font-bold text-white">
              {person.firstName.charAt(0)}{person.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">{person.firstName} {person.lastName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[var(--muted-foreground)]">
                {person.employeeCode && <span className="font-mono">#{person.employeeCode}</span>}
                {person.department && <span>| {person.department}</span>}
                {person.positionTitle && <span>| {person.positionTitle}</span>}
                {person.location && <span>| {person.location}</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>{statusLabel}</span>
              </div>
            </div>
            {/* Quick stats */}
            <div className="hidden sm:flex gap-3">
              {accidentCount > 0 && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-center dark:bg-red-900/20">
                  <div className="text-lg font-bold text-red-600">{accidentCount}</div>
                  <div className="text-[10px] text-red-500">İş Kazası</div>
                </div>
              )}
              {nearMissCount > 0 && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-center dark:bg-amber-900/20">
                  <div className="text-lg font-bold text-amber-600">{nearMissCount}</div>
                  <div className="text-[10px] text-amber-500">Ramak Kala</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex overflow-x-auto gap-1 rounded-xl bg-[var(--card)] p-1 border border-[var(--border)]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                tab === t.key ? "bg-[var(--gold)] text-white shadow" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className={`ml-1 ${t.color && tab !== t.key ? t.color : "opacity-75"}`}>({t.count})</span>}
            </button>
          ))}
        </div>

        {/* ══════ Info tab ══════ */}
        {tab === "info" && (
          <div className="space-y-4">
            {/* Kişisel Bilgiler */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Kişisel Bilgiler
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="TC Kimlik No" value={person.tcIdentityNumber ? `***${person.tcIdentityNumber.slice(-4)}` : ""} />
                <InfoItem label="Doğum Tarihi" value={fmtDate(person.birthDate)} />
                <InfoItem label="Cinsiyet" value={person.gender === "male" ? "Erkek" : person.gender === "female" ? "Kadın" : person.gender} />
                <InfoItem label="Uyruk" value={person.nationality} />
                <InfoItem label="Kan Grubu" value={person.bloodType} />
                <InfoItem label="Medeni Durum" value={person.maritalStatus === "single" ? "Bekar" : person.maritalStatus === "married" ? "Evli" : person.maritalStatus} />
                <InfoItem label="Eğitim Düzeyi" value={person.educationLevel} />
              </div>
            </div>

            {/* İletişim */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>
                İletişim
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="Telefon" value={person.phone} />
                <InfoItem label="E-posta" value={person.email} />
                <InfoItem label="Adres" value={person.address} span />
              </div>
            </div>

            {/* Acil Durum */}
            {(person.emergencyContactName || person.emergencyContactPhone) && (
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm dark:border-red-800 dark:bg-red-900/10">
                <h3 className="mb-4 text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Acil Durum İletişim
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="Kişi" value={person.emergencyContactName} />
                  <InfoItem label="Telefon" value={person.emergencyContactPhone} />
                </div>
              </div>
            )}

            {/* Çalışma Bilgileri */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                Çalışma Bilgileri
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="Sicil No" value={person.employeeCode} />
                <InfoItem label="Departman" value={person.department} />
                <InfoItem label="Pozisyon" value={person.positionTitle} />
                <InfoItem label="Lokasyon" value={person.location} />
                <InfoItem label="İşe Giriş" value={fmtDate(person.hireDate)} />
                {person.terminationDate && <InfoItem label="Çıkış Tarihi" value={fmtDate(person.terminationDate)} />}
                <InfoItem label="Çalışma Türü" value={person.employmentType === "full_time" ? "Tam Zamanlı" : person.employmentType === "part_time" ? "Yarı Zamanlı" : person.employmentType} />
                <InfoItem label="Vardiya" value={person.shiftType === "day" ? "Gündüz" : person.shiftType === "night" ? "Gece" : person.shiftType === "rotating" ? "Dönüşümlü" : person.shiftType} />
                <InfoItem label="Durum" value={statusLabel} />
              </div>
            </div>

            {/* Notlar */}
            {person.notes && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Notlar</h3>
                <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{person.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ══════ Training tab ══════ */}
        {tab === "training" && (
          <div className="space-y-3">
            {trainings.length === 0 ? <EmptyTab message="Eğitim kaydı yok" /> : trainings.map(t => (
              <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{t.trainingName}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{fmtDate(t.trainingDate)}</span>
                      {t.duration && <span>| {t.duration}</span>}
                      {t.trainer && <span>| {t.trainer}</span>}
                    </div>
                  </div>
                  {t.certificateNo && (
                    <span className="rounded-full bg-[var(--gold)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--gold)]">Sertifikalı</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════ Accidents tab ══════ */}
        {tab === "accidents" && (
          <div className="space-y-3">
            {accidentCount === 0 ? <EmptyTab message="İş kazası kaydı yok" /> :
              incidents.filter(i => i.incidentType === "work_accident").map(inc => <IncidentCard key={inc.id} incident={inc} />)}
          </div>
        )}

        {/* ══════ Near miss tab ══════ */}
        {tab === "nearMiss" && (
          <div className="space-y-3">
            {nearMissCount === 0 ? <EmptyTab message="Ramak kala kaydı yok" /> :
              incidents.filter(i => i.incidentType === "near_miss").map(inc => <IncidentCard key={inc.id} incident={inc} />)}
          </div>
        )}

        {/* ══════ Health tab ══════ */}
        {tab === "health" && (
          <div className="space-y-3">
            {healthExams.length === 0 ? <EmptyTab message="Sağlık muayene kaydı yok" /> : healthExams.map(h => (
              <div key={h.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{h.examType}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{fmtDate(h.examDate)}</span>
                      {h.doctor && <span>| Dr. {h.doctor}</span>}
                    </div>
                    {h.notes && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{h.notes}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    h.result === "fit" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    h.result === "unfit" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                    {h.result === "fit" ? "Uygun" : h.result === "unfit" ? "Uygun Değil" : h.result || "—"}
                  </span>
                </div>
                {h.nextExamDate && (
                  <div className="mt-2 text-xs text-[var(--muted-foreground)]">Sonraki muayene: {fmtDate(h.nextExamDate)}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══════ PPE tab ══════ */}
        {tab === "ppe" && (
          <div className="space-y-3">
            {ppeRecords.length === 0 ? <EmptyTab message="KKD zimmet kaydı yok" /> : ppeRecords.map(p => (
              <div key={p.id} className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--foreground)]">{p.ppeName}</div>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>Teslim: {fmtDate(p.issueDate)}</span>
                    {p.expiryDate && <span>| Son kullanma: {fmtDate(p.expiryDate)}</span>}
                    {p.size && <span>| Beden: {p.size}</span>}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                  {p.status === "active" ? "Aktif" : "İade"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ══════ Documents tab ══════ */}
        {tab === "documents" && (
          <div className="space-y-3">
            {documents.length === 0 ? <EmptyTab message="Belge kaydı yok" /> : documents.map(d => (
              <div key={d.id} className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[var(--foreground)]">{d.name}</div>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>{d.type}</span>
                    <span>| {fmtDate(d.uploadDate)}</span>
                    {d.expiryDate && <span>| Geçerlilik: {fmtDate(d.expiryDate)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helper components ── */

function InfoItem({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2 lg:col-span-3" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{value || "—"}</div>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-12 text-center">
      <p className="text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}

function IncidentCard({ incident }: { incident: IncidentRecord }) {
  const severityColors: Record<string, string> = {
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  const severityLabels: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[var(--foreground)]">
              {incident.incidentDate ? new Date(incident.incidentDate).toLocaleDateString("tr-TR") : "—"}
            </span>
            {incident.incidentTime && <span className="text-xs text-[var(--muted-foreground)]">{incident.incidentTime.slice(0, 5)}</span>}
            {incident.incidentLocation && <span className="text-xs text-[var(--muted-foreground)]">| {incident.incidentLocation}</span>}
          </div>
          {incident.description && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)] line-clamp-2">{incident.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {incident.injuryType && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Yaralanma: {incident.injuryType}
              </span>
            )}
            {incident.injuryBodyPart && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Bölge: {incident.injuryBodyPart}
              </span>
            )}
            {incident.daysLost != null && incident.daysLost > 0 && (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {incident.daysLost} gün kayıp
              </span>
            )}
            {incident.outcome && (
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {incident.outcome}
              </span>
            )}
          </div>
        </div>
        {incident.severityLevel && (
          <span className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColors[incident.severityLevel] || "bg-gray-100 text-gray-700"}`}>
            {severityLabels[incident.severityLevel] || incident.severityLevel}
          </span>
        )}
      </div>
    </div>
  );
}

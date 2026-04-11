"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCertificates,
  issueCertificate,
  DEFAULT_CERTIFICATE_TEMPLATES,
  type CertificateRecord,
} from "@/lib/supabase/certificate-api";

type Tab = "certificates" | "templates";

interface PersonnelItem {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  companyId: string;
  companyName: string;
}

export function CertificatesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdParam = searchParams.get("companyId") ?? "";
  const fromLibrary = searchParams.get("library") === "1";
  const librarySection = searchParams.get("librarySection") ?? "education";
  const [tab, setTab] = useState<Tab>("templates");
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const orgIdRef = useRef("");
  const [showPreview, setShowPreview] = useState<number | null>(null);

  // Bulk issue state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  const [trainingName, setTrainingName] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [trainingDuration, setTrainingDuration] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [personnelSearch, setPersonnelSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
    if (!profile?.organization_id) { setLoading(false); return; }
    orgIdRef.current = profile.organization_id;

    const certs = await fetchCertificates(profile.organization_id);
    setCertificates(certs);

    // Load personnel
    const { data: wsData } = await supabase
      .from("company_workspaces")
      .select("id, display_name, company_identity_id")
      .eq("is_archived", false)
      .order("display_name");

    if (wsData) {
      const companyMap: Record<string, string> = {};
      const wsIdentityMap: Record<string, string> = {};
      const identityToWs: Record<string, string> = {};
      for (const ws of wsData as Record<string, unknown>[]) {
        const wsId = ws.id as string;
        const ciId = ws.company_identity_id as string;
        companyMap[wsId] = (ws.display_name || "Firma") as string;
        if (ciId) {
          wsIdentityMap[wsId] = ciId;
          identityToWs[ciId] = wsId;
        }
      }
      const identityIds = Object.values(wsIdentityMap).filter(Boolean);
      if (identityIds.length > 0) {
        const { data: pData } = await supabase
          .from("personnel")
          .select("id, first_name, last_name, department, company_identity_id")
          .in("company_identity_id", identityIds);
        if (pData) {
          setPersonnel(pData.map((p: Record<string, unknown>) => {
            const ciId = (p.company_identity_id || "") as string;
            const wsId = identityToWs[ciId] || "";
            return {
              id: p.id as string,
              firstName: (p.first_name || "") as string,
              lastName: (p.last_name || "") as string,
              department: (p.department || "") as string,
              companyId: wsId,
              companyName: companyMap[wsId] || "",
            };
          }));
        }
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleBulkIssue() {
    const oid = orgIdRef.current;
    if (!oid || selectedPersonnel.size === 0 || !trainingName.trim()) return;
    setIssuing(true);

    const selectedPeople = personnel.filter(p => selectedPersonnel.has(p.id));

    for (const person of selectedPeople) {
      await issueCertificate({
        organizationId: oid,
        companyId: person.companyId,
        personnelId: person.id,
        personName: `${person.firstName} ${person.lastName}`.trim(),
        trainingName: trainingName.trim(),
        trainerName: trainerName.trim() || undefined,
        trainingDuration: trainingDuration.trim() || undefined,
        trainingDate: new Date().toISOString().split("T")[0],
        companyName: person.companyName,
      });
    }

    setIssuing(false);
    setShowIssueModal(false);
    setSelectedPersonnel(new Set());
    setTrainingName("");
    setTrainerName("");
    setTrainingDuration("");
    await loadData();
    setTab("certificates");
  }

  function toggleAll() {
    const filtered = filteredPersonnel;
    if (selectedPersonnel.size === filtered.length) {
      setSelectedPersonnel(new Set());
    } else {
      setSelectedPersonnel(new Set(filtered.map(p => p.id)));
    }
  }

  function renderTemplate(html: string, data: Record<string, string>) {
    let result = html;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return result;
  }

  const filteredPersonnel = personnel.filter(p => {
    if (!personnelSearch) return true;
    const q = personnelSearch.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.department.toLowerCase().includes(q) || p.companyName.toLowerCase().includes(q);
  });

  function downloadCertPdf(cert: CertificateRecord) {
    // Find matching template
    const tmpl = builtInTemplates[0]; // default template
    let html = tmpl.templateHtml;
    const vars: Record<string, string> = {
      person_name: cert.personName,
      training_name: cert.trainingName,
      training_date: cert.trainingDate ? new Date(cert.trainingDate).toLocaleDateString("tr-TR") : "",
      training_duration: cert.trainingDuration,
      score: cert.score != null ? String(cert.score) : "",
      trainer_name: cert.trainerName,
      company_name: cert.companyName,
      certificate_no: cert.certificateNo,
    };
    for (const [key, value] of Object.entries(vars)) {
      html = html.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Sertifika - ${cert.personName}</title><style>@page{size:landscape;margin:0}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}@media print{body{background:#fff}}</style></head><body>${html}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    printWindow.document.close();
  }

  const builtInTemplates = DEFAULT_CERTIFICATE_TEMPLATES;
  const backHref = fromLibrary
    ? `/isg-library?view=browse&section=${librarySection}${companyIdParam ? `&companyId=${companyIdParam}` : ""}`
    : `/training${companyIdParam ? `?companyId=${companyIdParam}` : ""}`;
  const documentCenterHref = `/documents${companyIdParam ? `?companyId=${companyIdParam}` : ""}${fromLibrary ? `${companyIdParam ? "&" : "?"}library=1&librarySection=${librarySection}` : ""}`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="w-full px-4 py-8">
        <button
          onClick={() => router.push(backHref)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Geri
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Sertifikalar</h1>
          <button
            onClick={() => setShowIssueModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:brightness-110"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Toplu Sertifika Oluştur
          </button>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl bg-[var(--card)] p-1 border border-[var(--border)]">
          {(["templates", "certificates"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-[var(--gold)] text-white shadow" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t === "templates" ? `Şablonlar (${builtInTemplates.length})` : `Verilen Sertifikalar (${certificates.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--card)] border border-[var(--border)]" />
            ))}
          </div>
        ) : (
          <>
            {/* Templates tab */}
            {tab === "templates" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {builtInTemplates.map((tmpl, idx) => (
                    <div key={idx} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-[var(--foreground)]">{tmpl.name}</h3>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{tmpl.description}</p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span>Değişkenler: {tmpl.variables.length}</span>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Hazır Şablon</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setShowPreview(showPreview === idx ? null : idx)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors"
                        >
                          {showPreview === idx ? "Gizle" : "Önizle"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTemplateIdx(idx);
                            setShowIssueModal(true);
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          Bu Şablonla Oluştur
                        </button>
                      </div>
                      {showPreview === idx && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                          <div className="overflow-auto p-2">
                            <div
                              className="mx-auto"
                              style={{ transform: "scale(0.45)", transformOrigin: "top left", width: "222%" }}
                              dangerouslySetInnerHTML={{
                                __html: renderTemplate(tmpl.templateHtml, {
                                  person_name: "Ahmet Yılmaz",
                                  training_name: "İSG Temel Eğitimi",
                                  training_date: "06.04.2026",
                                  training_duration: "16 Saat",
                                  score: "85",
                                  trainer_name: "Dr. Mehmet Demir",
                                  company_name: "ABC Sanayi A.Ş.",
                                  certificate_no: "RN-202604-ABC123",
                                }),
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Custom template card — links to document center */}
                  <Link
                    href={documentCenterHref}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center transition-colors hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5"
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--muted-foreground)]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                    <div className="font-medium text-[var(--foreground)]">Özel Şablon Oluştur</div>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Doküman merkezinde kendi sertifika şablonunuzu tasarlayın
                    </p>
                  </Link>
                </div>
              </div>
            )}

            {/* Certificates tab */}
            {tab === "certificates" && (
              <div className="space-y-3">
                {certificates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold)]/10">
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5"/></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">Henüz verilmiş sertifika yok</h3>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Şablon seçip çalışanlarınıza toplu sertifika oluşturabilirsiniz
                    </p>
                    <button
                      onClick={() => setShowIssueModal(true)}
                      className="mt-4 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-white shadow hover:brightness-110"
                    >
                      Toplu Sertifika Oluştur
                    </button>
                  </div>
                ) : (
                  certificates.map(cert => (
                    <div key={cert.id} className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all hover:shadow-md">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--foreground)]">{cert.personName}</div>
                        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          <span>{cert.trainingName}</span>
                          <span>|</span>
                          <span className="font-mono">{cert.certificateNo}</span>
                          <span>|</span>
                          <span>{new Date(cert.issuedAt).toLocaleDateString("tr-TR")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => downloadCertPdf(cert)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          PDF
                        </button>
                        <a
                          href={`/certificate/verify/${cert.qrCode}`}
                          target="_blank"
                          rel="noopener"
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors"
                        >
                          Doğrula
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Bulk Issue Modal */}
        {showIssueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-[var(--card)] shadow-2xl max-h-[85vh] flex flex-col">
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Toplu Sertifika Oluştur</h3>
                <button onClick={() => setShowIssueModal(false)} className="rounded-lg p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Template selection */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Şablon Seçin</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {builtInTemplates.map((tmpl, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTemplateIdx(idx)}
                        className={`rounded-xl border-2 p-3 text-left transition-colors ${
                          selectedTemplateIdx === idx
                            ? "border-[var(--gold)] bg-[var(--gold)]/5"
                            : "border-[var(--border)] hover:border-[var(--gold)]/30"
                        }`}
                      >
                        <div className="font-medium text-sm text-[var(--foreground)]">{tmpl.name}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{tmpl.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Training info */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">Eğitim Adı *</label>
                    <input
                      type="text"
                      value={trainingName}
                      onChange={e => setTrainingName(e.target.value)}
                      placeholder="ör: İSG Temel Eğitimi"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg,#f8f9fa)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">Eğitimci</label>
                    <input
                      type="text"
                      value={trainerName}
                      onChange={e => setTrainerName(e.target.value)}
                      placeholder="ör: Dr. Mehmet Demir"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg,#f8f9fa)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">Süre</label>
                    <input
                      type="text"
                      value={trainingDuration}
                      onChange={e => setTrainingDuration(e.target.value)}
                      placeholder="ör: 16 Saat"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg,#f8f9fa)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                    />
                  </div>
                </div>

                {/* Personnel selection */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-[var(--foreground)]">
                      Çalışan Seçin ({selectedPersonnel.size} seçili)
                    </label>
                    <button
                      onClick={toggleAll}
                      className="text-xs font-medium text-[var(--gold)] hover:underline"
                    >
                      {selectedPersonnel.size === filteredPersonnel.length && filteredPersonnel.length > 0 ? "Hiçbirini Seçme" : "Tümünü Seç"}
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative mb-2">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      value={personnelSearch}
                      onChange={e => setPersonnelSearch(e.target.value)}
                      placeholder="Çalışan ara..."
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg,#f8f9fa)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                    />
                  </div>

                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                    {filteredPersonnel.length === 0 ? (
                      <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">Çalışan bulunamadı</p>
                    ) : (
                      filteredPersonnel.map(p => (
                        <label
                          key={p.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[var(--accent)]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPersonnel.has(p.id)}
                            onChange={e => {
                              const next = new Set(selectedPersonnel);
                              if (e.target.checked) {
                                next.add(p.id);
                              } else {
                                next.delete(p.id);
                              }
                              setSelectedPersonnel(next);
                            }}
                            className="rounded border-[var(--border)]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-[var(--foreground)]">{p.firstName} {p.lastName}</span>
                            <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                              {p.department && `${p.department} | `}{p.companyName}
                            </span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex gap-2 border-t border-[var(--border)] p-5">
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  İptal
                </button>
                <button
                  onClick={handleBulkIssue}
                  disabled={issuing || selectedPersonnel.size === 0 || !trainingName.trim()}
                  className="flex-1 rounded-xl bg-[var(--gold)] py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50 hover:brightness-110"
                >
                  {issuing ? `Oluşturuluyor... (${selectedPersonnel.size})` : `${selectedPersonnel.size} Kişi İçin Oluştur`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

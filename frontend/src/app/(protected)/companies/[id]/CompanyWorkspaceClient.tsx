"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  loadCompanyDirectory,
  saveCompanyDirectory,
  type CompanyRecord,
} from "@/lib/company-directory";
import {
  getGuidedTasks,
  getOverallRiskState,
  getReminderItems,
} from "@/lib/workplace-status";

type WorkspaceTab =
  | "overview"
  | "structure"
  | "risk"
  | "people"
  | "tracking"
  | "documents"
  | "history"
  | "digital_twin";

function buildMockDocuments(company: CompanyRecord) {
  return [
    {
      title: `${company.shortName || company.name} Risk Analizi Raporu`,
      type: "Risk Analizi",
      status: "GÃ¼ncel",
    },
    {
      title: `${company.shortName || company.name} Acil Durum PlanÄ±`,
      type: "Acil Durum",
      status: "Kontrol Gerekli",
    },
    {
      title: `${company.shortName || company.name} EÄŸitim PlanÄ±`,
      type: "EÄŸitim",
      status: "Aktif",
    },
    {
      title: `${company.shortName || company.name} Periyodik Kontrol Takibi`,
      type: "Periyodik Kontrol",
      status: "Ä°zleniyor",
    },
  ];
}

function buildMockActivities(company: CompanyRecord) {
  return [
    {
      actor: "Mehmet YÄ±ldÄ±rÄ±m",
      role: "Ä°ÅŸ GÃ¼venliÄŸi UzmanÄ±",
      action: `${company.shortName || company.name} iÃ§in risk analizi gÃ¶zden geÃ§irildi.`,
      time: "BugÃ¼n Â· 14:20",
    },
    {
      actor: "AyÅŸe Demir",
      role: "Ä°ÅŸyeri Hekimi",
      action: "SaÄŸlÄ±k gÃ¶zetimi ve eÄŸitim planÄ± notlarÄ± gÃ¼ncellendi.",
      time: "BugÃ¼n Â· 10:05",
    },
    {
      actor: "Ali Kaya",
      role: "Ä°ÅŸveren Vekili",
      action: "2 adet aksiyon iÃ§in termin onayÄ± verildi.",
      time: "DÃ¼n Â· 16:40",
    },
  ];
}

function fieldClass() {
  return "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-[0_4px_20px_rgba(15,23,42,0.03)]";
}

function sectionCardClass() {
  return "rounded-[28px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur sm:p-6";
}

export function CompanyWorkspaceClient({
  companyId,
}: {
  companyId: string;
}) {
  const [companies, setCompanies] = useState<CompanyRecord[]>(() => loadCompanyDirectory());
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const company = useMemo(
    () => companies.find((item) => item.id === companyId) ?? null,
    [companies, companyId],
  );

  const riskState = useMemo(
    () => (company ? getOverallRiskState(company) : null),
    [company],
  );

  const guidedTasks = useMemo(
    () => (company ? getGuidedTasks(company) : []),
    [company],
  );

  const reminders = useMemo(
    () => (company ? getReminderItems(company) : []),
    [company],
  );

  const documents = useMemo(
    () => (company ? buildMockDocuments(company) : []),
    [company],
  );

  const activities = useMemo(
    () => (company ? buildMockActivities(company) : []),
    [company],
  );

  function updateTextField(
    field:
      | "name"
      | "shortName"
      | "kind"
      | "address"
      | "sector"
      | "naceCode"
      | "hazardClass"
      | "shiftModel"
      | "phone"
      | "email"
      | "contactPerson"
      | "employerName"
      | "employerRepresentative"
      | "notes"
      | "lastAnalysisDate"
      | "lastInspectionDate"
      | "lastDrillDate",
    value: string,
  ) {
    setCompanies((prev) =>
      prev.map((item) =>
        item.id === companyId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    setMessage("");
    setMessageType("");
  }

  function updateNumberField(
    field:
      | "employeeCount"
      | "activeProfessionals"
      | "employeeRepresentativeCount"
      | "supportStaffCount"
      | "openActions"
      | "overdueActions"
      | "openRiskAssessments"
      | "documentCount"
      | "completionRate"
      | "maturityScore"
      | "openRiskScore"
      | "last30DayImprovement"
      | "completedTrainingCount"
      | "expiringTrainingCount"
      | "periodicControlCount"
      | "overduePeriodicControlCount",
    value: number,
  ) {
    setCompanies((prev) =>
      prev.map((item) =>
        item.id === companyId
          ? {
              ...item,
              [field]: Number.isFinite(value) ? value : 0,
            }
          : item,
      ),
    );
    setMessage("");
    setMessageType("");
  }

  function updateArrayField(
    field: "locations" | "departments",
    index: number,
    value: string,
  ) {
    setCompanies((prev) =>
      prev.map((item) => {
        if (item.id !== companyId) {
          return item;
        }

        const nextValues = [...item[field]];
        nextValues[index] = value;

        return {
          ...item,
          [field]: nextValues,
        };
      }),
    );
    setMessage("");
    setMessageType("");
  }

  function addArrayItem(field: "locations" | "departments") {
    setCompanies((prev) =>
      prev.map((item) =>
        item.id === companyId
          ? {
              ...item,
              [field]: [...item[field], ""],
            }
          : item,
      ),
    );
    setMessage("");
    setMessageType("");
  }

  function removeArrayItem(field: "locations" | "departments", index: number) {
    setCompanies((prev) =>
      prev.map((item) => {
        if (item.id !== companyId) {
          return item;
        }

        const nextValues = item[field].filter((_, i) => i !== index);

        return {
          ...item,
          [field]: nextValues.length > 0 ? nextValues : [""],
        };
      }),
    );
    setMessage("");
    setMessageType("");
  }

  function handleSave() {
    if (!company) return;

    if (!company.name.trim()) {
      setMessage("Firma / kurum adÄ± boÅŸ bÄ±rakÄ±lamaz.");
      setMessageType("error");
      return;
    }

    saveCompanyDirectory(companies);
    setMessage("Ä°ÅŸyeri Ã§alÄ±ÅŸma alanÄ± bilgileri kaydedildi.");
    setMessageType("success");
  }

  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "overview", label: "Genel Durum" },
    { id: "structure", label: "YerleÅŸke / YapÄ±" },
    { id: "risk", label: "Risk ve Saha" },
    { id: "people", label: "Personel" },
    { id: "tracking", label: "Takip" },
    { id: "documents", label: "DokÃ¼manlar" },
    { id: "history", label: "GeÃ§miÅŸ" },
    { id: "digital_twin", label: "Dijital Ä°kiz" },
  ];

  if (!company) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <h1 className="text-3xl font-semibold text-slate-950">KayÄ±t bulunamadÄ±</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Ä°stenen firma / kurum kaydÄ± bulunamadÄ±.
        </p>
        <Link
          href="/companies"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
        >
          Firma Listesine DÃ¶n
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl space-y-4">
              <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Ä°ÅŸyeri Ã§alÄ±ÅŸma alanÄ±
              </span>

              <div className="space-y-3">
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {company.name}
                </h1>

                <p className="max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
                  {company.notes ||
                    "Bu ekran iÅŸyerinin Ä°SG operasyon merkezi olarak kullanÄ±lÄ±r."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {company.kind || "TÃ¼r yok"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {company.hazardClass || "Tehlike sÄ±nÄ±fÄ± yok"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  Ã‡alÄ±ÅŸan: {company.employeeCount}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  Lokasyon: {company.locations.filter(Boolean).length}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  BÃ¶lÃ¼m: {company.departments.filter(Boolean).length}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
              <Link
                href="/risk-analysis"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
              >
                Risk Analizi BaÅŸlat
              </Link>

              <Link
                href="/reports"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                DokÃ¼manlar
              </Link>

              <Link
                href="/companies"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Listeye DÃ¶n
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
          <div className="border-b border-slate-200/70 p-5 md:border-r xl:border-b-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Genel Durum
            </p>
            <div className="mt-3 flex items-center gap-3">
              {riskState ? (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${riskState.className}`}
                >
                  {riskState.label}
                  {riskState.score !== null ? ` Â· ${riskState.score}/100` : ""}
                </span>
              ) : null}
            </div>
          </div>

          <div className="border-b border-slate-200/70 p-5 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              AÃ§Ä±k Aksiyon
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {company.openActions}
            </p>
          </div>

          <div className="border-b border-slate-200/70 p-5 md:border-r xl:border-b-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Geciken Ä°ÅŸ
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {company.overdueActions}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Son Risk Analizi
            </p>
            <p className="mt-3 text-base font-semibold text-slate-950">
              {company.lastAnalysisDate || "-"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className={sectionCardClass()}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  BugÃ¼n ne yapmalÄ±yÄ±m?
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Sistem bu iÅŸyeri iÃ§in Ã¶ncelikli iÅŸleri Ã¶ne Ã§Ä±karÄ±r.
                </p>
              </div>

              {riskState ? (
                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${riskState.className}`}
                >
                  {riskState.label}
                  {riskState.score !== null ? ` Â· ${riskState.score}/100` : ""}
                </span>
              ) : null}
            </div>

            <div className="space-y-4">
              {guidedTasks.map((task, index) => (
                <div
                  key={`${task.title}-${index}`}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          task.priority === "high"
                            ? "border border-red-200 bg-red-50 text-red-700"
                            : task.priority === "medium"
                              ? "border border-amber-200 bg-amber-50 text-amber-700"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {task.priority === "high"
                          ? "YÃ¼ksek Ã–ncelik"
                          : task.priority === "medium"
                            ? "Orta Ã–ncelik"
                            : "DÃ¼ÅŸÃ¼k Ã–ncelik"}
                      </span>

                      <p className="text-base font-semibold text-slate-950">
                        {task.title}
                      </p>

                      <p className="text-sm leading-7 text-slate-600">
                        {task.description}
                      </p>
                    </div>

                    <Link
                      href={task.href}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {task.actionLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCardClass()}>
            <div className="mb-5 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex h-10 items-center rounded-2xl px-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Firma / Kurum AdÄ±"
                    value={company.name}
                    onChange={(event) => updateTextField("name", event.target.value)}
                  />
                  <Input
                    label="KÄ±sa Ad"
                    value={company.shortName}
                    onChange={(event) => updateTextField("shortName", event.target.value)}
                  />
                  <Input
                    label="TÃ¼r"
                    value={company.kind}
                    onChange={(event) => updateTextField("kind", event.target.value)}
                  />
                  <Input
                    label="SektÃ¶r / Faaliyet"
                    value={company.sector}
                    onChange={(event) => updateTextField("sector", event.target.value)}
                  />
                  <Input
                    label="NACE Kodu"
                    value={company.naceCode}
                    onChange={(event) => updateTextField("naceCode", event.target.value)}
                  />

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-900">
                      Tehlike SÄ±nÄ±fÄ±
                    </label>
                    <select
                      value={company.hazardClass}
                      onChange={(event) =>
                        updateTextField("hazardClass", event.target.value)
                      }
                      className={fieldClass()}
                    >
                      <option value="">SeÃ§</option>
                      <option value="Az Tehlikeli">Az Tehlikeli</option>
                      <option value="Tehlikeli">Tehlikeli</option>
                      <option value="Ã‡ok Tehlikeli">Ã‡ok Tehlikeli</option>
                    </select>
                  </div>

                  <Input
                    label="Adres / Ä°l / BÃ¶lge"
                    value={company.address}
                    onChange={(event) => updateTextField("address", event.target.value)}
                  />
                  <Input
                    label="Ã‡alÄ±ÅŸan SayÄ±sÄ±"
                    type="number"
                    value={String(company.employeeCount)}
                    onChange={(event) =>
                      updateNumberField("employeeCount", Number(event.target.value))
                    }
                  />
                  <Input
                    label="Vardiya DÃ¼zeni"
                    value={company.shiftModel}
                    onChange={(event) =>
                      updateTextField("shiftModel", event.target.value)
                    }
                  />
                  <Input
                    label="Ä°letiÅŸim KiÅŸisi"
                    value={company.contactPerson}
                    onChange={(event) =>
                      updateTextField("contactPerson", event.target.value)
                    }
                  />
                  <Input
                    label="Ä°ÅŸveren"
                    value={company.employerName}
                    onChange={(event) =>
                      updateTextField("employerName", event.target.value)
                    }
                  />
                  <Input
                    label="Ä°ÅŸveren Vekili"
                    value={company.employerRepresentative}
                    onChange={(event) =>
                      updateTextField("employerRepresentative", event.target.value)
                    }
                  />
                  <Input
                    label="Telefon"
                    value={company.phone}
                    onChange={(event) => updateTextField("phone", event.target.value)}
                  />
                  <Input
                    label="E-posta"
                    value={company.email}
                    onChange={(event) => updateTextField("email", event.target.value)}
                  />
                </div>

                <Textarea
                  label="Firma / Kurum Notu"
                  rows={5}
                  value={company.notes}
                  onChange={(event) => updateTextField("notes", event.target.value)}
                />
              </div>
            ) : null}

            {activeTab === "structure" ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-950">
                      Lokasyonlar
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addArrayItem("locations")}
                    >
                      Lokasyon Ekle
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {company.locations.map((location, index) => (
                      <div key={`loc-${index}`} className="flex gap-2">
                        <input
                          value={location}
                          onChange={(event) =>
                            updateArrayField("locations", index, event.target.value)
                          }
                          className={fieldClass()}
                          placeholder="Lokasyon adÄ±"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeArrayItem("locations", index)}
                        >
                          Sil
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-950">
                      BÃ¶lÃ¼mler / Birimler
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addArrayItem("departments")}
                    >
                      BÃ¶lÃ¼m Ekle
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {company.departments.map((department, index) => (
                      <div key={`dep-${index}`} className="flex gap-2">
                        <input
                          value={department}
                          onChange={(event) =>
                            updateArrayField("departments", index, event.target.value)
                          }
                          className={fieldClass()}
                          placeholder="BÃ¶lÃ¼m / birim adÄ±"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeArrayItem("departments", index)}
                        >
                          Sil
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "risk" ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      AÃ§Ä±k Risk Analizi
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      {company.openRiskAssessments}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      AÃ§Ä±k Aksiyon
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      {company.openActions}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      GecikmiÅŸ Aksiyon
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      {company.overdueActions}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      AÃ§Ä±k Risk BaskÄ±sÄ±
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      %{company.openRiskScore}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="text-base font-semibold text-slate-950">
                    Risk ve saha yÃ¶netimi
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Risk analizi, saha tespiti, gÃ¶rsel yÃ¼kleme ve ileride canlÄ± saha taramasÄ± bu iÅŸyeri baÄŸlamÄ±nda Ã§alÄ±ÅŸÄ±r.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/risk-analysis"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                    >
                      Risk Analizi ModÃ¼lÃ¼ne Git
                    </Link>

                    <span className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500">
                      CanlÄ± saha taramasÄ± Â· YakÄ±nda
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "people" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Input
                  label="Aktif Profesyonel"
                  type="number"
                  value={String(company.activeProfessionals)}
                  onChange={(event) =>
                    updateNumberField("activeProfessionals", Number(event.target.value))
                  }
                />
                <Input
                  label="Ã‡alÄ±ÅŸan Temsilcisi"
                  type="number"
                  value={String(company.employeeRepresentativeCount)}
                  onChange={(event) =>
                    updateNumberField(
                      "employeeRepresentativeCount",
                      Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Destek ElemanÄ±"
                  type="number"
                  value={String(company.supportStaffCount)}
                  onChange={(event) =>
                    updateNumberField("supportStaffCount", Number(event.target.value))
                  }
                />
                <Input
                  label="Ä°letiÅŸim KiÅŸisi"
                  value={company.contactPerson}
                  onChange={(event) =>
                    updateTextField("contactPerson", event.target.value)
                  }
                />
              </div>
            ) : null}

            {activeTab === "tracking" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Input
                  label="Tamamlanan EÄŸitim"
                  type="number"
                  value={String(company.completedTrainingCount)}
                  onChange={(event) =>
                    updateNumberField(
                      "completedTrainingCount",
                      Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Yenileme YaklaÅŸan EÄŸitim"
                  type="number"
                  value={String(company.expiringTrainingCount)}
                  onChange={(event) =>
                    updateNumberField(
                      "expiringTrainingCount",
                      Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Periyodik Kontrol SayÄ±sÄ±"
                  type="number"
                  value={String(company.periodicControlCount)}
                  onChange={(event) =>
                    updateNumberField(
                      "periodicControlCount",
                      Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Geciken Periyodik Kontrol"
                  type="number"
                  value={String(company.overduePeriodicControlCount)}
                  onChange={(event) =>
                    updateNumberField(
                      "overduePeriodicControlCount",
                      Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Son Risk Analizi Tarihi"
                  type="date"
                  value={company.lastAnalysisDate}
                  onChange={(event) =>
                    updateTextField("lastAnalysisDate", event.target.value)
                  }
                />
                <Input
                  label="Son Denetim Tarihi"
                  type="date"
                  value={company.lastInspectionDate}
                  onChange={(event) =>
                    updateTextField("lastInspectionDate", event.target.value)
                  }
                />
                <Input
                  label="Son Tatbikat Tarihi"
                  type="date"
                  value={company.lastDrillDate}
                  onChange={(event) =>
                    updateTextField("lastDrillDate", event.target.value)
                  }
                />
                <Input
                  label="DokÃ¼man SayÄ±sÄ±"
                  type="number"
                  value={String(company.documentCount)}
                  onChange={(event) =>
                    updateNumberField("documentCount", Number(event.target.value))
                  }
                />
              </div>
            ) : null}

            {activeTab === "documents" ? (
              <div className="space-y-4">
                {documents.map((document) => (
                  <div
                    key={document.title}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">
                          {document.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          TÃ¼r: {document.type}
                        </p>
                      </div>

                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {document.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === "history" ? (
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div
                    key={`${activity.actor}-${index}`}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <p className="text-base font-semibold text-slate-950">
                      {activity.actor}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {activity.role}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {activity.action}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {activity.time}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === "digital_twin" ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="text-base font-semibold text-slate-950">
                    Dijital ikiz yaklaÅŸÄ±mÄ±
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Bu iÅŸyeri iÃ§in dijital ikiz; lokasyon, bÃ¶lÃ¼m, risk analizi, saha taramasÄ±, dokÃ¼man ve iÅŸlem geÃ§miÅŸinin tek kurumsal hafÄ±zada birleÅŸmesiyle kurulacaktÄ±r.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      BugÃ¼n
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      Operasyonel dijital ikiz temeli
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Sonraki AÅŸama
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      CanlÄ± saha taramasÄ± + alan eÅŸleme
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Nihai Hedef
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      Dinamik risk haritasÄ±
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" size="lg" onClick={handleSave}>
                DeÄŸiÅŸiklikleri Kaydet
              </Button>

              <Link
                href="/companies"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Listeye DÃ¶n
              </Link>
            </div>

            {message ? (
              <div
                className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${
                  messageType === "success"
                    ? "border border-green-200 bg-green-50 text-green-700"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-6">
          {riskState ? (
            <div className={sectionCardClass()}>
              <h2 className="text-xl font-semibold text-slate-950">
                Ä°ÅŸyeri Durumu
              </h2>

              <div
                className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${riskState.className}`}
              >
                {riskState.label}
                {riskState.score !== null ? ` Â· ${riskState.score}/100` : ""}
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                {riskState.description}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    YapÄ±sal Risk
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {riskState.structural}/100
                  </p>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Kapsam
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    %{riskState.coverage}
                  </p>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Olgunluk
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    %{riskState.maturity}
                  </p>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    AÃ§Ä±k Risk BaskÄ±sÄ±
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    %{riskState.openPressure}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className={sectionCardClass()}>
            <h2 className="text-xl font-semibold text-slate-950">
              YaklaÅŸan Ä°ÅŸler
            </h2>

            <div className="mt-4 space-y-3">
              {reminders.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-7 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCardClass()}>
            <h2 className="text-xl font-semibold text-slate-950">
              Son Hareketler
            </h2>

            <div className="mt-4 space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={`side-${activity.actor}-${index}`}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {activity.actor}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {activity.role}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {activity.action}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {activity.time}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

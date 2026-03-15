"use client";

import { useEffect, useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import { initialActions, type ActionItem, type ActionPriority, type ActionSource, type ActionStatus } from "@/lib/action-data";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 18,
        padding: 18,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{hint}</div>
    </div>
  );
}

function getCompanyName(companyId: number) {
  return companies.find((company) => company.id === companyId)?.name ?? "Bilinmeyen Kurum";
}

function isOverdue(action: ActionItem) {
  if (action.status === "Tamamlandi") return false;
  const today = new Date().toISOString().slice(0, 10);
  return action.dueDate < today;
}

function statusBadgeStyle(status: ActionStatus): React.CSSProperties {
  const map: Record<ActionStatus, string> = {
    "Acik": "#fff9ef",
    "Devam Ediyor": "#f4f8ff",
    "Tamamlandi": "#f5fff7",
    "Gecikti": "#fff4f4",
  };

  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #eee",
    background: map[status],
    fontWeight: 700,
    fontSize: 13,
  };
}

function priorityBadgeStyle(priority: ActionPriority): React.CSSProperties {
  const map: Record<ActionPriority, string> = {
    "Dusuk": "#f8f8f8",
    "Orta": "#fff9ef",
    "Yuksek": "#fff4f4",
    "Kritik": "#ffe9e9",
  };

  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #eee",
    background: map[priority],
    fontWeight: 700,
    fontSize: 13,
  };
}

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);

  const [filterCompanyId, setFilterCompanyId] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ActionStatus | "all">("all");
  const [search, setSearch] = useState("");

  const [companyId, setCompanyId] = useState<number>(companies[0]?.id ?? 1);
  const [source, setSource] = useState<ActionSource>("Saha Denetimi");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ActionPriority>("Orta");
  const [responsible, setResponsible] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [verificationNeeded, setVerificationNeeded] = useState(true);

  const companyForForm = useMemo(
    () => companies.find((company) => company.id === companyId) ?? companies[0],
    [companyId]
  );

  /* eslint-disable react-hooks/set-state-in-effect */
useEffect(() => {
  if (!companyForForm) return;
  const firstAssigned = companyForForm.assignments?.[0]?.fullName ?? companyForForm.contacts?.[0]?.name ?? "";
  setResponsible(firstAssigned);
}, [companyForForm]);
/* eslint-enable react-hooks/set-state-in-effect */

  const filteredActions = actions.filter((action) => {
    const companyMatch = filterCompanyId === "all" ? true : action.companyId === filterCompanyId;
    const statusMatch = filterStatus === "all" ? true : action.status === filterStatus;

    const q = search.trim().toLowerCase();
    const searchMatch =
      q === "" ||
      action.title.toLowerCase().includes(q) ||
      action.description.toLowerCase().includes(q) ||
      action.responsible.toLowerCase().includes(q) ||
      getCompanyName(action.companyId).toLowerCase().includes(q);

    return companyMatch && statusMatch && searchMatch;
  });

  const openCount = actions.filter((item) => item.status === "Acik" || item.status === "Devam Ediyor").length;
  const overdueCount = actions.filter((item) => item.status === "Gecikti" || isOverdue(item)).length;
  const completedCount = actions.filter((item) => item.status === "Tamamlandi").length;
  const verificationCount = actions.filter((item) => item.status === "Tamamlandi" && item.verificationNeeded).length;

  function handleCreateAction() {
    if (!title.trim() || !dueDate || !responsible.trim()) return;

    const newAction: ActionItem = {
      id: Date.now(),
      companyId,
      title: title.trim(),
      description: description.trim(),
      source,
      status: "Acik",
      priority,
      responsible: responsible.trim(),
      dueDate,
      createdAt: new Date().toLocaleString("tr-TR"),
      evidenceNote: evidenceNote.trim(),
      closeNote: "",
      verificationNeeded,
    };

    setActions((prev) => [newAction, ...prev]);

    setSource("Saha Denetimi");
    setTitle("");
    setDescription("");
    setPriority("Orta");
    setDueDate("");
    setEvidenceNote("");
    setVerificationNeeded(true);
  }

  function updateStatus(id: number, nextStatus: ActionStatus) {
    setActions((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    );
  }

  function verifyClosure(id: number) {
    setActions((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              verificationNeeded: false,
            }
          : item
      )
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>DOF / Aksiyon Takibi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 960 }}>
          Bu ekran, uygunsuzluklarin acilmasi, sorumlu atanmasi, termin takibi, kapanis ve
          dogrulama sureclerinin tek yerde yonetilmesi icin hazirlandi.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard title="Acik / Devam Eden" value={String(openCount)} hint="Takibi devam eden aksiyonlar" />
        <StatCard title="Geciken" value={String(overdueCount)} hint="Termin tarihi gecmis kayitlar" />
        <StatCard title="Tamamlanan" value={String(completedCount)} hint="Kapanisi yapilan aksiyonlar" />
        <StatCard title="Dogrulama Bekleyen" value={String(verificationCount)} hint="Kapanis kontrolu gerekenler" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Yeni DOF / Aksiyon Ac">
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Kurum</div>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(Number(e.target.value))}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Kaynak</div>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as ActionSource)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  >
                    <option value="Saha Denetimi">Saha Denetimi</option>
                    <option value="Risk Analizi">Risk Analizi</option>
                    <option value="Dokuman">Dokuman</option>
                    <option value="Tatbikat">Tatbikat</option>
                    <option value="Mevzuat">Mevzuat</option>
                    <option value="Diger">Diger</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Baslik</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ornek: Yangin sondurucu erisim alani duzenlenmeli"
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Aciklama</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Uygunsuzluk, beklenen duzeltici faaliyet ve gerekli detaylari yaz..."
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Oncelik</div>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ActionPriority)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  >
                    <option value="Dusuk">Dusuk</option>
                    <option value="Orta">Orta</option>
                    <option value="Yuksek">Yuksek</option>
                    <option value="Kritik">Kritik</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Sorumlu</div>
                  <select
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  >
                    {companyForForm.assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.fullName}>
                        {assignment.fullName} - {assignment.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Termin Tarihi</div>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Kanit / Aciklama Notu</div>
                <textarea
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  rows={3}
                  placeholder="Varsa ilk kanit, gecici not veya saha bilgisi..."
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
                />
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={verificationNeeded}
                  onChange={(e) => setVerificationNeeded(e.target.checked)}
                />
                Kapanis sonrasinda dogrulama gereksin
              </label>

              <div>
                <button
                  onClick={handleCreateAction}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Aksiyon Kaydi Olustur
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Filtreler">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Kurum Filtresi</div>
                <select
                  value={filterCompanyId}
                  onChange={(e) =>
                    setFilterCompanyId(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                >
                  <option value="all">Tum kurumlar</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Durum</div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as ActionStatus | "all")}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                >
                  <option value="all">Tum durumlar</option>
                  <option value="Acik">Acik</option>
                  <option value="Devam Ediyor">Devam Ediyor</option>
                  <option value="Tamamlandi">Tamamlandi</option>
                  <option value="Gecikti">Gecikti</option>
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Ara</div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Baslik, sorumlu veya kurum ara"
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Aksiyon Listesi">
            {filteredActions.length === 0 ? (
              <div style={{ opacity: 0.75, lineHeight: 1.7 }}>
                Filtrelere uygun aksiyon bulunamadi.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {filteredActions.map((action) => (
                  <div
                    key={action.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{action.title}</div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={statusBadgeStyle(action.status)}>{action.status}</span>
                        <span style={priorityBadgeStyle(action.priority)}>{action.priority}</span>
                      </div>
                    </div>

                    <div style={{ opacity: 0.85, lineHeight: 1.7, marginBottom: 10 }}>
                      {action.description}
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14, marginBottom: 12 }}>
                      <div><strong>Kurum:</strong> {getCompanyName(action.companyId)}</div>
                      <div><strong>Kaynak:</strong> {action.source}</div>
                      <div><strong>Sorumlu:</strong> {action.responsible}</div>
                      <div><strong>Termin:</strong> {action.dueDate}</div>
                      <div><strong>Olusturma:</strong> {action.createdAt}</div>
                      <div><strong>Kanit:</strong> {action.evidenceNote || "-"}</div>
                      <div><strong>Kapanis Notu:</strong> {action.closeNote || "-"}</div>
                      <div><strong>Dogrulama:</strong> {action.verificationNeeded ? "Bekleniyor" : "Tamam"}</div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {action.status === "Acik" ? (
                        <button
                          onClick={() => updateStatus(action.id, "Devam Ediyor")}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Devama Al
                        </button>
                      ) : null}

                      {action.status !== "Tamamlandi" ? (
                        <button
                          onClick={() => updateStatus(action.id, "Tamamlandi")}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Tamamla
                        </button>
                      ) : null}

                      {action.status !== "Gecikti" && action.status !== "Tamamlandi" ? (
                        <button
                          onClick={() => updateStatus(action.id, "Gecikti")}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Gecikti Isaretle
                        </button>
                      ) : null}

                      {action.status === "Tamamlandi" && action.verificationNeeded ? (
                        <button
                          onClick={() => verifyClosure(action.id)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Kapanisi Dogrula
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
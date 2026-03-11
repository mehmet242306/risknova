"use client";

import { useEffect, useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";

type RiskLevel = "Dusuk" | "Orta" | "Yuksek";

type Finding = {
  id: number;
  createdAt: string;
  companyId: number;
  location: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  legislationTag: string;
  photoName?: string;
  voiceNote?: string;
};

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

function InfoMiniCard({
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
        borderRadius: 14,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      <div style={{ opacity: 0.7, fontSize: 13 }}>{hint}</div>
    </div>
  );
}

function formatElapsed(seconds: number) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function FieldAuditPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(companies[0]?.id ?? 1);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? companies[0],
    [selectedCompanyId]
  );

  const [selectedLocation, setSelectedLocation] = useState<string>(selectedCompany?.locations?.[0] ?? "");
  const [auditStarted, setAuditStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("Orta");
  const [legislationTag, setLegislationTag] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);

  useEffect(() => {
    if (!auditStarted) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [auditStarted]);

  useEffect(() => {
    if (selectedCompany?.locations?.length) {
      setSelectedLocation(selectedCompany.locations[0]);
    } else {
      setSelectedLocation("");
    }
  }, [selectedCompanyId, selectedCompany]);

  const highCount = findings.filter((item) => item.riskLevel === "Yuksek").length;

  function handleStartAudit() {
    setAuditStarted(true);
    setElapsedSeconds(0);
    setStartedAt(new Date().toLocaleString("tr-TR"));
  }

  function handleStopAudit() {
    setAuditStarted(false);
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPhotoName(file ? file.name : "");
  }

  function handleAddFinding() {
    if (!title.trim()) return;

    const newFinding: Finding = {
      id: Date.now(),
      createdAt: new Date().toLocaleString("tr-TR"),
      companyId: selectedCompanyId,
      location: selectedLocation,
      title: title.trim(),
      description: description.trim(),
      riskLevel,
      legislationTag: legislationTag.trim(),
      photoName: photoName || undefined,
      voiceNote: voiceNote.trim() || undefined,
    };

    setFindings((prev) => [newFinding, ...prev]);

    setTitle("");
    setDescription("");
    setRiskLevel("Orta");
    setLegislationTag("");
    setVoiceNote("");
    setPhotoName("");
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Saha Denetimi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 960 }}>
          Bu ekran; denetim baslatma, bulgu ekleme, fotograf yukleme, sesli not ozeti ve
          bulgulari DOF ile risk analizi akisina tasima iskeletidir.
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
        <InfoMiniCard title="Denetim Durumu" value={auditStarted ? "Aktif" : "Pasif"} hint="Saha oturumu" />
        <InfoMiniCard title="Baslangic" value={startedAt || "-"} hint="Denetim baslangic zamani" />
        <InfoMiniCard title="Gecen Sure" value={formatElapsed(elapsedSeconds)} hint="Canli denetim suresi" />
        <InfoMiniCard title="Bulgu Sayisi" value={String(findings.length)} hint={`Yuksek risk: ${highCount}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Denetim Oturumu">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Firma / Kurum</div>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
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
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Lokasyon / Birim</div>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                >
                  {selectedCompany.locations.map((location, index) => (
                    <option key={index} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button
                onClick={handleStartAudit}
                disabled={auditStarted}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: auditStarted ? "#f4f4f4" : "#fafafa",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Denetimi Baslat
              </button>

              <button
                onClick={handleStopAudit}
                disabled={!auditStarted}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: !auditStarted ? "#f4f4f4" : "#fafafa",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Denetimi Bitir
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Bulgu Ekle">
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Bulgu Basligi</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ornek: Elektrik panosu onunde malzeme birikimi"
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Bulgu Aciklamasi</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sahada tespit edilen durumu yaz..."
                  rows={4}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Risk Seviyesi</div>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  >
                    <option value="Dusuk">Dusuk</option>
                    <option value="Orta">Orta</option>
                    <option value="Yuksek">Yuksek</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Mevzuat Etiketi</div>
                  <input
                    value={legislationTag}
                    onChange={(e) => setLegislationTag(e.target.value)}
                    placeholder="Ornek: Elektrik, Yangin, KKD"
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Fotograf Ekle</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                />
                {photoName ? <div style={{ marginTop: 8, opacity: 0.75 }}>Secilen dosya: {photoName}</div> : null}
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Sesli Not Ozeti</div>
                <textarea
                  value={voiceNote}
                  onChange={(e) => setVoiceNote(e.target.value)}
                  placeholder="Bu alan ileride sesli nottan metne ceviri ile beslenecek."
                  rows={3}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={handleAddFinding}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Bulguyu Kayda Al
                </button>

                <button
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 700,
                  }}
                >
                  DOF'e Donustur (yakinda)
                </button>

                <button
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 700,
                  }}
                >
                  Risk Analizine Ekle (yakinda)
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Canli Saha Taramasi Vizyonu">
            <div style={{ lineHeight: 1.8, opacity: 0.9 }}>
              Bu alanda sonraki surumde tam video kaydi tutulmadan, canli kamera akisi uzerinden
              risk anlari yakalanacak. Sistem o kareyi zaman damgasi ile kaydedecek, anotasyon
              olusturacak ve bulguyu otomatik olarak denetim kaydina ekleyecek.
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <div>- Video yerine akilli kare yakalama</div>
              <div>- Risk aninda otomatik anotasyon</div>
              <div>- Zaman damgali bulgu kaydi</div>
              <div>- Sesli not ve goruntu eslestirme</div>
              <div>- DOF ve risk analizine otomatik aktarma</div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Anlik Denetim Ozeti">
            <div style={{ display: "grid", gap: 10 }}>
              <div><strong>Firma:</strong> {selectedCompany.name}</div>
              <div><strong>Lokasyon:</strong> {selectedLocation}</div>
              <div><strong>Hizmet Modeli:</strong> {selectedCompany.serviceModel}</div>
              <div><strong>Acik Aksiyon:</strong> {selectedCompany.openActions}</div>
              <div><strong>Son Ziyaret:</strong> {selectedCompany.lastVisit}</div>
            </div>
          </SectionCard>

          <SectionCard title="Toplanan Bulgular">
            {findings.length === 0 ? (
              <div style={{ opacity: 0.75, lineHeight: 1.7 }}>
                Henuz bulgu eklenmedi. Denetim baslatip ilk bulguyu eklediginde burada listelenecek.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {findings.map((finding) => (
                  <div
                    key={finding.id}
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
                      <div style={{ fontWeight: 800 }}>{finding.title}</div>
                      <div style={{ fontSize: 13, opacity: 0.75 }}>{finding.createdAt}</div>
                    </div>

                    <div style={{ opacity: 0.85, lineHeight: 1.7, marginBottom: 10 }}>
                      {finding.description || "Aciklama girilmedi."}
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Lokasyon:</strong> {finding.location}</div>
                      <div><strong>Risk:</strong> {finding.riskLevel}</div>
                      <div><strong>Mevzuat Etiketi:</strong> {finding.legislationTag || "-"}</div>
                      <div><strong>Fotograf:</strong> {finding.photoName || "-"}</div>
                      <div><strong>Sesli Not:</strong> {finding.voiceNote || "-"}</div>
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
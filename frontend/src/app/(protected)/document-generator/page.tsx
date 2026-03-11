"use client";

import { useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import { documentTemplates } from "@/lib/template-data";

type Tone = "Resmi" | "Teknik" | "Yonetici Ozeti" | "Sade";
type DetailLevel = "Kisa" | "Standart" | "Detayli";

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
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{hint}</div>
    </div>
  );
}

function badge(label: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #eee",
    background: "#fafafa",
    fontWeight: 700,
    fontSize: 13,
    display: "inline-flex",
  };
}

export default function DocumentGeneratorPage() {
  const [companyId, setCompanyId] = useState<number>(companies[0]?.id ?? 1);
  const [templateId, setTemplateId] = useState<number>(documentTemplates[0]?.id ?? 1);
  const [tone, setTone] = useState<Tone>("Resmi");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("Standart");
  const [documentTitle, setDocumentTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  const [includeLegislation, setIncludeLegislation] = useState(true);
  const [includeActions, setIncludeActions] = useState(true);
  const [includeTable, setIncludeTable] = useState(true);
  const [sectorAdaptation, setSectorAdaptation] = useState(true);
  const [formalizeLanguage, setFormalizeLanguage] = useState(true);
  const [fillGaps, setFillGaps] = useState(true);

  const selectedCompany = useMemo(
    () => companies.find((item) => item.id === companyId) ?? companies[0],
    [companyId]
  );

  const selectedTemplate = useMemo(
    () => documentTemplates.find((item) => item.id === templateId) ?? documentTemplates[0],
    [templateId]
  );

  const generatedTitle =
    documentTitle.trim() ||
    `${selectedCompany.name} - ${selectedTemplate.title}`;

  const previewText = useMemo(() => {
    const toneText =
      tone === "Resmi"
        ? "Metin resmi ve kurumsal ifade kalibinda duzenlenecektir."
        : tone === "Teknik"
        ? "Metin teknik terminoloji ve uzmanlik odakli anlatimla duzenlenecektir."
        : tone === "Yonetici Ozeti"
        ? "Metin yonetime sunulabilecek kisa ve karar odakli bir yapida duzenlenecektir."
        : "Metin daha sade ve anlasilir bir dille duzenlenecektir.";

    const detailText =
      detailLevel === "Kisa"
        ? "Icerik ozet seviyede tutulacaktir."
        : detailLevel === "Detayli"
        ? "Icerik ayrintili aciklamalar ve alt baslik mantigi ile genisletilecektir."
        : "Icerik standart seviyede, dengeli ayrinti ile sunulacaktir.";

    const optionLines = [
      includeLegislation ? "Mevzuat ve rehber referanslari vurgulanacak." : "Mevzuat vurgusu minimal tutulacak.",
      includeActions ? "Aksiyon ve sorumluluk basliklari eklenecek." : "Aksiyon basliklari sinirli tutulacak.",
      includeTable ? "Uygun alanlarda tablo veya liste mantigi onerilecek." : "Tablo kullanimi minimum tutulacak.",
      sectorAdaptation ? `Metin ${selectedCompany.sector} faaliyetine gore uyarlanacak.` : "Sektore ozel uyarlama kullanilmayacak.",
      formalizeLanguage ? "Dil resmi yazi ve rapor standardina yaklastirilacak." : "Dil daha serbest tutulacak.",
      fillGaps ? "Eksik alanlar AI mantigi ile tamamlanacak." : "Sadece verilen bilgiler kullanilacak."
    ];

    return [
      `${generatedTitle}`,
      "",
      `Kurum: ${selectedCompany.name}`,
      `Belge Turu: ${selectedTemplate.title}`,
      `Hedef Alan: ${selectedTemplate.target}`,
      "",
      `Amac: ${purpose.trim() || "Belgenin kurumun mevcut ihtiyacina uygun, duzenlenebilir ve profesyonel bir taslak olarak hazirlanmasi."}`,
      "",
      toneText,
      detailText,
      "",
      "AI Uyarlama Kararlari:",
      ...optionLines.map((line) => `- ${line}`),
      "",
      "Belge Omurgasi:",
      `- Giris ve kapsam`,
      `- Kuruma ozel durum analizi`,
      `- ${selectedTemplate.includes.join(", ")}`,
      includeActions ? "- Uygulanabilir aksiyon ve takip basliklari" : "",
      includeLegislation ? "- Mevzuat uyum ve dayanak vurgusu" : "",
      "",
      `Kurum Profili: ${selectedCompany.sector}, ${selectedCompany.hazardClass}, calisan sayisi ${selectedCompany.employeeCount}.`,
      "",
      `Ozel Notlar: ${specialNotes.trim() || "Ek ozel not girilmedi."}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    generatedTitle,
    selectedCompany,
    selectedTemplate,
    purpose,
    specialNotes,
    tone,
    detailLevel,
    includeLegislation,
    includeActions,
    includeTable,
    sectorAdaptation,
    formalizeLanguage,
    fillGaps,
  ]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>AI ile Dokuman Uyarlama Studyosu</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; sablon secimi, kurum uyarlamasi, ton ve ayrinti ayarlari ile
          yapay zeka destekli belge hazirlama akisinin on yuzudur.
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
        <StatCard title="Secili Kurum" value={selectedCompany.name} hint={selectedCompany.sector} />
        <StatCard title="Secili Sablon" value={selectedTemplate.title} hint={selectedTemplate.category} />
        <StatCard title="Ton / Ayrinti" value={`${tone} / ${detailLevel}`} hint="Uyarlama stili" />
        <StatCard title="AI Hazirlik" value={selectedTemplate.aiReady ? "Hazir" : "Sinirli"} hint="Sablon AI ile uyarlama durumu" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Belge Ayarlari">
            <div style={{ display: "grid", gap: 12 }}>
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

              <select
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value))}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                {documentTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>

              <input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Belge basligi (bos birakirsan otomatik olusur)"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />

              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                placeholder="Belgenin amaci"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
              />

              <textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                rows={4}
                placeholder="Kuruma ozel notlar, ozellesen ihtiyaclar, isveren talepleri"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
              />
            </div>
          </SectionCard>

          <SectionCard title="Uyarlama Tercihleri">
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                >
                  <option value="Resmi">Resmi</option>
                  <option value="Teknik">Teknik</option>
                  <option value="Yonetici Ozeti">Yonetici Ozeti</option>
                  <option value="Sade">Sade</option>
                </select>

                <select
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(e.target.value as DetailLevel)}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                >
                  <option value="Kisa">Kisa</option>
                  <option value="Standart">Standart</option>
                  <option value="Detayli">Detayli</option>
                </select>
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={includeLegislation} onChange={(e) => setIncludeLegislation(e.target.checked)} />
                Mevzuat vurgusu ekle
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={includeActions} onChange={(e) => setIncludeActions(e.target.checked)} />
                Aksiyon ve sorumluluk basliklari ekle
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={includeTable} onChange={(e) => setIncludeTable(e.target.checked)} />
                Tablo / liste mantigi oner
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={sectorAdaptation} onChange={(e) => setSectorAdaptation(e.target.checked)} />
                Sektore gore uyarlama yap
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={formalizeLanguage} onChange={(e) => setFormalizeLanguage(e.target.checked)} />
                Dili resmilesitir
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={fillGaps} onChange={(e) => setFillGaps(e.target.checked)} />
                Eksik alanlari tamamla
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Sablon Bilgisi">
            <div style={{ display: "grid", gap: 10 }}>
              <div><strong>Kategori:</strong> {selectedTemplate.category}</div>
              <div><strong>Hedef Kurum:</strong> {selectedTemplate.target}</div>
              <div><strong>Durum:</strong> <span style={badge(selectedTemplate.status)}>{selectedTemplate.status}</span></div>
              <div><strong>AI Hazir:</strong> <span style={badge(selectedTemplate.aiReady ? "AI Hazir" : "Sinirli")}>{selectedTemplate.aiReady ? "AI Hazir" : "Sinirli"}</span></div>
              <div><strong>Ozet:</strong> {selectedTemplate.summary}</div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Canli Taslak Onizleme">
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 14,
                background: "#fafafa",
                whiteSpace: "pre-wrap",
                lineHeight: 1.75,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 14,
              }}
            >
              {previewText}
            </div>
          </SectionCard>

          <SectionCard title="AI Islem Onerileri">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={badge("Kurum Uyarlamasi")}>Kurum Uyarlamasi</span>
                <span style={badge("Resmi Dile Cevrim")}>Resmi Dile Cevrim</span>
                <span style={badge("Eksik Alan Tamamlama")}>Eksik Alan Tamamlama</span>
                <span style={badge("Aksiyon Basliklari")}>Aksiyon Basliklari</span>
              </div>

              <div style={{ lineHeight: 1.8 }}>
                Bu belge, secili sablon ile kurumun faaliyet konusu, tehlike sinifi,
                calisan sayisi ve kullanicinin verdigi amaca gore uyarlanacak sekilde tasarlandi.
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Belge Islem Butonlari">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  fontWeight: 700,
                }}
              >
                Taslagi Kaydet (yakinda)
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
                Dokuman Olustur (yakinda)
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
                Word / PDF Cikti (yakinda)
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
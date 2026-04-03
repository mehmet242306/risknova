/**
 * Risk Analizi Export: PDF, Word, Excel
 * Profesyonel ISG rapor formatı
 */

import ExcelJS from "exceljs";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

export type ExportImage = {
  rowTitle: string;
  dataUrl: string;
  fileName: string;
  findingCount: number;
};

export type ExportFinding = {
  rowTitle: string;
  title: string;
  category: string;
  severity: string;
  severityLabel: string;
  score: number;
  scoreLabel: string;
  riskClass: string;
  action: string;
  recommendation: string;
  confidence: number;
  isManual: boolean;
  correctiveActionRequired: boolean;
  method: string;
  methodLabel: string;
  paramDetails?: { code: string; label: string; value: number; contribution: number }[];
  fkDetails?: { likelihood: number; severity: number; exposure: number };
  matrixDetails?: { likelihood: number; severity: number };
  legalReferences?: { law: string; article: string; description: string }[];
};

export type ExportParticipant = {
  fullName: string;
  role: string;
  title: string;
  certificateNo: string;
};

export type RiskAnalysisExportData = {
  analysisTitle: string;
  analysisNote: string;
  companyName: string;
  companyKind: string;
  companySector: string;
  companyHazardClass: string;
  companyAddress: string;
  companyLogoUrl: string;
  location: string;
  department: string;
  method: string;
  methodLabel: string;
  participants: ExportParticipant[];
  findings: ExportFinding[];
  images: ExportImage[];
  totalFindings: number;
  criticalCount: number;
  dofCandidateCount: number;
  date: string;
};

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function severityColor(s: string): string {
  return s === "critical" ? "#7F1D1D" : s === "high" ? "#DC2626" : s === "medium" ? "#F97316" : s === "low" ? "#F59E0B" : "#10B981";
}

function severityBg(s: string): string {
  return s === "critical" ? "#FEE2E2" : s === "high" ? "#FEF2F2" : s === "medium" ? "#FFF7ED" : s === "low" ? "#FFFBEB" : "#ECFDF5";
}

function scoreDisplay(f: ExportFinding): string {
  return f.score < 2 ? (f.score * 100).toFixed(0) : String(Math.round(f.score));
}

/* ================================================================== */
/* HTML Generator (Professional ISG Report)                            */
/* ================================================================== */

function generateHTML(data: RiskAnalysisExportData): string {
  const now = data.date || new Date().toLocaleDateString("tr-TR");

  // Her risk icin detayli kart
  const findingCards = data.findings.map((f, i) => `
    <div style="margin-bottom:20px;border:1px solid #dee2e6;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
      <div style="background:${severityBg(f.severity)};padding:10px 14px;border-bottom:1px solid #dee2e6;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:14px;color:#1a1a2e;">${i + 1}. ${f.title}</span>
          <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;color:#fff;background:${severityColor(f.severity)};">
            ${f.scoreLabel} — ${scoreDisplay(f)}
          </span>
        </div>
        <div style="margin-top:4px;font-size:11px;color:#666;">${f.category} · ${f.rowTitle}${f.correctiveActionRequired ? ' · <strong style="color:#DC2626;">DÖF Adayı</strong>' : ""}</div>
      </div>
      <div style="padding:12px 14px;">
        <div style="margin-bottom:8px;">
          <p style="margin:0 0 2px 0;font-size:10px;font-weight:600;color:#B8860B;text-transform:uppercase;letter-spacing:0.05em;">Tespit ve Değerlendirme</p>
          <p style="margin:0;font-size:12px;line-height:1.5;">${f.recommendation || "Detaylı değerlendirme yapılmalıdır."}</p>
        </div>
        <div style="margin-bottom:8px;">
          <p style="margin:0 0 2px 0;font-size:10px;font-weight:600;color:#B8860B;text-transform:uppercase;letter-spacing:0.05em;">Alınması Gereken Önlem</p>
          <p style="margin:0;font-size:12px;line-height:1.5;">${f.action}</p>
        </div>
        ${(f.legalReferences ?? []).length > 0 ? `
          <div>
            <p style="margin:0 0 4px 0;font-size:10px;font-weight:600;color:#B8860B;text-transform:uppercase;letter-spacing:0.05em;">Mevzuat Dayanağı</p>
            ${(f.legalReferences ?? []).map((r) => `
              <p style="margin:2px 0;font-size:11px;line-height:1.4;">
                <strong>§ ${r.law}</strong>${r.article ? ` — ${r.article}` : ""}${r.description ? `<br/><span style="color:#666;margin-left:12px;">${r.description}</span>` : ""}
              </p>
            `).join("")}
          </div>
        ` : ""}
      </div>
    </div>
  `).join("");

  // Gorseller (kucuk thumbnail satiri)
  const imagesHTML = data.images.length > 0 ? `
    <h2>SAHA GÖRSELLERİ</h2>
    <table style="border:none;"><tr>
      ${data.images.map((img) => `
        <td style="border:none;padding:2px;width:${Math.floor(100 / Math.min(data.images.length, 5))}%;vertical-align:top;">
          <img src="${img.dataUrl}" style="width:100%;height:auto;max-height:180px;object-fit:contain;border:1px solid #dee2e6;border-radius:3px;background:#f9fafb;" />
          <p style="margin:1px 0 0;font-size:7px;color:#999;text-align:center;">${img.rowTitle} (${img.findingCount})</p>
        </td>
      `).join("")}
    </tr></table>
  ` : "";

  // Katilimcilar
  const participantsHTML = data.participants.length > 0 ? `
    <h2>ANALİZ EKİBİ</h2>
    <table>
      <tr class="hdr"><th>#</th><th>Ad Soyad</th><th>Görev / Rol</th><th>Unvan</th><th>Belge No</th></tr>
      ${data.participants.map((p, i) => `
        <tr><td style="text-align:center;">${i + 1}</td><td>${p.fullName || "-"}</td><td>${p.role || "-"}</td><td>${p.title || "-"}</td><td>${p.certificateNo || "-"}</td></tr>
      `).join("")}
    </table>
  ` : "";

  // Ozet tablo
  const summaryTable = `
    <h2>RİSK DAĞILIM ÖZETİ</h2>
    <table>
      <tr class="hdr"><th>#</th><th>Tespit</th><th>Kategori</th><th>Risk Sınıfı</th><th>Skor</th><th>DÖF</th></tr>
      ${data.findings.map((f, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
          <td style="text-align:center;">${i + 1}</td>
          <td>${f.title}</td>
          <td>${f.category}</td>
          <td style="color:${severityColor(f.severity)};font-weight:600;">${f.scoreLabel}</td>
          <td style="text-align:center;font-weight:600;">${scoreDisplay(f)}</td>
          <td style="text-align:center;">${f.correctiveActionRequired ? "✓" : "-"}</td>
        </tr>
      `).join("")}
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${data.analysisTitle} - Risk Analizi Raporu</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 32px; color: #1a1a2e; font-size: 12px; line-height: 1.6; }
    h1 { color: #B8860B; font-size: 20px; margin: 0; }
    h2 { color: #B8860B; font-size: 14px; border-bottom: 2px solid #B8860B; padding-bottom: 4px; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    th, td { border: 1px solid #dee2e6; padding: 5px 7px; text-align: left; }
    .hdr { background: #B8860B; color: #fff; }
    .hdr th { border-color: #996F09; font-size: 10px; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #B8860B; padding-bottom: 12px; margin-bottom: 16px; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0; }
    .stat-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
    .stat-box .val { font-size: 20px; font-weight: 700; color: #B8860B; }
    .stat-box .lbl { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      ${data.companyLogoUrl ? `<img src="${data.companyLogoUrl}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb;" />` : ""}
      <div>
        <h1>RİSK ANALİZİ RAPORU</h1>
        <p style="margin:2px 0 0;font-size:11px;"><strong>${data.companyName}</strong></p>
        <p style="margin:1px 0 0;font-size:10px;color:#666;">${data.companyKind || ""} ${data.companySector ? `· ${data.companySector}` : ""} ${data.companyHazardClass ? `· ${data.companyHazardClass}` : ""}</p>
      </div>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:10px;color:#666;">RiskNova İSG Platformu</p>
      <p style="margin:0;font-size:10px;">${data.methodLabel}</p>
      <p style="margin:0;font-size:10px;color:#666;">Tarih: ${now}</p>
      <p style="margin:0;font-size:10px;color:#666;">Lokasyon: ${data.location || "-"}</p>
      <p style="margin:0;font-size:10px;color:#666;">Bölüm: ${data.department || "-"}</p>
      ${data.companyAddress ? `<p style="margin:0;font-size:9px;color:#999;">${data.companyAddress}</p>` : ""}
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-box"><div class="val">${data.totalFindings}</div><div class="lbl">Toplam Tespit</div></div>
    <div class="stat-box"><div class="val" style="color:#DC2626;">${data.criticalCount}</div><div class="lbl">Yüksek / Kritik</div></div>
    <div class="stat-box"><div class="val">${data.dofCandidateCount}</div><div class="lbl">DÖF Adayı</div></div>
    <div class="stat-box"><div class="val">${data.participants.length}</div><div class="lbl">Ekip Üyesi</div></div>
  </div>

  ${participantsHTML}
  ${imagesHTML}
  ${summaryTable}

  <h2 style="page-break-before:always;">DETAYLI RİSK TESPİTLERİ VE ÇÖZÜM ÖNERİLERİ</h2>
  ${findingCards}

  <div style="margin-top:32px;padding-top:12px;border-top:2px solid #B8860B;font-size:9px;color:#999;text-align:center;">
    Bu rapor RiskNova İSG Platformu tarafından ${now} tarihinde oluşturulmuştur.<br/>
    Rapor içeriği ${data.methodLabel} yöntemi ile değerlendirilmiştir.
  </div>
</body>
</html>`;
}

/* ================================================================== */
/* PDF Export                                                          */
/* ================================================================== */

export function exportRiskAnalysisPDF(data: RiskAnalysisExportData) {
  const html = generateHTML(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) w.onload = () => w.print();
}

/* ================================================================== */
/* Word Export                                                         */
/* ================================================================== */

export function exportRiskAnalysisWord(data: RiskAnalysisExportData) {
  const html = generateHTML(data);
  const pre = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Risk Analizi Raporu</title></head><body>`;
  const post = `</body></html>`;
  const blob = new Blob(["\ufeff", pre + html + post], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Risk-Analizi-${data.companyName || "Rapor"}-${data.date || new Date().toISOString().split("T")[0]}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================== */
/* Excel Export — Tek sayfa, profesyonel                               */
/* ================================================================== */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRiskAnalysisExcel(data: RiskAnalysisExportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RiskNova İSG Platformu";
  wb.created = new Date();

  const GOLD = "B8860B";
  const WHITE = "FFFFFF";
  const LIGHT = "F9FAFB";
  const RED = "DC2626";
  const ORANGE = "F97316";
  const GREEN = "10B981";

  function riskColor(severity: string): string {
    return severity === "critical" ? "7F1D1D" : severity === "high" ? RED : severity === "medium" ? ORANGE : severity === "low" ? "F59E0B" : GREEN;
  }

  // ── Tek Sayfa: Risk Analizi Raporu ──
  const ws = wb.addWorksheet("Risk Analizi");

  // Kolon genislikleri
  ws.columns = [
    { width: 5 },   // A: #
    { width: 30 },  // B: Tespit
    { width: 14 },  // C: Kategori
    { width: 10 },  // D: Risk Sinifi
    { width: 8 },   // E: Skor
    { width: 6 },   // F: DÖF
    { width: 35 },  // G: Öneri / Çözüm
    { width: 30 },  // H: Mevzuat Dayanağı
    { width: 25 },  // I: Alınacak Önlem
  ];

  // Baslik
  const titleRow = ws.addRow(["RİSK ANALİZİ RAPORU"]);
  ws.mergeCells("A1:I1");
  titleRow.font = { bold: true, size: 16, color: { argb: GOLD } };
  titleRow.height = 28;

  // Firma bilgileri
  const infoRow = ws.addRow([`${data.companyName} · ${data.location || "-"} · ${data.department || "-"} · ${data.methodLabel} · ${data.date}`]);
  ws.mergeCells("A2:I2");
  infoRow.font = { size: 10, color: { argb: "666666" } };

  // Istatistik satiri
  const statRow = ws.addRow([`Toplam: ${data.totalFindings} tespit · Yüksek/Kritik: ${data.criticalCount} · DÖF Adayı: ${data.dofCandidateCount} · Ekip: ${data.participants.length} kişi`]);
  ws.mergeCells("A3:I3");
  statRow.font = { size: 10, bold: true, color: { argb: GOLD } };

  ws.addRow([]); // Bos satir

  // Tablo basligi
  const headers = ["#", "Tespit", "Kategori", "Risk Sınıfı", "Skor", "DÖF", "Tespit Detayı ve Çözüm Önerisi", "Mevzuat Dayanağı", "Alınacak Önlem"];
  const hRow = ws.addRow(headers);
  hRow.height = 22;
  hRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: "996F09" } } };
  });

  // Veriler
  data.findings.forEach((f, i) => {
    const mevzuat = (f.legalReferences ?? []).map((r) => `${r.law}${r.article ? ` — ${r.article}` : ""}${r.description ? `: ${r.description}` : ""}`).join("\n");

    const row = ws.addRow([
      i + 1,
      f.title,
      f.category,
      f.scoreLabel,
      f.score < 2 ? Number((f.score * 100).toFixed(0)) : Math.round(f.score),
      f.correctiveActionRequired ? "Evet" : "-",
      f.recommendation || "Detaylı değerlendirme yapılmalıdır.",
      mevzuat || "-",
      f.action || "-",
    ]);

    row.alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(40, (f.recommendation?.length || 0) / 3);

    // Risk sinifina gore renk
    const rColor = riskColor(f.severity);
    row.getCell(4).font = { bold: true, color: { argb: rColor }, size: 9 };
    row.getCell(5).font = { bold: true, size: 9 };

    if (f.correctiveActionRequired) {
      row.getCell(6).font = { bold: true, color: { argb: RED }, size: 9 };
    }

    // Zebra renk
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT.replace("#", "") } };
      });
    }

    // Border
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "E5E7EB" } },
      };
    });
  });

  // Ekip bilgileri (alt kisim)
  if (data.participants.length > 0) {
    ws.addRow([]);
    const ekipTitle = ws.addRow(["ANALİZ EKİBİ"]);
    ws.mergeCells(`A${ekipTitle.number}:I${ekipTitle.number}`);
    ekipTitle.font = { bold: true, size: 11, color: { argb: GOLD } };

    data.participants.forEach((p) => {
      ws.addRow([
        "",
        p.fullName,
        p.role,
        p.title || "-",
        "",
        "",
        p.certificateNo || "-",
      ]);
    });
  }

  // Auto filter + frozen panes
  ws.autoFilter = { from: "A5", to: `I${5 + data.findings.length}` };
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 5 }];

  // Görseller (ayrı sheet, varsa)
  if (data.images.length > 0) {
    const wsImg = wb.addWorksheet("Görseller");
    wsImg.columns = [{ width: 5 }, { width: 25 }, { width: 25 }, { width: 12 }, { width: 45 }];
    const imgHdr = wsImg.addRow(["#", "Alan", "Dosya", "Tespit", ""]);
    imgHdr.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    });

    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const row = wsImg.addRow([i + 1, img.rowTitle, img.fileName, img.findingCount]);
      try {
        const base64Data = img.dataUrl.split(",")[1];
        if (base64Data) {
          const ext = img.dataUrl.includes("image/png") ? "png" : "jpeg";
          const imageId = wb.addImage({ base64: base64Data, extension: ext });
          wsImg.addImage(imageId, { tl: { col: 4, row: row.number - 1 }, ext: { width: 300, height: 200 } });
          row.height = 155;
        }
      } catch { /* gorsel eklenemezse devam */ }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `Risk-Analizi-${data.companyName || "Rapor"}-${data.date || new Date().toISOString().split("T")[0]}.xlsx`);
}

import type { DofRecord, IshikawaRecord, IncidentRecord } from "@/lib/supabase/incident-api";

type ExportData = {
  incident: IncidentRecord;
  dof: DofRecord | null;
  ishikawa: IshikawaRecord | null;
};

const ishikawaCategoryLabels: Record<string, string> = {
  manCauses: "İnsan",
  machineCauses: "Makine",
  methodCauses: "Yöntem",
  materialCauses: "Malzeme",
  environmentCauses: "Çevre",
  measurementCauses: "Ölçüm",
};

function generateDofHTML(data: ExportData): string {
  const { incident, dof, ishikawa } = data;
  const now = new Date().toLocaleDateString("tr-TR");

  const actionsHTML = (actions: { action: string; assignedTo: string; deadline: string; done: boolean }[], title: string) => {
    if (!actions.length) return "";
    return `
      <h3 style="margin-top:24px;color:#B8860B;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <tr style="background:#f8f9fa;">
          <th style="border:1px solid #dee2e6;padding:8px;text-align:left;font-size:12px;">Durum</th>
          <th style="border:1px solid #dee2e6;padding:8px;text-align:left;font-size:12px;">Faaliyet</th>
          <th style="border:1px solid #dee2e6;padding:8px;text-align:left;font-size:12px;">Sorumlu</th>
          <th style="border:1px solid #dee2e6;padding:8px;text-align:left;font-size:12px;">Termin</th>
        </tr>
        ${actions.map((a) => `
          <tr>
            <td style="border:1px solid #dee2e6;padding:8px;text-align:center;">${a.done ? "✅" : "⬜"}</td>
            <td style="border:1px solid #dee2e6;padding:8px;font-size:12px;">${a.action || "-"}</td>
            <td style="border:1px solid #dee2e6;padding:8px;font-size:12px;">${a.assignedTo || "-"}</td>
            <td style="border:1px solid #dee2e6;padding:8px;font-size:12px;">${a.deadline || "-"}</td>
          </tr>
        `).join("")}
      </table>
    `;
  };

  const ishikawaHTML = ishikawa ? `
    <div style="page-break-before:always;"></div>
    <h2 style="color:#B8860B;border-bottom:2px solid #B8860B;padding-bottom:8px;margin-top:32px;">
      İSHİKAWA (BALIKKILÇIĞI) ANALİZİ
    </h2>
    <p><strong>Problem:</strong> ${ishikawa.problemStatement || "-"}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr style="background:#f8f9fa;">
        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;font-size:12px;">Kategori</th>
        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;font-size:12px;">Nedenler</th>
      </tr>
      ${Object.entries(ishikawaCategoryLabels).map(([key, label]) => {
        const causes = (ishikawa as Record<string, unknown>)[key] as string[] | undefined;
        return `
          <tr>
            <td style="border:1px solid #dee2e6;padding:8px;font-weight:600;font-size:12px;width:120px;">${label}</td>
            <td style="border:1px solid #dee2e6;padding:8px;font-size:12px;">${causes?.length ? causes.join(", ") : "-"}</td>
          </tr>
        `;
      }).join("")}
    </table>
    <p style="margin-top:16px;"><strong>Kök Neden Sonucu:</strong> ${ishikawa.rootCauseConclusion || "-"}</p>
  ` : "";

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>DÖF Raporu - ${dof?.dofCode || incident.incidentCode}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a2e; }
        h1 { color: #B8860B; font-size: 24px; }
        h2 { color: #B8860B; font-size: 18px; border-bottom: 2px solid #B8860B; padding-bottom: 8px; }
        h3 { font-size: 15px; }
        p { font-size: 13px; line-height: 1.6; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #B8860B; padding-bottom: 16px; margin-bottom: 24px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
        .info-item { font-size: 12px; }
        .info-item strong { color: #666; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>DÖF RAPORU</h1>
          <p style="margin:0;color:#666;">Düzeltici ve Önleyici Faaliyet</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:12px;color:#666;">RiskNova Platform</p>
          <p style="margin:0;font-size:12px;"><strong>${dof?.dofCode || "-"}</strong></p>
          <p style="margin:0;font-size:12px;color:#666;">Tarih: ${now}</p>
        </div>
      </div>

      <h2>OLAY BİLGİLERİ</h2>
      <div class="info-grid">
        <div class="info-item"><strong>Olay Kodu:</strong> ${incident.incidentCode}</div>
        <div class="info-item"><strong>Olay Tipi:</strong> ${incident.incidentType === "work_accident" ? "İş Kazası" : incident.incidentType === "near_miss" ? "Ramak Kala" : "Meslek Hastalığı"}</div>
        <div class="info-item"><strong>Firma:</strong> ${incident.companyName || "-"}</div>
        <div class="info-item"><strong>Personel:</strong> ${incident.personnelName || "-"}</div>
        <div class="info-item"><strong>Tarih:</strong> ${incident.incidentDate || "-"}</div>
        <div class="info-item"><strong>Lokasyon:</strong> ${incident.incidentLocation || "-"}</div>
      </div>
      ${incident.description ? `<p><strong>Açıklama:</strong> ${incident.description}</p>` : ""}

      <h2 style="margin-top:32px;">KÖK NEDEN ANALİZİ</h2>
      <p><strong>Kök Neden:</strong> ${dof?.rootCause || "-"}</p>
      <p><strong>Detaylı Analiz:</strong> ${dof?.rootCauseAnalysis || "-"}</p>

      ${actionsHTML(dof?.correctiveActions ?? [], "DÜZELTİCİ FAALİYETLER")}
      ${actionsHTML(dof?.preventiveActions ?? [], "ÖNLEYİCİ FAALİYETLER")}

      <h3 style="margin-top:24px;">Genel Bilgiler</h3>
      <div class="info-grid">
        <div class="info-item"><strong>Sorumlu:</strong> ${dof?.assignedTo || "-"}</div>
        <div class="info-item"><strong>Son Tarih:</strong> ${dof?.deadline || "-"}</div>
        <div class="info-item"><strong>Durum:</strong> ${dof?.status === "open" ? "Açık" : dof?.status === "in_progress" ? "Devam Ediyor" : dof?.status === "completed" ? "Tamamlandı" : "Doğrulandı"}</div>
      </div>

      ${ishikawaHTML}

      <div style="margin-top:48px;padding-top:16px;border-top:1px solid #dee2e6;font-size:11px;color:#999;text-align:center;">
        Bu rapor RiskNova AI destekli İSG platformu tarafından oluşturulmuştur.
      </div>
    </body>
    </html>
  `;
}

export function exportDofAsPDF(data: ExportData) {
  const html = generateDofHTML(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export function exportDofAsWord(data: ExportData) {
  const html = generateDofHTML(data);
  const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>DÖF Raporu</title></head><body>`;
  const postHtml = `</body></html>`;
  const fullHtml = preHtml + html + postHtml;

  const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DOF-Raporu-${data.dof?.dofCode || data.incident.incidentCode}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

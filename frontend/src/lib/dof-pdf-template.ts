import type { DofFormData } from "@/components/incidents/DofOsgbForm";

const FORM_TYPE_LABELS: Record<string, string> = {
  duzeltici: "Düzeltici Faaliyet",
  onleyici: "Önleyici Faaliyet",
  ramak_kala: "Ramak Kala",
  kaza: "Kaza",
  uygunsuzluk: "Uygunsuzluk",
  tehlike: "Tehlike",
};

const ALL_TYPES = ["duzeltici", "onleyici", "ramak_kala", "kaza", "uygunsuzluk", "tehlike"];

function esc(s: unknown): string {
  if (s === null || s === undefined || s === "") return "&nbsp;";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function checkboxRow(selected: string[]): string {
  return ALL_TYPES.map((key) => {
    const checked = selected.includes(key);
    return `<span style="display:inline-block;margin-right:14px;white-space:nowrap;">
      <span style="display:inline-block;width:12px;height:12px;border:1.5px solid #111;text-align:center;line-height:10px;font-size:11px;vertical-align:middle;margin-right:4px;">${checked ? "✓" : ""}</span>
      ${FORM_TYPE_LABELS[key]}
    </span>`;
  }).join("");
}

function resultRow(sonuc: string | undefined): string {
  return `
    <span style="display:inline-block;margin-right:20px;white-space:nowrap;">
      <span style="display:inline-block;width:12px;height:12px;border:1.5px solid #111;border-radius:50%;text-align:center;line-height:10px;font-size:11px;vertical-align:middle;margin-right:4px;">${sonuc === "kaldirildi" ? "●" : ""}</span>
      Risk Ortadan Kaldırıldı
    </span>
    <span style="display:inline-block;white-space:nowrap;">
      <span style="display:inline-block;width:12px;height:12px;border:1.5px solid #111;border-radius:50%;text-align:center;line-height:10px;font-size:11px;vertical-align:middle;margin-right:4px;">${sonuc === "kaldirilmadi" ? "●" : ""}</span>
      Risk Ortadan Kaldırılmadı
    </span>
  `;
}

function renderRow(label: string, value: string): string {
  return `
    <tr>
      <td style="width:32%;background:#f3f4f6;padding:5px 8px;border:1px solid #9ca3af;font-weight:600;font-size:10px;vertical-align:middle;">${label}</td>
      <td style="padding:5px 8px;border:1px solid #9ca3af;font-size:10px;vertical-align:middle;min-height:18px;">${value}</td>
    </tr>
  `;
}

function renderSectionHeader(title: string, subtitle: string): string {
  return `
    <tr>
      <td colspan="2" style="background:#d4a017;color:#fff;padding:6px 8px;border:1px solid #9ca3af;font-weight:700;font-size:11px;letter-spacing:0.5px;">
        ${esc(title)}${subtitle ? ` <span style="font-weight:400;opacity:0.85;font-size:9px;">(${esc(subtitle)})</span>` : ""}
      </td>
    </tr>
  `;
}

function renderFormHtml(form: DofFormData, index: number): string {
  const dolduran = form.formuDolduran ?? { adSoyad: "", tc: "", firma: "", imza: "" };
  const onaylayan = form.formuOnaylayan ?? { adSoyad: "", tc: "", firmaGorev: "", imza: "", aksiyon: "", termin: "" };
  const kapatan = form.formuKapatan ?? { adSoyad: "", tc: "", firmaGorev: "", imza: "" };
  const formTuru = form.formuTuru ?? [];
  const cozum = [form.corrective_action, form.preventive_action].filter(Boolean).join("\n\n");

  return `
    <div style="page-break-after:always;${index === 0 ? "" : "padding-top:10mm;"}">
      <!-- Form başlık -->
      <div style="background:#1f2937;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border:1px solid #111;">
        <div>
          <div style="font-weight:700;font-size:14px;letter-spacing:0.5px;">DÜZELTİCİ ÖNLEYİCİ FAALİYET FORMU</div>
          <div style="font-size:9px;opacity:0.8;margin-top:2px;">Doküman No: RN-DOF · Form #${index + 1}</div>
        </div>
        <div style="text-align:right;font-size:9px;">
          <div>Öncelik: <strong style="color:#fbbf24;">${esc(form.priority)}</strong></div>
          <div style="margin-top:2px;">Efor: ${esc(form.estimated_effort)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:0;">
        ${renderSectionHeader("FORMU DOLDURANIN", "Bu bölüm bildirimi yapan kişi tarafından doldurulacaktır")}
        ${renderRow("Adı Soyadı", esc(dolduran.adSoyad))}
        ${renderRow("T.C. Kimlik No", esc(dolduran.tc))}
        ${renderRow("Firması", esc(dolduran.firma))}
        ${renderRow("İmzası", esc(dolduran.imza))}

        ${renderSectionHeader("FORMUN", "")}
        ${renderRow("Türü", checkboxRow(formTuru))}
        ${renderRow("Tarihi", esc(form.formuTarihi))}
        ${renderRow("Yeri", esc(form.formuYeri))}
        ${renderRow("Tanımı", esc(form.formuTanimi))}
        ${renderRow("Kök Nedeni", esc(form.root_cause))}
        ${renderRow("Çözüm Önerisi", esc(cozum))}

        ${renderSectionHeader("FORMU ONAYLAYAN YETKİLİNİN", "Bu bölüm yetkili/işveren tarafından doldurulacaktır")}
        ${renderRow("Adı Soyadı", esc(onaylayan.adSoyad))}
        ${renderRow("T.C. Kimlik No", esc(onaylayan.tc))}
        ${renderRow("Firması/Görevi", esc(onaylayan.firmaGorev || form.suggested_role))}
        ${renderRow("İmzası", esc(onaylayan.imza))}
        ${renderRow("Alınacak Aksiyonlar", esc(onaylayan.aksiyon))}
        ${renderRow("Termin Süresi", esc(onaylayan.termin || `${form.suggested_deadline_days} gün`))}

        ${renderSectionHeader("SONUÇ", "")}
        ${renderRow("Durum", resultRow(form.sonuc))}

        ${renderSectionHeader("FORMU KAPATAN YETKİLİNİN", "Bu bölüm işveren/işveren vekili tarafından doldurulacaktır")}
        ${renderRow("Adı Soyadı", esc(kapatan.adSoyad))}
        ${renderRow("T.C. Kimlik No", esc(kapatan.tc))}
        ${renderRow("Firması/Görevi", esc(kapatan.firmaGorev))}
        ${renderRow("İmzası", esc(kapatan.imza))}
      </table>
    </div>
  `;
}

/**
 * Tek veya çoklu DÖF formunu profesyonel OSGB formu olarak PDF penceresinde açar.
 */
export function exportDofPdf(forms: DofFormData[], title: string) {
  if (typeof window === "undefined" || forms.length === 0) return;

  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) return;

  const formsHtml = forms.map((f, i) => renderFormHtml(f, i)).join("");
  const dateStr = new Date().toLocaleDateString("tr-TR");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${esc(title)}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4; margin: 10mm; }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', Arial, sans-serif;
            color: #111;
            background: #fff;
            font-size: 10px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            margin-bottom: 12px;
            border-bottom: 3px double #d4a017;
          }
          .header-left { font-size: 16px; font-weight: 700; color: #111; }
          .header-left small { display: block; font-size: 9px; font-weight: 400; color: #6b7280; margin-top: 2px; }
          .header-right { text-align: right; font-size: 9px; color: #6b7280; }
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${esc(title)}
            <small>Risk<strong style="color:#d4a017;">Nova</strong> İSG Platformu · ${forms.length} form</small>
          </div>
          <div class="header-right">
            Rapor Tarihi: ${esc(dateStr)}<br>
            Toplam Form: ${forms.length}
          </div>
        </div>
        ${formsHtml}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}

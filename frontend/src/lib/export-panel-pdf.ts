/**
 * Bir HTML element'in içeriğini yeni pencerede açıp yazdırma (PDF) diyalogunu tetikler.
 * Form inputları (input/textarea/select) canlı değerleriyle metne çevrilir.
 * Checkbox/radio ☑/☐ işaretine dönüşür.
 */
export function exportPanelPdf(
  element: HTMLElement | null,
  title: string,
  options: { orientation?: "portrait" | "landscape"; theme?: "dark" | "light" } = {},
) {
  if (typeof window === "undefined" || !element) return;

  const orientation = options.orientation ?? "landscape";
  const theme = options.theme ?? "light";

  const printWindow = window.open("", "_blank", "width=1200,height=1600");
  if (!printWindow) return;

  // Form elemanlarını yazdırma-dostu hale getir.
  // Clone + orijinal eleman listelerini paralel iterasyonla eşle.
  const clone = element.cloneNode(true) as HTMLElement;

  const liveInputs = Array.from(element.querySelectorAll("input"));
  const cloneInputs = Array.from(clone.querySelectorAll("input"));
  cloneInputs.forEach((cloneEl, i) => {
    const live = liveInputs[i] as HTMLInputElement | undefined;
    const type = (cloneEl.getAttribute("type") ?? "text").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      const checked = live?.checked ?? cloneEl.hasAttribute("checked");
      const span = cloneEl.ownerDocument!.createElement("span");
      span.textContent = checked ? "☑ " : "☐ ";
      span.style.cssText = "display:inline-block;margin-right:4px;font-size:15px;";
      cloneEl.replaceWith(span);
    } else {
      const value = live?.value ?? cloneEl.getAttribute("value") ?? "";
      const span = cloneEl.ownerDocument!.createElement("span");
      span.textContent = value || "—";
      span.style.cssText = "display:inline-block;padding:2px 8px;border-bottom:1px solid #999;min-width:140px;font-size:11px;";
      cloneEl.replaceWith(span);
    }
  });

  const liveTextareas = Array.from(element.querySelectorAll("textarea"));
  const cloneTextareas = Array.from(clone.querySelectorAll("textarea"));
  cloneTextareas.forEach((cloneEl, i) => {
    const live = liveTextareas[i] as HTMLTextAreaElement | undefined;
    const value = live?.value ?? cloneEl.textContent ?? "";
    const div = cloneEl.ownerDocument!.createElement("div");
    div.textContent = value || "—";
    div.style.cssText = "white-space:pre-wrap;padding:6px 8px;border:1px solid #ccc;min-height:40px;border-radius:4px;font-size:11px;line-height:1.5;";
    cloneEl.replaceWith(div);
  });

  const liveSelects = Array.from(element.querySelectorAll("select"));
  const cloneSelects = Array.from(clone.querySelectorAll("select"));
  cloneSelects.forEach((cloneEl, i) => {
    const live = liveSelects[i] as HTMLSelectElement | undefined;
    const value = live?.value ?? "";
    const label = live?.selectedOptions?.[0]?.textContent ?? value;
    const span = cloneEl.ownerDocument!.createElement("span");
    span.textContent = label || "—";
    span.style.cssText = "display:inline-block;padding:2px 8px;border-bottom:1px solid #999;min-width:140px;font-size:11px;";
    cloneEl.replaceWith(span);
  });

  // Aksiyonlara bagli butonlari gizle (Sil, PDF, Kaydet gibi)
  clone.querySelectorAll("button").forEach((b) => b.remove());

  const isLight = theme === "light";
  const bg = isLight ? "#ffffff" : "#0a0e1a";
  const fg = isLight ? "#111827" : "#cdd2e8";
  const muted = isLight ? "#f9fafb" : "#1a1f33";
  const border = isLight ? "#d1d5db" : "#2a2f45";
  const heading = isLight ? "#111827" : "#e8ecf4";

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 12mm;
            font-family: Inter, Arial, sans-serif;
            background: ${bg};
            color: ${fg};
            font-size: 11px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-shell { max-width: 100%; margin: 0 auto; }
          h1, h2, h3, h4 { color: ${heading}; }
          h2.pdf-title {
            margin: 0 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #d4a017;
            font-size: 15px;
            color: #d4a017;
          }
          svg { max-width: 100%; height: auto; }
          /* Kart gorunumleri: kagit uyumlu yumusat */
          [class*="rounded"] { border-radius: 4px !important; }
          [class*="border"] { border-color: ${border} !important; }
          [class*="bg-card"], [class*="bg-muted"] { background: ${muted} !important; }
          /* Grid layout'lari korur */
          @page {
            size: A4 ${orientation};
            margin: 8mm;
          }
        </style>
      </head>
      <body>
        <h2 class="pdf-title">${title}</h2>
        <div class="print-shell">${clone.innerHTML}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

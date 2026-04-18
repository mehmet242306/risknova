/**
 * PDF Generator — HTML string'inden PDF Blob üretir.
 *
 * Strateji:
 *  - Off-screen render edilmiş bir iframe'e HTML inject edilir
 *  - html2canvas ile yüksek DPI'da yakalanır
 *  - jspdf ile A4 sayfaya yerleştirilir
 *  - Blob olarak döndürülür
 *
 * Kullanım:
 *   const blob = await generatePdfBlob(htmlBody, "rapor.pdf");
 *   // → Blob (application/pdf)
 *
 * Sonrasında:
 *   - shareOrDownloadPdf(blob, fileName, title) → native share veya download
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface GeneratePdfOptions {
  /** PDF dosya başlığı (metadata) */
  title?: string;
  /** Render kalitesi — yüksek = büyük dosya, daha keskin */
  scale?: number;
}

/**
 * HTML body string'ini PDF Blob'a çevirir.
 *
 * @param htmlBody - tam HTML belgesi (DOCTYPE + html + body içeren)
 * @param options - üretim seçenekleri
 * @returns PDF Blob (application/pdf MIME)
 */
export async function generatePdfBlob(
  htmlBody: string,
  options: GeneratePdfOptions = {},
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("generatePdfBlob: client-side only");
  }

  const scale = options.scale ?? 2;

  // Off-screen iframe oluştur
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-100000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";        // A4 genişlik
  iframe.style.height = "297mm";       // A4 yükseklik
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    // HTML'i iframe'e yaz
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("iframe document erişilemiyor");
    doc.open();
    doc.write(htmlBody);
    doc.close();

    // İçeriğin (özellikle img'lerin) tamamen yüklenmesini bekle
    await waitForIframeLoad(iframe);
    await waitForImages(doc);

    // body genişliği belirsiz ise A4'e zorla
    const body = doc.body;
    if (!body) throw new Error("iframe body bulunamadı");

    // Canvas'a yakala
    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: body.scrollWidth,
      windowHeight: body.scrollHeight,
    });

    // jsPDF — A4 portrait (210 x 297 mm)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    if (options.title) {
      pdf.setProperties({ title: options.title });
    }

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Canvas'ı PDF'e sığdır (oran koru, çok uzun ise birden fazla sayfa)
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}

function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    if (iframe.contentDocument?.readyState === "complete") {
      resolve();
      return;
    }
    iframe.addEventListener("load", () => resolve(), { once: true });
    // güvenlik: 3 sn sonra zorla devam
    setTimeout(resolve, 3000);
  });
}

async function waitForImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
        // güvenlik: 2 sn
        setTimeout(resolve, 2000);
      });
    }),
  );
}

/* ------------------------------------------------------------------ */
/*  Native share / download                                            */
/* ------------------------------------------------------------------ */

interface ShareOrDownloadOptions {
  /** Paylaşım metni (açıklama) */
  shareText?: string;
  /** Paylaşım URL'si — modal'ın da gösterdiği link */
  shareUrl?: string;
  /** Force download — native share atlanır */
  forceDownload?: boolean;
}

/**
 * PDF Blob'u native share API ile paylaşır.
 * Eğer browser destek vermiyorsa veya kullanıcı iptal ederse PDF'i indirir.
 *
 * @returns "shared" | "downloaded" | "cancelled" — kullanıcı feedback için
 */
export async function shareOrDownloadPdf(
  blob: Blob,
  fileName: string,
  title: string,
  options: ShareOrDownloadOptions = {},
): Promise<"shared" | "downloaded" | "cancelled"> {
  if (typeof window === "undefined") return "cancelled";

  const file = new File([blob], fileName, { type: "application/pdf" });

  // Native share — özellikle mobile'da WhatsApp/Mail/AirDrop gibi seçeneklere açılır
  if (
    !options.forceDownload &&
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title,
        text: options.shareText,
        files: [file],
      });
      return "shared";
    } catch (e) {
      // AbortError = kullanıcı iptal etti
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
      // Diğer hatalar için download fallback
      console.warn("Native share başarısız, indirmeye geçiliyor:", e);
    }
  }

  // Fallback: indir
  downloadBlob(blob, fileName);
  return "downloaded";
}

/** PDF Blob'u kullanıcıya indirir (window.URL.createObjectURL). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // URL'yi 1 sn sonra serbest bırak (download tetiklensin)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

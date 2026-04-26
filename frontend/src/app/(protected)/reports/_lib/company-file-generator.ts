"use client";

import type { jsPDF as JsPDFType } from "jspdf";
import type JSZipType from "jszip";
import type { CompanyFileCategory, CompanyFileItem } from "./company-file-collector";

type JsPDF = JsPDFType;

let JsPDFCtor: typeof JsPDFType | null = null;
let JSZipCtor: typeof JSZipType | null = null;
let saveAsFn: ((blob: Blob, name: string) => void) | null = null;

async function ensurePdfLibs(): Promise<void> {
  if (!JsPDFCtor) {
    const mod = await import("jspdf");
    JsPDFCtor = mod.jsPDF;
  }
  if (!JSZipCtor) {
    const mod = await import("jszip");
    JSZipCtor = mod.default;
  }
  if (!saveAsFn) {
    const mod = await import("file-saver");
    saveAsFn = mod.saveAs;
  }
}

// =============================================================================
// Firma Dosyası — PDF + ZIP üretici (client-side)
// =============================================================================
// Seçilen kategoriler için:
//   1. Genel özet PDF'i (tüm firma snapshot'ı)
//   2. Her kategori için bir index PDF'i (kayıt listesi)
//   3. Hepsini ZIP'e paketler, tarayıcıda indirmeyi tetikler
// =============================================================================

export type CompanyFileContext = {
  companyName: string;
  organizationName: string;
  generatedBy?: string | null;
  generatedAt: Date;
};

function asA4(): JsPDF {
  // jsPDF A4: 210 x 297 mm, 72 dpi -> biz mm kullanıyoruz
  return new JsPDFCtor!({ unit: "mm", format: "a4", orientation: "portrait" });
}

function addHeader(doc: JsPDF, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 15, 20);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 15, 27);
    doc.setTextColor(0);
  }
  doc.setDrawColor(180);
  doc.line(15, 32, 195, 32);
}

function addFooter(doc: JsPDF, ctx: CompanyFileContext) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footer = `${ctx.organizationName} · ${ctx.companyName} · ${ctx.generatedAt.toLocaleDateString("tr-TR")} · Sayfa ${i}/${pageCount}`;
    doc.text(footer, 15, 290);
    doc.setTextColor(0);
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR");
  } catch {
    return iso;
  }
}

function wrapText(doc: JsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

// -----------------------------------------------------------------------------
// Özet PDF — tüm firma dosyasına giriş kapağı
// -----------------------------------------------------------------------------

function buildSummaryPdf(categories: CompanyFileCategory[], ctx: CompanyFileContext): Blob {
  const doc = asA4();
  addHeader(doc, "Firma Dosyası", `${ctx.companyName} · ${ctx.organizationName}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 42;

  doc.text("Oluşturulma tarihi: " + ctx.generatedAt.toLocaleString("tr-TR"), 15, y);
  y += 6;
  if (ctx.generatedBy) {
    doc.text("Hazırlayan: " + ctx.generatedBy, 15, y);
    y += 6;
  }
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("İçindekiler", 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const cat of categories) {
    doc.text(`${cat.icon}  ${cat.label}`, 20, y);
    doc.text(String(cat.count), 195, y, { align: "right" });
    y += 7;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const note = wrapText(
    doc,
    "Bu dosya Risknova tarafından otomatik olarak hazırlanmıştır. Her kategori için ayrı bir özet PDF ilgili alt klasörün içinde yer alır. Hassas kişisel verileri içerebilir; KVKK uyarınca saklama ve paylaşım kurallarınıza uyun.",
    175,
  );
  doc.text(note, 15, y);
  doc.setTextColor(0);

  addFooter(doc, ctx);
  return doc.output("blob");
}

// -----------------------------------------------------------------------------
// Kategori index PDF — bir kategorideki tüm kayıtların listesi
// -----------------------------------------------------------------------------

function buildCategoryPdf(
  category: CompanyFileCategory,
  ctx: CompanyFileContext,
): Blob {
  const doc = asA4();
  addHeader(
    doc,
    `${category.icon} ${category.label}`,
    `${category.count} kayıt · ${ctx.companyName}`,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 42;

  if (category.items.length === 0) {
    doc.setTextColor(120);
    doc.text("Bu kategoride kayıt bulunmuyor.", 15, y);
    doc.setTextColor(0);
    addFooter(doc, ctx);
    return doc.output("blob");
  }

  // Header row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 4, 180, 7, "F");
  doc.text("#", 17, y);
  doc.text("Kod / Başlık", 25, y);
  doc.text("Durum", 140, y);
  doc.text("Tarih", 170, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  category.items.forEach((item, i) => {
    if (y > 278) {
      addFooter(doc, ctx);
      doc.addPage();
      y = 20;
    }
    const head = item.code ? `[${item.code}] ` : "";
    const title = head + item.title;
    const titleLines = wrapText(doc, title, 108);
    doc.text(String(i + 1), 17, y);
    doc.text(titleLines, 25, y);
    doc.text((item.status ?? "—").slice(0, 16), 140, y);
    doc.text(formatDate(item.createdAt), 170, y);
    y += Math.max(5, titleLines.length * 4.5) + 1;
  });

  addFooter(doc, ctx);
  return doc.output("blob");
}

// -----------------------------------------------------------------------------
// Ana fonksiyon — ZIP'i oluşturup indirir
// -----------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildItemSnippet(category: CompanyFileCategory, item: CompanyFileItem, ctx: CompanyFileContext): Blob {
  const doc = asA4();
  const head = item.code ? `[${item.code}] ` : "";
  addHeader(doc, `${head}${item.title}`, `${category.label} · ${ctx.companyName}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 42;

  const rows: Array<[string, string]> = [
    ["Kayıt No", item.id],
    ["Durum", item.status ?? "—"],
    ["Oluşturma", formatDate(item.createdAt)],
  ];
  if (item.updatedAt) rows.push(["Son Güncelleme", formatDate(item.updatedAt)]);
  if (item.meta) {
    for (const [k, v] of Object.entries(item.meta)) {
      if (v === null || v === undefined) continue;
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toLocaleUpperCase("tr-TR"));
      const value = typeof v === "object" ? JSON.stringify(v) : String(v);
      rows.push([label, value]);
    }
  }

  for (const [label, value] of rows) {
    if (y > 278) {
      addFooter(doc, ctx);
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", 15, y);
    doc.setFont("helvetica", "normal");
    const lines = wrapText(doc, value, 130);
    doc.text(lines, 60, y);
    y += Math.max(6, lines.length * 4.5) + 1;
  }

  addFooter(doc, ctx);
  return doc.output("blob");
}

export async function downloadCompanyFileZip(options: {
  categories: CompanyFileCategory[];
  selectedIds: Set<string>;
  includePerItemPdf: boolean;
  context: CompanyFileContext;
}): Promise<void> {
  await ensurePdfLibs();
  const selected = options.categories.filter((c) => options.selectedIds.has(c.id));
  const zip = new JSZipCtor!();

  // Genel özet PDF'i
  const summary = buildSummaryPdf(selected, options.context);
  zip.file("00-firma-dosyasi-ozet.pdf", summary);

  // Her kategori için index + opsiyonel detay PDF'leri
  for (const cat of selected) {
    const folder = zip.folder(slugify(cat.label));
    if (!folder) continue;

    const indexPdf = buildCategoryPdf(cat, options.context);
    folder.file("00-index.pdf", indexPdf);

    if (options.includePerItemPdf && cat.items.length > 0) {
      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i];
        const snippet = buildItemSnippet(cat, item, options.context);
        const ordinal = String(i + 1).padStart(3, "0");
        const name = `${ordinal}-${slugify(item.code || item.title || item.id)}.pdf`;
        folder.file(name, snippet);
      }
    }
  }

  const readme = `RiskNova — Firma Dosyası
${options.context.companyName}
Oluşturulma: ${options.context.generatedAt.toLocaleString("tr-TR")}

İçerik:
${selected.map((c) => `- ${c.label} (${c.count} kayıt)`).join("\n")}

Bu dosya otomatik olarak hazırlanmıştır. Hassas veriler içerebilir — KVKK
uyarınca saklama ve paylaşım kurallarına uyun.
`;
  zip.file("README.txt", readme);

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const filename = `firma-dosyasi-${slugify(options.context.companyName)}-${options.context.generatedAt.toISOString().slice(0, 10)}.zip`;
  saveAsFn!(blob, filename);
}

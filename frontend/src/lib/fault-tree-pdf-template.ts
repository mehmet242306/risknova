/**
 * Fault Tree (FTA / Hata Ağacı) PDF rapor template'i.
 *
 * İçerik:
 *  - Shared header
 *  - Hierarchical tree (nested HTML, gate sembolleriyle)
 *  - Düğüm istatistikleri (gate / event sayımı)
 *  - Shared footer
 */

import type { FaultTreeData, FaultTreeNode } from "@/lib/analysis/types";
import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

export interface FaultTreePdfData extends FaultTreeData {
  problemStatement?: string | null;
  analysisSummary?: string | null;
}

const NODE_META: Record<FaultTreeNode["type"], { label: string; symbol: string; color: string; bg: string }> = {
  event:        { label: "Olay",         symbol: "▭",  color: "#1e40af", bg: "#eff6ff" },
  and_gate:     { label: "VE Kapısı",    symbol: "∧",  color: "#7c2d12", bg: "#fef3c7" },
  or_gate:      { label: "VEYA Kapısı",  symbol: "∨",  color: "#7e22ce", bg: "#faf5ff" },
  basic_event:  { label: "Temel Olay",   symbol: "○",  color: "#16a34a", bg: "#f0fdf4" },
};

function renderNode(node: FaultTreeNode, allNodes: FaultTreeNode[], depth = 0, isRoot = false): string {
  const meta = NODE_META[node.type] ?? NODE_META.event;
  const children = node.children
    .map((cid) => allNodes.find((n) => n.id === cid))
    .filter((n): n is FaultTreeNode => Boolean(n));

  const nodeBox = `
    <div style="display:inline-block;padding:6px 10px;border:1.5px solid ${meta.color};background:${meta.bg};border-radius:4px;margin:2px 0;">
      <span style="font-family:monospace;font-size:11px;font-weight:700;color:${meta.color};margin-right:4px;">${meta.symbol}</span>
      <span style="font-size:10px;color:#111;">${esc(node.label)}</span>
      <span style="font-size:8px;color:${meta.color};opacity:0.7;margin-left:6px;">[${esc(meta.label)}]</span>
      ${isRoot ? '<span style="font-size:8px;background:#dc2626;color:#fff;padding:1px 5px;border-radius:3px;margin-left:6px;">ÜST OLAY</span>' : ""}
    </div>`;

  const childrenHtml = children.length === 0
    ? ""
    : `<div style="margin-left:${(depth + 1) * 20}px;border-left:2px dashed #d1d5db;padding-left:10px;margin-top:4px;">
        ${children.map((c) => renderNode(c, allNodes, depth + 1)).join("")}
      </div>`;

  return `
    <div style="margin:4px 0;page-break-inside:avoid;">
      ${nodeBox}
      ${childrenHtml}
    </div>`;
}

type FaultTreeMetaInput = Omit<PdfReportMeta, "reportTitle" | "reportSubtitle"> & Partial<Pick<PdfReportMeta, "reportTitle" | "reportSubtitle">>;

function normalizeFaultTreeMeta(metaInput: FaultTreeMetaInput): PdfReportMeta {
  return {
    reportTitle: metaInput.reportTitle ?? "Hata Ağacı (FTA) Analiz Raporu",
    reportSubtitle: metaInput.reportSubtitle ?? "Üst olay → mantıksal kapılar → temel olaylar hiyerarşisi",
    ...metaInput,
  };
}

export function buildFaultTreePdfHtml(
  data: FaultTreePdfData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  const root = data.nodes?.find((n) => !n.parentId) ?? null;
  const counts = {
    event: data.nodes?.filter((n) => n.type === "event").length ?? 0,
    and_gate: data.nodes?.filter((n) => n.type === "and_gate").length ?? 0,
    or_gate: data.nodes?.filter((n) => n.type === "or_gate").length ?? 0,
    basic_event: data.nodes?.filter((n) => n.type === "basic_event").length ?? 0,
  };

  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${esc(meta.reportTitle)}</title>
    <style>
      ${SHARED_PDF_CSS}
      h3 {
        margin: 14px 0 8px 0; padding: 5px 10px;
        background: #5ae0a0; color: #064e3b;
        font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border-radius: 3px;
        page-break-after: avoid;
      }
      .top-event-box {
        background: #fef2f2; border: 2px solid #dc2626;
        padding: 12px 16px; margin: 8px 0;
        border-radius: 6px; text-align: center;
      }
      .top-event-label {
        font-size: 9px; color: #991b1b; text-transform: uppercase;
        letter-spacing: 0.5px; margin-bottom: 4px;
      }
      .top-event-text { font-size: 14px; font-weight: 700; color: #7f1d1d; }
      .stats-row {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
        margin: 10px 0;
      }
      .stat {
        padding: 8px; background: #f9fafb; border: 1px solid #d1d5db;
        border-radius: 4px; text-align: center;
      }
      .stat-value { font-size: 18px; font-weight: 700; }
      .stat-label { font-size: 8px; color: #6b7280; text-transform: uppercase; margin-top: 2px; }
      .legend-row {
        display: flex; gap: 16px; flex-wrap: wrap;
        font-size: 8.5px; color: #4b5563;
        padding: 8px 12px; background: #f9fafb;
        border-radius: 4px; margin-bottom: 8px;
      }
      .legend-item { display: inline-flex; align-items: center; gap: 4px; }
      .legend-symbol {
        font-family: monospace; font-weight: 700; font-size: 11px;
        padding: 1px 5px; border-radius: 3px;
      }
    </style>
  </head>
  <body>
    ${renderReportHeader(meta)}

    ${data.topEvent ? `
      <div class="top-event-box">
        <div class="top-event-label">⚠ Üst Olay (Top Event)</div>
        <div class="top-event-text">${esc(data.topEvent)}</div>
      </div>` : ""}

    <div class="stats-row">
      <div class="stat" style="border-left:3px solid ${NODE_META.event.color};">
        <div class="stat-value" style="color:${NODE_META.event.color};">${counts.event}</div>
        <div class="stat-label">Olay</div>
      </div>
      <div class="stat" style="border-left:3px solid ${NODE_META.and_gate.color};">
        <div class="stat-value" style="color:${NODE_META.and_gate.color};">${counts.and_gate}</div>
        <div class="stat-label">VE Kapısı</div>
      </div>
      <div class="stat" style="border-left:3px solid ${NODE_META.or_gate.color};">
        <div class="stat-value" style="color:${NODE_META.or_gate.color};">${counts.or_gate}</div>
        <div class="stat-label">VEYA Kapısı</div>
      </div>
      <div class="stat" style="border-left:3px solid ${NODE_META.basic_event.color};">
        <div class="stat-value" style="color:${NODE_META.basic_event.color};">${counts.basic_event}</div>
        <div class="stat-label">Temel Olay</div>
      </div>
    </div>

    <h3>Sembol Açıklamaları</h3>
    <div class="legend-row">
      ${(Object.entries(NODE_META) as [FaultTreeNode["type"], typeof NODE_META.event][]).map(([, m]) => `
        <span class="legend-item">
          <span class="legend-symbol" style="background:${m.bg};color:${m.color};border:1px solid ${m.color};">${m.symbol}</span>
          ${esc(m.label)}
        </span>
      `).join("")}
    </div>

    <h3>Hata Ağacı Yapısı</h3>
    ${root
      ? renderNode(root, data.nodes ?? [], 0, true)
      : '<div style="padding:14px;background:#fef3c7;border-left:4px solid #d4a017;font-size:10px;color:#7c2d12;">Hata ağacı düğümleri henüz tanımlanmamış.</div>'}

    ${data.analysisSummary ? `
      <h3>Analiz Özeti</h3>
      <div style="background:#f9fafb;border:1px solid #d1d5db;border-left:4px solid #5ae0a0;padding:10px 14px;font-size:11px;line-height:1.55;">
        ${esc(data.analysisSummary)}
      </div>` : ""}

    ${renderReportFooter(meta, qrDataUrl)}
  </body>
</html>`;
}

export async function exportFaultTreePdf(data: FaultTreePdfData, metaInput: FaultTreeMetaInput): Promise<void> {
  if (typeof window === "undefined") return;
  const meta = normalizeFaultTreeMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildFaultTreePdfHtml(data, meta, qrDataUrl);
  const printWindow = window.open("", "_blank", "width=1100,height=1400");
  if (!printWindow) { alert("Yazıcı penceresi açılamadı."); return; }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

export async function exportFaultTreePdfBlob(data: FaultTreePdfData, metaInput: FaultTreeMetaInput): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("client-side only");
  const meta = normalizeFaultTreeMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildFaultTreePdfHtml(data, meta, qrDataUrl);
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}

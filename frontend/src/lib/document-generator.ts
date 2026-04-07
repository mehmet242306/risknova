/**
 * Document generator: converts TipTap JSON directly into professional DOCX files.
 * No markdown intermediate step — real Word tables, formatting, headers/footers.
 */

import PptxGenJS from "pptxgenjs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ShadingType,
  convertInchesToTwip,
  LevelFormat,
  TabStopPosition,
  TabStopType,
} from "docx";
import { saveAs } from "file-saver";
import type { JSONContent } from "@tiptap/react";
import type { CompanyVariableData } from "./document-variables";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DocumentBlock {
  title: string;
  type: "docx" | "pptx";
  content: string; // kept for pptx backward compat
}

export interface DocxExportOptions {
  title: string;
  json: JSONContent;
  companyData?: CompanyVariableData;
  companyName?: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const BRAND_GOLD = "D4A017";
const DARK_TEXT = "0F172A";
const GRAY_TEXT = "64748B";
const BORDER_COLOR = "CCCCCC";
const HEADER_BG = "F1F5F9";
const FONT = "Arial";

const FONT_SIZES = {
  title: 32,
  h1: 28,
  h2: 24,
  h3: 20,
  body: 22,
  small: 18,
  footer: 16,
} as const;

/* ------------------------------------------------------------------ */
/* TipTap JSON → docx Paragraph/Table conversion                       */
/* ------------------------------------------------------------------ */

function resolveVarsInText(text: string, data?: CompanyVariableData): string {
  if (!data || !text) return text || "";
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const MONTHS_TR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

  const map: Record<string, string> = {
    firma_adi: data.official_name || "",
    firma_adresi: data.address || "",
    firma_sehir: data.city || "",
    firma_ilce: data.district || "",
    vergi_no: data.tax_number || "",
    mersis_no: data.mersis_number || "",
    sektor: data.sector || "",
    nace_kodu: data.nace_code || "",
    tehlike_sinifi: data.hazard_class || "",
    sgk_sicil_no: "",
    personel_sayisi: data.employee_count?.toString() || "",
    erkek_personel: data.male_count?.toString() || "",
    kadin_personel: data.female_count?.toString() || "",
    departman_sayisi: data.department_count?.toString() || "",
    isveren_adi: data.employer_name || "",
    isveren_vekili: data.employer_rep || "",
    bugun: fmt(now),
    ay_yil: `${MONTHS_TR[now.getMonth()]} ${now.getFullYear()}`,
    yil: now.getFullYear().toString(),
    bir_yil_sonra: fmt(oneYearLater),
    rapor_tarihi: fmt(now),
    toplam_risk_sayisi: data.total_risks?.toString() || "",
    yuksek_risk_sayisi: data.high_risks?.toString() || "",
    orta_risk_sayisi: data.medium_risks?.toString() || "",
    dusuk_risk_sayisi: data.low_risks?.toString() || "",
    genel_risk_skoru: data.overall_score?.toString() || "",
    uzman_adi: data.specialist_name || "",
    uzman_sinifi: data.specialist_class || "",
    uzman_belge_no: data.specialist_cert_no || "",
    isyeri_hekimi: data.physician_name || "",
    hekim_diploma_no: data.physician_cert_no || "",
  };

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return map[key] !== undefined ? (map[key] || match) : match;
  });
}

/** Convert TipTap text marks to docx TextRun options */
function marksToRunOptions(
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
): Partial<{
  bold: boolean;
  italics: boolean;
  underline: { type: "single" };
  strike: boolean;
  color: string;
  shading: { type: typeof ShadingType.CLEAR; fill: string };
  size: number;
  font: string;
}> {
  const opts: Record<string, unknown> = {};
  if (!marks) return opts;

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        opts.bold = true;
        break;
      case "italic":
        opts.italics = true;
        break;
      case "underline":
        opts.underline = { type: "single" as const };
        break;
      case "strike":
        opts.strike = true;
        break;
      case "textStyle": {
        if (mark.attrs?.color) {
          const c = (mark.attrs.color as string).replace("#", "");
          opts.color = c;
        }
        if (mark.attrs?.fontSize) {
          const fs = parseInt(mark.attrs.fontSize as string, 10);
          if (fs) opts.size = fs * 2; // docx uses half-points
        }
        break;
      }
      case "highlight": {
        const bg = (mark.attrs?.color as string) || "#FFFF00";
        opts.shading = { type: ShadingType.CLEAR, fill: bg.replace("#", "") };
        break;
      }
    }
  }
  return opts;
}

/** Convert inline content (text nodes with marks) to TextRun[] */
function inlineToRuns(
  node: JSONContent,
  companyData?: CompanyVariableData,
  defaultSize?: number
): TextRun[] {
  if (!node.content) {
    // Empty paragraph
    return [new TextRun({ text: "", size: defaultSize || FONT_SIZES.body, font: FONT })];
  }

  const runs: TextRun[] = [];
  for (const child of node.content) {
    if (child.type === "text" && child.text) {
      const resolved = resolveVarsInText(child.text, companyData);
      const markOpts = marksToRunOptions(child.marks as Array<{ type: string; attrs?: Record<string, unknown> }>);
      runs.push(
        new TextRun({
          text: resolved,
          size: (markOpts.size as number) || defaultSize || FONT_SIZES.body,
          font: FONT,
          ...markOpts,
        })
      );
    } else if (child.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1, size: defaultSize || FONT_SIZES.body, font: FONT }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: "", size: defaultSize || FONT_SIZES.body, font: FONT }));
  }

  return runs;
}

/** Get alignment from node attrs */
function getAlignment(node: JSONContent): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = node.attrs?.textAlign as string;
  switch (align) {
    case "center": return AlignmentType.CENTER;
    case "right": return AlignmentType.RIGHT;
    case "justify": return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

/** Standard cell border */
const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

/** Convert a TipTap table node to a docx Table */
function tableNodeToDocx(
  node: JSONContent,
  companyData?: CompanyVariableData
): Table {
  const rows: TableRow[] = [];

  if (node.content) {
    for (let rowIdx = 0; rowIdx < node.content.length; rowIdx++) {
      const rowNode = node.content[rowIdx];
      if (!rowNode.content) continue;

      const cells: TableCell[] = [];
      const isHeaderRow = rowIdx === 0 || rowNode.content.some(c => c.type === "tableHeader");

      for (const cellNode of rowNode.content) {
        const isHeader = cellNode.type === "tableHeader" || isHeaderRow;
        const cellParagraphs: Paragraph[] = [];

        if (cellNode.content) {
          for (const cellChild of cellNode.content) {
            const runs = inlineToRuns(cellChild, companyData, FONT_SIZES.body);
            if (isHeader) {
              // Make header text bold
              for (const run of runs) {
                // We re-create with bold
              }
            }
            cellParagraphs.push(
              new Paragraph({
                children: isHeader
                  ? runs.map(r => {
                      // Extract text from run — rebuild as bold
                      return new TextRun({
                        text: (r as unknown as { options: { text: string } }).options?.text || "",
                        bold: true,
                        size: FONT_SIZES.body,
                        font: FONT,
                        color: DARK_TEXT,
                      });
                    })
                  : runs,
                spacing: { before: 40, after: 40 },
                alignment: getAlignment(cellChild),
              })
            );
          }
        }

        if (cellParagraphs.length === 0) {
          cellParagraphs.push(new Paragraph({ children: [new TextRun({ text: "", size: FONT_SIZES.body, font: FONT })] }));
        }

        const colspan = (cellNode.attrs?.colspan as number) || 1;
        const rowspan = (cellNode.attrs?.rowspan as number) || 1;

        cells.push(
          new TableCell({
            children: cellParagraphs,
            borders: cellBorder,
            columnSpan: colspan,
            rowSpan: rowspan,
            shading: isHeader
              ? { type: ShadingType.CLEAR, fill: HEADER_BG }
              : undefined,
            margins: {
              top: convertInchesToTwip(0.04),
              bottom: convertInchesToTwip(0.04),
              left: convertInchesToTwip(0.08),
              right: convertInchesToTwip(0.08),
            },
          })
        );
      }

      rows.push(new TableRow({ children: cells, tableHeader: isHeaderRow }));
    }
  }

  // Calculate column count from first row
  const colCount = node.content?.[0]?.content?.length || 1;

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array(colCount).fill(Math.floor(9000 / colCount)),
  });
}

/** Convert a single TipTap node to docx elements (Paragraph | Table) */
function nodeToDocx(
  node: JSONContent,
  companyData?: CompanyVariableData
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) || 1;
      const headingMap: Record<number, { docxLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel]; size: number }> = {
        1: { docxLevel: HeadingLevel.HEADING_1, size: FONT_SIZES.h1 },
        2: { docxLevel: HeadingLevel.HEADING_2, size: FONT_SIZES.h2 },
        3: { docxLevel: HeadingLevel.HEADING_3, size: FONT_SIZES.h3 },
      };
      const cfg = headingMap[level] || headingMap[1];
      const runs = inlineToRuns(node, companyData, cfg.size);

      elements.push(
        new Paragraph({
          children: runs.map(r => {
            const text = (r as unknown as { options: { text: string } }).options?.text || "";
            const origOpts = (r as unknown as { options: Record<string, unknown> }).options || {};
            return new TextRun({
              text,
              bold: true,
              size: cfg.size,
              font: FONT,
              color: (origOpts.color as string) || DARK_TEXT,
            });
          }),
          heading: cfg.docxLevel,
          alignment: getAlignment(node),
          spacing: { before: level === 1 ? 400 : 300, after: level === 1 ? 200 : 100 },
        })
      );
      break;
    }

    case "paragraph": {
      const runs = inlineToRuns(node, companyData);
      elements.push(
        new Paragraph({
          children: runs,
          alignment: getAlignment(node),
          spacing: { after: 80 },
        })
      );
      break;
    }

    case "bulletList": {
      if (node.content) {
        for (const li of node.content) {
          // Each listItem has paragraph children
          if (li.content) {
            for (const child of li.content) {
              const runs = inlineToRuns(child, companyData);
              elements.push(
                new Paragraph({
                  children: runs,
                  bullet: { level: 0 },
                  spacing: { after: 60 },
                  alignment: getAlignment(child),
                })
              );
            }
          }
        }
      }
      break;
    }

    case "orderedList": {
      if (node.content) {
        for (let i = 0; i < node.content.length; i++) {
          const li = node.content[i];
          if (li.content) {
            for (const child of li.content) {
              const runs = inlineToRuns(child, companyData);
              elements.push(
                new Paragraph({
                  children: runs,
                  numbering: { reference: "default-numbering", level: 0 },
                  spacing: { after: 60 },
                  alignment: getAlignment(child),
                })
              );
            }
          }
        }
      }
      break;
    }

    case "blockquote": {
      if (node.content) {
        for (const child of node.content) {
          const runs = inlineToRuns(child, companyData);
          elements.push(
            new Paragraph({
              children: runs.map(r => {
                const text = (r as unknown as { options: { text: string } }).options?.text || "";
                return new TextRun({
                  text,
                  italics: true,
                  size: FONT_SIZES.body,
                  font: FONT,
                  color: GRAY_TEXT,
                });
              }),
              indent: { left: convertInchesToTwip(0.5) },
              border: {
                left: { style: BorderStyle.SINGLE, size: 6, color: BRAND_GOLD },
              },
              spacing: { before: 80, after: 80 },
            })
          );
        }
      }
      break;
    }

    case "horizontalRule": {
      elements.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
          },
          spacing: { before: 200, after: 200 },
        })
      );
      break;
    }

    case "table": {
      elements.push(tableNodeToDocx(node, companyData));
      // Add small spacing after table
      elements.push(new Paragraph({ spacing: { after: 100 } }));
      break;
    }

    default: {
      // Fallback: try to extract text
      const runs = inlineToRuns(node, companyData);
      if (runs.length > 0) {
        elements.push(
          new Paragraph({
            children: runs,
            spacing: { after: 80 },
          })
        );
      }
      break;
    }
  }

  return elements;
}

/** Convert full TipTap JSON to docx elements */
function tiptapJsonToDocx(
  json: JSONContent,
  companyData?: CompanyVariableData
): (Paragraph | Table)[] {
  if (!json.content) return [];

  const elements: (Paragraph | Table)[] = [];
  for (const node of json.content) {
    elements.push(...nodeToDocx(node, companyData));
  }
  return elements;
}

/* ------------------------------------------------------------------ */
/* Professional DOCX Generator (from TipTap JSON)                      */
/* ------------------------------------------------------------------ */

export async function generateDocxFromTipTap(opts: DocxExportOptions): Promise<void> {
  const { title, json, companyData, companyName } = opts;
  const resolvedTitle = resolveVarsInText(title, companyData);
  const displayCompany = companyName || companyData?.official_name || "";

  // Convert content
  const contentElements = tiptapJsonToDocx(json, companyData);

  // Build title section
  const titleSection: (Paragraph | Table)[] = [
    // Document title
    new Paragraph({
      children: [
        new TextRun({
          text: resolvedTitle,
          bold: true,
          size: FONT_SIZES.title,
          font: FONT,
          color: BRAND_GOLD,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 },
    }),
  ];

  // Company name subtitle (if available)
  if (displayCompany) {
    titleSection.push(
      new Paragraph({
        children: [
          new TextRun({
            text: displayCompany,
            size: FONT_SIZES.h2,
            font: FONT,
            color: DARK_TEXT,
          }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  // Date line
  titleSection.push(
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          size: FONT_SIZES.small,
          font: FONT,
          color: GRAY_TEXT,
          italics: true,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Gold divider line
  titleSection.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 3, color: BRAND_GOLD },
      },
      spacing: { after: 300 },
    })
  );

  const document = new Document({
    creator: "RiskNova",
    title: resolvedTitle,
    description: displayCompany ? `${resolvedTitle} - ${displayCompany}` : resolvedTitle,
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "RiskNova",
                    bold: true,
                    size: FONT_SIZES.footer,
                    font: FONT,
                    color: BRAND_GOLD,
                  }),
                  new TextRun({
                    text: displayCompany ? `  |  ${displayCompany}` : "",
                    size: FONT_SIZES.footer,
                    font: FONT,
                    color: GRAY_TEXT,
                  }),
                ],
                alignment: AlignmentType.LEFT,
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                },
                spacing: { after: 200 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: resolvedTitle,
                    size: FONT_SIZES.footer,
                    font: FONT,
                    color: GRAY_TEXT,
                  }),
                  new TextRun({
                    children: ["\t"],
                    size: FONT_SIZES.footer,
                  }),
                  new TextRun({
                    text: "Sayfa ",
                    size: FONT_SIZES.footer,
                    font: FONT,
                    color: GRAY_TEXT,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: FONT_SIZES.footer,
                    font: FONT,
                    color: GRAY_TEXT,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
                },
                spacing: { before: 200 },
                tabStops: [
                  { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
                ],
              }),
            ],
          }),
        },
        children: [...titleSection, ...contentElements],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const fileName = resolvedTitle
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\s_-]/g, "")
    .replace(/\s+/g, "_");
  saveAs(blob, `${fileName}.docx`);
}

/* ------------------------------------------------------------------ */
/* Legacy DOCX Generator (from markdown string — kept for back-compat) */
/* ------------------------------------------------------------------ */

export async function generateDocx(doc: DocumentBlock): Promise<void> {
  const lines = doc.content.split("\n");
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: doc.title, bold: true, size: 36, font: FONT, color: BRAND_GOLD }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    }),
  );

  // Subtitle line
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `RiskNova - ${new Date().toLocaleDateString("tr-TR")}`,
          size: 20, font: FONT, color: GRAY_TEXT, italics: true,
        }),
      ],
      spacing: { after: 400 },
    }),
  );

  // Content
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 100 } }));
      i++;
      continue;
    }

    // Detect markdown table (| ... | pattern)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const row = lines[i].trim();
        // Skip separator rows like |---|---|
        if (/^\|[\s\-:]+\|$/.test(row.replace(/\|/g, m => m).replace(/[|\s\-:]/g, ""))) {
          i++;
          continue;
        }
        if (/^[\|\s\-:]+$/.test(row)) {
          i++;
          continue;
        }
        const cells = row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        tableRows.push(cells);
        i++;
      }

      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map(r => r.length));
        const rows = tableRows.map((rowCells, rowIdx) => {
          const isHeader = rowIdx === 0;
          const cells = [];
          for (let c = 0; c < colCount; c++) {
            cells.push(
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: rowCells[c] || "",
                        bold: isHeader,
                        size: FONT_SIZES.body,
                        font: FONT,
                      }),
                    ],
                    spacing: { before: 40, after: 40 },
                  }),
                ],
                borders: cellBorder,
                shading: isHeader ? { type: ShadingType.CLEAR, fill: HEADER_BG } : undefined,
                margins: {
                  top: convertInchesToTwip(0.04),
                  bottom: convertInchesToTwip(0.04),
                  left: convertInchesToTwip(0.08),
                  right: convertInchesToTwip(0.08),
                },
              })
            );
          }
          return new TableRow({ children: cells, tableHeader: isHeader });
        });

        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }) as unknown as Paragraph // type workaround for mixed array
        );
        children.push(new Paragraph({ spacing: { after: 100 } }));
      }
      continue;
    }

    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const level = trimmed.startsWith("### ") ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
      const text = trimmed.replace(/^#+\s*/, "");
      children.push(
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_2 ? 28 : 24, font: FONT, color: DARK_TEXT })],
          heading: level,
          spacing: { before: 300, after: 100 },
        }),
      );
    } else if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 32, font: FONT, color: DARK_TEXT })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
    } else if (trimmed === "---") {
      // Horizontal rule as a bottom border paragraph
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
          },
          spacing: { before: 200, after: 200 },
        }),
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/^[-*]\s*/, ""), size: 22, font: FONT })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22, font: FONT })],
          spacing: { after: 60 },
        }),
      );
    } else if (trimmed.startsWith("> ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(2), size: 22, font: FONT, italics: true, color: GRAY_TEXT })],
          indent: { left: 720 },
          spacing: { after: 80 },
        }),
      );
    } else {
      // Parse bold markers **text**
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      const runs = parts.map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return new TextRun({ text: part.slice(2, -2), bold: true, size: 22, font: FONT });
        }
        return new TextRun({ text: part, size: 22, font: FONT });
      });
      children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
    }

    i++;
  }

  const document = new Document({
    creator: "RiskNova",
    title: doc.title,
    sections: [{ children: children as Paragraph[] }],
  });

  const blob = await Packer.toBlob(document);
  const fileName = doc.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\s_-]/g, "").replace(/\s+/g, "_");
  saveAs(blob, `${fileName}.docx`);
}

/* ------------------------------------------------------------------ */
/* PPTX Generator (unchanged)                                          */
/* ------------------------------------------------------------------ */

/** Split markdown-ish content into slide-sized sections */
function splitIntoSlides(content: string): { heading: string; bullets: string[] }[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const slides: { heading: string; bullets: string[] }[] = [];
  let current: { heading: string; bullets: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("### ") || line.startsWith("# ")) {
      if (current) slides.push(current);
      current = { heading: line.replace(/^#+\s*/, ""), bullets: [] };
    } else if (line.startsWith("- ") || line.startsWith("* ") || /^\d+\.\s/.test(line)) {
      if (!current) current = { heading: "", bullets: [] };
      current.bullets.push(line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));
    } else {
      if (!current) current = { heading: "", bullets: [] };
      current.bullets.push(line);
    }
  }
  if (current) slides.push(current);

  if (slides.length === 0) {
    slides.push({ heading: "", bullets: content.split("\n").filter((l) => l.trim()) });
  }

  return slides;
}

export async function generatePptx(doc: DocumentBlock): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.title = doc.title;
  pptx.author = "RiskNova";
  pptx.layout = "LAYOUT_WIDE";

  const PRIMARY = "D4A017";
  const DARK_BG = "0F172A";
  const WHITE = "FFFFFF";
  const LIGHT_GRAY = "94A3B8";

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: DARK_BG };
  titleSlide.addText("RiskNova", {
    x: 0.5, y: 0.3, w: "90%", fontSize: 14, color: PRIMARY, fontFace: "Arial", bold: true,
  });
  titleSlide.addText(doc.title, {
    x: 0.5, y: 1.8, w: "90%", fontSize: 32, color: WHITE, fontFace: "Arial", bold: true, align: "left",
  });
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 3.3, w: 2.0, h: 0.05, fill: { color: PRIMARY },
  });
  titleSlide.addText(new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" }), {
    x: 0.5, y: 3.6, w: "90%", fontSize: 12, color: LIGHT_GRAY, fontFace: "Arial",
  });

  const slides = splitIntoSlides(doc.content);
  for (const section of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: DARK_BG };
    slide.addText("RiskNova", {
      x: 10.5, y: 0.15, w: 2.5, fontSize: 10, color: PRIMARY, fontFace: "Arial", bold: true, align: "right",
    });

    if (section.heading) {
      slide.addText(section.heading, {
        x: 0.5, y: 0.4, w: "90%", fontSize: 24, color: WHITE, fontFace: "Arial", bold: true,
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 1.1, w: 1.5, h: 0.04, fill: { color: PRIMARY },
      });
    }

    if (section.bullets.length > 0) {
      const yStart = section.heading ? 1.4 : 0.5;
      const textRows = section.bullets.map((b) => ({
        text: b,
        options: {
          fontSize: 16, color: WHITE, fontFace: "Arial" as const,
          bullet: { type: "bullet" as const, color: PRIMARY },
          paraSpaceAfter: 8,
        },
      }));
      slide.addText(textRows, { x: 0.5, y: yStart, w: "90%", h: 5.5 - yStart, valign: "top" });
    }

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 7.2, w: "100%", h: 0.05, fill: { color: PRIMARY },
    });
  }

  const fileName = doc.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\s_-]/g, "").replace(/\s+/g, "_");
  await pptx.writeFile({ fileName: `${fileName}.pptx` });
}

/* ------------------------------------------------------------------ */
/* Unified download                                                    */
/* ------------------------------------------------------------------ */

export async function downloadDocument(doc: DocumentBlock): Promise<void> {
  if (doc.type === "pptx") {
    await generatePptx(doc);
  } else {
    await generateDocx(doc);
  }
}

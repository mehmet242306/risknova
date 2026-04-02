/**
 * Document generator: converts AI-produced <<<DOCUMENT>>> blocks
 * into downloadable PPTX / DOCX files in the browser.
 */

import PptxGenJS from "pptxgenjs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DocumentBlock {
  title: string;
  type: "docx" | "pptx";
  content: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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

  // If nothing was parsed, put everything in one slide
  if (slides.length === 0) {
    slides.push({ heading: "", bullets: content.split("\n").filter((l) => l.trim()) });
  }

  return slides;
}

/* ------------------------------------------------------------------ */
/* PPTX Generator                                                      */
/* ------------------------------------------------------------------ */

export async function generatePptx(doc: DocumentBlock): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.title = doc.title;
  pptx.author = "RiskNova";
  pptx.layout = "LAYOUT_WIDE";

  // Brand colors
  const PRIMARY = "D4A017";
  const DARK_BG = "0F172A";
  const WHITE = "FFFFFF";
  const LIGHT_GRAY = "94A3B8";

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: DARK_BG };
  titleSlide.addText("RiskNova", {
    x: 0.5,
    y: 0.3,
    w: "90%",
    fontSize: 14,
    color: PRIMARY,
    fontFace: "Arial",
    bold: true,
  });
  titleSlide.addText(doc.title, {
    x: 0.5,
    y: 1.8,
    w: "90%",
    fontSize: 32,
    color: WHITE,
    fontFace: "Arial",
    bold: true,
    align: "left",
  });
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 3.3,
    w: 2.0,
    h: 0.05,
    fill: { color: PRIMARY },
  });
  titleSlide.addText(new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" }), {
    x: 0.5,
    y: 3.6,
    w: "90%",
    fontSize: 12,
    color: LIGHT_GRAY,
    fontFace: "Arial",
  });

  // Content slides
  const slides = splitIntoSlides(doc.content);
  for (const section of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: DARK_BG };

    // RiskNova watermark
    slide.addText("RiskNova", {
      x: 10.5,
      y: 0.15,
      w: 2.5,
      fontSize: 10,
      color: PRIMARY,
      fontFace: "Arial",
      bold: true,
      align: "right",
    });

    // Heading
    if (section.heading) {
      slide.addText(section.heading, {
        x: 0.5,
        y: 0.4,
        w: "90%",
        fontSize: 24,
        color: WHITE,
        fontFace: "Arial",
        bold: true,
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 1.1,
        w: 1.5,
        h: 0.04,
        fill: { color: PRIMARY },
      });
    }

    // Bullets
    if (section.bullets.length > 0) {
      const yStart = section.heading ? 1.4 : 0.5;
      const textRows = section.bullets.map((b) => ({
        text: b,
        options: {
          fontSize: 16,
          color: WHITE,
          fontFace: "Arial" as const,
          bullet: { type: "bullet" as const, color: PRIMARY },
          paraSpaceAfter: 8,
        },
      }));

      slide.addText(textRows, {
        x: 0.5,
        y: yStart,
        w: "90%",
        h: 5.5 - yStart,
        valign: "top",
      });
    }

    // Bottom bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 7.2,
      w: "100%",
      h: 0.05,
      fill: { color: PRIMARY },
    });
  }

  // Download
  const fileName = doc.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\s_-]/g, "").replace(/\s+/g, "_");
  await pptx.writeFile({ fileName: `${fileName}.pptx` });
}

/* ------------------------------------------------------------------ */
/* DOCX Generator                                                      */
/* ------------------------------------------------------------------ */

export async function generateDocx(doc: DocumentBlock): Promise<void> {
  const lines = doc.content.split("\n");
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: doc.title, bold: true, size: 36, font: "Arial", color: "D4A017" }),
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
          size: 20,
          font: "Arial",
          color: "64748B",
          italics: true,
        }),
      ],
      spacing: { after: 400 },
    }),
  );

  // Content
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const level = trimmed.startsWith("### ") ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
      const text = trimmed.replace(/^#+\s*/, "");
      children.push(
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_2 ? 28 : 24, font: "Arial", color: "0F172A" })],
          heading: level,
          spacing: { before: 300, after: 100 },
        }),
      );
    } else if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 32, font: "Arial", color: "0F172A" })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/^[-*]\s*/, ""), size: 22, font: "Arial" })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22, font: "Arial" })],
          spacing: { after: 60 },
        }),
      );
    } else if (trimmed.startsWith("> ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(2), size: 22, font: "Arial", italics: true, color: "64748B" })],
          indent: { left: 720 },
          spacing: { after: 80 },
        }),
      );
    } else {
      // Parse bold markers **text**
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      const runs = parts.map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return new TextRun({ text: part.slice(2, -2), bold: true, size: 22, font: "Arial" });
        }
        return new TextRun({ text: part, size: 22, font: "Arial" });
      });
      children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
    }
  }

  const document = new Document({
    creator: "RiskNova",
    title: doc.title,
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(document);
  const fileName = doc.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\s_-]/g, "").replace(/\s+/g, "_");
  saveAs(blob, `${fileName}.docx`);
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

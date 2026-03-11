import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";

export const runtime = "nodejs";

type RawRow = Record<string, unknown>;

function getValue(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function toBool(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["evet", "e", "1", "true", "var", "yes"].includes(normalized);
}

function normalizeRows(rows: RawRow[]) {
  const normalizedRows = rows.map((row, index) => {
    const fullName = getValue(row, ["Ad Soyad", "Adı Soyadı", "AdSoyad", "Full Name"]);
    const title = getValue(row, ["Görev", "Unvan", "Pozisyon", "Title"]);
    const unit = getValue(row, ["Birim", "Departman", "Unit", "Department"]);
    const startDate = getValue(row, ["İşe Giriş", "İşe Giriş Tarihi", "Start Date"]);
    const shift = getValue(row, ["Vardiya", "Çalışma Düzeni", "Shift"]);
    const specialPolicyRaw = getValue(row, ["Özel Politika Durumu", "Özel Politika", "ÖPGÇ", "Special Policy"]);
    const note = getValue(row, ["Not", "Açıklama", "Remarks"]);

    return {
      sourceRow: index + 2,
      fullName,
      title,
      unit,
      startDate,
      shift,
      specialPolicy: toBool(specialPolicyRaw),
      note,
    };
  });

  const validRows = normalizedRows.filter((row) => row.fullName !== "");
  const specialPolicyCount = validRows.filter((row) => row.specialPolicy).length;

  return {
    totalRows: validRows.length,
    specialPolicyCount,
    rows: validRows,
  };
}

async function parseXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel sayfası okunamadı.");
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: RawRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: RawRow = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = cell.text ?? "";
      }
    });

    rows.push(record);
  });

  return normalizeRows(rows);
}

function parseCsv(text: string) {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error("CSV dosyası okunamadı.");
  }

  return normalizeRows(result.data);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let parsed;

    if (fileName.endsWith(".xlsx")) {
      parsed = await parseXlsx(buffer);
    } else if (fileName.endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      parsed = parseCsv(text);
    } else {
      return NextResponse.json(
        { error: "Sadece .xlsx ve .csv dosyaları desteklenir." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      totalRows: parsed.totalRows,
      specialPolicyCount: parsed.specialPolicyCount,
      rows: parsed.rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Dosya işlenirken hata oluştu." },
      { status: 500 }
    );
  }
}
"use client";

import { useState } from "react";

type ImportedEmployee = {
  sourceRow: number;
  fullName: string;
  title: string;
  unit: string;
  startDate: string;
  shift: string;
  specialPolicy: boolean;
  note: string;
};

type ImportResponse = {
  fileName: string;
  totalRows: number;
  specialPolicyCount: number;
  rows: ImportedEmployee[];
  error?: string;
};

export default function EmployeeImportPanel({ companyName }: { companyName: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!file) {
      setError("Lütfen bir Excel veya CSV dosyası seçin.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import-employees", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "İçe aktarma başarısız oldu.");
      } else {
        setData(result);
      }
    } catch {
      setError("Sunucuya bağlanırken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
        Excel / CSV Personel İçe Aktarma
      </div>

      <div style={{ opacity: 0.8, lineHeight: 1.7, marginBottom: 14 }}>
        {companyName} için personel listesini Excel veya CSV olarak yükleyebilirsin.
        Bu aşamada yüklenen veri önizleme olarak gösterilir; kalıcı kayıt daha sonra eklenecek.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 12,
          }}
        />

        <button
          onClick={handleImport}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fafafa",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Yükleniyor..." : "İçe Aktar"}
        </button>
      </div>

      <div
        style={{
          border: "1px dashed #ddd",
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
          background: "#fcfcfc",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Beklenen kolonlar</div>
        <div style={{ opacity: 0.75, lineHeight: 1.8 }}>
          Ad Soyad, Görev, Birim, İşe Giriş, Vardiya, Özel Politika Durumu, Not
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            background: "#fff4f4",
            border: "1px solid #f2d3d3",
            color: "#8b1e1e",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}

      {data ? (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Dosya</div>
              <div style={{ fontWeight: 800 }}>{data.fileName}</div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Aktarılan Satır</div>
              <div style={{ fontWeight: 800 }}>{data.totalRows}</div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Özel Politika Gerektiren</div>
              <div style={{ fontWeight: 800 }}>{data.specialPolicyCount}</div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                  <th style={{ padding: "10px 8px" }}>Satır</th>
                  <th style={{ padding: "10px 8px" }}>Ad Soyad</th>
                  <th style={{ padding: "10px 8px" }}>Görev</th>
                  <th style={{ padding: "10px 8px" }}>Birim</th>
                  <th style={{ padding: "10px 8px" }}>İşe Giriş</th>
                  <th style={{ padding: "10px 8px" }}>Vardiya</th>
                  <th style={{ padding: "10px 8px" }}>Özel Politika</th>
                  <th style={{ padding: "10px 8px" }}>Not</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={{ padding: "10px 8px" }}>{row.sourceRow}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 700 }}>{row.fullName}</td>
                    <td style={{ padding: "10px 8px" }}>{row.title}</td>
                    <td style={{ padding: "10px 8px" }}>{row.unit}</td>
                    <td style={{ padding: "10px 8px" }}>{row.startDate}</td>
                    <td style={{ padding: "10px 8px" }}>{row.shift}</td>
                    <td style={{ padding: "10px 8px" }}>{row.specialPolicy ? "Evet" : "Hayır"}</td>
                    <td style={{ padding: "10px 8px" }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
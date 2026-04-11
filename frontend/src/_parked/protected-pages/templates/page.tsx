"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { documentTemplates, type TemplateCategory, type TemplateStatus, type TemplateTarget } from "@/lib/template-data";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 18,
        padding: 18,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{hint}</div>
    </div>
  );
}

function pillStyle(value: string): React.CSSProperties {
  const bg =
    value === "Hazir"
      ? "#f5fff7"
      : value === "Uyarlanabilir"
      ? "#fff9ef"
      : value === "Gelismekte"
      ? "#f4f8ff"
      : value === "AI Hazir"
      ? "#f5fff7"
      : "#fafafa";

  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #eee",
    background: bg,
    fontWeight: 700,
    fontSize: 13,
    display: "inline-flex",
  };
}

export default function TemplatesPage() {
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | "all">("all");
  const [targetFilter, setTargetFilter] = useState<TemplateTarget | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    return documentTemplates.filter((item) => {
      const categoryMatch = categoryFilter === "all" ? true : item.category === categoryFilter;
      const targetMatch = targetFilter === "all" ? true : item.target === targetFilter;
      const statusMatch = statusFilter === "all" ? true : item.status === statusFilter;

      const q = search.trim().toLowerCase();
      const searchMatch =
        q === "" ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.target.toLowerCase().includes(q);

      return categoryMatch && targetMatch && statusMatch && searchMatch;
    });
  }, [categoryFilter, targetFilter, statusFilter, search]);

  const totalTemplates = documentTemplates.length;
  const readyTemplates = documentTemplates.filter((item) => item.status === "Hazir").length;
  const aiReadyTemplates = documentTemplates.filter((item) => item.aiReady).length;
  const sectorSpecific = documentTemplates.filter((item) => item.target !== "Genel").length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Sablon Kutuphanesi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; kurum, sektor ve belge amacina gore kullanilabilecek sablonlari
          tek merkezden secmek ve AI ile uyarlama akisina baglamak icin tasarlandi.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard title="Toplam Sablon" value={String(totalTemplates)} hint="Kutuphane envanteri" />
        <StatCard title="Hazir Sablon" value={String(readyTemplates)} hint="Hemen kullanilabilir sablonlar" />
        <StatCard title="AI Hazir" value={String(aiReadyTemplates)} hint="Uyarlamaya uygun sablonlar" />
        <StatCard title="Sektore Ozel" value={String(sectorSpecific)} hint="Kurum tipine ozellesen sablonlar" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Filtreler">
            <div style={{ display: "grid", gap: 12 }}>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as TemplateCategory | "all")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum kategoriler</option>
                <option value="Risk">Risk</option>
                <option value="Acil Durum">Acil Durum</option>
                <option value="Denetim">Denetim</option>
                <option value="Aksiyon">Aksiyon</option>
                <option value="Egitim">Egitim</option>
                <option value="Kurul">Kurul</option>
                <option value="Talimat">Talimat</option>
                <option value="Saglik">Saglik</option>
              </select>

              <select
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value as TemplateTarget | "all")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum hedef kurumlar</option>
                <option value="Genel">Genel</option>
                <option value="Bakim Merkezi">Bakim Merkezi</option>
                <option value="Fabrika">Fabrika</option>
                <option value="Ofis">Ofis</option>
                <option value="Egitim Kurumu">Egitim Kurumu</option>
                <option value="Saglik Kurumu">Saglik Kurumu</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TemplateStatus | "all")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum durumlar</option>
                <option value="Hazir">Hazir</option>
                <option value="Uyarlanabilir">Uyarlanabilir</option>
                <option value="Gelismekte">Gelismekte</option>
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sablon ara"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />
            </div>
          </SectionCard>

          <SectionCard title="Kullanim Mantigi">
            <div style={{ display: "grid", gap: 10, lineHeight: 1.8 }}>
              <div>- Uygun sablonu sec</div>
              <div>- Kurum tipine gore daralt</div>
              <div>- AI ile uyarlama akisina gonder</div>
              <div>- Dokuman olarak olustur</div>
              <div>- Revizyon ve cikti gecmisi ile takip et</div>
            </div>
          </SectionCard>

          <SectionCard title="Hizli Gecis">
            <div style={{ display: "grid", gap: 10 }}>
              <Link
                href="/solution-center"
                style={{
                  textDecoration: "none",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  color: "inherit",
                  fontWeight: 700,
                  background: "#fafafa",
                }}
              >
                AI ile Dokuman Hazirla
              </Link>

              <Link
                href="/solution-center/documents"
                style={{
                  textDecoration: "none",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  color: "inherit",
                  fontWeight: 700,
                  background: "#fafafa",
                }}
              >
                Dokuman Operasyon Merkezine Don
              </Link>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Sablon Envanteri">
            <div style={{ display: "grid", gap: 12 }}>
              {filteredTemplates.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={pillStyle(item.status)}>{item.status}</span>
                      {item.aiReady ? <span style={pillStyle("AI Hazir")}>AI Hazir</span> : null}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14, marginBottom: 10 }}>
                    <div><strong>Kategori:</strong> {item.category}</div>
                    <div><strong>Hedef:</strong> {item.target}</div>
                    <div><strong>Ozet:</strong> {item.summary}</div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Icerir</div>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {item.includes.map((value, index) => (
                        <li key={index}>{value}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Onerilen Kullanim</div>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {item.recommendedFor.map((value, index) => (
                        <li key={index}>{value}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      Sablonu Kullan (yakinda)
                    </button>

                    <button
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      AI ile Uyarla (yakinda)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import { archivedDocumentRecords, documentVersionRecords } from "@/lib/document-history-data";

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
    value === "Yayinlandi"
      ? "#f5fff7"
      : value === "Taslak"
      ? "#f4f8ff"
      : value === "Revize Edildi"
      ? "#fff9ef"
      : value === "Arsivlendi"
      ? "#f3f3f3"
      : value === "Yeni Surum"
      ? "#fff9ef"
      : value === "Donem Sonu"
      ? "#f4f8ff"
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

function getCompanyName(companyId: number) {
  return companies.find((company) => company.id === companyId)?.name ?? "Bilinmeyen Kurum";
}

export default function ArchivesPage() {
  const [companyFilter, setCompanyFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const filteredVersions = useMemo(() => {
    return documentVersionRecords.filter((item) => {
      const companyMatch = companyFilter === "all" ? true : item.companyId === companyFilter;
      const q = search.trim().toLowerCase();
      const searchMatch =
        q === "" ||
        item.title.toLowerCase().includes(q) ||
        item.version.toLowerCase().includes(q) ||
        item.revisionReason.toLowerCase().includes(q) ||
        getCompanyName(item.companyId).toLowerCase().includes(q);

      return companyMatch && searchMatch;
    });
  }, [companyFilter, search]);

  const filteredArchives = useMemo(() => {
    return archivedDocumentRecords.filter((item) => {
      const companyMatch = companyFilter === "all" ? true : item.companyId === companyFilter;
      const q = search.trim().toLowerCase();
      const searchMatch =
        q === "" ||
        item.title.toLowerCase().includes(q) ||
        item.archiveReason.toLowerCase().includes(q) ||
        getCompanyName(item.companyId).toLowerCase().includes(q);

      return companyMatch && searchMatch;
    });
  }, [companyFilter, search]);

  const totalVersions = documentVersionRecords.length;
  const archivedCount = archivedDocumentRecords.length;
  const draftCount = documentVersionRecords.filter((item) => item.status === "Taslak").length;
  const revisedCount = documentVersionRecords.filter((item) => item.status === "Revize Edildi").length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Arsiv ve Revizyon Merkezi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; versiyon gecmisi, revizyon nedenleri, yayim durumu ve arsive alinan
          belge kayitlarini tek yerde izlemek icin tasarlandi.
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
        <StatCard title="Toplam Versiyon Kaydi" value={String(totalVersions)} hint="Belge surum gecmisi" />
        <StatCard title="Arsivlenen Belge" value={String(archivedCount)} hint="Saklanan kapali kayitlar" />
        <StatCard title="Taslak Surum" value={String(draftCount)} hint="Tamamlanmamis versiyonlar" />
        <StatCard title="Revize Edilen" value={String(revisedCount)} hint="Revizyon gormus kayitlar" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Filtreler">
            <div style={{ display: "grid", gap: 12 }}>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum kurumlar</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Belge, versiyon veya neden ara"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />
            </div>
          </SectionCard>

          <SectionCard title="Revizyon Mantigi">
            <div style={{ display: "grid", gap: 10, lineHeight: 1.8 }}>
              <div>- Yeni surum olustugunda onceki kayit arsive alinabilir</div>
              <div>- Taslak, yayin, revizyon ve arsiv durumu ayri izlenir</div>
              <div>- Revizyon nedeni ve ozet degisiklik kaydi tutulur</div>
              <div>- Cikti ve onay akisina baglanabilir</div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Versiyon Gecmisi">
            <div style={{ display: "grid", gap: 12 }}>
              {filteredVersions.map((item) => (
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
                      <span style={pillStyle(item.version)}>{item.version}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Degisim Tarihi:</strong> {item.changedAt}</div>
                    <div><strong>Degistiren:</strong> {item.changedBy}</div>
                    <div><strong>Revizyon Nedeni:</strong> {item.revisionReason}</div>
                    <div><strong>Ozet:</strong> {item.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Arsiv Kayitlari">
            <div style={{ display: "grid", gap: 12 }}>
              {filteredArchives.map((item) => (
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
                      <span style={pillStyle("Arsivlendi")}>Arsivlendi</span>
                      <span style={pillStyle(item.archiveReason)}>{item.archiveReason}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Arsiv Tarihi:</strong> {item.archivedAt}</div>
                    <div><strong>Arsivleyen:</strong> {item.archivedBy}</div>
                    <div><strong>Son Surum:</strong> {item.lastVersion}</div>
                    <div><strong>Cikti Turu:</strong> {item.outputType}</div>
                    <div><strong>Not:</strong> {item.note}</div>
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
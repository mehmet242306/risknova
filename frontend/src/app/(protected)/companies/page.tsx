import Link from "next/link";

const companies = [
  {
    id: 1,
    name: "Nova Yaşam Destek Merkezi",
    sector: "Bakım ve rehabilitasyon hizmetleri",
    hazardClass: "Çok Tehlikeli",
    employeeCount: 58,
    lastVisit: "04.03.2026",
    openActions: 6,
    documentStatus: "Revizyon gerekli",
    riskLevel: "Yüksek",
  },
  {
    id: 2,
    name: "Atlas Metal Sanayi",
    sector: "Metal işleme ve üretim",
    hazardClass: "Çok Tehlikeli",
    employeeCount: 132,
    lastVisit: "01.03.2026",
    openActions: 11,
    documentStatus: "Güncel",
    riskLevel: "Yüksek",
  },
  {
    id: 3,
    name: "Umut Egitim ve Bakim Merkezi",
    sector: "Eğitim ve bakım hizmetleri",
    hazardClass: "Tehlikeli",
    employeeCount: 41,
    lastVisit: "27.02.2026",
    openActions: 3,
    documentStatus: "Kısmen güncel",
    riskLevel: "Orta",
  },
  {
    id: 4,
    name: "Merkez Yonetim Binasi",
    sector: "Ofis ve idari hizmetler",
    hazardClass: "Az Tehlikeli",
    employeeCount: 24,
    lastVisit: "20.02.2026",
    openActions: 2,
    documentStatus: "Güncel",
    riskLevel: "Düşük",
  },
];

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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid #f3f3f3",
      }}
    >
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Firmalar / Kurumlar</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 900 }}>
          Tüm saha ziyaretleri, risk analizleri, dokümanlar ve aksiyonlar firma bazlı takip edilir.
          Bu ekran, kurum profilini ve genel İSG operasyon durumunu toplu olarak gösterir.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <StatCard title="Toplam Kurum" value="4" hint="Aktif kayıtlı firma ve birimler" />
        <StatCard title="Açık Aksiyon" value="22" hint="Kapanmayı bekleyen DÖF ve görevler" />
        <StatCard title="Yüksek Riskli" value="2" hint="Öncelikli takip gerektiren kurumlar" />
        <StatCard title="Revizyon Bekleyen" value="2" hint="Doküman güncellemesi gereken kurumlar" />
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          marginBottom: 18,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Firma Yönetim Alanı</div>
            <div style={{ opacity: 0.75, fontSize: 14 }}>
              Sonraki aşamada burada arama, filtreleme, tehlike sınıfına göre listeleme ve yeni firma ekleme alanları olacak.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#fafafa",
                fontWeight: 700,
              }}
            >
              + Yeni Firma (yakında)
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {companies.map((company) => (
          <div
            key={company.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 18,
              padding: 18,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{company.name}</div>
                <div style={{ opacity: 0.75 }}>{company.sector}</div>
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid #eee",
                  fontWeight: 700,
                  background:
                    company.riskLevel === "Yüksek"
                      ? "#fff4f4"
                      : company.riskLevel === "Orta"
                      ? "#fff9ef"
                      : "#f5fff7",
                }}
              >
                Risk: {company.riskLevel}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              <div>
                <InfoRow label="Tehlike Sınıfı" value={company.hazardClass} />
                <InfoRow label="Çalışan Sayısı" value={company.employeeCount} />
                <InfoRow label="Son Ziyaret" value={company.lastVisit} />
              </div>

              <div>
                <InfoRow label="Açık Aksiyon" value={company.openActions} />
                <InfoRow label="Doküman Durumu" value={company.documentStatus} />
                <InfoRow label="Firma ID" value={company.id} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <Link
                href="/field-audit"
                style={{
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  color: "inherit",
                  fontWeight: 700,
                }}
              >
                Saha Denetimine Git
              </Link>

              <Link
                href="/documents"
                style={{
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  color: "inherit",
                  fontWeight: 700,
                }}
              >
                Dokümanları Gör
              </Link>

              <Link
                href="/actions"
                style={{
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  color: "inherit",
                  fontWeight: 700,
                }}
              >
                Açık Aksiyonlar
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

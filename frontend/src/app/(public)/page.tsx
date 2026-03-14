import Link from "next/link";

const announcements = [
  {
    title: "Yeni moduller devrede",
    text: "Risk analizi, saha denetimi, dokuman ve aksiyon surecleri tek akista toplandi.",
  },
  {
    title: "Takvim ve bildirim alani guncellendi",
    text: "Gorev, hatirlatma ve operasyon planlama ekranlari ayni panelde birlestirildi.",
  },
  {
    title: "AI destekli belge altyapisi genisledi",
    text: "Rapor, dokuman ve saha bulgulari icin yeni akislar hazirlandi.",
  },
];

const features = [
  "AI destekli risk analizi",
  "Saha denetimi ve tespit yonetimi",
  "Dokuman olusturma ve arsiv",
  "RHAM ve R-SKOR 2D alanlari",
  "Takvim, bildirim ve gorev zinciri",
  "Kurum, lokasyon ve kullanici takibi",
];

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f7f8",
        color: "#111827",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header
        style={{
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>guvenligimcepte</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            AI Destekli ISG Risk Analizi ve Operasyon Platformu
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/login"
            style={{
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              color: "#111827",
              fontWeight: 700,
              background: "#fff",
            }}
          >
            Giris
          </Link>

          <Link
            href="/register"
            style={{
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #111827",
              color: "#fff",
              fontWeight: 700,
              background: "#111827",
            }}
          >
            Kayit Ol
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "56px 24px 24px",
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 32,
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 999,
              background: "#eef2ff",
              color: "#3730a3",
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 18,
            }}
          >
            Yeni Nesil ISG Operasyon Altyapisi
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 46,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Sahadan rapora kadar tum ISG surecini tek merkezden yonetin
          </h1>

          <p
            style={{
              marginTop: 18,
              marginBottom: 0,
              fontSize: 18,
              lineHeight: 1.8,
              color: "#4b5563",
              maxWidth: 760,
            }}
          >
            guvenligimcepte; isg uzmani, isyeri hekimi ve diger saglik personeli
            icin saha denetimi, risk yonetimi, dokuman olusturma, aksiyon takibi,
            bildirim ve raporlama sureclerini tek platformda birlestirir.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <Link
              href="/login"
              style={{
                textDecoration: "none",
                padding: "12px 18px",
                borderRadius: 14,
                background: "#111827",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              Platforma Giris Yap
            </Link>

            <Link
              href="/register"
              style={{
                textDecoration: "none",
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontWeight: 800,
              }}
            >
              Hesap Olustur
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
            Duyurular
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {announcements.map((item) => (
              <div
                key={item.title}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{item.title}</div>
                <div style={{ color: "#4b5563", lineHeight: 1.7 }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 64px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 18 }}>
            Platformda neler var?
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            {features.map((item) => (
              <div
                key={item}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 18,
                  background: "#fafafa",
                  fontWeight: 700,
                  lineHeight: 1.7,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
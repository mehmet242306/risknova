import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={sidebarLinkStyle}>
      {label}
    </Link>
  );
}

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div>
          <div style={brandStyle}>guvenligimcepte</div>
          <div style={taglineStyle}>AI Destekli ISG Risk Analizi ve Operasyon Platformu</div>
        </div>

        <div style={headerRightStyle}>
          <Link href="/profile" style={topLinkStyle}>Profil</Link>
          <Link href="/settings" style={topLinkStyle}>Ayarlar</Link>
          <div style={userChipStyle}>
            {session.user?.email ?? "Kullanici"}
          </div>
        </div>
      </header>

      <div style={contentWrapStyle}>
        <aside style={asideStyle}>
          <div style={sectionTitleStyle}>Menu</div>

          <div style={sectionLabelStyle}>OPERASYON</div>
          <div style={linksGroupStyle}>
            <SidebarLink href="/dashboard" label="Operasyon Merkezi" />
            <SidebarLink href="/calendar" label="Takvim ve Hatirlatmalar" />
            <SidebarLink href="/notifications" label="Bildirim Merkezi" />
            <SidebarLink href="/workflow" label="Gorev Zinciri" />
            <SidebarLink href="/tasks" label="Gorevler" />
          </div>

          <div style={sectionLabelStyle}>KURUM VE SAHA</div>
          <div style={linksGroupStyle}>
            <SidebarLink href="/companies" label="Firmalar / Kurumlar" />
            <SidebarLink href="/field-audit" label="Saha Denetimi" />
            <SidebarLink href="/findings" label="Tespit ve Oneri" />
            <SidebarLink href="/photo-findings" label="Fotograf Tespitleri" />
            <SidebarLink href="/locations" label="Lokasyonlar" />
          </div>

          <div style={sectionLabelStyle}>RISK VE METODOLOJI</div>
          <div style={linksGroupStyle}>
            <SidebarLink href="/risk-analysis" label="Risk Analizi" />
            <SidebarLink href="/visual-risk" label="Gorsel Risk Tespiti" />
            <SidebarLink href="/hazard-library" label="Tehlike Kutuphanesi" />
            <SidebarLink href="/rham" label="RHAM" />
            <SidebarLink href="/r-skor-2d" label="R-SKOR 2D" />
            <SidebarLink href="/trend" label="Trend" />
            <SidebarLink href="/score-history" label="Skor Gecmisi" />
          </div>

          <div style={sectionLabelStyle}>DOKUMAN VE RAPOR</div>
          <div style={linksGroupStyle}>
            <SidebarLink href="/document-create" label="Dokuman Olustur" />
            <SidebarLink href="/document-generator" label="AI ile Dokuman Hazirla" />
            <SidebarLink href="/documents" label="Dokumanlar" />
            <SidebarLink href="/templates" label="Sablonlar" />
            <SidebarLink href="/archives" label="Arsiv" />
            <SidebarLink href="/reports" label="Raporlar" />
            <SidebarLink href="/executive-summary" label="Yonetici Ozeti" />
          </div>

          <div style={sectionLabelStyle}>SAGLIK VE ACIL DURUM</div>
          <div style={linksGroupStyle}>
            <SidebarLink href="/health" label="Saglik" />
            <SidebarLink href="/health-docs" label="Saglik Dokumanlari" />
            <SidebarLink href="/medical-schedule" label="Saglik Takvimi" />
            <SidebarLink href="/emergency" label="Acil Durum" />
          </div>

          <div style={sectionLabelStyle}>SISTEM</div>
          <div style={linksGroupStyle}>
            <SidebarLink href="/users" label="Kullanicilar" />
            <SidebarLink href="/profile" label="Profil ve Hesap" />
            <SidebarLink href="/settings" label="Ayarlar" />
            <SidebarLink href="/deadline-tracking" label="Termin Takibi" />
            <SidebarLink href="/closure-verification" label="Kapanis Dogrulama" />
            <SidebarLink href="/actions" label="Aksiyonlar" />
            <SidebarLink href="/text-query" label="Metin Sorgu" />
          </div>

          <div style={footerNoteStyle}>
            Cekirdek akis: ziyaret - tespit - skor - dokuman - aksiyon - takip - rapor - revizyon
          </div>
        </aside>

        <main style={mainStyle}>{children}</main>
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f7f7f8",
  color: "#111827",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const headerStyle: CSSProperties = {
  height: 72,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  background: "#ffffff",
  borderBottom: "1px solid #e5e7eb",
  position: "sticky",
  top: 0,
  zIndex: 20,
};

const brandStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.02em",
};

const taglineStyle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const headerRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const topLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111827",
  fontWeight: 700,
};

const userChipStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 13,
  fontWeight: 700,
};

const contentWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "270px 1fr",
  minHeight: "calc(100vh - 72px)",
};

const asideStyle: CSSProperties = {
  background: "#ffffff",
  borderRight: "1px solid #e5e7eb",
  padding: 16,
  overflowY: "auto",
};

const mainStyle: CSSProperties = {
  padding: 24,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 14,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#6b7280",
  marginTop: 18,
  marginBottom: 8,
};

const linksGroupStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const sidebarLinkStyle: CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#111827",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "12px 14px",
  fontWeight: 700,
};

const footerNoteStyle: CSSProperties = {
  marginTop: 18,
  paddingTop: 12,
  borderTop: "1px solid #e5e7eb",
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.6,
};
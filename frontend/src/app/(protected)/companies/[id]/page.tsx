import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyById } from "@/lib/mock-data";
import EmployeeImportPanel from "@/components/EmployeeImportPanel";

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
        gridTemplateColumns: "160px 1fr",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid #f3f3f3",
      }}
    >
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

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

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = getCompanyById(Number(id));

  if (!company) {
    notFound();
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/companies" style={{ textDecoration: "none", opacity: 0.75 }}>
          Firmalar listesine don
        </Link>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>{company.name}</h1>
            <div style={{ opacity: 0.75, lineHeight: 1.7 }}>
              {company.sector} | NACE: {company.naceCode} | {company.address}
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #eee",
              fontWeight: 800,
              background:
                company.riskLevel === "Yuksek"
                  ? "#fff4f4"
                  : company.riskLevel === "Orta"
                  ? "#fff9ef"
                  : "#f5fff7",
            }}
          >
            Risk Seviyesi: {company.riskLevel}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Calisan Sayisi</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{company.employeeCount}</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Ozel Politika Gerektiren</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{company.specialPolicyCount}</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Acik Aksiyon</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{company.openActions}</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Son Ziyaret</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{company.lastVisit}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <SectionCard title="Firma Profili">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <div>
              <InfoRow label="Firma Adi" value={company.name} />
              <InfoRow label="Faaliyet Konusu" value={company.sector} />
              <InfoRow label="NACE Kodu" value={company.naceCode} />
              <InfoRow label="Tehlike Sinifi" value={company.hazardClass} />
              <InfoRow label="Dokuman Durumu" value={company.documentStatus} />
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Lokasyonlar / Birimler</div>
              <ul style={{ lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
                {company.locations.map((location, index) => (
                  <li key={index}>{location}</li>
                ))}
              </ul>

              <div style={{ fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Sorumlu Kisiler</div>
              <ul style={{ lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
                {company.contacts.map((contact, index) => (
                  <li key={index}>
                    {contact.name} - {contact.title} - {contact.phone}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Hizmet Modeli ve Gorevlendirme">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <div>
              <InfoRow label="Hizmet Modeli" value={company.serviceModel} />
              <InfoRow label="Sozlesme Baslangic" value={company.contractStart} />
              <InfoRow label="Sozlesme Bitis" value={company.contractEnd} />
            </div>

            <div>
              {company.osgbInfo ? (
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>OSGB Bilgileri</div>
                  <div style={{ lineHeight: 1.8 }}>
                    <div><strong>Unvan:</strong> {company.osgbInfo.name}</div>
                    <div><strong>Yetki No:</strong> {company.osgbInfo.authorizationNo}</div>
                    <div><strong>Telefon:</strong> {company.osgbInfo.phone}</div>
                    <div><strong>Adres:</strong> {company.osgbInfo.address}</div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                    opacity: 0.85,
                  }}
                >
                  Bu kurum icin aktif OSGB kaydi bulunmuyor.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Aktif Gorevlendirmeler</div>

            <div style={{ display: "grid", gap: 12 }}>
              {company.assignments.map((assignment) => (
                <div
                  key={assignment.id}
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
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {assignment.role} - {assignment.fullName}
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {assignment.active ? "Aktif" : "Pasif"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                    <div><strong>Istihdam Turu:</strong> {assignment.employmentType}</div>
                    <div><strong>Saglayici:</strong> {assignment.providerCompany}</div>
                    <div><strong>Belge / Sinif:</strong> {assignment.certificateClass}</div>
                    <div><strong>Telefon:</strong> {assignment.phone}</div>
                    <div><strong>Baslangic:</strong> {assignment.startDate}</div>
                    <div><strong>Bitis:</strong> {assignment.endDate || "-"}</div>
                  </div>

                  <div style={{ marginTop: 10, opacity: 0.85 }}>
                    <strong>Not:</strong> {assignment.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Personel Yonetimi">
          <div style={{ marginBottom: 14, opacity: 0.8, lineHeight: 1.7 }}>
            Bu alanda personel listesi izlenir, ozel politika gerektiren calisanlar isaretlenir
            ve Excel / CSV uzerinden toplu ice aktarma yapilir.
          </div>

          <EmployeeImportPanel companyName={company.name} />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                  <th style={{ padding: "10px 8px" }}>Ad Soyad</th>
                  <th style={{ padding: "10px 8px" }}>Gorev</th>
                  <th style={{ padding: "10px 8px" }}>Birim</th>
                  <th style={{ padding: "10px 8px" }}>Ise Giris</th>
                  <th style={{ padding: "10px 8px" }}>Vardiya</th>
                  <th style={{ padding: "10px 8px" }}>Ozel Politika</th>
                  <th style={{ padding: "10px 8px" }}>Not</th>
                </tr>
              </thead>
              <tbody>
                {company.employees.map((employee) => (
                  <tr key={employee.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{employee.fullName}</td>
                    <td style={{ padding: "10px 8px" }}>{employee.title}</td>
                    <td style={{ padding: "10px 8px" }}>{employee.unit}</td>
                    <td style={{ padding: "10px 8px" }}>{employee.startDate}</td>
                    <td style={{ padding: "10px 8px" }}>{employee.shift}</td>
                    <td style={{ padding: "10px 8px" }}>{employee.specialPolicy ? "Evet" : "Hayir"}</td>
                    <td style={{ padding: "10px 8px" }}>{employee.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Profesyonel Notlar">
          <div style={{ display: "grid", gap: 14 }}>
            {company.notes.map((note) => (
              <div
                key={note.id}
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
                  <div style={{ fontWeight: 800 }}>{note.title}</div>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    {note.role} - {note.date}
                  </div>
                </div>

                <div style={{ lineHeight: 1.7, opacity: 0.9, marginBottom: 10 }}>{note.content}</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #eee",
                      background: "#fff",
                    }}
                  >
                    Gizlilik: {note.confidential ? "Yuksek" : "Normal"}
                  </span>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #eee",
                      background: "#fff",
                    }}
                  >
                    Takip: {note.followUp ? "Gerekli" : "Bilgi"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Hizli Islemler">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              Saha Denetimi Baslat
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
              Dokuman Yonetimine Git
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
              Acik Aksiyonlari Gor
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
import Link from "next/link";
import { companies } from "@/lib/mock-data";
import { initialActions } from "@/lib/action-data";
import { managedDocuments } from "@/lib/document-data";
import { emergencyPlans, emergencyTrainings, drillRecords } from "@/lib/emergency-data";
import { calendarEvents } from "@/lib/calendar-data";
import { seededNotifications } from "@/lib/notification-data";

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
      <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function pillStyle(value: string): React.CSSProperties {
  const bg =
    value === "Kritik"
      ? "#ffe9e9"
      : value === "Yuksek"
      ? "#fff9ef"
      : value === "Orta"
      ? "#fff9ef"
      : value === "Guncel"
      ? "#f5fff7"
      : value === "Revizyon Gerekli"
      ? "#fff4f4"
      : value === "Bugun"
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

function getDateDiff(dateStr: string) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function near(dateStr: string, days: number) {
  const diff = getDateDiff(dateStr);
  return diff <= days;
}

export default function DashboardPage() {
  const openActions = initialActions.filter((item) => item.status !== "Tamamlandi");
  const criticalActions = openActions.filter((item) => item.priority === "Kritik");
  const overdueActions = openActions.filter((item) => getDateDiff(item.dueDate) < 0);

  const revisionDocs = managedDocuments.filter(
    (item) => item.status === "Revizyon Gerekli" || near(item.nextReviewDate, 30)
  );

  const emergencyWarnings = emergencyPlans.filter((item) => near(item.nextReviewDate, 60));
  const upcomingTrainings = emergencyTrainings.filter((item) => near(item.renewalDate, 45));
  const upcomingDrills = drillRecords.filter((item) => near(item.nextDrillDate, 60));

  const todayEvents = calendarEvents.filter((item) => getDateDiff(item.date) === 0);
  const weekEvents = calendarEvents.filter((item) => {
    const diff = getDateDiff(item.date);
    return diff >= 0 && diff <= 7;
  });

  const unreadNotifications = seededNotifications.filter((item) => !item.read);
  const riskyCompanies = [...companies]
    .sort((a, b) => b.openActions - a.openActions)
    .slice(0, 4);

  const latestDocuments = [...managedDocuments]
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Gunluk Operasyon Merkezi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; DOF, dokuman, acil durum, egitim, tatbikat, takvim ve bildirim verilerini
          tek merkezde toplayarak kullaniciya bugun neye odaklanmasi gerektigini gosterir.
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
        <StatCard
          title="Acik DOF / Aksiyon"
          value={String(openActions.length)}
          hint={`${criticalActions.length} kritik, ${overdueActions.length} geciken`}
        />
        <StatCard
          title="Revizyon / Yakin Belge"
          value={String(revisionDocs.length)}
          hint="Revizyon gereken veya tarihi yaklasan belgeler"
        />
        <StatCard
          title="Bu Hafta Olaylari"
          value={String(weekEvents.length)}
          hint={`${todayEvents.length} bugun planli olay`}
        />
        <StatCard
          title="Okunmamis Bildirim"
          value={String(unreadNotifications.length)}
          hint="Moduller arasi kritik sinyaller"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Bugun ve Bu Hafta Odak Noktalari">
            <div style={{ display: "grid", gap: 12 }}>
              {weekEvents.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Bu hafta planli kayit bulunmuyor.</div>
              ) : (
                weekEvents.map((item) => {
                  const diff = getDateDiff(item.date);
                  const label = diff === 0 ? "Bugun" : `${diff} gun kaldi`;

                  return (
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
                        <span style={pillStyle(diff === 0 ? "Bugun" : "Orta")}>{label}</span>
                      </div>

                      <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                        <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                        <div><strong>Tur:</strong> {item.type}</div>
                        <div><strong>Tarih:</strong> {item.date}</div>
                        <div><strong>Sorumlu:</strong> {item.owner}</div>
                        <div><strong>Not:</strong> {item.note}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard title="Kritik DOF ve Aksiyonlar">
            <div style={{ display: "grid", gap: 12 }}>
              {criticalActions.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Kritik acik aksiyon bulunmuyor.</div>
              ) : (
                criticalActions.map((item) => (
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
                      <span style={pillStyle("Kritik")}>Kritik</span>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                      <div><strong>Termin:</strong> {item.dueDate}</div>
                      <div><strong>Sorumlu:</strong> {item.responsible}</div>
                      <div><strong>Aciklama:</strong> {item.description}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Revizyon ve Belge Durumu">
            <div style={{ display: "grid", gap: 12 }}>
              {revisionDocs.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Yakin revizyon gerektiren belge bulunmuyor.</div>
              ) : (
                revisionDocs.map((item) => (
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
                      <span style={pillStyle(item.status)}>{item.status}</span>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                      <div><strong>Tur:</strong> {item.type}</div>
                      <div><strong>Sonraki Gozden Gecirme:</strong> {item.nextReviewDate}</div>
                      <div><strong>Hazirlayan:</strong> {item.preparedBy}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Acil Durum, Egitim ve Tatbikat Uyarilari">
            <div style={{ display: "grid", gap: 12 }}>
              {emergencyWarnings.map((item) => (
                <div
                  key={`plan-${item.companyId}`}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Acil durum plani gozden gecirme</div>
                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Versiyon:</strong> {item.version}</div>
                    <div><strong>Tarih:</strong> {item.nextReviewDate}</div>
                  </div>
                </div>
              ))}

              {upcomingTrainings.map((item) => (
                <div
                  key={`training-${item.id}`}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Egitim yenileme</div>
                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Egitim:</strong> {item.title}</div>
                    <div><strong>Yenileme:</strong> {item.renewalDate}</div>
                  </div>
                </div>
              ))}

              {upcomingDrills.map((item) => (
                <div
                  key={`drill-${item.id}`}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Tatbikat planlamasi</div>
                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Tatbikat:</strong> {item.type}</div>
                    <div><strong>Sonraki Tarih:</strong> {item.nextDrillDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="En Riskli Kurumlar">
            <div style={{ display: "grid", gap: 12 }}>
              {riskyCompanies.map((company) => (
                <div
                  key={company.id}
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
                    <div style={{ fontWeight: 800 }}>{company.name}</div>
                    <span style={pillStyle(company.riskLevel)}>{company.riskLevel}</span>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Faaliyet:</strong> {company.sector}</div>
                    <div><strong>Acik Aksiyon:</strong> {company.openActions}</div>
                    <div><strong>Son Ziyaret:</strong> {company.lastVisit}</div>
                    <div><strong>Dokuman:</strong> {company.documentStatus}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Son Guncellenen Belgeler">
            <div style={{ display: "grid", gap: 12 }}>
              {latestDocuments.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{item.title}</div>
                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Tur:</strong> {item.type}</div>
                    <div><strong>Son Guncelleme:</strong> {item.lastUpdated}</div>
                    <div><strong>Versiyon:</strong> {item.version}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Kritik Bildirimler">
            <div style={{ display: "grid", gap: 12 }}>
              {unreadNotifications.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Okunmamis bildirim bulunmuyor.</div>
              ) : (
                unreadNotifications.map((item) => (
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
                      <span style={pillStyle(item.level)}>{item.level}</span>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                      <div><strong>Kaynak:</strong> {item.source}</div>
                      <div><strong>Mesaj:</strong> {item.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Hizli Gecis">
            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/actions" style={{ textDecoration: "none", color: "inherit", padding: "12px 14px", borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
                DOF / Aksiyon Takibine Git
              </Link>
              <Link href="/documents" style={{ textDecoration: "none", color: "inherit", padding: "12px 14px", borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
                Dokuman Operasyon Merkezine Git
              </Link>
              <Link href="/emergency" style={{ textDecoration: "none", color: "inherit", padding: "12px 14px", borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
                Acil Durum Modulune Git
              </Link>
              <Link href="/calendar" style={{ textDecoration: "none", color: "inherit", padding: "12px 14px", borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
                Takvim ve Hatirlatmalara Git
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
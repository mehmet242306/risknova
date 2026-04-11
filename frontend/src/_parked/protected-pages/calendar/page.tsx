"use client";

import { useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import { initialActions } from "@/lib/action-data";
import { managedDocuments } from "@/lib/document-data";
import { emergencyPlans, emergencyTrainings, drillRecords } from "@/lib/emergency-data";
import { calendarEvents } from "@/lib/calendar-data";

type UnifiedItem = {
  id: string;
  companyId: number;
  title: string;
  source: string;
  date: string;
  owner: string;
  note: string;
  priority: "Normal" | "Yuksek" | "Kritik";
};

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

function getCompanyName(companyId: number) {
  return companies.find((company) => company.id === companyId)?.name ?? "Bilinmeyen Kurum";
}

function priorityPill(priority: string): React.CSSProperties {
  const bg =
    priority === "Kritik"
      ? "#ffe9e9"
      : priority === "Yuksek"
      ? "#fff9ef"
      : "#f5fff7";

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

function getDateDiff(dateStr: string) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function CalendarPage() {
  const [companyFilter, setCompanyFilter] = useState<number | "all">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week" | "late">("all");

  const items = useMemo(() => {
    const manualItems: UnifiedItem[] = calendarEvents.map((item) => ({
      id: `manual-${item.id}`,
      companyId: item.companyId,
      title: item.title,
      source: item.type,
      date: item.date,
      owner: item.owner,
      note: item.note,
      priority: "Normal",
    }));

    const actionItems: UnifiedItem[] = initialActions.map((item) => ({
      id: `action-${item.id}`,
      companyId: item.companyId,
      title: item.title,
      source: "DOF / Aksiyon",
      date: item.dueDate,
      owner: item.responsible,
      note: item.description,
      priority: item.priority === "Kritik" ? "Kritik" : item.priority === "Yuksek" ? "Yuksek" : "Normal",
    }));

    const documentItems: UnifiedItem[] = managedDocuments.map((item) => ({
      id: `doc-${item.id}`,
      companyId: item.companyId,
      title: `${item.title} gozden gecirme`,
      source: "Dokuman",
      date: item.nextReviewDate,
      owner: item.preparedBy,
      note: `Belge durumu: ${item.status}`,
      priority: item.status === "Revizyon Gerekli" ? "Yuksek" : "Normal",
    }));

    const emergencyPlanItems: UnifiedItem[] = emergencyPlans.map((item) => ({
      id: `plan-${item.companyId}`,
      companyId: item.companyId,
      title: "Acil durum plani gozden gecirme",
      source: "Acil Durum",
      date: item.nextReviewDate,
      owner: item.approvedBy,
      note: `Plan versiyonu: ${item.version}`,
      priority: "Yuksek",
    }));

    const trainingItems: UnifiedItem[] = emergencyTrainings.map((item) => ({
      id: `training-${item.id}`,
      companyId: item.companyId,
      title: `${item.title} yenileme`,
      source: "Egitim",
      date: item.renewalDate,
      owner: item.trainer,
      note: item.targetGroup,
      priority: "Normal",
    }));

    const drillItems: UnifiedItem[] = drillRecords.map((item) => ({
      id: `drill-${item.id}`,
      companyId: item.companyId,
      title: `${item.type} sonraki tatbikat`,
      source: "Tatbikat",
      date: item.nextDrillDate,
      owner: "Emergency Modulu",
      note: item.scenario,
      priority: "Yuksek",
    }));

    return [
      ...manualItems,
      ...actionItems,
      ...documentItems,
      ...emergencyPlanItems,
      ...trainingItems,
      ...drillItems,
    ].sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const filteredItems = items.filter((item) => {
    const companyMatch = companyFilter === "all" ? true : item.companyId === companyFilter;
    const diff = getDateDiff(item.date);

    const timeMatch =
      timeFilter === "all"
        ? true
        : timeFilter === "today"
        ? diff === 0
        : timeFilter === "week"
        ? diff >= 0 && diff <= 7
        : diff < 0;

    return companyMatch && timeMatch;
  });

  const todayCount = items.filter((item) => getDateDiff(item.date) === 0).length;
  const weekCount = items.filter((item) => {
    const diff = getDateDiff(item.date);
    return diff >= 0 && diff <= 7;
  }).length;
  const lateCount = items.filter((item) => getDateDiff(item.date) < 0).length;
  const criticalCount = items.filter((item) => item.priority === "Kritik").length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Takvim ve Hatirlatma Merkezi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; ziyaretler, DOF terminleri, belge gozden gecirme tarihleri,
          egitimler, tatbikatlar ve acil durum planlarini tek bir zaman akisinda toplar.
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
        <StatCard title="Bugun" value={String(todayCount)} hint="Bugune ait kayitlar" />
        <StatCard title="Bu Hafta" value={String(weekCount)} hint="7 gun icindeki kayitlar" />
        <StatCard title="Geciken" value={String(lateCount)} hint="Tarihi gecmis kayitlar" />
        <StatCard title="Kritik" value={String(criticalCount)} hint="Yuksek oncelikli hatirlatmalar" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 18 }}>
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

              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as "all" | "today" | "week" | "late")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum zamanlar</option>
                <option value="today">Bugun</option>
                <option value="week">Bu hafta</option>
                <option value="late">Gecikenler</option>
              </select>
            </div>
          </SectionCard>

          <SectionCard title="Kaynaklar">
            <div style={{ display: "grid", gap: 10, lineHeight: 1.8 }}>
              <div>- Manuel takvim kayitlari</div>
              <div>- DOF ve aksiyon terminleri</div>
              <div>- Dokuman gozden gecirme tarihleri</div>
              <div>- Acil durum plani revizyonlari</div>
              <div>- Egitim yenilemeleri</div>
              <div>- Tatbikat planlari</div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Birlesik Zaman Akisi">
            <div style={{ display: "grid", gap: 12 }}>
              {filteredItems.map((item) => {
                const diff = getDateDiff(item.date);
                const dayLabel =
                  diff < 0
                    ? `${Math.abs(diff)} gun gecmis`
                    : diff === 0
                    ? "Bugun"
                    : `${diff} gun kaldi`;

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
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={priorityPill(item.priority)}>{item.priority}</span>
                        <span style={priorityPill(diff < 0 ? "Kritik" : diff <= 7 ? "Yuksek" : "Normal")}>{dayLabel}</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                      <div><strong>Kaynak:</strong> {item.source}</div>
                      <div><strong>Tarih:</strong> {item.date}</div>
                      <div><strong>Sorumlu:</strong> {item.owner}</div>
                      <div><strong>Not:</strong> {item.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
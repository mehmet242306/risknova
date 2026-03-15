"use client";


const createDraftActionId = () => createDraftActionId();

const getDefaultDueDate = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
import { useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import {
  drillRecords as initialDrills,
  emergencyPlans,
  emergencyTeams,
  emergencyTrainings as initialTrainings,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  type EmergencyTeamType,
} from "@/lib/emergency-data";

type TrainingRecord = (typeof initialTrainings)[number];
type DrillRecord = (typeof initialDrills)[number];

type RevisionLog = {
  id: number;
  companyId: number;
  reason: string;
  reviewDate: string;
  note: string;
  createdAt: string;
};

type DraftAction = {
  id: number;
  companyId: number;
  title: string;
  source: string;
  priority: "Orta" | "Yuksek" | "Kritik";
  responsible: string;
  dueDate: string;
  note: string;
};

type ChecklistItem = {
  label: string;
  ok: boolean;
  detail: string;
};

type ResponseMatrixRow = {
  scenario: string;
  leadTeam: string;
  supportTeams: string[];
  firstAction: string;
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
        gridTemplateColumns: "190px 1fr",
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

function calcSupportMinimum(hazardClass: string, employeeCount: number) {
  if (employeeCount < 10) return 1;
  if (hazardClass === "Cok Tehlikeli") return Math.ceil(employeeCount / 30);
  if (hazardClass === "Tehlikeli") return Math.ceil(employeeCount / 40);
  return Math.ceil(employeeCount / 50);
}

function calcFirstAidMinimum(hazardClass: string, employeeCount: number) {
  if (hazardClass === "Cok Tehlikeli") return Math.ceil(employeeCount / 10);
  if (hazardClass === "Tehlikeli") return Math.ceil(employeeCount / 15);
  return Math.ceil(employeeCount / 20);
}

function pillStyle(status: string): React.CSSProperties {
  const bg =
    status === "Guncel"
      ? "#f5fff7"
      : status === "Kismen"
      ? "#fff9ef"
      : status === "Tam"
      ? "#f5fff7"
      : status === "Kismi"
      ? "#fff9ef"
      : status === "Uygun"
      ? "#f5fff7"
      : status === "Uyari"
      ? "#fff9ef"
      : status === "Kritik"
      ? "#ffe9e9"
      : "#fff4f4";

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

function isDateNear(dateStr: string, days: number) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function isWithinLastYear(dateStr: string) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = today.getTime() - target.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);
  return diffDays <= 365;
}

function deriveResponseMatrix(scenarios: string[]): ResponseMatrixRow[] {
  return scenarios.map((scenario) => {
    const s = scenario.toLowerCase();

    if (s.includes("yangin")) {
      return {
        scenario,
        leadTeam: "Sondurme",
        supportTeams: ["Koruma", "Kurtarma", "Ilk Yardim"],
        firstAction: "Alarm ver, enerji kaynaklarini degerlendir, ilk mudahale ve tahliye akisini baslat.",
      };
    }

    if (s.includes("deprem")) {
      return {
        scenario,
        leadTeam: "Kurtarma",
        supportTeams: ["Koruma", "Ilk Yardim", "Sondurme"],
        firstAction: "Cokmeden korun, durum kontrolu yap, tahliye ve toplanma alani yonetimini baslat.",
      };
    }

    if (s.includes("patlama")) {
      return {
        scenario,
        leadTeam: "Koruma",
        supportTeams: ["Sondurme", "Kurtarma", "Ilk Yardim"],
        firstAction: "Alan izolasyonu, ikincil risk kontrolu ve acil tahliye koordinasyonu sagla.",
      };
    }

    if (s.includes("kimyasal")) {
      return {
        scenario,
        leadTeam: "Koruma",
        supportTeams: ["Kurtarma", "Ilk Yardim"],
        firstAction: "Maruziyet alanini sinirla, etkilenen personeli uzaklastir, acil bildirim yap.",
      };
    }

    return {
      scenario,
      leadTeam: "Koruma",
      supportTeams: ["Sondurme", "Kurtarma", "Ilk Yardim"],
      firstAction: "Olayi degerlendir, haberlesmeyi baslat, alan guvenligini sagla.",
    };
  });
}

export default function EmergencyPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(companies[0]?.id ?? 1);
  const [trainings, setTrainings] = useState<TrainingRecord[]>(initialTrainings);
  const [drills, setDrills] = useState<DrillRecord[]>(initialDrills);
  const [revisions, setRevisions] = useState<RevisionLog[]>([]);
  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);

  const [trainingTitle, setTrainingTitle] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingTargetGroup, setTrainingTargetGroup] = useState("");
  const [trainingTrainer, setTrainingTrainer] = useState("");
  const [trainingRenewal, setTrainingRenewal] = useState("");

  const [drillType, setDrillType] = useState("");
  const [drillDate, setDrillDate] = useState("");
  const [drillScenario, setDrillScenario] = useState("");
  const [drillParticipants, setDrillParticipants] = useState("");
  const [drillNextDate, setDrillNextDate] = useState("");

  const [revisionReason, setRevisionReason] = useState("");
  const [revisionDate, setRevisionDate] = useState("");
  const [revisionNote, setRevisionNote] = useState("");

  const company = useMemo(
    () => companies.find((item) => item.id === selectedCompanyId) ?? companies[0],
    [selectedCompanyId]
  );

  const plan = emergencyPlans.find((item) => item.companyId === selectedCompanyId);
  const teams = emergencyTeams.filter((item) => item.companyId === selectedCompanyId);
  const companyTrainings = trainings.filter((item) => item.companyId === selectedCompanyId);
  const companyDrills = drills.filter((item) => item.companyId === selectedCompanyId);
  const companyRevisions = revisions.filter((item) => item.companyId === selectedCompanyId);
  const companyDraftActions = draftActions.filter((item) => item.companyId === selectedCompanyId);

  const supportMinimum = calcSupportMinimum(company.hazardClass, company.employeeCount);
  const firstAidMinimum = calcFirstAidMinimum(company.hazardClass, company.employeeCount);

  const latestDrill = companyDrills[0];
  const nearReview = plan ? isDateNear(plan.nextReviewDate, 90) : false;

  const teamIssues = teams.flatMap((team) => {
    const actualCount = 1 + team.members.length;
    const requiredCount = team.type === "Ilk Yardim" ? firstAidMinimum : supportMinimum;

    const issues: { title: string; note: string; priority: "Orta" | "Yuksek" | "Kritik" }[] = [];

    if (actualCount < requiredCount) {
      issues.push({
        title: `${team.type} ekibi sayi yetersizligi`,
        note: `${team.type} ekibinde mevcut sayi ${actualCount}, gerekli sayi ${requiredCount}.`,
        priority: "Kritik",
      });
    }

    if (team.trainingStatus === "Eksik") {
      issues.push({
        title: `${team.type} ekibi egitim eksigi`,
        note: `${team.type} ekibi icin egitim durumu eksik gorunuyor.`,
        priority: "Yuksek",
      });
    }

    if (team.shiftCoverage === "Yetersiz") {
      issues.push({
        title: `${team.type} ekibi vardiya kapsami yetersiz`,
        note: `${team.type} ekibi tum vardiyalari kapsamayabilir.`,
        priority: "Yuksek",
      });
    }

    if (team.equipmentStatus === "Eksik") {
      issues.push({
        title: `${team.type} ekibi ekipman eksigi`,
        note: `${team.type} ekibi ekipman hazirlik seviyesi eksik.`,
        priority: "Yuksek",
      });
    }

    return issues;
  });

  const latestDrillIsCurrent = latestDrill ? isWithinLastYear(latestDrill.date) : false;

  const checklist: ChecklistItem[] = [
    {
      label: "Acil durum plani mevcut",
      ok: !!plan,
      detail: plan ? `Plan versiyonu ${plan.version}` : "Plan kaydi yok",
    },
    {
      label: "Toplanma alani tanimli",
      ok: !!plan?.assemblyPoint,
      detail: plan?.assemblyPoint || "Toplanma alani tanimli degil",
    },
    {
      label: "Tahliye / kroki notu mevcut",
      ok: !!plan?.evacuationPlanNote,
      detail: plan?.evacuationPlanNote || "Tahliye notu eksik",
    },
    {
      label: "Elektrik kesim noktasi tanimli",
      ok: !!plan?.shutoffPoints.electric,
      detail: plan?.shutoffPoints.electric || "Elektrik kesim noktasi yok",
    },
    {
      label: "Acil iletisim listesi mevcut",
      ok: !!plan?.emergencyContacts?.length,
      detail: plan?.emergencyContacts?.join(", ") || "Iletisim listesi eksik",
    },
    {
      label: "Temel destek ekipleri mevcut",
      ok:
        teams.some((x) => x.type === "Sondurme") &&
        teams.some((x) => x.type === "Kurtarma") &&
        teams.some((x) => x.type === "Koruma"),
      detail: "Sondurme / kurtarma / koruma kontrol edildi",
    },
    {
      label: "Ilk yardim ekibi kritik eksik tasimiyor",
      ok: !teamIssues.some((x) => x.title.toLowerCase().includes("ilk yardim")),
      detail: `Asgari ihtiyac: ${firstAidMinimum}`,
    },
    {
      label: "Son 1 yil icinde tatbikat yapilmis",
      ok: latestDrillIsCurrent,
      detail: latestDrill ? latestDrill.date : "Tatbikat kaydi yok",
    },
    {
      label: "Plan revizyon tarihi kritik degil",
      ok: !nearReview,
      detail: plan?.nextReviewDate || "-",
    },
  ];

  const passedCount = checklist.filter((item) => item.ok).length;
  const readinessScore = Math.round((passedCount / checklist.length) * 100);

  const documentCompleteness = [
    { label: "Acil durum plani", ok: !!plan },
    { label: "Destek ekip listesi", ok: teams.length > 0 },
    { label: "Egitim kaydi", ok: companyTrainings.length > 0 },
    { label: "Tatbikat kaydi", ok: companyDrills.length > 0 },
    { label: "Revizyon kaydi", ok: companyRevisions.length > 0 || !!plan },
  ];

  const documentCompleteCount = documentCompleteness.filter((x) => x.ok).length;
  const documentScore = Math.round((documentCompleteCount / documentCompleteness.length) * 100);

  const managerWarnings = [
    nearReview
      ? {
          title: "Plan revizyon tarihi yaklasiyor",
          note: `Planin sonraki gozden gecirme tarihi ${plan?.nextReviewDate}.`,
          level: "Kritik",
        }
      : null,
    !latestDrillIsCurrent
      ? {
          title: "Tatbikat kaydi guncel degil",
          note: latestDrill ? `Son tatbikat ${latestDrill.date}.` : "Kayitli tatbikat bulunmuyor.",
          level: "Yuksek",
        }
      : null,
    ...teamIssues.slice(0, 5).map((issue) => ({
      title: issue.title,
      note: issue.note,
      level: issue.priority,
    })),
  ].filter(Boolean) as { title: string; note: string; level: string }[];

  const responseMatrix = deriveResponseMatrix(plan?.scenarios || []);

  function addDraftAction(
    title: string,
    source: string,
    priority: "Orta" | "Yuksek" | "Kritik",
    note: string
  ) {
    const responsible =
      company.assignments?.[0]?.fullName ?? company.contacts?.[0]?.name ?? "Atama bekleniyor";

    const nextItem: DraftAction = {
      id: createDraftActionId(),
      companyId: selectedCompanyId,
      title,
      source,
      priority,
      responsible,
      dueDate: getDefaultDueDate(),
      note,
    };

    setDraftActions((prev) => [nextItem, ...prev]);
  }

  function handleAddTraining() {
    if (!trainingTitle.trim() || !trainingDate || !trainingTargetGroup.trim() || !trainingTrainer.trim()) return;

    const nextItem: TrainingRecord = {
      id: Date.now(),
      companyId: selectedCompanyId,
      title: trainingTitle.trim(),
      date: trainingDate,
      targetGroup: trainingTargetGroup.trim(),
      trainer: trainingTrainer.trim(),
      renewalDate: trainingRenewal || trainingDate,
      status: "Guncel",
    };

    setTrainings((prev) => [nextItem, ...prev]);
    setTrainingTitle("");
    setTrainingDate("");
    setTrainingTargetGroup("");
    setTrainingTrainer("");
    setTrainingRenewal("");
  }

  function handleAddDrill() {
    if (!drillType.trim() || !drillDate || !drillScenario.trim()) return;

    const nextItem: DrillRecord = {
      id: Date.now(),
      companyId: selectedCompanyId,
      date: drillDate,
      type: drillType.trim(),
      scenario: drillScenario.trim(),
      participants: Number(drillParticipants || "0"),
      findings: ["Degerlendirme eklenecek"],
      improvements: ["Iyilestirme basliklari eklenecek"],
      nextDrillDate: drillNextDate || drillDate,
    };

    setDrills((prev) => [nextItem, ...prev]);
    setDrillType("");
    setDrillDate("");
    setDrillScenario("");
    setDrillParticipants("");
    setDrillNextDate("");
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleAddRevision() {
    if (!revisionReason.trim() || !revisionDate) return;

    const nextItem: RevisionLog = {
      id: Date.now(),
      companyId: selectedCompanyId,
      reason: revisionReason.trim(),
      reviewDate: revisionDate,
      note: revisionNote.trim(),
      createdAt: new Date().toLocaleString("tr-TR"),
    };

    setRevisions((prev) => [nextItem, ...prev]);
    setRevisionReason("");
    setRevisionDate("");
    setRevisionNote("");
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Acil Durum ve Hazirlik</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu modul; acil durum plani, destek ekipleri, egitimler, tatbikatlar,
          plan revizyonlari ve aksiyon taslaklarini firma bazli yonetmek icin tasarlandi.
        </p>
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
          marginBottom: 18,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Kurum Secimi</div>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 420, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        >
          {companies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard title="Hazirlik Skoru" value={`%${readinessScore}`} hint="Kontrol listesine gore genel durum" />
        <StatCard title="Belge Tamlik" value={`%${documentScore}`} hint="Plan / ekip / egitim / tatbikat / revizyon" />
        <StatCard title="Ekip Uygunluk Sorunu" value={String(teamIssues.length)} hint="Ekip bazli kritik / orta eksikler" />
        <StatCard title="Aksiyon Taslagi" value={String(companyDraftActions.length)} hint="Emergency modulunden olusan taslaklar" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Yonetici Ozeti">
            {managerWarnings.length === 0 ? (
              <div style={{ lineHeight: 1.8 }}>
                Kritik uyarÃ„Â± gorunmuyor. Hazirlik skoru ve belge tamlik durumu kontrol altinda.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {managerWarnings.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={pillStyle(item.level)}>{item.level}</div>
                    </div>
                    <div style={{ opacity: 0.82, marginBottom: 10 }}>{item.note}</div>
                    <button
                      onClick={() => addDraftAction(item.title, "Manager Summary", item.level as "Orta" | "Yuksek" | "Kritik", item.note)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fafafa",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      DOF Taslagi Olustur
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Acil Durum Eylem Plani">
            {plan ? (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
                  <div>
                    <InfoRow label="Plan Versiyonu" value={plan.version} />
                    <InfoRow label="Hazirlanma Tarihi" value={plan.preparedDate} />
                    <InfoRow label="Gecerlilik Sonu" value={plan.validUntil} />
                    <InfoRow label="Sonraki Gozden Gecirme" value={plan.nextReviewDate} />
                    <InfoRow label="Onaylayan" value={plan.approvedBy} />
                    <InfoRow label="Toplanma Alani" value={plan.assemblyPoint} />
                    <InfoRow label="En Yakin Hastane" value={plan.nearestHospital} />
                    <InfoRow label="Haberlesme Yontemi" value={plan.communicationMethod} />
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Acil Iletisim Zinciri</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {plan.emergencyContacts.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 12,
                            padding: 10,
                            background: "#fafafa",
                          }}
                        >
                          {index + 1}. {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                  <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, background: "#fafafa" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Elektrik Kesim Noktasi</div>
                    <div>{plan.shutoffPoints.electric}</div>
                  </div>

                  <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, background: "#fafafa" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Gaz Kesim Noktasi</div>
                    <div>{plan.shutoffPoints.gas}</div>
                  </div>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, background: "#fafafa" }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Tahliye / Kroki Notu</div>
                  <div>{plan.evacuationPlanNote}</div>
                </div>
              </div>
            ) : (
              <div>Bu kurum icin plan kaydi bulunamadi.</div>
            )}
          </SectionCard>

          <SectionCard title="Mudahale Matrisi">
            {responseMatrix.length === 0 ? (
              <div>Senaryo kaydi bulunmuyor.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {responseMatrix.map((row, index) => (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>{row.scenario}</div>
                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Lider Ekip:</strong> {row.leadTeam}</div>
                      <div><strong>Destek Ekipleri:</strong> {row.supportTeams.join(", ")}</div>
                      <div><strong>Ilk Aksiyon:</strong> {row.firstAction}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Destek Ekipleri ve Uygunluk Analizi">
            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              {teams.map((team, index) => {
                const actualCount = 1 + team.members.length;
                const requiredCount = team.type === "Ilk Yardim" ? firstAidMinimum : calcSupportMinimum(company.hazardClass, company.employeeCount);
                const adequacy = actualCount >= requiredCount ? "Guncel" : "Eksik";

                return (
                  <div
                    key={index}
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
                      <div style={{ fontWeight: 800 }}>{team.type} Ekibi</div>
                      <div style={pillStyle(adequacy)}>
                        {actualCount} / {requiredCount} yeterlilik
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Ekip Basi:</strong> {team.leader}</div>
                      <div><strong>Uyeler:</strong> {team.members.join(", ") || "-"}</div>
                      <div><strong>Yedekler:</strong> {team.backups.join(", ") || "-"}</div>
                      <div><strong>Egitim:</strong> <span style={pillStyle(team.trainingStatus)}>{team.trainingStatus}</span></div>
                      <div><strong>Ekipman:</strong> <span style={pillStyle(team.equipmentStatus)}>{team.equipmentStatus}</span></div>
                      <div><strong>Vardiya Kapsami:</strong> <span style={pillStyle(team.shiftCoverage)}>{team.shiftCoverage}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Otomatik Uyari Basliklari</div>

              {teamIssues.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Ekip yapisinda otomatik tespit edilen kritik eksik bulunmuyor.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {teamIssues.map((issue, index) => (
                    <div
                      key={index}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{issue.title}</div>
                      <div style={{ opacity: 0.8, marginBottom: 10 }}>{issue.note}</div>
                      <button
                        onClick={() => addDraftAction(issue.title, "Emergency Team Analysis", issue.priority, issue.note)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fafafa",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        DOF Taslagi Olustur
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Belge Tamlik Durumu">
            <div style={{ display: "grid", gap: 10 }}>
              {documentCompleteness.map((item, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={pillStyle(item.ok ? "Uygun" : "Eksik")}>
                    {item.ok ? "Uygun" : "Eksik"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Uygunluk Kontrol Listesi">
            <div style={{ display: "grid", gap: 10 }}>
              {checklist.map((item, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{item.label}</div>
                    <div style={pillStyle(item.ok ? "Uygun" : "Eksik")}>
                      {item.ok ? "Uygun" : "Eksik"}
                    </div>
                  </div>
                  <div style={{ opacity: 0.8 }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Egitim Takibi">
            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              {companyTrainings.map((item) => (
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
                    <div style={pillStyle(item.status)}>{item.status}</div>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Tarih:</strong> {item.date}</div>
                    <div><strong>Hedef Grup:</strong> {item.targetGroup}</div>
                    <div><strong>Egitimi Veren:</strong> {item.trainer}</div>
                    <div><strong>Yenileme:</strong> {item.renewalDate}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Yeni Egitim Kaydi</div>
              <div style={{ display: "grid", gap: 12 }}>
                <input value={trainingTitle} onChange={(e) => setTrainingTitle(e.target.value)} placeholder="Egitim basligi" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                <input value={trainingTargetGroup} onChange={(e) => setTrainingTargetGroup(e.target.value)} placeholder="Hedef grup" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                <input value={trainingTrainer} onChange={(e) => setTrainingTrainer(e.target.value)} placeholder="Egitimi veren" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                  <input type="date" value={trainingRenewal} onChange={(e) => setTrainingRenewal(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                </div>
                <button
                  onClick={handleAddTraining}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Egitim Kaydi Ekle
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Tatbikat Yonetimi">
            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              {companyDrills.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    {item.type} - {item.date}
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14, marginBottom: 10 }}>
                    <div><strong>Senaryo:</strong> {item.scenario}</div>
                    <div><strong>Katilimci:</strong> {item.participants}</div>
                    <div><strong>Sonraki Tatbikat:</strong> {item.nextDrillDate}</div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Eksikler</div>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      {item.findings.map((finding, index) => (
                        <li key={index}>{finding}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {item.findings.map((finding, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          addDraftAction(
                            `${item.type} tatbikati bulgusu`,
                            "Drill Finding",
                            "Yuksek",
                            finding
                          )
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fafafa",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Eksikten DOF Taslagi
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Yeni Tatbikat Kaydi</div>
              <div style={{ display: "grid", gap: 12 }}>
                <input value={drillType} onChange={(e) => setDrillType(e.target.value)} placeholder="Tatbikat turu" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                <textarea value={drillScenario} onChange={(e) => setDrillScenario(e.target.value)} rows={3} placeholder="Senaryo aciklamasi" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <input type="date" value={drillDate} onChange={(e) => setDrillDate(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                  <input value={drillParticipants} onChange={(e) => setDrillParticipants(e.target.value)} placeholder="Katilimci sayisi" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                  <input type="date" value={drillNextDate} onChange={(e) => setDrillNextDate(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                </div>
                <button
                  onClick={handleAddDrill}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Tatbikat Kaydi Ekle
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Emergency Aksiyon Taslaklari">
            {companyDraftActions.length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                Henuz acil durum modulu icinden olusturulmus taslak aksiyon yok.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {companyDraftActions.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={pillStyle(item.priority)}>{item.priority}</div>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                      <div><strong>Kaynak:</strong> {item.source}</div>
                      <div><strong>Sorumlu:</strong> {item.responsible}</div>
                      <div><strong>Termin:</strong> {item.dueDate}</div>
                      <div><strong>Not:</strong> {item.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
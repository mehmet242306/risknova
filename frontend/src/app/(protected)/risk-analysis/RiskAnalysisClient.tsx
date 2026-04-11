"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusAlert } from "@/components/ui/status-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import {
  loadCompanyDirectory,
  type CompanyRecord,
} from "@/lib/company-directory";

type AnalysisMethod = "r_skor" | "fine_kinney" | "l_matrix";
type DetectionSeverity = "low" | "medium" | "high" | "critical";

type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type RiskLine = {
  id: string;
  title: string;
  description: string;
  images: UploadedImage[];
};

type ParticipantRole = {
  code: string;
  label: string;
};

type Participant = {
  id: string;
  fullName: string;
  roleCode: string;
  title: string;
  certificateNo: string;
};

type AnnotationPoint = {
  x: number;
  y: number;
};

type PinAnnotation = {
  id: string;
  kind: "pin";
  label: string;
  x: number;
  y: number;
};

type BoxAnnotation = {
  id: string;
  kind: "box";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PolygonAnnotation = {
  id: string;
  kind: "polygon";
  label: string;
  points: AnnotationPoint[];
};

type FindingAnnotation = PinAnnotation | BoxAnnotation | PolygonAnnotation;

type VisualFinding = {
  id: string;
  imageId: string;
  title: string;
  category: string;
  confidence: number;
  severity: DetectionSeverity;
  priorityScore: number;
  methodScore: string;
  recommendation: string;
  correctiveActionRequired: boolean;
  annotations: FindingAnnotation[];
};

type LineResult = {
  rowId: string;
  rowTitle: string;
  imageCount: number;
  findings: VisualFinding[];
};

const participantRoleCatalog: ParticipantRole[] = [
  { code: "employer", label: "İşveren" },
  { code: "employer_representative", label: "İşveren Vekili" },
  { code: "ohs_specialist", label: "İş Güvenliği Uzmanı" },
  { code: "workplace_physician", label: "İşyeri Hekimi" },
  { code: "other_health_personnel", label: "Diğer Sağlık Personeli" },
  { code: "employee_representative", label: "Çalışan Temsilcisi" },
  { code: "support_staff", label: "Destek Elemanı" },
  { code: "knowledgeable_employee", label: "Riskler Hakkında Bilgi Sahibi Çalışan" },
];

function createLine(): RiskLine {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    images: [],
  };
}

function createParticipant(): Participant {
  return {
    id: crypto.randomUUID(),
    fullName: "",
    roleCode: "",
    title: "",
    certificateNo: "",
  };
}

function methodLabel(method: AnalysisMethod) {
  switch (method) {
    case "r_skor":
      return "R-SKOR";
    case "fine_kinney":
      return "Fine Kinney";
    case "l_matrix":
      return "L Tipi Matris";
    default:
      return method;
  }
}

function severityLabel(severity: DetectionSeverity) {
  switch (severity) {
    case "low":
      return "Düşük";
    case "medium":
      return "Orta";
    case "high":
      return "Yüksek";
    case "critical":
      return "Kritik";
    default:
      return severity;
  }
}

function severityClass(severity: DetectionSeverity) {
  switch (severity) {
    case "low":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    case "medium":
      return "border border-amber-200 bg-amber-50 text-amber-700";
    case "high":
      return "border border-orange-200 bg-orange-50 text-orange-700";
    case "critical":
      return "border border-red-200 bg-red-50 text-red-700";
    default:
      return "border border-slate-200 bg-slate-50 text-slate-700";
  }
}

function buildMethodScore(method: AnalysisMethod, priorityScore: number) {
  if (method === "r_skor") {
    const score = Math.min(100, priorityScore * 9.5 + 7.2);
    return `${score.toFixed(1)} / ${
      priorityScore >= 9
        ? "Kritik"
        : priorityScore >= 7
          ? "Yüksek"
          : priorityScore >= 5
            ? "Orta"
            : "Düşük"
    }`;
  }

  if (method === "fine_kinney") {
    const score = priorityScore * 18;
    return `${score} / ${
      priorityScore >= 9
        ? "Çok yüksek"
        : priorityScore >= 7
          ? "Yüksek"
          : priorityScore >= 5
            ? "Önemli"
            : "Düşük"
    }`;
  }

  const score = Math.min(25, priorityScore * 2);
  return `${score} / ${
    priorityScore >= 9
      ? "Kabul edilemez"
      : priorityScore >= 7
        ? "Yüksek"
        : priorityScore >= 5
          ? "Orta"
          : "Düşük"
  }`;
}

function getMockFindingsForImage(
  imageId: string,
  imageIndex: number,
  lineIndex: number,
  method: AnalysisMethod,
): VisualFinding[] {
  const patterns: Array<Omit<VisualFinding, "id" | "imageId" | "methodScore">> = [
    {
      title: "KKD eksikliği şüphesi",
      category: "PPE",
      confidence: 0.91,
      severity: "high",
      priorityScore: 8,
      recommendation:
        "Kişi üzerinde gerekli KKD varlığı sahada doğrulanmalı ve eksiklik varsa derhal giderilmelidir.",
      correctiveActionRequired: false,
      annotations: [
        {
          id: crypto.randomUUID(),
          kind: "pin",
          label: "R1",
          x: 58,
          y: 30,
        },
        {
          id: crypto.randomUUID(),
          kind: "box",
          label: "Kişi",
          x: 44,
          y: 18,
          width: 22,
          height: 52,
        },
      ],
    },
    {
      title: "Düşme / takılma riski şüphesi",
      category: "Housekeeping",
      confidence: 0.87,
      severity: "medium",
      priorityScore: 6,
      recommendation:
        "Geçiş yolları, zemin düzeni ve yerdeki engeller saha kontrolüne alınmalıdır.",
      correctiveActionRequired: false,
      annotations: [
        {
          id: crypto.randomUUID(),
          kind: "pin",
          label: "R2",
          x: 42,
          y: 76,
        },
        {
          id: crypto.randomUUID(),
          kind: "polygon",
          label: "Geçiş alanı",
          points: [
            { x: 18, y: 68 },
            { x: 62, y: 66 },
            { x: 70, y: 84 },
            { x: 24, y: 88 },
          ],
        },
      ],
    },
    {
      title: "İstif / devrilme riski şüphesi",
      category: "Storage",
      confidence: 0.89,
      severity: "critical",
      priorityScore: 9,
      recommendation:
        "İstif güvenliği, yük dengesi ve sabitleme önlemleri derhal gözden geçirilmelidir.",
      correctiveActionRequired: true,
      annotations: [
        {
          id: crypto.randomUUID(),
          kind: "pin",
          label: "R3",
          x: 74,
          y: 42,
        },
        {
          id: crypto.randomUUID(),
          kind: "box",
          label: "İstif",
          x: 61,
          y: 20,
          width: 24,
          height: 48,
        },
      ],
    },
    {
      title: "Elektriksel maruziyet şüphesi",
      category: "Electrical",
      confidence: 0.84,
      severity: "high",
      priorityScore: 7,
      recommendation:
        "Açık elektrik ekipmanı veya uygunsuz kablolama ihtimali teknik ekip tarafından incelenmelidir.",
      correctiveActionRequired: false,
      annotations: [
        {
          id: crypto.randomUUID(),
          kind: "pin",
          label: "R4",
          x: 20,
          y: 38,
        },
        {
          id: crypto.randomUUID(),
          kind: "box",
          label: "Pano/Kablo",
          x: 10,
          y: 22,
          width: 18,
          height: 30,
        },
      ],
    },
    {
      title: "Elle taşıma ergonomi riski şüphesi",
      category: "Ergonomi",
      confidence: 0.83,
      severity: "high",
      priorityScore: 7,
      recommendation:
        "Taşıma yöntemi, yük ağırlığı ve yardımcı ekipman kullanımı yeniden değerlendirilmelidir.",
      correctiveActionRequired: false,
      annotations: [
        {
          id: crypto.randomUUID(),
          kind: "pin",
          label: "R5",
          x: 53,
          y: 49,
        },
        {
          id: crypto.randomUUID(),
          kind: "box",
          label: "Yük/Kişi",
          x: 38,
          y: 30,
          width: 26,
          height: 38,
        },
      ],
    },
  ];

  const selectionMatrix = [
    [0, 2],
    [1, 4],
    [3, 1],
    [2, 0, 4],
  ];

  const selectedIndexes =
    selectionMatrix[(lineIndex + imageIndex) % selectionMatrix.length];

  return selectedIndexes.map((patternIndex) => {
    const item = patterns[patternIndex];
    return {
      id: crypto.randomUUID(),
      imageId,
      title: item.title,
      category: item.category,
      confidence: item.confidence,
      severity: item.severity,
      priorityScore: item.priorityScore,
      methodScore: buildMethodScore(method, item.priorityScore),
      recommendation: item.recommendation,
      correctiveActionRequired: item.correctiveActionRequired,
      annotations: item.annotations,
    };
  });
}

function buildMockResults(
  lines: RiskLine[],
  method: AnalysisMethod,
): {
  results: LineResult[];
  selectedImages: Record<string, string>;
  selectedFindings: Record<string, string>;
} {
  const validLines = lines.filter((line) => line.images.length > 0);

  const results = validLines.map((line, lineIndex) => {
    const findings = line.images.flatMap((image, imageIndex) =>
      getMockFindingsForImage(image.id, imageIndex, lineIndex, method),
    );

    return {
      rowId: line.id,
      rowTitle: line.title.trim() || `Satır ${lineIndex + 1}`,
      imageCount: line.images.length,
      findings,
    };
  });

  const selectedImages: Record<string, string> = {};
  const selectedFindings: Record<string, string> = {};

  results.forEach((result) => {
    const firstFinding = result.findings[0];
    if (firstFinding) {
      selectedImages[result.rowId] = firstFinding.imageId;
      selectedFindings[result.rowId] = firstFinding.id;
    }
  });

  return {
    results,
    selectedImages,
    selectedFindings,
  };
}

function annotationStyle(
  style: CSSProperties,
  active: boolean,
): CSSProperties {
  return {
    ...style,
    zIndex: active ? 20 : 10,
  };
}

function renderAnnotation(
  annotation: FindingAnnotation,
  active: boolean,
  onClick: () => void,
) {
  if (annotation.kind === "pin") {
    return (
      <button
        key={annotation.id}
        type="button"
        onClick={onClick}
        title={annotation.label}
        className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg transition-transform hover:scale-105 ${
          active
            ? "border-red-700 bg-red-600 text-white"
            : "border-white bg-slate-900/90 text-white"
        }`}
        style={annotationStyle(
          {
            left: `${annotation.x}%`,
            top: `${annotation.y}%`,
          },
          active,
        )}
      >
        {annotation.label}
      </button>
    );
  }

  if (annotation.kind === "box") {
    return (
      <button
        key={annotation.id}
        type="button"
        onClick={onClick}
        title={annotation.label}
        className={`absolute rounded-md border-2 ${
          active
            ? "border-red-600 bg-red-500/10 shadow-[0_0_0_2px_rgba(220,38,38,0.18)]"
            : "border-cyan-400 bg-cyan-400/10"
        }`}
        style={annotationStyle(
          {
            left: `${annotation.x}%`,
            top: `${annotation.y}%`,
            width: `${annotation.width}%`,
            height: `${annotation.height}%`,
          },
          active,
        )}
      >
        <span
          className={`absolute -top-7 left-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
            active ? "bg-red-600 text-white" : "bg-cyan-500 text-white"
          }`}
        >
          {annotation.label}
        </span>
      </button>
    );
  }

  return (
    <button
      key={annotation.id}
      type="button"
      onClick={onClick}
      className="absolute inset-0"
      title={annotation.label}
      style={annotationStyle({}, active)}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <polygon
          points={annotation.points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill={active ? "rgba(239,68,68,0.18)" : "rgba(6,182,212,0.18)"}
          stroke={active ? "rgb(220,38,38)" : "rgb(8,145,178)"}
          strokeWidth="1.8"
        />
      </svg>

      <span
        className={`absolute rounded-md px-2 py-1 text-[10px] font-semibold ${
          active ? "bg-red-600 text-white" : "bg-cyan-500 text-white"
        }`}
        style={{
          left: `${annotation.points[0]?.x ?? 0}%`,
          top: `${annotation.points[0]?.y ?? 0}%`,
          transform: "translate(-10%, -120%)",
        }}
      >
        {annotation.label}
      </span>
    </button>
  );
}

export function RiskAnalysisClient() {
  const [analysisTitle, setAnalysisTitle] = useState("Saha Risk Analizi");
  const [analysisNote, setAnalysisNote] = useState(
    "Her satır bir risk konusu veya uygunsuzluk grubunu temsil eder. Aynı satıra bir veya birden fazla fotoğraf eklenebilir.",
  );
  const [method, setMethod] = useState<AnalysisMethod>("r_skor");

  const [companies, setCompanies] = useState<CompanyRecord[]>(() => loadCompanyDirectory());
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => loadCompanyDirectory()[0]?.id ?? "");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const [participants, setParticipants] = useState<Participant[]>([
    createParticipant(),
  ]);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupMessageType, setSetupMessageType] = useState<"success" | "error" | "">("");

  const [lines, setLines] = useState<RiskLine[]>([
    {
      id: crypto.randomUUID(),
      title: "İstifleme alanı",
      description:
        "Aynı durumun genel ve yakın açıdan çekilmiş görselleri birlikte eklenebilir.",
      images: [],
    },
  ]);

  const [results, setResults] = useState<LineResult[]>([]);
  const [selectedImageByRow, setSelectedImageByRow] = useState<Record<string, string>>({});
  const [selectedFindingByRow, setSelectedFindingByRow] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedCompany = useMemo(
    () => companies.find((item) => item.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const validParticipants = useMemo(() => {
    return participants.filter(
      (participant) =>
        participant.fullName.trim() && participant.roleCode.trim(),
    );
  }, [participants]);

  const lineMap = useMemo(() => {
    return new Map(lines.map((line) => [line.id, line]));
  }, [lines]);

  const totalImageCount = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.images.length, 0);
  }, [lines]);

  const totalDetectionCount = useMemo(() => {
    return results.reduce((sum, result) => sum + result.findings.length, 0);
  }, [results]);

  const dofCandidateCount = useMemo(() => {
    return results.reduce(
      (sum, result) =>
        sum +
        result.findings.filter((finding) => finding.correctiveActionRequired).length,
      0,
    );
  }, [results]);

  const highestPriority = useMemo(() => {
    const scores = results.flatMap((result) =>
      result.findings.map((finding) => finding.priorityScore),
    );
    return scores.length ? Math.max(...scores) : 0;
  }, [results]);

  function validateSetup(): string | null {
    if (!selectedCompanyId) {
      return "Önce firma / kurum seçmelisin.";
    }

    if (!selectedLocation) {
      return "Lokasyon / çalışma alanı seçmelisin.";
    }

    if (!selectedDepartment) {
      return "Bölüm / birim seçmelisin.";
    }

    if (validParticipants.length === 0) {
      return "En az bir görevli kişi adı ve rolü girilmelidir.";
    }

    return null;
  }

  function handlePrepareSetup() {
    const error = validateSetup();

    if (error) {
      setSetupMessage(error);
      setSetupMessageType("error");
      return;
    }

    setSetupMessage("Firma / kurum ve analiz ekibi bilgileri bu analiz için hazırlandı.");
    setSetupMessageType("success");
  }

  function updateParticipant(
    participantId: string,
    field: keyof Omit<Participant, "id">,
    value: string,
  ) {
    setParticipants((prev) =>
      prev.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              [field]: value,
            }
          : participant,
      ),
    );
    setSetupMessage("");
    setSetupMessageType("");
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, createParticipant()]);
    setSetupMessage("");
    setSetupMessageType("");
  }

  function removeParticipant(participantId: string) {
    setParticipants((prev) =>
      prev.length === 1 ? prev : prev.filter((participant) => participant.id !== participantId),
    );
    setSetupMessage("");
    setSetupMessageType("");
  }

  function updateLine(
    lineId: string,
    field: "title" | "description",
    value: string,
  ) {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: value,
            }
          : line,
      ),
    );
    setResults([]);
  }

  function appendFiles(lineId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const nextImages = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              images: [...line.images, ...nextImages],
            }
          : line,
      ),
    );

    setResults([]);
  }

  function removeImage(lineId: string, imageId: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const target = line.images.find((image) => image.id === imageId);
        if (target) {
          URL.revokeObjectURL(target.previewUrl);
        }

        return {
          ...line,
          images: line.images.filter((image) => image.id !== imageId),
        };
      }),
    );

    setResults((prev) =>
      prev.map((result) =>
        result.rowId === lineId
          ? {
              ...result,
              findings: result.findings.filter((finding) => finding.imageId !== imageId),
            }
          : result,
      ),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, createLine()]);
    setResults([]);
  }

  function removeLine(lineId: string) {
    setLines((prev) => {
      const target = prev.find((line) => line.id === lineId);
      if (target) {
        target.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      }
      return prev.filter((line) => line.id !== lineId);
    });

    setResults((prev) => prev.filter((result) => result.rowId !== lineId));

    setSelectedImageByRow((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });

    setSelectedFindingByRow((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  async function handleAnalyze() {
    const setupError = validateSetup();

    if (setupError) {
      setSetupMessage(setupError);
      setSetupMessageType("error");
      return;
    }

    if (totalImageCount === 0) {
      setSetupMessage("Analiz başlatmak için en az bir görsel eklemelisin.");
      setSetupMessageType("error");
      return;
    }

    setIsAnalyzing(true);
    setResults([]);

    await new Promise((resolve) => setTimeout(resolve, 1800));

    const built = buildMockResults(lines, method);
    setResults(built.results);
    setSelectedImageByRow(built.selectedImages);
    setSelectedFindingByRow(built.selectedFindings);

    setSetupMessage("Analiz bağlamı doğrulandı ve risk tespit ekranı hazırlandı.");
    setSetupMessageType("success");
    setIsAnalyzing(false);
  }

  function resetAll() {
    lines.forEach((line) =>
      line.images.forEach((image) => URL.revokeObjectURL(image.previewUrl)),
    );

    setAnalysisTitle("Saha Risk Analizi");
    setAnalysisNote(
      "Her satır bir risk konusu veya uygunsuzluk grubunu temsil eder. Aynı satıra bir veya birden fazla fotoğraf eklenebilir.",
    );
    setMethod("r_skor");
    const loaded = loadCompanyDirectory();
    setCompanies(loaded);
    setSelectedCompanyId(loaded[0]?.id ?? "");
    setSelectedLocation("");
    setSelectedDepartment("");
    setParticipants([createParticipant()]);
    setSetupMessage("");
    setSetupMessageType("");
    setLines([createLine()]);
    setResults([]);
    setSelectedImageByRow({});
    setSelectedFindingByRow({});
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Risk Analizi"
        title="Firma Bağlamlı ve Ekip Katılımlı Risk Analizi"
        description="Risk analizi firma / kurum seçilerek başlar, analiz ekibi tanımlanır, sonra satır bazlı görsel risk tespiti ve anotasyonlu sonuçlar oluşturulur."
        meta={
          <>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Firma / kurum seçimi
            </span>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Dinamik analiz ekibi
            </span>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Anotasyonlu görsel akış
            </span>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.97)_100%)] p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-foreground">
                Analiz Bağlamı
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Bu risk analizinin hangi firma / kurum, lokasyon ve bölüm için yapıldığını seç.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                  Firma / Kurum
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(event) => {
                    setSelectedCompanyId(event.target.value);
                    setSelectedLocation("");
                    setSelectedDepartment("");
                    setSetupMessage("");
                    setSetupMessageType("");
                  }}
                  className="h-12 rounded-2xl border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.95)_100%)] px-4 text-sm text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors transition-shadow hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring),0_12px_28px_rgba(11,95,193,0.12)]"
                >
                  <option value="">Firma / kurum seç</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                  Analiz Yöntemi
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={method === "r_skor" ? "accent" : "outline"}
                    onClick={() => setMethod("r_skor")}
                  >
                    R-SKOR
                  </Button>
                  <Button
                    type="button"
                    variant={method === "fine_kinney" ? "accent" : "outline"}
                    onClick={() => setMethod("fine_kinney")}
                  >
                    Fine Kinney
                  </Button>
                  <Button
                    type="button"
                    variant={method === "l_matrix" ? "accent" : "outline"}
                    onClick={() => setMethod("l_matrix")}
                  >
                    L Tipi Matris
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                  Lokasyon / Çalışma Alanı
                </label>
                <select
                  value={selectedLocation}
                  onChange={(event) => setSelectedLocation(event.target.value)}
                  className="h-12 rounded-2xl border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.95)_100%)] px-4 text-sm text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors transition-shadow hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring),0_12px_28px_rgba(11,95,193,0.12)]"
                >
                  <option value="">Lokasyon seç</option>
                  {(selectedCompany?.locations ?? []).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                  Bölüm / Birim
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(event) => setSelectedDepartment(event.target.value)}
                  className="h-12 rounded-2xl border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.95)_100%)] px-4 text-sm text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors transition-shadow hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring),0_12px_28px_rgba(11,95,193,0.12)]"
                >
                  <option value="">Bölüm seç</option>
                  {(selectedCompany?.departments ?? []).map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <Link href="/companies">
                <Button type="button" variant="outline">
                  Firma / Kurum Yapısını Düzenle
                </Button>
              </Link>
            </div>

            <div className="mt-5 grid gap-4">
              <Input
                label="Analiz Başlığı"
                value={analysisTitle}
                onChange={(event) => setAnalysisTitle(event.target.value)}
              />
              <Textarea
                label="Analiz Notu"
                rows={4}
                value={analysisNote}
                onChange={(event) => setAnalysisNote(event.target.value)}
              />
            </div>

            {selectedCompany ? (
              <div className="mt-5 rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Seçili Kurum Özeti
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-foreground">
                  {selectedCompany.name}
                </p>
                <p className="mt-1 text-sm leading-7 text-muted-foreground">
                  Tür: {selectedCompany.kind || "-"} · Adres: {selectedCompany.address || "-"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.75rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.97)_100%)] p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Risk Analizinde Görev Alanlar
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Analizde görev alan kişileri dinamik olarak ekle. Kişi adı ve rol seçimi zorunludur.
                </p>
              </div>

              <Button type="button" variant="outline" onClick={addParticipant}>
                Görevli Ekle
              </Button>
            </div>

            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div
                  key={participant.id}
                  className="rounded-[1.25rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.96)_100%)] p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Görevli {index + 1}
                      </p>
                    </div>

                    {participants.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeParticipant(participant.id)}
                      >
                        Sil
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Ad Soyad"
                      value={participant.fullName}
                      onChange={(event) =>
                        updateParticipant(participant.id, "fullName", event.target.value)
                      }
                    />

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">
                        Rol / Ünvan Türü
                      </label>
                      <select
                        value={participant.roleCode}
                        onChange={(event) =>
                          updateParticipant(participant.id, "roleCode", event.target.value)
                        }
                        className="h-12 rounded-2xl border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.95)_100%)] px-4 text-sm text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors transition-shadow hover:border-primary/30 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring),0_12px_28px_rgba(11,95,193,0.12)]"
                      >
                        <option value="">Rol seç</option>
                        {participantRoleCatalog.map((role) => (
                          <option key={role.code} value={role.code}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Input
                      label="Görev / Unvan Açıklaması"
                      value={participant.title}
                      onChange={(event) =>
                        updateParticipant(participant.id, "title", event.target.value)
                      }
                      placeholder="Örn. A sınıfı uzman, kurum müdürü, çalışan temsilcisi"
                    />

                    <Input
                      label="Belge / Sertifika No (varsa)"
                      value={participant.certificateNo}
                      onChange={(event) =>
                        updateParticipant(participant.id, "certificateNo", event.target.value)
                      }
                      placeholder="İSG uzmanı / hekim için varsa gir"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button type="button" size="lg" variant="accent" onClick={handlePrepareSetup}>
                Ekip ve Kurum Bilgilerini Hazırla
              </Button>

              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  setParticipants([createParticipant()]);
                  setSetupMessage("");
                  setSetupMessageType("");
                }}
              >
                Görevli Alanını Sıfırla
              </Button>
            </div>

            {setupMessage ? (
  <StatusAlert
    tone={setupMessageType === "success" ? "success" : "danger"}
    className="mt-5"
  >
    {setupMessage}
  </StatusAlert>
) : null}
          </div>

          <div className="rounded-[1.75rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.97)_100%)] p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Risk Satırları
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Her satır bir risk konusu, alan veya uygunsuzluk grubunu temsil eder.
                </p>
              </div>

              <Button type="button" variant="outline" onClick={addLine}>
                Yeni Satır Ekle
              </Button>
            </div>

            <div className="space-y-5">
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="rounded-[1.5rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.97)_100%)] p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Satır {index + 1}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Aynı durumun genel ve yakın açıları bu satır altında toplanabilir.
                      </p>
                    </div>

                    {lines.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeLine(line.id)}
                      >
                        Satırı Sil
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4">
                    <Input
                      label="Satır Başlığı"
                      value={line.title}
                      onChange={(event) =>
                        updateLine(line.id, "title", event.target.value)
                      }
                      placeholder="Örn. İstifleme alanı / elektrik panosu / geçiş yolu"
                    />

                    <Textarea
                      label="Satır Açıklaması"
                      rows={4}
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.id, "description", event.target.value)
                      }
                      placeholder="Bu satırdaki risk grubunu veya uygunsuzluğu açıkla."
                    />
                  </div>

                  <input
                    ref={(node) => {
                      fileInputRefs.current[line.id] = node;
                    }}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      appendFiles(line.id, event.target.files)
                    }
                  />

                  <input
                    ref={(node) => {
                      cameraInputRefs.current[line.id] = node;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      appendFiles(line.id, event.target.files)
                    }
                  />

                  <div className="mt-5 rounded-[1.25rem] border border-dashed border-primary/20 bg-[linear-gradient(135deg,rgba(11,95,193,0.08)_0%,rgba(255,255,255,0.95)_55%,rgba(96,165,250,0.10)_100%)] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        onClick={() => fileInputRefs.current[line.id]?.click()}
                      >
                        Bu Satıra Görsel Ekle
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => cameraInputRefs.current[line.id]?.click()}
                      >
                        Kameradan Ekle
                      </Button>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      Sistem ileride aynı satırdaki çoklu görselleri tek risk grubunun ortak kanıtı olarak değerlendirecek.
                    </p>
                  </div>

                  {line.images.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] text-sm leading-7 text-muted-foreground">
                      Bu satıra henüz görsel eklenmedi.
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {line.images.map((image) => (
                        <div
                          key={image.id}
                          className="overflow-hidden rounded-[1.25rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.96)_100%)] shadow-[0_10px_22px_rgba(15,23,42,0.05)]"
                        >
                          <div className="aspect-[4/3] bg-slate-100">
                            <img
                              src={image.previewUrl}
                              alt={image.file.name}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="space-y-2 p-3">
                            <p className="break-all text-sm font-medium text-foreground">
                              {image.file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(image.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>

                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => removeImage(line.id, image.id)}
                            >
                              Görseli Kaldır
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.97)_100%)] p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold text-foreground">
              Analiz Paneli
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Firma, lokasyon, bölüm ve ekip bilgileri olmadan analiz başlatılmaz.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Firma / Kurum
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-foreground">
                  {selectedCompany?.name ?? "-"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Lokasyon
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {selectedLocation || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Bölüm
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {selectedDepartment || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Görevli Sayısı
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {validParticipants.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Görsel Sayısı
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {totalImageCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Yöntem
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {methodLabel(method)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={totalImageCount === 0 || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? "Analiz hazırlanıyor..." : "Risk Analizini Başlat"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={resetAll}
              >
                Formu Temizle
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                En Yüksek Öncelik
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {highestPriority || "-"}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                1 en düşük operasyonel öncelik, 10 ise derhal ele alınması gereken risk anlamına gelir.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Toplam Tespit
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {totalDetectionCount}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                DÖF Adayı Tespitler
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {dofCandidateCount}
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.97)_100%)] p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold text-foreground">
              Analiz Ekibi Özeti
            </h2>

            {validParticipants.length === 0 ? (
  <div className="mt-4">
    <EmptyState
      compact
      title="Henüz tamamlanmış görevli bilgisi yok"
      description="Kişi adı ve rol seçildiğinde ekip özeti burada görünür."
    />
  </div>
) : (
              <div className="mt-4 space-y-3">
                {validParticipants.map((participant, index) => {
                  const role =
                    participantRoleCatalog.find((item) => item.code === participant.roleCode)
                      ?.label ?? participant.roleCode;

                  return (
                    <div
                      key={participant.id}
                      className="rounded-2xl border border-border bg-white px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Görevli {index + 1}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {participant.fullName}
                      </p>
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">
                        {role}
                        {participant.title ? ` · ${participant.title}` : ""}
                      </p>
                      {participant.certificateNo ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Belge / Sertifika No: {participant.certificateNo}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="rounded-[1.75rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.97)_100%)] p-6 shadow-[var(--shadow-card)]">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-foreground">
            Anotasyonlu Tespit Sonuçları
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Risk kartı ile görsel üstündeki anotasyonlar birbirine bağlı çalışır.
          </p>
        </div>

        {isAnalyzing ? (
  <div className="grid gap-4 xl:grid-cols-2">
    <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-[var(--shadow-soft)]">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-4 h-64 w-full rounded-[1.25rem]" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>

    <div className="rounded-[1.5rem] border border-border bg-white p-5 shadow-[var(--shadow-soft)]">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="mt-3 h-28 w-full" />
      <Skeleton className="mt-3 h-28 w-full" />
    </div>
  </div>
) : results.length === 0 ? (
  <EmptyState
    title="Henüz sonuç üretilmedi"
    description="Önce kurum ve ekip bilgilerini tamamlayıp ardından satırlara görsel ekleyerek analizi başlat. Sonuç kartları ve anotasyonlar burada görünecek."
  />
) : (
          <div className="space-y-6">
            {results.map((result, resultIndex) => {
              const sourceLine = lineMap.get(result.rowId);
              const images = sourceLine?.images ?? [];
              const selectedImageId =
                selectedImageByRow[result.rowId] ?? images[0]?.id ?? "";
              const selectedFindingId =
                selectedFindingByRow[result.rowId] ?? result.findings[0]?.id ?? "";
              const selectedImage =
                images.find((image) => image.id === selectedImageId) ?? images[0];
              const visibleFindings = result.findings.filter(
                (finding) => finding.imageId === selectedImage?.id,
              );

              return (
                <div
                  key={result.rowId}
                  className="rounded-[1.5rem] border border-border bg-white p-5"
                >
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Satır {resultIndex + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {result.rowTitle}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      İlişkili görsel sayısı: {result.imageCount} · Tespit sayısı:{" "}
                      {result.findings.length}
                    </p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        {images.map((image, imageIndex) => {
                          const imageFindings = result.findings.filter(
                            (finding) => finding.imageId === image.id,
                          );
                          const active = selectedImage?.id === image.id;

                          return (
                            <button
                              key={image.id}
                              type="button"
                              onClick={() => {
                                setSelectedImageByRow((prev) => ({
                                  ...prev,
                                  [result.rowId]: image.id,
                                }));

                                if (imageFindings[0]) {
                                  setSelectedFindingByRow((prev) => ({
                                    ...prev,
                                    [result.rowId]: imageFindings[0].id,
                                  }));
                                }
                              }}
                              className={`overflow-hidden rounded-2xl border text-left transition-colors ${
                                active
                                  ? "border-primary shadow-[var(--shadow-soft)]"
                                  : "border-border hover:border-primary/40 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                              }`}
                            >
                              <div className="aspect-[4/3] bg-slate-100">
                                <img
                                  src={image.previewUrl}
                                  alt={image.file.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Görsel {imageIndex + 1}
                                </p>
                                <p className="mt-1 truncate text-sm font-medium text-foreground">
                                  {image.file.name}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Risk sayısı: {imageFindings.length}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedImage ? (
                        <div className="overflow-hidden rounded-[1.5rem] border border-border bg-[linear-gradient(135deg,rgba(11,95,193,0.08)_0%,rgba(255,255,255,0.97)_55%,rgba(96,165,250,0.12)_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
                          <div className="relative aspect-[4/3]">
                            <img
                              src={selectedImage.previewUrl}
                              alt={selectedImage.file.name}
                              className="h-full w-full object-cover"
                            />

                            <div className="absolute inset-0">
                              {visibleFindings.map((finding) =>
                                finding.annotations.map((annotation) =>
                                  renderAnnotation(
                                    annotation,
                                    selectedFindingId === finding.id,
                                    () => {
                                      setSelectedFindingByRow((prev) => ({
                                        ...prev,
                                        [result.rowId]: finding.id,
                                      }));
                                    },
                                  ),
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {visibleFindings.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(234,242,251,0.70)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] text-sm leading-7 text-muted-foreground">
                          Seçilen görsel için tespit bulunamadı.
                        </div>
                      ) : (
                        visibleFindings.map((finding, findingIndex) => {
                          const active = selectedFindingId === finding.id;

                          return (
                            <button
                              key={finding.id}
                              type="button"
                              onClick={() => {
                                setSelectedFindingByRow((prev) => ({
                                  ...prev,
                                  [result.rowId]: finding.id,
                                }));

                                setSelectedImageByRow((prev) => ({
                                  ...prev,
                                  [result.rowId]: finding.imageId,
                                }));
                              }}
                              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                active
                                  ? "border-[#0b5fc1]/40 bg-[linear-gradient(135deg,rgba(11,95,193,0.10)_0%,rgba(255,255,255,0.97)_58%,rgba(96,165,250,0.12)_100%)] shadow-[0_18px_36px_rgba(11,95,193,0.16)]"
                                  : "border-border bg-muted/50 hover:border-primary/40 hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Risk {findingIndex + 1}
                                  </p>
                                  <h4 className="mt-1 text-base font-semibold text-foreground">
                                    {finding.title}
                                  </h4>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Sınıf: {finding.category}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClass(finding.severity)}`}
                                  >
                                    {severityLabel(finding.severity)}
                                  </span>

                                  <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                    Öncelik: {finding.priorityScore}/10
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-border bg-white px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Confidence
                                  </p>
                                  <p className="mt-2 text-sm font-medium text-foreground">
                                    %{Math.round(finding.confidence * 100)}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-border bg-white px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    {methodLabel(method)} Skoru
                                  </p>
                                  <p className="mt-2 text-sm font-medium text-foreground">
                                    {finding.methodScore}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-border bg-white px-3 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Öneri
                                </p>
                                <p className="mt-2 text-sm leading-7 text-foreground">
                                  {finding.recommendation}
                                </p>
                              </div>

                              {finding.correctiveActionRequired ? (
                                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
                                  Bu tespit DÖF adayı olarak işaretlenmelidir.
                                </div>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

















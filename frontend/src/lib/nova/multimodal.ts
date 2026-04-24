export type NovaImageAnalysis = {
  fileName: string;
  mimeType: string;
  imageDescription: string;
  areaSummary: string;
  notableRisks: string[];
  positiveObservations: string[];
  personCount: number | null;
};

type AnalyzeRiskApiResponse = {
  risks?: Array<{ title?: string | null }>;
  positiveObservations?: string[];
  areaSummary?: string;
  personCount?: number;
  imageDescription?: string;
  error?: string;
  message?: string;
};

export const NOVA_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const NOVA_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const NOVA_IMAGE_MAX_EDGE = 1600;
const NOVA_IMAGE_JPEG_QUALITY = 0.86;

export function validateNovaImageFile(file: File) {
  if (!NOVA_IMAGE_MIME_TYPES.includes(file.type as (typeof NOVA_IMAGE_MIME_TYPES)[number])) {
    return "Desteklenmeyen gorsel turu. JPG, PNG, GIF veya WEBP yukleyin.";
  }

  if (file.size <= 0 || file.size > NOVA_IMAGE_MAX_BYTES) {
    return "Gorsel boyutu cok buyuk. Maksimum 8 MB yukleyebilirsiniz.";
  }

  return null;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Dosya okunamadi."));
    reader.readAsDataURL(file);
  });
}

async function loadImage(dataUrl: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gorsel onizleme icin okunamadi."));
    image.src = dataUrl;
  });
}

async function prepareImageForNova(file: File) {
  const originalDataUrl = await fileToDataUrl(file);

  if (typeof document === "undefined") {
    return { dataUrl: originalDataUrl, mimeType: file.type };
  }

  try {
    const image = await loadImage(originalDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      return { dataUrl: originalDataUrl, mimeType: file.type };
    }

    const largestEdge = Math.max(sourceWidth, sourceHeight);
    if (file.size <= 1_200_000 && largestEdge <= NOVA_IMAGE_MAX_EDGE) {
      return { dataUrl: originalDataUrl, mimeType: file.type };
    }

    const scale = Math.min(1, NOVA_IMAGE_MAX_EDGE / largestEdge);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return { dataUrl: originalDataUrl, mimeType: file.type };
    }

    context.drawImage(image, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", NOVA_IMAGE_JPEG_QUALITY),
      mimeType: "image/jpeg",
    };
  } catch {
    return { dataUrl: originalDataUrl, mimeType: file.type };
  }
}

function extractBase64Payload(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export async function analyzeNovaImage(file: File): Promise<NovaImageAnalysis> {
  const validationError = validateNovaImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const preparedImage = await prepareImageForNova(file);
  const response = await fetch("/api/nova/image-context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageBase64: extractBase64Payload(preparedImage.dataUrl),
      mimeType: preparedImage.mimeType,
      fileName: file.name,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as AnalyzeRiskApiResponse;
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Nova gorseli su anda okuyamadi. Lutfen tekrar deneyin.");
  }

  return {
    fileName: file.name,
    mimeType: file.type,
    imageDescription: payload.imageDescription || "",
    areaSummary: payload.areaSummary || "",
    notableRisks: Array.isArray(payload.risks)
      ? payload.risks
          .map((risk) => String(risk?.title || "").trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    positiveObservations: Array.isArray(payload.positiveObservations)
      ? payload.positiveObservations.filter(Boolean).slice(0, 5)
      : [],
    personCount:
      typeof payload.personCount === "number" && Number.isFinite(payload.personCount)
        ? payload.personCount
        : null,
  };
}

export function buildNovaPromptWithImage(
  message: string,
  image: NovaImageAnalysis | null,
  fallbackPrompt = "Bu gorseli ISG acisindan yorumlar misin?",
) {
  const cleanMessage = message.trim();
  const basePrompt = cleanMessage || (image ? fallbackPrompt : "");

  if (!image) {
    return basePrompt;
  }

  const parts = [basePrompt, "", "[Gorsel Baglami]"];
  parts.push(`Dosya: ${image.fileName}`);

  if (image.imageDescription) {
    parts.push(`Gorsel ozeti: ${image.imageDescription}`);
  }

  if (image.areaSummary) {
    parts.push(`Alan ozeti: ${image.areaSummary}`);
  }

  if (image.personCount != null) {
    parts.push(`Tahmini kisi sayisi: ${image.personCount}`);
  }

  if (image.notableRisks.length > 0) {
    parts.push("Olasi riskler:");
    image.notableRisks.forEach((risk) => parts.push(`- ${risk}`));
  }

  if (image.positiveObservations.length > 0) {
    parts.push("Olumlu gozlemler:");
    image.positiveObservations.forEach((item) => parts.push(`- ${item}`));
  }

  parts.push("[/Gorsel Baglami]");
  return parts.join("\n");
}

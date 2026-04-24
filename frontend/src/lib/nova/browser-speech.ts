export type BrowserSpeechRecognitionAlternative = {
  transcript?: string;
};

export type BrowserSpeechRecognitionResult = {
  isFinal?: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative | undefined;
};

export type BrowserSpeechRecognitionEvent = {
  resultIndex?: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult | undefined;
  };
};

export type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function getBrowserSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function toSpeechRecognitionLocale(locale?: string | null) {
  const normalized = String(locale || "tr").toLowerCase();
  if (normalized.startsWith("tr")) return "tr-TR";
  if (normalized.startsWith("en")) return "en-US";
  return normalized.includes("-") ? normalized : `${normalized}-${normalized.toUpperCase()}`;
}

export function collectSpeechTranscript(
  event: BrowserSpeechRecognitionEvent,
  options: { finalOnly?: boolean } = {},
) {
  const finalOnly = options.finalOnly ?? true;
  const parts: string[] = [];
  const start = Math.max(0, event.resultIndex ?? 0);

  for (let index = start; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (!result) continue;
    if (finalOnly && !result.isFinal) continue;
    const transcript = result[0]?.transcript?.trim();
    if (transcript) parts.push(transcript);
  }

  return parts.join(" ").trim();
}

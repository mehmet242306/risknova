export type NovaUiLanguage = "tr" | "en";

export function getNovaUiLanguage(locale?: string | null): NovaUiLanguage {
  return String(locale || "").toLowerCase().startsWith("tr") ? "tr" : "en";
}

type NovaUiCopy = {
  quickActions: {
    workspace: string;
    planner: string;
    newIncident: string;
    documents: string;
    login: string;
    register: string;
  };
  widget: {
    welcomeAuthenticated: string;
    welcomePublic: string;
    publicLocked: string;
    initializing: string;
    unavailable: string;
    redirecting: (label: string) => string;
    subtitle: string;
    openAriaLabel: string;
    minimizeAriaLabel: string;
    closeAriaLabel: string;
    sourceCount: (count: number) => string;
    navigationTitle: string;
    gotoPage: string;
    workflowLabel: string;
    nextStepLabel: string;
    openLabel: string;
    continueLabel: string;
    toolPreviewLabel: string;
    draftReadyLabel: string;
    safetyBlockLabel: string;
    continueInWorkspace: string;
    approveAction: string;
    cancelAction: string;
    actionRunning: string;
    actionDone: string;
    currentPageLabel: string;
    authenticatedPlaceholder: string;
    publicPlaceholder: string;
  };
  solutionCenter: {
    modes: Array<{ label: string; hint: string; badge: string }>;
    quickQuestions: string[];
    welcomeDescription: string;
    unavailable: string;
    briefEyebrow: string;
    focusQuestion: string;
    loadingBrief: string;
    routeTitle: string;
    actionReadyBadge: string;
    nextStepsLabel: string;
    workflowLabel: string;
    nextStepLabel: string;
    navigationTitle: string;
    gotoPage: string;
    toolPreviewLabel: string;
    draftReadyLabel: string;
    safetyBlockLabel: string;
    approveAction: string;
    cancelAction: string;
    actionRunning: string;
    actionDone: string;
    sourceCount: (count: number) => string;
    documentType: (isPptx: boolean, ext: string) => string;
    helpful: string;
    lacking: string;
    saved: string;
    save: string;
    copy: string;
  };
};

const trCopy: NovaUiCopy = {
  quickActions: {
    workspace: "Nova Calisma Alani",
    planner: "Planlayici",
    newIncident: "Yeni Olay",
    documents: "Dokumanlar",
    login: "Giris Yap",
    register: "Hesap Olustur",
  },
  widget: {
    welcomeAuthenticated:
      "Merhaba! Ben Nova. Mevzuati yorumlayabilir, sizi dogru modullere goturebilir, egitim veya gorev planlayabilir, olay taslagi baslatabilir ve dokuman akislarini hazirlayabilirim.",
    welcomePublic:
      "Merhaba! Gercek Nova ajanina erismek icin giris yapmaniz gerekir. Isterseniz hemen oturum acin veya hesap olusturun.",
    publicLocked:
      "Bu alandaki hafif cevap katmani kaldirildi. Gercek Nova ajanina erismek icin giris yapin ve isteginizi burada veya Solution Center'da surdurun.",
    initializing: "Lutfen bir saniye, Nova hazirlaniyor...",
    unavailable:
      "Nova su anda cevap veremiyor. Lutfen biraz sonra tekrar deneyin veya Solution Center uzerinden devam edin.",
    redirecting: (label) => `${label} sayfasina yonlendiriliyorsunuz...`,
    subtitle: "AI ISG Asistani",
    openAriaLabel: "Nova asistanini ac",
    minimizeAriaLabel: "Kucult",
    closeAriaLabel: "Kapat ve konusmayi sifirla",
    sourceCount: (count) => `${count} mevzuat kaynagi`,
    navigationTitle: "Sayfa Yonlendirme",
    gotoPage: "Sayfaya Git",
    workflowLabel: "Nova Workflow",
    nextStepLabel: "Siradaki",
    openLabel: "Ac",
    continueLabel: "Devam",
    toolPreviewLabel: "Nova Aksiyon Onerisi",
    draftReadyLabel: "Taslak Hazir",
    safetyBlockLabel: "Guvenlik Kisitlamasi",
    continueInWorkspace: "Solution Center'da devam et",
    approveAction: "Onayla",
    cancelAction: "Iptal Et",
    actionRunning: "Isleniyor...",
    actionDone: "Tamamlandi",
    currentPageLabel: "Su an",
    authenticatedPlaceholder: "Nova'ya sorun...",
    publicPlaceholder: "Gercek Nova ajani icin giris yapin...",
  },
  solutionCenter: {
    modes: [
      { label: "Mevzuat", hint: "mevzuati yorumlasin, kaynak gostersin ve riskleri aciklasin", badge: "RAG" },
      { label: "Planlama", hint: "egitim, kurul ve operasyon gorevlerini olustursun", badge: "ACTION" },
      { label: "Olay", hint: "ramak kala ve kaza taslaklarini baslatsin", badge: "INCIDENT" },
      { label: "Dokuman", hint: "prosedur, rapor ve editor taslaklari hazirlasin", badge: "DOC" },
    ],
    quickQuestions: [
      "25 Haziran'a yuksekte calisma egitimi planla",
      "28 Haziran icin aylik kurul toplantisi gorevi olustur",
      "Yeni bir ramak kala olay taslagi baslat",
      "Acil durum proseduru icin dokuman taslagi hazirla",
      "Bu firmadaki acik riskleri ozetle",
      "Is kazasi bildirimi kac gun icinde yapilmali?",
    ],
    welcomeDescription:
      "Nova; mevzuati yorumlayan, sizi dogru modullere goturen, belge ve operasyon akislarini baslatan kurumsal ISG ajanidir.",
    unavailable: "Nova bu istegi su anda tamamlayamadi. Lutfen biraz sonra tekrar deneyin.",
    briefEyebrow: "Nova Brief",
    focusQuestion: "Bugun sizin icin neye odaklanmaliyiz?",
    loadingBrief: "Nova aktif akislarinizi ve takip bekleyen operasyonlari taruyor...",
    routeTitle: "Mevzuat, yonlendirme ve operasyon aksiyonlari tek akista",
    actionReadyBadge: "Aksiyon Hazir",
    nextStepsLabel: "Sonraki Adimlar",
    workflowLabel: "Nova Workflow",
    nextStepLabel: "Siradaki adim",
    navigationTitle: "Sayfa Yonlendirme",
    gotoPage: "Sayfaya Git",
    toolPreviewLabel: "Nova Aksiyon Onerisi",
    draftReadyLabel: "Taslak Hazir",
    safetyBlockLabel: "Guvenlik Kisitlamasi",
    approveAction: "Onayla",
    cancelAction: "Iptal Et",
    actionRunning: "Isleniyor...",
    actionDone: "Tamamlandi",
    sourceCount: (count) => `${count} mevzuat kaynagi`,
    documentType: (isPptx, ext) => `${isPptx ? "PowerPoint Sunumu" : "Word Belgesi"} (.${ext})`,
    helpful: "Yararli",
    lacking: "Eksik",
    saved: "Kaydedildi",
    save: "Kaydet",
    copy: "Kopyala",
  },
};

const enCopy: NovaUiCopy = {
  quickActions: {
    workspace: "Nova Workspace",
    planner: "Planner",
    newIncident: "New Incident",
    documents: "Documents",
    login: "Sign In",
    register: "Create Account",
  },
  widget: {
    welcomeAuthenticated:
      "Hello! I'm Nova. I can interpret regulations, route you to the right modules, plan trainings or tasks, start incident drafts, and prepare document workflows.",
    welcomePublic:
      "Hello! You need to sign in to access the real Nova agent. You can sign in now or create an account.",
    publicLocked:
      "The lightweight answer layer has been removed from this area. Sign in to access the real Nova agent, then continue the same request here or in Solution Center.",
    initializing: "Please wait a moment, Nova is getting ready...",
    unavailable:
      "Nova cannot respond right now. Please try again shortly or continue inside Solution Center.",
    redirecting: (label) => `Routing you to ${label}...`,
    subtitle: "AI OHS Assistant",
    openAriaLabel: "Open Nova assistant",
    minimizeAriaLabel: "Minimize",
    closeAriaLabel: "Close and reset conversation",
    sourceCount: (count) => `${count} legislation sources`,
    navigationTitle: "Page Routing",
    gotoPage: "Open Page",
    workflowLabel: "Nova Workflow",
    nextStepLabel: "Next",
    openLabel: "Open",
    continueLabel: "Continue",
    toolPreviewLabel: "Nova Action Preview",
    draftReadyLabel: "Draft Ready",
    safetyBlockLabel: "Safety Guardrail",
    continueInWorkspace: "Continue in Solution Center",
    approveAction: "Approve",
    cancelAction: "Cancel",
    actionRunning: "Processing...",
    actionDone: "Completed",
    currentPageLabel: "Current page",
    authenticatedPlaceholder: "Ask Nova...",
    publicPlaceholder: "Sign in to access the real Nova agent...",
  },
  solutionCenter: {
    modes: [
      { label: "Regulation", hint: "interpret legislation, cite sources, and explain risk impact", badge: "RAG" },
      { label: "Planning", hint: "create training, committee, and operational tasks", badge: "ACTION" },
      { label: "Incident", hint: "start near-miss or accident drafts and guide next steps", badge: "INCIDENT" },
      { label: "Document", hint: "prepare procedures, reports, and editor-ready drafts", badge: "DOC" },
    ],
    quickQuestions: [
      "Plan working-at-height training for June 25",
      "Create the monthly committee task for June 28",
      "Start a new near-miss incident draft",
      "Prepare an emergency procedure document draft",
      "Summarize open risks for this company",
      "Within how many days must a work accident be reported?",
    ],
    welcomeDescription:
      "Nova is the operational OHS agent that interprets legislation, routes you to the right modules, and starts document or workflow actions.",
    unavailable: "Nova could not complete this request right now. Please try again shortly.",
    briefEyebrow: "Nova Brief",
    focusQuestion: "What should we focus on today?",
    loadingBrief: "Nova is scanning active workflows and pending operational follow-ups...",
    routeTitle: "Legislation, routing, and operational actions in one stream",
    actionReadyBadge: "Action Ready",
    nextStepsLabel: "Next Steps",
    workflowLabel: "Nova Workflow",
    nextStepLabel: "Next step",
    navigationTitle: "Page Routing",
    gotoPage: "Open Page",
    toolPreviewLabel: "Nova Action Preview",
    draftReadyLabel: "Draft Ready",
    safetyBlockLabel: "Safety Guardrail",
    approveAction: "Approve",
    cancelAction: "Cancel",
    actionRunning: "Processing...",
    actionDone: "Completed",
    sourceCount: (count) => `${count} legislation sources`,
    documentType: (isPptx, ext) => `${isPptx ? "PowerPoint Deck" : "Word Document"} (.${ext})`,
    helpful: "Helpful",
    lacking: "Needs work",
    saved: "Saved",
    save: "Save",
    copy: "Copy",
  },
};

export function getNovaUiCopy(locale?: string | null): NovaUiCopy {
  return getNovaUiLanguage(locale) === "tr" ? trCopy : enCopy;
}

export function getNovaRuntimeErrorMessage(locale?: string | null, error?: unknown): string {
  const language = getNovaUiLanguage(locale);
  const message = String(
    error && typeof error === "object" && "message" in error ? (error as { message?: string }).message : error || "",
  ).toLowerCase();

  const isEdgeFailure =
    message.includes("non-2xx") ||
    message.includes("edge function") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("failed to fetch");

  if (language === "en") {
    return isEdgeFailure
      ? "Nova is temporarily unavailable while the latest server updates are being applied. Please try again shortly."
      : "Nova could not complete this request right now. Please try again shortly.";
  }

  return isEdgeFailure
    ? "Nova servisi son sunucu guncellemeleri uygulanirken gecici olarak hazir degil. Lutfen biraz sonra tekrar deneyin."
    : "Nova bu istegi su anda tamamlayamadi. Lutfen biraz sonra tekrar deneyin.";
}

type NovaRuntimeErrorContext = {
  status?: number;
  message?: string | null;
  error?: string | null;
};

async function readNovaRuntimeErrorContext(error?: unknown): Promise<NovaRuntimeErrorContext | null> {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return null;
  }

  const response = (error as { context?: Response }).context;
  if (!response || typeof response.status !== "number") {
    return null;
  }

  const result: NovaRuntimeErrorContext = { status: response.status };

  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object") {
      result.message =
        typeof payload.message === "string"
          ? payload.message
          : typeof payload.error === "string"
            ? payload.error
            : null;
      result.error = typeof payload.error === "string" ? payload.error : null;
    }
  } catch {
    return result;
  }

  return result;
}

export async function resolveNovaRuntimeErrorMessage(locale?: string | null, error?: unknown): Promise<string> {
  const context = await readNovaRuntimeErrorContext(error);
  const fallback = getNovaRuntimeErrorMessage(locale, error);
  const language = getNovaUiLanguage(locale);
  const rawMessage = String(context?.message || "").toLowerCase();

  if (
    rawMessage.includes("err_auth_006") ||
    rawMessage.includes("gerekli yetki") ||
    rawMessage.includes("required permission")
  ) {
    return language === "tr"
      ? "Nova bu ekranda yalnizca yetkili oldugunuz firma ve calisma alanlari icin yardim sunabilir. Ilgili firmayi acin veya OSGB yoneticinizden erisim isteyin."
      : "Nova can only help with companies and workspaces you are authorized to access on this screen. Open the relevant company or ask your OSGB admin for access.";
  }

  if (!context?.message) {
    return fallback;
  }

  return context.status && context.status < 500 ? context.message : fallback;
}

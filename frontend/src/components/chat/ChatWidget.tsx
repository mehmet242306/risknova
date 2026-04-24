"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  analyzeNovaImage,
  buildNovaPromptWithImage,
  type NovaImageAnalysis,
} from "@/lib/nova/multimodal";
import {
  collectSpeechTranscript,
  getBrowserSpeechRecognition,
  toSpeechRecognitionLocale,
  type BrowserSpeechRecognition,
} from "@/lib/nova/browser-speech";
import { getNovaUiCopy, resolveNovaRuntimeErrorMessage } from "@/lib/nova-ui";
import { postNovaAgentRequest } from "@/lib/nova/client";
import { resolveNovaApiEndpoint, resolveNovaRequestMode } from "@/lib/nova/request-mode";
import { fetchAccountContext } from "@/lib/account/account-api";
import type {
  NovaAgentResponse,
  NovaActionHint,
  NovaDraftPayload,
  NovaAgentSource,
  NovaSafetyBlock,
  NovaAgentToolPreview,
} from "@/lib/nova/agent";
import {
  getNovaProactiveBrief,
  markNovaWorkflowStep,
  type NovaFollowUpAction,
  type NovaWorkflowSummary,
} from "@/lib/supabase/nova-workflows";
import {
  MessageCircle,
  X,
  Minus,
  Send,
  ImagePlus,
  Mic,
  Square,
  Sparkles,
  Bot,
  User,
} from "lucide-react";

type NovaSource = {
  doc_title?: string;
  law?: string;
  article?: string;
  article_number?: string;
  article_title?: string;
};

type NovaNavigation = {
  action: "navigate";
  url: string;
  label: string;
  reason: string;
  destination: string;
  auto_navigate: boolean;
};

type WidgetAction = {
  label: string;
  path: string;
  icon: string;
};

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  suggestions?: WidgetAction[];
  timestamp: Date;
  sources?: NovaSource[];
  navigation?: NovaNavigation | null;
  workflow?: NovaWorkflowSummary | null;
  followUpActions?: NovaFollowUpAction[];
  actionHint?: NovaActionHint | null;
  toolPreview?: NovaAgentToolPreview | null;
  draft?: NovaDraftPayload | null;
  safetyBlock?: NovaSafetyBlock | null;
  isError?: boolean;
};

type PanelPosition = {
  left: number;
  top: number;
};

type PanelDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type WidgetHistoryItem = {
  id: string;
  queryText: string;
  aiResponse: string;
  createdAt: string;
  source: "local" | "server";
};

const PANEL_EDGE_GAP = 12;
const WIDGET_HISTORY_STORAGE_KEY = "risknova:nova-widget-history";
const MAX_WIDGET_HISTORY_ITEMS = 30;

function clampPanelPosition(position: PanelPosition, width: number, height: number): PanelPosition {
  if (typeof window === "undefined") return position;

  const maxLeft = Math.max(PANEL_EDGE_GAP, window.innerWidth - width - PANEL_EDGE_GAP);
  const maxTop = Math.max(PANEL_EDGE_GAP, window.innerHeight - height - PANEL_EDGE_GAP);

  return {
    left: Math.min(Math.max(PANEL_EDGE_GAP, position.left), maxLeft),
    top: Math.min(Math.max(PANEL_EDGE_GAP, position.top), maxTop),
  };
}

function defaultPanelPosition(width: number, height: number): PanelPosition {
  if (typeof window === "undefined") {
    return { left: PANEL_EDGE_GAP, top: PANEL_EDGE_GAP };
  }

  return clampPanelPosition(
    {
      left: window.innerWidth - width - 24,
      top: window.innerHeight - height - 24,
    },
    width,
    height,
  );
}

function readLocalWidgetHistory(): WidgetHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(WIDGET_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<WidgetHistoryItem>[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        id: String(item.id || crypto.randomUUID()),
        queryText: String(item.queryText || "").trim(),
        aiResponse: String(item.aiResponse || "").trim(),
        createdAt: String(item.createdAt || new Date().toISOString()),
        source: "local" as const,
      }))
      .filter((item) => item.queryText && item.aiResponse)
      .slice(0, MAX_WIDGET_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function writeLocalWidgetHistory(items: WidgetHistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      WIDGET_HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_WIDGET_HISTORY_ITEMS)),
    );
  } catch {
    // History must never block Nova from showing a response.
  }
}

function rememberLocalWidgetHistory(queryText: string, aiResponse: string) {
  const cleanQuery = queryText.trim();
  const cleanAnswer = aiResponse.trim();
  if (!cleanQuery || !cleanAnswer) return;

  const nextItem: WidgetHistoryItem = {
    id: crypto.randomUUID(),
    queryText: cleanQuery,
    aiResponse: cleanAnswer,
    createdAt: new Date().toISOString(),
    source: "local",
  };

  const next = [
    nextItem,
    ...readLocalWidgetHistory().filter(
      (item) => item.queryText !== cleanQuery || item.aiResponse !== cleanAnswer,
    ),
  ];
  writeLocalWidgetHistory(next);
}

export function ChatWidget({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"individual" | "osgb" | "enterprise" | null>(null);
  const [accountSurface, setAccountSurface] = useState<"platform-admin" | "osgb-manager" | "standard">("standard");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<NovaImageAnalysis | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [historyItems, setHistoryItems] = useState<WidgetHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [launcherPosition, setLauncherPosition] = useState<PanelPosition | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelDragRef = useRef<PanelDragState | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const launcherDragRef = useRef<PanelDragState | null>(null);
  const launcherMovedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const proactiveLoadedRef = useRef(false);
  const actionPollCancelledRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechTranscriptRef = useRef("");
  const speechInterimTranscriptRef = useRef("");
  const supabase = createClient();
  const currentQueryString = searchParams.toString();
  const currentPage = `${pathname}${currentQueryString ? `?${currentQueryString}` : ""}`;
  const companyWorkspaceId = useMemo(() => {
    const workspaceId = searchParams.get("workspaceId");
    return workspaceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)
      ? workspaceId
      : null;
  }, [searchParams]);
  const isOsgbSurface =
    pathname.startsWith("/osgb") ||
    currentPage.toLowerCase().includes("surface=osgb-manager") ||
    accountSurface === "osgb-manager";
  const isPlatformAdminSurface =
    pathname.startsWith("/platform-admin") ||
    currentPage.toLowerCase().includes("surface=platform-admin") ||
    accountSurface === "platform-admin";
  const isEnterpriseSurface =
    pathname.startsWith("/enterprise") ||
    currentPage.toLowerCase().includes("surface=enterprise") ||
    accountType === "enterprise";
  const assistantName = isPlatformAdminSurface
    ? "Nova Platform"
    : isOsgbSurface
    ? "Nova OSGB"
    : isEnterpriseSurface
      ? "Nova Kurumsal"
      : "Nova";
  const assistantSubtitle = isPlatformAdminSurface
    ? "Platform ic operasyon asistani"
    : isOsgbSurface
    ? "OSGB yonetim asistani"
    : isEnterpriseSurface
      ? "Kurumsal AI asistani"
      : ui.widget.subtitle;
  const authenticatedWelcomeActions = useMemo<WidgetAction[]>(() => {
    if (isPlatformAdminSurface) {
      return [
        { label: "Nova Platform", path: "/settings?tab=admin_ai", icon: "N" },
        { label: "Hata Loglari", path: "/settings?tab=error_logs", icon: "H" },
        { label: "Belgeler", path: "/settings?tab=admin_documents", icon: "D" },
        { label: "Audit", path: "/settings?tab=audit_logs", icon: "A" },
      ];
    }

    if (isOsgbSurface) {
      const managerHref = companyWorkspaceId
        ? `/solution-center?surface=osgb-manager&workspaceId=${companyWorkspaceId}`
        : "/solution-center?surface=osgb-manager";
      const tasksHref = companyWorkspaceId
        ? `/osgb/tasks?workspaceId=${companyWorkspaceId}`
        : "/osgb/tasks";
      const assignmentsHref = companyWorkspaceId
        ? `/osgb/assignments?workspaceId=${companyWorkspaceId}`
        : "/osgb/assignments";
      const documentsHref = companyWorkspaceId
        ? `/osgb/documents?workspaceId=${companyWorkspaceId}`
        : "/osgb/documents";

      return [
        { label: "Nova OSGB", path: managerHref, icon: "N" },
        { label: "Gorevler", path: tasksHref, icon: "G" },
        { label: "Atamalar", path: assignmentsHref, icon: "A" },
        { label: "Dokumanlar", path: documentsHref, icon: "D" },
      ];
    }

    if (isEnterpriseSurface) {
      const enterpriseHref = companyWorkspaceId
        ? `/solution-center?surface=enterprise&workspaceId=${companyWorkspaceId}`
        : "/solution-center?surface=enterprise";

      return [
        { label: "Nova Kurumsal", path: enterpriseHref, icon: "N" },
        { label: "Dokumanlar", path: "/solution-center/documents", icon: "D" },
        { label: "Raporlar", path: "/reports", icon: "R" },
        { label: "Firmalar", path: "/companies", icon: "F" },
      ];
    }

    return [
      { label: ui.quickActions.workspace, path: "/solution-center", icon: "N" },
      { label: ui.quickActions.planner, path: "/planner", icon: "P" },
      { label: ui.quickActions.newIncident, path: "/incidents/new", icon: "O" },
      { label: ui.quickActions.documents, path: "/solution-center/documents", icon: "D" },
    ];
  }, [
    companyWorkspaceId,
    isEnterpriseSurface,
    isOsgbSurface,
    isPlatformAdminSurface,
    ui.quickActions.documents,
    ui.quickActions.newIncident,
    ui.quickActions.planner,
    ui.quickActions.workspace,
  ]);
  const publicEntryActions = useMemo<WidgetAction[]>(() => ([
    { label: ui.quickActions.login, path: "/login", icon: "G" },
    { label: ui.quickActions.register, path: "/register", icon: "K" },
  ]), [ui.quickActions.login, ui.quickActions.register]);
  const welcomeText = isAuthenticated
    ? isPlatformAdminSurface
      ? "Merhaba! Ben Nova Platform. Bu yuzeyde site sagligi, hata akislari, belge omurgasi ve ic operasyon risklerini ozetlerim."
      : ui.widget.welcomeAuthenticated
    : ui.widget.welcomePublic;
  const welcomeActions = isAuthenticated ? authenticatedWelcomeActions : publicEntryActions;

  function isAccessErrorMessage(text: string): boolean {
    const normalized = text.toLowerCase();
    return (
      normalized.includes("err_auth_006") ||
      normalized.includes("gerekli yetki") ||
      normalized.includes("yetkili") ||
      normalized.includes("erisim") ||
      normalized.includes("erişim")
    );
  }

  function buildBotMessageFromAgentResponse(data: NovaAgentResponse): Message {
    const answer = data?.answer || ui.widget.unavailable;
    const rawSources = data?.sources || [];
    const navigation: NovaNavigation | null = (data?.navigation as NovaNavigation | null) || null;
    const workflow: NovaWorkflowSummary | null = (data?.workflow as NovaWorkflowSummary | null) || null;
    const followUpActions: NovaFollowUpAction[] = Array.isArray(data?.follow_up_actions)
      ? (data.follow_up_actions as NovaFollowUpAction[])
      : [];

    const normalizedSources: NovaSource[] = rawSources.map((s: NovaAgentSource) => ({
      doc_title: s.doc_title || s.law || "",
      law: s.law,
      article: s.article,
      article_number: s.article_number || s.article || "",
      article_title: s.article_title || s.title || "",
    }));

    return {
      id: crypto.randomUUID(),
      role: "bot",
      text: answer,
      sources: normalizedSources.length > 0 ? normalizedSources : undefined,
      navigation,
      workflow,
      followUpActions,
      actionHint:
        data.action_hint && typeof data.action_hint === "object"
          ? (data.action_hint as NovaActionHint)
          : null,
      toolPreview: data.tool_preview || null,
      draft: data.draft || null,
      safetyBlock: data.safety_block || null,
      suggestions:
        navigation == null && answer.length < 220
          ? authenticatedWelcomeActions.slice(0, 3)
          : undefined,
      timestamp: new Date(),
    };
  }

  // Fetch organization_id for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !supabase) return;

    async function fetchAccountScope() {
      try {
        const response = await fetchAccountContext();
        if (!response?.context) return;
        setOrganizationId(response.context.organizationId ?? null);
        setAccountType(response.context.accountType ?? null);
        setAccountSurface(response.surface ?? "standard");
      } catch {
        return;
      }
    }

    void fetchAccountScope();
  }, [isAuthenticated, supabase]);

  // Welcome message on first open
  useEffect(() => {
    return () => {
      actionPollCancelledRef.current = true;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (recordingStreamRef.current) {
        for (const track of recordingStreamRef.current.getTracks()) track.stop();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "bot",
          text: welcomeText,
          suggestions: welcomeActions,
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length, open, welcomeActions, welcomeText]);

  useEffect(() => {
    if (!open || !isAuthenticated || !organizationId || proactiveLoadedRef.current) return;
    if (messages.length !== 1 || messages[0]?.id !== "welcome") return;

    proactiveLoadedRef.current = true;
    let cancelled = false;

    (async () => {
      const brief = await getNovaProactiveBrief(locale);
      if (cancelled || !brief) return;
      if (!brief.actions.length && !brief.insights.length && !brief.activeWorkflows.length) return;

      const summaryLines = [
        brief.summary,
        ...brief.insights.slice(0, 2).map((item) => `- ${item}`),
      ].filter(Boolean);

      const proactiveMessage: Message = {
        id: "proactive-brief",
        role: "bot",
        text: summaryLines.join("\n"),
        workflow: brief.activeWorkflows[0] ?? null,
        followUpActions: brief.actions,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        if (prev.some((item) => item.id === "proactive-brief")) return prev;
        return [...prev, proactiveMessage];
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isAuthenticated, organizationId, locale, messages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function refreshHistory() {
    setHistoryLoading(true);
    const localItems = readLocalWidgetHistory();

    try {
      if (!isAuthenticated || !supabase) {
        setHistoryItems(localItems);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHistoryItems(localItems);
        return;
      }

      const { data } = await supabase
        .from("solution_queries")
        .select("id, query_text, ai_response, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);

      const serverItems: WidgetHistoryItem[] = Array.isArray(data)
        ? data
            .map((item) => ({
              id: String(item.id),
              queryText: String(item.query_text || "").trim(),
              aiResponse: String(item.ai_response || "").trim(),
              createdAt: String(item.created_at || new Date().toISOString()),
              source: "server" as const,
            }))
            .filter((item) => item.queryText && item.aiResponse)
        : [];

      const seen = new Set<string>();
      const merged = [...localItems, ...serverItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .filter((item) => {
          const key = `${item.queryText}\n${item.aiResponse}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_WIDGET_HISTORY_ITEMS);

      setHistoryItems(merged);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!open || activeTab !== "history") return;
    void refreshHistory();
  }, [open, activeTab, isAuthenticated]);

  useEffect(() => {
    if (!open) {
      panelDragRef.current = null;
      return;
    }

    function keepPanelInViewport() {
      const panel = panelRef.current;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();
      setPanelPosition((current) =>
        clampPanelPosition(
          current ?? defaultPanelPosition(rect.width, rect.height),
          rect.width,
          rect.height,
        ),
      );
    }

    const timer = window.setTimeout(keepPanelInViewport, 0);
    window.addEventListener("resize", keepPanelInViewport);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", keepPanelInViewport);
    };
  }, [open]);

  useEffect(() => {
    function keepLauncherInViewport() {
      const launcher = launcherRef.current;
      if (!launcher || !launcherPosition) return;
      const rect = launcher.getBoundingClientRect();
      setLauncherPosition(clampPanelPosition(launcherPosition, rect.width, rect.height));
    }

    window.addEventListener("resize", keepLauncherInViewport);
    return () => window.removeEventListener("resize", keepLauncherInViewport);
  }, [launcherPosition]);

  const openWidget = () => {
    const launcher = launcherRef.current;
    if (launcher) {
      const rect = launcher.getBoundingClientRect();
      setPanelPosition(
        defaultPanelPosition(
          Math.min(window.innerWidth - PANEL_EDGE_GAP * 2, 340),
          Math.min(window.innerHeight - PANEL_EDGE_GAP * 2, 520),
        ),
      );

      if (launcherPosition) {
        const panelWidth = Math.min(window.innerWidth - PANEL_EDGE_GAP * 2, 340);
        const panelHeight = Math.min(window.innerHeight - PANEL_EDGE_GAP * 2, 520);
        setPanelPosition(
          clampPanelPosition(
            {
              left: rect.left - panelWidth + rect.width,
              top: rect.top - panelHeight + rect.height,
            },
            panelWidth,
            panelHeight,
          ),
        );
      }
    }

    setActiveTab("chat");
    setOpen(true);
  };

  const startPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    panelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanelPosition({ left: rect.left, top: rect.top });
  };

  const dragPanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    setPanelPosition(
      clampPanelPosition(
        {
          left: event.clientX - drag.offsetX,
          top: event.clientY - drag.offsetY,
        },
        drag.width,
        drag.height,
      ),
    );
  };

  const stopPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panelDragRef.current?.pointerId !== event.pointerId) return;

    panelDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const launcher = launcherRef.current;
    if (!launcher) return;

    const rect = launcher.getBoundingClientRect();
    launcherMovedRef.current = false;
    launcherDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setLauncherPosition({ left: rect.left, top: rect.top });
  };

  const dragLauncher = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextPosition = clampPanelPosition(
      {
        left: event.clientX - drag.offsetX,
        top: event.clientY - drag.offsetY,
      },
      drag.width,
      drag.height,
    );

    if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
      launcherMovedRef.current = true;
    }

    setLauncherPosition(nextPosition);
  };

  const stopLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (launcherDragRef.current?.pointerId !== event.pointerId) return;

    launcherDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  function restoreHistoryItem(item: WidgetHistoryItem) {
    setMessages((prev) => [
      ...prev.filter((message) => message.id !== "welcome"),
      {
        id: crypto.randomUUID(),
        role: "user",
        text: item.queryText,
        timestamp: new Date(item.createdAt),
      },
      {
        id: crypto.randomUUID(),
        role: "bot",
        text: item.aiResponse,
        timestamp: new Date(item.createdAt),
      },
    ]);
    setActiveTab("chat");
  }

  function formatHistoryDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const clearAttachedImage = () => {
    setImageAnalysis(null);
    setComposerError(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleImageSelected = async (file: File | null) => {
    if (!file) return;
    setComposerError(null);
    setImageUploading(true);
    try {
      const analysis = await analyzeNovaImage(file);
      setImageAnalysis(analysis);
      setImagePreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "Gorsel Nova icin okunamadi.");
    } finally {
      setImageUploading(false);
    }
  };

  const transcribeVoiceBlob = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("file", new File([blob], "nova-voice.webm", { type: blob.type || "audio/webm" }));
    formData.append("language", locale || "tr");

    const response = await fetch("/api/nova/transcribe", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as { transcript?: string; message?: string };
    if (!response.ok) {
      throw new Error(payload.message || "Ses metne cevrilemedi.");
    }
    return String(payload.transcript || "").trim();
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
  };

  const startRecording = async () => {
    setComposerError(null);
    const BrowserSpeechRecognition = getBrowserSpeechRecognition();
    if (BrowserSpeechRecognition) {
      try {
        const recognition = new BrowserSpeechRecognition();
        let speechHadError = false;
        speechTranscriptRef.current = "";
        speechInterimTranscriptRef.current = "";
        recognition.lang = toSpeechRecognitionLocale(locale);
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          const finalTranscript = collectSpeechTranscript(event, { finalOnly: true });
          const anyTranscript = collectSpeechTranscript(event, { finalOnly: false });
          if (finalTranscript) {
            speechTranscriptRef.current = [speechTranscriptRef.current, finalTranscript]
              .filter(Boolean)
              .join(" ")
              .trim();
          }
          if (anyTranscript) {
            speechInterimTranscriptRef.current = anyTranscript;
          }
        };
        recognition.onerror = (event) => {
          speechHadError = true;
          const errorCode = event.error || "speech-error";
          setComposerError(
            errorCode === "not-allowed"
              ? "Mikrofon izni reddedildi."
              : "Ses anlasilamadi. Lutfen tekrar deneyin.",
          );
        };
        recognition.onend = () => {
          speechRecognitionRef.current = null;
          if (recordingTimerRef.current) {
            window.clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          setRecording(false);
          const transcript = (speechTranscriptRef.current || speechInterimTranscriptRef.current).trim();
          speechTranscriptRef.current = "";
          speechInterimTranscriptRef.current = "";
          if (transcript) {
            setComposerError(null);
            setInput((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
          } else if (!speechHadError) {
            setComposerError("Ses anlasilamadi. Lutfen biraz daha net tekrar deneyin.");
          }
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
        setRecordingElapsed(0);
        setRecording(true);
        recordingTimerRef.current = window.setInterval(() => {
          setRecordingElapsed((current) => current + 1);
        }, 1000);
        return;
      } catch {
        speechRecognitionRef.current = null;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setComposerError("Tarayici ses kaydini desteklemiyor.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        if (recordingStreamRef.current) {
          for (const track of recordingStreamRef.current.getTracks()) track.stop();
        }
        recordingStreamRef.current = null;

        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        recordingChunksRef.current = [];
        if (blob.size === 0) return;

        setVoiceTranscribing(true);
        try {
          const transcript = await transcribeVoiceBlob(blob);
          if (transcript) {
            setInput((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
          }
        } catch (error) {
          setComposerError(error instanceof Error ? error.message : "Sesli mesaj islenemedi.");
        } finally {
          setVoiceTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordingElapsed(0);
      setRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingElapsed((current) => current + 1);
      }, 1000);
    } catch (error) {
      setComposerError(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Mikrofon izni reddedildi."
          : error instanceof Error
            ? error.message
            : "Mikrofon baslatilamadi.",
      );
    }
  };

  const formatRecordingElapsed = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  async function handleSend() {
    const text = input.trim();
    const composedPrompt = buildNovaPromptWithImage(text, imageAnalysis);
    if (!composedPrompt || typing || imageUploading || voiceTranscribing) return;
    const visiblePrompt =
      text ||
      (imageAnalysis
        ? `Gorsel uzerinden ISG yorumu istendi (${imageAnalysis.fileName}).`
        : "");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: visiblePrompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setComposerError(null);

    // Public users: no lightweight response layer
    if (!isAuthenticated) {
      setTimeout(() => {
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          text: ui.widget.publicLocked,
          suggestions: publicEntryActions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setTyping(false);
      }, 600 + Math.random() * 400);
      return;
    }

    if (!supabase) {
      setTimeout(() => {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          text: ui.widget.initializing,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setTyping(false);
      }, 500);
      return;
    }

    // Authenticated users: Nova edge function
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const history = messages.slice(-10).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const requestMode = resolveNovaRequestMode(composedPrompt);
      const data = await postNovaAgentRequest(
        resolveNovaApiEndpoint(composedPrompt),
        {
          message: composedPrompt,
          session_id: sessionId,
          language: locale,
          as_of_date: new Date().toISOString().slice(0, 10),
          answer_mode: "extractive",
          access_token: session?.access_token ?? null,
          mode: requestMode,
          context_surface: "widget",
          history,
          current_page: currentPage,
          company_workspace_id: companyWorkspaceId,
        },
      );

      // Preserve session
      if (data?.session_id && !sessionId) {
        setSessionId(data.session_id);
      }

      const botMessage = buildBotMessageFromAgentResponse(data);
      rememberLocalWidgetHistory(visiblePrompt, botMessage.text);
      setMessages((prev) => [...prev, botMessage]);
      if (imageAnalysis) {
        clearAttachedImage();
      }
    } catch (err: unknown) {
      const errorText = await resolveNovaRuntimeErrorMessage(locale, err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: errorText,
        suggestions: authenticatedWelcomeActions.slice(0, 2),
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setTyping(false);
    }
  }

  function handleQuickAction(action: WidgetAction) {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: action.label,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    setTimeout(() => {
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: ui.widget.redirecting(action.label),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);

      setTimeout(() => router.push(action.path), 800);
    }, 400);
  }

  async function handleFollowUpAction(action: NovaFollowUpAction) {
    if (action.workflow_step_id) {
      await markNovaWorkflowStep(action.workflow_step_id, "completed");
    }

    if (action.kind === "navigate" && action.url) {
      router.push(action.url);
      setOpen(false);
      return;
    }

    if (action.kind === "prompt" && action.prompt) {
      setInput(action.prompt);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handlePendingAction(actionHint: NovaActionHint, decision: "confirm" | "cancel") {
    const actionRunId = actionHint.action_run_id;
    if (!actionRunId) return;

    setActionInFlightId(actionRunId);
    try {
      const response = await fetch(`/api/nova/actions/${actionRunId}/${decision}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          decision === "confirm"
            ? {
                idempotency_key: crypto.randomUUID(),
                context_surface: "widget",
              }
            : {
                context_surface: "widget",
              },
        ),
      });

      const data: NovaAgentResponse = await response.json().catch(() => ({
        type: "safety_block",
        answer: ui.widget.unavailable,
      }));

      if (!response.ok) {
        throw { context: new Response(JSON.stringify(data), { status: response.status }) };
      }

      setMessages((prev) => [
        ...prev.map((msg) =>
          msg.actionHint?.action_run_id === actionRunId
            ? { ...msg, actionHint: null }
            : msg,
        ),
        buildBotMessageFromAgentResponse(data),
      ]);

      const executionStatus =
        data.action_hint && typeof data.action_hint === "object"
          ? data.action_hint.execution_status
          : null;

      if (decision === "confirm" && (executionStatus === "queued" || executionStatus === "processing")) {
        void pollActionRunUntilSettled(actionRunId);
      }
    } catch (err: unknown) {
      const errorText = await resolveNovaRuntimeErrorMessage(locale, err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: errorText,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setActionInFlightId(null);
    }
  }

  async function pollActionRunUntilSettled(actionRunId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (actionPollCancelledRef.current) return;

      await new Promise((resolve) => window.setTimeout(resolve, 2500));

      const response = await fetch(`/api/nova/actions/${actionRunId}`, { cache: "no-store" });
      const data: NovaAgentResponse = await response.json().catch(() => ({
        type: "message",
        answer: ui.widget.unavailable,
      }));

      if (!response.ok) {
        return;
      }

      const executionStatus =
        data.action_hint && typeof data.action_hint === "object"
          ? data.action_hint.execution_status
          : null;

      if (executionStatus === "queued" || executionStatus === "processing") {
        continue;
      }

      setMessages((prev) => [...prev, buildBotMessageFromAgentResponse(data)]);
      return;
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={(event) => {
            if (launcherMovedRef.current) {
              event.preventDefault();
              launcherMovedRef.current = false;
              return;
            }
            openWidget();
          }}
          onPointerDown={startLauncherDrag}
          onPointerMove={dragLauncher}
          onPointerUp={stopLauncherDrag}
          onPointerCancel={stopLauncherDrag}
          className={`group fixed z-50 inline-flex h-12 w-[3.25rem] touch-none cursor-move items-center justify-center rounded-[1.15rem] border border-amber-200/45 bg-[linear-gradient(135deg,#B87910_0%,#D39B17_46%,#F4C33F_100%)] text-white shadow-[0_12px_26px_rgba(188,132,20,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_18px_36px_rgba(188,132,20,0.35)] sm:h-[3.25rem] sm:w-[3.5rem] sm:rounded-[1.3rem] ${launcherPosition ? "" : "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 sm:bottom-7 sm:right-7"}`}
          style={
            launcherPosition
              ? {
                  left: launcherPosition.left,
                  top: launcherPosition.top,
                }
              : undefined
          }
          aria-label={ui.widget.openAriaLabel}
          title="Nova'yi tasimak icin surukleyin, acmak icin tiklayin"
        >
          <span
            className="pointer-events-none absolute -inset-6 rounded-full bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(250,215,120,0.78)_68deg,rgba(255,255,255,0)_126deg,rgba(214,161,26,0.5)_212deg,rgba(255,255,255,0)_286deg,rgba(250,215,120,0.76)_360deg)] opacity-80 blur-[13px] animate-spin [animation-duration:6.8s]"
          />
          <span
            className="pointer-events-none absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(247,203,86,0.52)_0%,rgba(221,166,33,0.28)_30%,rgba(188,132,20,0.12)_54%,rgba(188,132,20,0)_78%)] blur-2xl"
            style={{ animation: "pulse 2.1s ease-in-out infinite" }}
          />
          <span
            className="pointer-events-none absolute -inset-4 rounded-full border border-amber-100/45 opacity-80 animate-ping [animation-duration:2.9s]"
            style={{ boxShadow: "0 0 26px rgba(243,191,56,0.28)" }}
          />
          <span
            className="pointer-events-none absolute -inset-2 rounded-full border border-amber-50/60 opacity-80 animate-ping [animation-duration:2.2s]"
            style={{ animationDelay: "0.7s" }}
          />
          <span
            className="pointer-events-none absolute -inset-4 rounded-full border border-amber-200/35 opacity-70"
            style={{ animation: "pulse 3.8s ease-in-out infinite" }}
          />
          <span
            className="pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.36)_0%,rgba(255,255,255,0.08)_42%,rgba(255,255,255,0)_68%)] blur-xl"
            style={{ animation: "pulse 1.8s ease-in-out infinite" }}
          />
          <span className="pointer-events-none absolute inset-[2px] rounded-[1.05rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.02)_38%,rgba(0,0,0,0.05)_100%)] sm:rounded-[1.2rem]" />
          <span
            className="pointer-events-none absolute bottom-[0.26rem] right-[0.36rem] h-3 w-3 rotate-45 rounded-[0.24rem] border-r border-b border-amber-200/45 bg-[linear-gradient(135deg,#C78B11_0%,#E1AB24_55%,#F4C33F_100%)] shadow-[0_8px_16px_rgba(188,132,20,0.16)]"
          />
          <MessageCircle className="relative z-10 size-5 -translate-y-[1px] transition-transform duration-300 group-hover:scale-110" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          ref={panelRef}
          className={`fixed z-50 flex w-[min(calc(100vw-1.5rem),340px)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_22px_56px_rgba(0,0,0,0.24)] ${panelPosition ? "" : "bottom-[calc(env(safe-area-inset-bottom)+0.85rem)] right-3 sm:bottom-6 sm:right-6"}`}
          style={{
            height: "min(520px, calc(100dvh - 3.25rem))",
            ...(panelPosition
              ? {
                  left: panelPosition.left,
                  top: panelPosition.top,
                }
              : null),
          }}
        >
          {/* Header */}
          <div
            className="flex touch-none select-none items-center justify-between border-b border-border bg-[var(--header-bg-solid)] px-3 py-2.5"
            onPointerDown={startPanelDrag}
            onPointerMove={dragPanel}
            onPointerUp={stopPanelDrag}
            onPointerCancel={stopPanelDrag}
            title="Nova penceresini tasimak icin surukleyin"
          >
            <div className="flex min-w-0 cursor-move items-center gap-2.5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_100%)]">
                <Sparkles className="size-3.5 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{assistantName}</p>
                <p className="truncate text-[11px] text-white/50">{assistantSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ui.widget.minimizeAriaLabel}
                title={ui.widget.minimizeAriaLabel}
                className="inline-flex size-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMessages([]);
                  setSessionId(null);
                  proactiveLoadedRef.current = false;
                }}
                aria-label={ui.widget.closeAriaLabel}
                title={ui.widget.closeAriaLabel}
                className="inline-flex size-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "chat"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Sohbet
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("history");
                void refreshHistory();
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "history"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Gecmis
            </button>
          </div>

          {/* Messages */}
          {activeTab === "chat" ? (
            <>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "bot"
                    ? "bg-[var(--gold-glow)] text-[var(--gold)]"
                    : "bg-primary/10 text-primary"
                }`}>
                  {msg.role === "bot" ? <Bot className="size-4" /> : <User className="size-4" />}
                </span>

                <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "text-right" : ""}`}>
                  {/* Text */}
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : msg.isError
                        ? isAccessErrorMessage(msg.text)
                          ? "rounded-tl-sm border border-amber-300/35 bg-amber-50 text-amber-900"
                          : "rounded-tl-sm border border-red-500/20 bg-red-500/10 text-red-400"
                        : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.text.split("\n").map((line, i) => (
                      <span key={i}>
                        {line.startsWith("**") && line.endsWith("**")
                          ? <strong>{line.slice(2, -2)}</strong>
                          : line.startsWith("* ")
                            ? <span className="block pl-2">{line}</span>
                            : line.startsWith("- ")
                              ? <span className="block pl-2">{line}</span>
                              : line
                        }
                        {i < msg.text.split("\n").length - 1 && <br />}
                      </span>
                    ))}
                  </div>

                  {/* Nova Sources Accordion */}
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-yellow-500/80 hover:text-yellow-400 select-none">
                        {ui.widget.sourceCount(msg.sources.length)}
                      </summary>
                      <div className="mt-2 space-y-1 pl-2 border-l-2 border-yellow-500/20">
                        {msg.sources.slice(0, 5).map((src, i) => (
                          <div key={i} className="text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              {src.doc_title || src.law}
                            </span>
                            {src.article_number && (
                              <span className="ml-1">- {src.article_number}</span>
                            )}
                          </div>
                        ))}
                        {msg.sources.length > 5 && (
                          <div className="text-muted-foreground italic">
                            +{msg.sources.length - 5} daha...
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Nova Navigation Card */}
                  {msg.navigation && (
                    <div className="mt-2 p-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                      <div className="text-xs text-yellow-500/80 mb-1">{ui.widget.navigationTitle}</div>
                      <div className="text-xs font-medium mb-2">{msg.navigation.label}</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (msg.navigation) {
                            router.push(msg.navigation.url);
                            setOpen(false);
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-md bg-gradient-to-r from-yellow-600 to-yellow-500 text-black text-xs font-semibold hover:from-yellow-500 hover:to-yellow-400 transition-all"
                      >
                        {ui.widget.gotoPage}
                      </button>
                    </div>
                  )}

                  {msg.toolPreview && (
                    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {ui.widget.toolPreviewLabel}
                      </div>
                      <div className="mt-1 text-xs font-medium text-foreground">{msg.toolPreview.title}</div>
                      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{msg.toolPreview.summary}</div>
                      {msg.actionHint?.action_run_id && msg.toolPreview.requiresConfirmation ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={actionInFlightId === msg.actionHint.action_run_id}
                            onClick={() => handlePendingAction(msg.actionHint as NovaActionHint, "confirm")}
                            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionInFlightId === msg.actionHint.action_run_id
                              ? ui.widget.actionRunning
                              : ui.widget.approveAction}
                          </button>
                          <button
                            type="button"
                            disabled={actionInFlightId === msg.actionHint.action_run_id}
                            onClick={() => handlePendingAction(msg.actionHint as NovaActionHint, "cancel")}
                            className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {ui.widget.cancelAction}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {msg.draft && (
                    <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        {ui.widget.draftReadyLabel}
                      </div>
                      <div className="mt-1 text-xs font-medium text-foreground">{msg.draft.title}</div>
                      {msg.draft.summary ? (
                        <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{msg.draft.summary}</div>
                      ) : null}
                    </div>
                  )}

                  {msg.safetyBlock && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        {ui.widget.safetyBlockLabel}
                      </div>
                      <div className="mt-1 text-xs font-medium text-foreground">{msg.safetyBlock.title}</div>
                      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{msg.safetyBlock.message}</div>
                    </div>
                  )}

                  {msg.workflow && (
                    <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{ui.widget.workflowLabel}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {msg.workflow.current_step}/{msg.workflow.total_steps}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-foreground">{msg.workflow.title}</div>
                      {msg.workflow.next_step_label && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {ui.widget.nextStepLabel}: {msg.workflow.next_step_label}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.followUpActions && msg.followUpActions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.followUpActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => handleFollowUpAction(action)}
                          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">{action.label}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                              {action.kind === "navigate" ? ui.widget.openLabel : ui.widget.continueLabel}
                            </span>
                          </div>
                          {action.description && (
                            <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                              {action.description}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {(msg.toolPreview || msg.draft || msg.workflow) && (
                    <button
                      type="button"
                      onClick={() => router.push("/solution-center")}
                      className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                    >
                      {ui.widget.continueInWorkspace}
                    </button>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((s) => (
                        <button key={s.path} type="button" onClick={() => handleQuickAction(s)}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors">
                          <span>{s.icon}</span> {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-glow)] text-[var(--gold)]">
                  <Bot className="size-4" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card p-2.5">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleImageSelected(file);
              }}
            />
            {isAuthenticated ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={typing || imageUploading || voiceTranscribing}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                >
                  <ImagePlus className="size-3.5" />
                  {imageUploading ? "Gorsel analiz ediliyor..." : "Gorsel"}
                </button>
                <button
                  type="button"
                  onClick={() => void (recording ? stopRecording() : startRecording())}
                  disabled={typing || imageUploading || voiceTranscribing}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                >
                  {recording ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
                  {recording ? "Durdur" : "Ses"}
                </button>
                {recording ? (
                  <span className="text-[11px] font-medium text-primary">
                    {formatRecordingElapsed(recordingElapsed)}
                  </span>
                ) : null}
                {voiceTranscribing ? (
                  <span className="text-[11px] text-muted-foreground">Ses metne cevriliyor...</span>
                ) : null}
              </div>
            ) : null}

            {imageAnalysis ? (
              <div className="mb-2 rounded-xl border border-border bg-muted/30 p-2">
                <div className="flex items-start gap-2">
                  {imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreviewUrl}
                      alt={imageAnalysis.fileName}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-foreground">{imageAnalysis.fileName}</div>
                        <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                          {imageAnalysis.imageDescription || imageAnalysis.areaSummary || "Gorsel Nova icin hazirlandi."}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearAttachedImage}
                        className="inline-flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Gorseli kaldir"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {composerError ? (
              <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-500">
                {composerError}
              </div>
            ) : null}

            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isAuthenticated
                    ? ui.widget.authenticatedPlaceholder
                    : ui.widget.publicPlaceholder
                }
                className="h-9 flex-1 rounded-xl border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button type="submit" disabled={(!input.trim() && !imageAnalysis) || typing || imageUploading || voiceTranscribing}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_100%)] text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100">
                <Send className="size-4" />
              </button>
            </form>
          </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Gecmis sohbetler</p>
                  <p className="text-[11px] text-muted-foreground">Son Nova sorularinizi buradan acabilirsiniz.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshHistory()}
                  disabled={historyLoading}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  Yenile
                </button>
              </div>

              {historyLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Henuz gecmis yok</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Nova ile konustukca sohbetler burada gorunecek.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item) => (
                    <button
                      key={`${item.source}-${item.id}`}
                      type="button"
                      onClick={() => restoreHistoryItem(item)}
                      className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-semibold leading-5 text-foreground">
                          {item.queryText}
                        </p>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {item.source === "server" ? "Kayit" : "Widget"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                        {item.aiResponse}
                      </p>
                      <p className="mt-2 text-[10px] font-medium text-primary">
                        {formatHistoryDate(item.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

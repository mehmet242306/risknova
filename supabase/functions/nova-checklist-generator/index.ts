// =============================================================================
// nova-checklist-generator — Saha Denetimi AI Checklist Üretici
// =============================================================================
// Claude (claude-sonnet-4-6) tabanlı, org bağlamını okuyan checklist üretici.
// - Girdi: { workspace_id?, purpose, context?, mode, sources[] }
// - Çıktı: { checklist_id, questions: [{ text, reason, source_ref }] }
//
// Okuduğu tablolar (her source için):
//   existing_risks → risk_assessments (son tamamlanmış)
//   past_findings  → risk_assessment_findings (son 90 gün)
//   open_actions   → corrective_actions (tracking | in_progress)
//   dof            → corrective_actions (Kritik/Yüksek öncelik)
//   library        → (skip — library_contents migration henüz yok)
//   reports        → risk_assessments (son kapanmış denetim raporları)
//
// Yazdığı tablolar:
//   inspection_checklist_templates (status='draft', source='nova')
//   inspection_checklist_questions (sort_order'lı)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.40.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  logEdgeAiUsage,
  logEdgeErrorEvent,
} from "../_shared/observability.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const FN_NAME = "nova-checklist-generator";

const MODE_LIMITS: Record<string, { min: number; max: number; target: number }> = {
  quick: { min: 8, max: 12, target: 10 },
  standard: { min: 15, max: 30, target: 20 },
  detailed: { min: 25, max: 40, target: 30 },
};

const VALID_SOURCES = [
  "existing_risks",
  "past_findings",
  "open_actions",
  "dof",
  "library",
  "reports",
] as const;

type SourceKey = (typeof VALID_SOURCES)[number];

type RequestPayload = {
  workspace_id?: string | null;
  purpose: string;
  context?: { location?: string; shift?: string; line?: string };
  mode: "quick" | "standard" | "detailed";
  sources: SourceKey[];
};

type NovaQuestion = {
  section: string;
  category: string;
  text: string;
  priority: "low" | "medium" | "high" | "critical";
  reason: string;
  source_ref: { type: SourceKey | "general"; ids: string[] };
  suggested_action_title?: string;
};

type ContextBundle = {
  risks: Array<{ id: string; title: string; category: string }>;
  findings: Array<{ id: string; title: string; category: string; severity: string }>;
  openActions: Array<{ id: string; title: string; category: string; priority: string }>;
  dof: Array<{ id: string; title: string; category: string; priority: string }>;
  reports: Array<{ id: string; title: string; completed_at: string | null }>;
  librarySkipped: boolean;
};

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// -----------------------------------------------------------------------------
// Supabase helpers
// -----------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function resolveCallerOrg(
  req: Request,
): Promise<{ userId: string; orgId: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const supabase = getServiceClient();
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return null;

  const user = userData.user;
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromJwt =
    (appMeta.organization_id as string | undefined) ??
    (userMeta.organization_id as string | undefined);
  if (fromJwt) return { userId: user.id, orgId: fromJwt };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profile?.organization_id) {
    return { userId: user.id, orgId: profile.organization_id as string };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Context aggregation (parallel queries for requested sources)
// -----------------------------------------------------------------------------

async function gatherContext(
  orgId: string,
  workspaceId: string | null,
  sources: SourceKey[],
): Promise<ContextBundle> {
  const supabase = getServiceClient();
  const want = new Set(sources);

  const tasks: Array<Promise<unknown>> = [];
  const result: ContextBundle = {
    risks: [],
    findings: [],
    openActions: [],
    dof: [],
    reports: [],
    librarySkipped: want.has("library"),
  };

  if (want.has("existing_risks")) {
    let q = supabase
      .from("risk_assessments")
      .select("id, title, category")
      .eq("organization_id", orgId)
      .limit(20);
    if (workspaceId) q = q.eq("company_workspace_id", workspaceId);
    tasks.push(
      q.then(({ data }) => {
        result.risks = (data ?? []).map((r) => ({
          id: r.id as string,
          title: (r.title as string) ?? "",
          category: (r.category as string) ?? "",
        }));
      }),
    );
  }

  if (want.has("past_findings")) {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    let q = supabase
      .from("risk_assessment_findings")
      .select("id, title, category, severity, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);
    if (workspaceId) q = q.eq("company_workspace_id", workspaceId);
    tasks.push(
      q.then(({ data }) => {
        result.findings = (data ?? []).map((f) => ({
          id: f.id as string,
          title: (f.title as string) ?? "",
          category: (f.category as string) ?? "",
          severity: (f.severity as string) ?? "",
        }));
      }),
    );
  }

  if (want.has("open_actions")) {
    let q = supabase
      .from("corrective_actions")
      .select("id, title, category, priority, status")
      .eq("organization_id", orgId)
      .in("status", ["tracking", "in_progress"])
      .limit(15);
    if (workspaceId) q = q.eq("company_workspace_id", workspaceId);
    tasks.push(
      q.then(({ data }) => {
        result.openActions = (data ?? []).map((a) => ({
          id: a.id as string,
          title: (a.title as string) ?? "",
          category: (a.category as string) ?? "",
          priority: (a.priority as string) ?? "",
        }));
      }),
    );
  }

  if (want.has("dof")) {
    let q = supabase
      .from("corrective_actions")
      .select("id, title, category, priority")
      .eq("organization_id", orgId)
      .in("priority", ["Kritik", "Yüksek"])
      .in("status", ["tracking", "in_progress", "overdue"])
      .limit(15);
    if (workspaceId) q = q.eq("company_workspace_id", workspaceId);
    tasks.push(
      q.then(({ data }) => {
        result.dof = (data ?? []).map((a) => ({
          id: a.id as string,
          title: (a.title as string) ?? "",
          category: (a.category as string) ?? "",
          priority: (a.priority as string) ?? "",
        }));
      }),
    );
  }

  if (want.has("reports")) {
    let q = supabase
      .from("risk_assessments")
      .select("id, title, completed_at, status")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10);
    if (workspaceId) q = q.eq("company_workspace_id", workspaceId);
    tasks.push(
      q.then(({ data }) => {
        result.reports = (data ?? []).map((r) => ({
          id: r.id as string,
          title: (r.title as string) ?? "",
          completed_at: (r.completed_at as string | null) ?? null,
        }));
      }),
    );
  }

  await Promise.all(tasks);
  return result;
}

// -----------------------------------------------------------------------------
// Claude prompt + call
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `Sen bir İSG (iş sağlığı ve güvenliği) uzmanısın. Görevin, saha denetimi için checklist soruları üretmek.

Kurallar:
- Her soru TEK bir uygunsuzluk durumunu kontrol etmeli (çift anlamlı soru YASAK).
- Soru SOMUT ve ÖLÇÜLEBİLİR olmalı (örn: "1 metre güvenli açıklık var mı?" — "güvenlik sağlandı mı?" değil).
- Her soru için: section (örn "Yangın Güvenliği"), category (örn "Yangın"), text, priority (low|medium|high|critical), reason (neden bu checklist'te olmalı — kullanıcının verdiği bağlama atıfla), source_ref (hangi tablodan hangi kayıt/kayıtlardan esinlenildi).
- 6331 Sayılı Kanun ve ilgili yönetmelik referansları varsa reason içinde belirt.
- suggested_action_title alanı: uygunsuz cevap durumunda önerilecek düzeltici aksiyonun başlığı (10-12 kelime).
- Yalnızca JSON döndür. Başka metin YOK, markdown YOK.

Çıktı formatı:
{
  "title": "Checklist başlığı",
  "description": "1-2 cümle açıklama",
  "questions": [
    {
      "section": "...",
      "category": "...",
      "text": "Soru?",
      "priority": "medium",
      "reason": "...",
      "source_ref": { "type": "past_findings", "ids": ["uuid-1"] },
      "suggested_action_title": "..."
    }
  ]
}`;

function buildUserMessage(
  payload: RequestPayload,
  ctx: ContextBundle,
  limits: { min: number; max: number; target: number },
): string {
  const lines: string[] = [];
  lines.push(`AMAÇ: ${payload.purpose}`);
  if (payload.context?.location) lines.push(`LOKASYON: ${payload.context.location}`);
  if (payload.context?.shift) lines.push(`VARDİYA: ${payload.context.shift}`);
  if (payload.context?.line) lines.push(`HAT/BÖLÜM: ${payload.context.line}`);
  lines.push(
    `MOD: ${payload.mode} (hedef soru sayısı ${limits.target}, aralık ${limits.min}-${limits.max})`,
  );
  lines.push("");

  lines.push("=== BAĞLAM ===");
  if (ctx.risks.length > 0) {
    lines.push("\nMEVCUT RİSK ANALİZLERİ:");
    for (const r of ctx.risks) lines.push(`- [${r.id}] ${r.title} (kategori: ${r.category})`);
  }
  if (ctx.findings.length > 0) {
    lines.push("\nSON 90 GÜN GEÇMİŞ TESPİTLERİ:");
    for (const f of ctx.findings)
      lines.push(`- [${f.id}] ${f.title} (${f.category}, şiddet: ${f.severity})`);
  }
  if (ctx.openActions.length > 0) {
    lines.push("\nAÇIK AKSİYONLAR:");
    for (const a of ctx.openActions)
      lines.push(`- [${a.id}] ${a.title} (${a.category}, öncelik: ${a.priority})`);
  }
  if (ctx.dof.length > 0) {
    lines.push("\nYÜKSEK ÖNCELİKLİ DÖF KAYITLARI:");
    for (const d of ctx.dof)
      lines.push(`- [${d.id}] ${d.title} (${d.category}, öncelik: ${d.priority})`);
  }
  if (ctx.reports.length > 0) {
    lines.push("\nÖNCEKİ DENETİM RAPORLARI:");
    for (const r of ctx.reports)
      lines.push(`- [${r.id}] ${r.title} (${r.completed_at ?? "tarih yok"})`);
  }
  if (ctx.librarySkipped) {
    lines.push("\n(Not: İSG kütüphanesi henüz entegre değil — o kaynak atlandı.)");
  }
  if (
    ctx.risks.length +
      ctx.findings.length +
      ctx.openActions.length +
      ctx.dof.length +
      ctx.reports.length ===
    0
  ) {
    lines.push(
      "\n(Bu org için bağlam kaydı bulunamadı — genel İSG en iyi uygulamalarına göre üret.)",
    );
  }

  lines.push(
    `\n=== GÖREV ===\nYukarıdaki AMAÇ ve BAĞLAM'a uygun ${limits.target} adet checklist sorusu üret. Geçmiş tespitler tekrar ediyorsa o konulara öncelik ver. JSON çıktısı dışında hiçbir şey yazma.`,
  );
  return lines.join("\n");
}

async function callClaude(
  anthropic: Anthropic,
  userMessage: string,
): Promise<{ parsed: { title: string; description: string; questions: NovaQuestion[] }; usage: Anthropic.Messages.Usage }> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    temperature: 0.3,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const firstBlock = response.content.find((b) => b.type === "text");
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error("Claude returned non-text content");
  }
  const rawText = firstBlock.text.trim();

  // Strip ```json fences if model added them despite instructions
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_e) {
    throw new Error(`Claude response not valid JSON: ${cleaned.slice(0, 200)}`);
  }

  const p = parsed as {
    title?: string;
    description?: string;
    questions?: NovaQuestion[];
  };
  if (!p.questions || !Array.isArray(p.questions) || p.questions.length === 0) {
    throw new Error("Claude response missing 'questions' array");
  }

  return {
    parsed: {
      title: p.title ?? "Nova Checklist Taslağı",
      description: p.description ?? "",
      questions: p.questions,
    },
    usage: response.usage,
  };
}

// -----------------------------------------------------------------------------
// Persist (template + questions)
// -----------------------------------------------------------------------------

async function persistChecklist(args: {
  orgId: string;
  userId: string;
  workspaceId: string | null;
  payload: RequestPayload;
  parsed: { title: string; description: string; questions: NovaQuestion[] };
}): Promise<{ checklistId: string; questionIds: string[] }> {
  const supabase = getServiceClient();

  const sourcesFlags: Record<string, boolean> = {};
  for (const s of VALID_SOURCES) sourcesFlags[s] = args.payload.sources.includes(s);

  const { data: tmpl, error: tmplErr } = await supabase
    .from("inspection_checklist_templates")
    .insert({
      organization_id: args.orgId,
      company_workspace_id: args.workspaceId,
      title: args.parsed.title,
      description: args.parsed.description,
      source: "nova",
      mode: args.payload.mode,
      status: "draft",
      nova_purpose: args.payload.purpose,
      nova_sources: sourcesFlags,
      metadata: {
        ai_model: ANTHROPIC_MODEL,
        generated_at: new Date().toISOString(),
        context: args.payload.context ?? {},
      },
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (tmplErr || !tmpl) {
    throw new Error(`Template insert failed: ${tmplErr?.message ?? "unknown"}`);
  }
  const checklistId = tmpl.id as string;

  const rows = args.parsed.questions.map((q, index) => ({
    template_id: checklistId,
    sort_order: index,
    section: q.section ?? "Genel",
    category: q.category ?? "Genel",
    text: q.text,
    priority: q.priority ?? "medium",
    suggested_action_title: q.suggested_action_title ?? null,
    source_badges: buildSourceBadges(args.payload.sources),
    why_suggested: q.reason ?? null,
    rule_hint:
      "Uygunsuz cevapta tespit oluşur. Kritik cevapta fotoğraf, not, aksiyon ve sorumlu zorunludur.",
  }));

  const { data: inserted, error: qErr } = await supabase
    .from("inspection_checklist_questions")
    .insert(rows)
    .select("id");
  if (qErr || !inserted) {
    throw new Error(`Questions insert failed: ${qErr?.message ?? "unknown"}`);
  }

  return {
    checklistId,
    questionIds: inserted.map((r) => r.id as string),
  };
}

function buildSourceBadges(sources: SourceKey[]): string[] {
  const badges = ["Nova taslağı"];
  if (sources.includes("existing_risks")) badges.push("Risk analizinden beslendi");
  if (sources.includes("past_findings")) badges.push("Geçmiş tespitlerle beslendi");
  if (sources.includes("open_actions")) badges.push("Açık aksiyonları taradı");
  if (sources.includes("dof")) badges.push("DÖF geçmişini kullandı");
  if (sources.includes("library")) badges.push("Kütüphane ile harmanlandı");
  if (sources.includes("reports")) badges.push("Rapor kayıtlarıyla zenginleşti");
  return badges;
}

// -----------------------------------------------------------------------------
// Input validation
// -----------------------------------------------------------------------------

function validatePayload(body: unknown): RequestPayload | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.purpose !== "string" || b.purpose.trim().length < 5) {
    return { error: "purpose required (min 5 chars)" };
  }
  if (!["quick", "standard", "detailed"].includes(b.mode as string)) {
    return { error: "mode must be quick | standard | detailed" };
  }
  if (!Array.isArray(b.sources) || b.sources.length === 0) {
    return { error: "sources must be non-empty array" };
  }
  const invalid = (b.sources as unknown[]).find(
    (s) => typeof s !== "string" || !VALID_SOURCES.includes(s as SourceKey),
  );
  if (invalid) return { error: `invalid source: ${String(invalid)}` };

  const workspaceId =
    typeof b.workspace_id === "string" && b.workspace_id.length > 0
      ? b.workspace_id
      : null;

  return {
    workspace_id: workspaceId,
    purpose: (b.purpose as string).trim(),
    context:
      b.context && typeof b.context === "object"
        ? (b.context as RequestPayload["context"])
        : undefined,
    mode: b.mode as RequestPayload["mode"],
    sources: b.sources as SourceKey[],
  };
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    await logEdgeErrorEvent({
      level: "critical",
      source: FN_NAME,
      message: "ANTHROPIC_API_KEY not configured",
    });
    return json({ error: "server_misconfigured", message: "AI key missing" }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "invalid_json" }, 400);
  }

  const validated = validatePayload(body);
  if ("error" in validated) return json({ error: "invalid_input", message: validated.error }, 400);

  const auth = await resolveCallerOrg(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const limits = MODE_LIMITS[validated.mode];

  try {
    const ctx = await gatherContext(auth.orgId, validated.workspace_id ?? null, validated.sources);
    const userMessage = buildUserMessage(validated, ctx, limits);

    const anthropic = new Anthropic({ apiKey });
    const { parsed, usage } = await callClaude(anthropic, userMessage);

    const persisted = await persistChecklist({
      orgId: auth.orgId,
      userId: auth.userId,
      workspaceId: validated.workspace_id ?? null,
      payload: validated,
      parsed,
    });

    // Non-blocking observability
    void logEdgeAiUsage({
      userId: auth.userId,
      organizationId: auth.orgId,
      model: ANTHROPIC_MODEL,
      endpoint: FN_NAME,
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      cachedTokens:
        (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
      success: true,
      metadata: {
        mode: validated.mode,
        question_count: parsed.questions.length,
      },
    });

    // Slim output shape (user's spec)
    return json({
      checklist_id: persisted.checklistId,
      title: parsed.title,
      description: parsed.description,
      questions: parsed.questions.map((q, i) => ({
        id: persisted.questionIds[i],
        text: q.text,
        reason: q.reason,
        source_ref: q.source_ref ?? { type: "general", ids: [] },
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEdgeErrorEvent({
      level: "error",
      source: FN_NAME,
      message: `nova-checklist-generator failed: ${message}`,
      userId: auth.userId,
      organizationId: auth.orgId,
      context: { mode: validated.mode, sources: validated.sources },
    });
    return json({ error: "generator_failed", message }, 500);
  }
});

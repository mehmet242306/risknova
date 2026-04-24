// ============================================================================
// Nova Edge Function — solution-chat v13
// Dosya: 06-nova-edge-function.ts
// Hedef: supabase/functions/solution-chat/index.ts
// Sürüm: 1.2 (FINAL - Claude + OpenAI embeddings)
// Tarih: 09 Nisan 2026
// ============================================================================
//
// MIMARI:
// - Ana AI: Claude Sonnet 4 (konusma, tool use, cevap uretimi)
// - Embedding: OpenAI text-embedding-3-small (SADECE semantic cache icin)
// - Neden 2 sağlayıcı: Claude embedding API sunmuyor. OpenAI embedding cok ucuz
//   ($0.02 / 1M token ~ ayda $1) ama cache hit oranini %30 → %65 cikariyor,
//   bu da Claude maliyetinde %30+ tasarruf demek.
//
// GEREKLI ENV VARS:
// - SUPABASE_URL (otomatik)
// - SUPABASE_SERVICE_ROLE_KEY (otomatik)
// - ANTHROPIC_API_KEY (v12'den var)
// - OPENAI_API_KEY (YENI - eklenmeli)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import OpenAI from 'https://esm.sh/openai@4.53.0'
import { z } from 'https://esm.sh/zod@3.23.8'
import { executeWithResilience } from '../_shared/resilience.ts'
import { logEdgeAiUsage, logEdgeErrorEvent } from '../_shared/observability.ts'

// ============================================================================
// CONFIG
// ============================================================================

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i

function buildCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : (LOCAL_DEV_ORIGIN_PATTERN.test(requestOrigin)
      ? requestOrigin
      : (ALLOWED_ORIGINS[0] ?? requestOrigin))

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nova-internal-auth, x-nova-user-id, x-nova-organization-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function jsonErrorResponse(req: Request, options: {
  status: number
  error: string
  message: string
  details?: Record<string, unknown>
  userId?: string | null
  organizationId?: string | null
}) {
  await logEdgeErrorEvent({
    level: options.status >= 500 ? 'error' : 'warn',
    source: 'solution-chat',
    endpoint: '/functions/v1/solution-chat',
    message: options.message,
    context: {
      status: options.status,
      code: options.error,
      ...(options.details ?? {}),
    },
    userId: options.userId ?? null,
    organizationId: options.organizationId ?? null,
  })

  return new Response(
    JSON.stringify({
      error: options.error,
      message: options.message,
      ...(options.details ?? {}),
    }),
    {
      status: options.status,
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
    },
  )
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

const MAX_TOOL_ITERATIONS = 10
const MAX_TOKENS = 4096
const TEMPERATURE = 0.3

const SUPPORTED_NOVA_LANGUAGES = [
  'tr',
  'en',
  'ar',
  'ru',
  'de',
  'fr',
  'es',
  'zh',
  'ja',
  'hi',
  'ko',
  'az',
  'id',
] as const

type NovaLanguage = typeof SUPPORTED_NOVA_LANGUAGES[number]

const NOVA_STRATEGIC_MEMORY_STALE_MS = 6 * 60 * 60 * 1000

// Cosine similarity eşikleri (0-1 arası, 1 = tam eşleşme)
const CACHE_STRONG_MATCH = 0.92   // Güçlü: direkt dön
const CACHE_WEAK_MATCH = 0.85     // Zayıf: Claude'a ipucu ver

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequest {
  message: string
  session_id?: string
  organization_id: string
  workspace_id?: string
  company_workspace_id?: string
  jurisdiction_code?: string
  language?: NovaLanguage
  as_of_date?: string
  answer_mode?: 'extractive' | 'polish'
  mode?: 'read' | 'agent'
  context_surface?: 'widget' | 'solution_center'
  confirmation_token?: string | null
  confirmation_action?: 'confirm' | 'cancel'
  idempotency_key?: string | null
  history?: Array<{ role: 'user' | 'assistant', content: string }>
}

interface ToolContext {
  user: { id: string; organization_id: string; role: string; preferred_language: string }
  subscription: { plan_key: string; allowed_tools: string[]; subscription_id: string }
  supabase: SupabaseClient
  session: {
    id: string
    language: 'tr' | 'en'
    answer_language: NovaLanguage
    as_of_date: string
    answer_mode: 'extractive' | 'polish'
    jurisdiction_code: string
    mode: 'read' | 'agent'
    context_surface: 'widget' | 'solution_center'
    confirmation_token?: string | null
    confirmation_action?: 'confirm' | 'cancel'
    idempotency_key?: string | null
    workspace_id?: string | null
    company_workspace_id?: string | null
  }
}

interface ToolResult {
  success: boolean
  data?: any
  error?: string
  error_type?: string
}

interface LegalEvidenceHit {
  chunk_id?: string | null
  document_id?: string | null
  version_id?: string | null
  law: string
  article: string | null
  title: string | null
  content: string
  relevance_score: number
  source_type: string
  binding_level: string
  official_citation: string
  doc_number?: string | null
  jurisdiction_code?: string | null
  corpus_scope?: 'official' | 'tenant_private'
  workspace_id?: string | null
  rank_fusion_score?: number
  rerank_score?: number
  citation_id?: string
  match_type: 'exact' | 'lexical' | 'dense'
}

const ISG_TASK_CATEGORY_EGITIM = '9b722ae5-0a72-48c8-9d1f-836e1a114b8a'
const ISG_TASK_CATEGORY_PERIYODIK_KONTROL = '5656072d-c601-453d-a3c6-fa40e5a624e6'
const ISG_TASK_CATEGORY_ISG_KURUL = '7e4dda4c-d0c0-4e61-adce-eba783e43085'

const ACTION_LABELS: Record<string, { tr: string; en: string }> = {
  create_training_plan: { tr: 'egitim plani', en: 'training plan' },
  create_planner_task: { tr: 'planner gorevi', en: 'planner task' },
  create_incident_draft: { tr: 'olay taslagi', en: 'incident draft' },
  create_document_draft: { tr: 'dokuman taslagi', en: 'document draft' },
}

const PHASE1_READ_ONLY_TOOLS = [
  'search_legislation',
  'search_past_answers',
  'get_proactive_operations',
  'save_memory_note',
  'get_active_workflows',
  'navigate_to_page',
]

const PHASE1_DRAFT_TOOLS = [
  'create_training_plan',
  'create_planner_task',
  'create_incident_draft',
  'create_document_draft',
]

const PHASE1_BLOCKED_TOOLS = [
  'confirm_pending_action',
  'cancel_pending_action',
  'complete_workflow_step',
]

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional(),
  company_workspace_id: z.string().uuid().optional(),
  jurisdiction_code: z.string().regex(/^[A-Z]{2}$/).optional(),
  language: z.enum(SUPPORTED_NOVA_LANGUAGES).optional(),
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  answer_mode: z.enum(['extractive', 'polish']).optional(),
  mode: z.enum(['read', 'agent']).optional(),
  context_surface: z.enum(['widget', 'solution_center']).optional(),
  confirmation_token: z.string().uuid().nullable().optional(),
  confirmation_action: z.enum(['confirm', 'cancel']).optional(),
  idempotency_key: z.string().uuid().nullable().optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(4000),
    }),
  ).max(20).optional(),
})

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const NOVA_SYSTEM_PROMPT_TR = `Sen Nova'sın. RiskNova platformunun AI iş sağlığı ve güvenliği asistanısın.
20+ yıl deneyimli bir İSG uzmanı gibi davranıyorsun.

## GÖREV
Kullanıcıya şu konularda yardımcı olursun:
1. Türk İSG mevzuatı soruları (search_legislation tool ile)
2. Firma verilerini sorgulama (get_personnel_count, get_recent_assessments)
3. Risk analizi yorumlama
4. Proaktif öneriler

## TOOL KULLANIMI

**search_legislation** — Mevzuat sorusu geldiğinde MUTLAKA kullan. Hafızandan cevap verme.
**get_personnel_count** — Personel sayısı/sorgu için kullan.
**get_recent_assessments** — Risk analizi verisi için kullan.

## HALÜSİNASYON KORUMASI (KURAL #0)

ASLA:
- Bilmediğin mevzuat maddesini uydurma → search_legislation kullan
- Görmediğin personel sayısını söyleme → get_personnel_count kullan
- "Genellikle böyledir" gibi belirsiz cevap verme

EĞER tool'dan veri gelmezse:
- "Bu bilgiyi şu an sistemden çekemiyorum, daha detaylı bilgi için İSG uzmanınıza danışın" de

## ETİK

- Kişisel sağlık verisini cevapta tekrarlama
- Başka firmanın verisini gösterme
- Yasal tavsiye verme — "Hukuk danışmanınıza sorun" de
- Tarafsız kal

## ÇIKTI FORMAT

- Kısa ve net (max 300 kelime)
- Madde madde yapı
- Mevzuat referansı (tool'dan)
- Sonraki adım öner
- Türkçe yaz

Her cevabın sonunda sonraki adım sorusu sor.`

const NOVA_SYSTEM_PROMPT_EN = `You are Nova, the AI OHS assistant of RiskNova platform.
You behave like a 20+ year experienced OHS specialist.

## MISSION
Help users with:
1. OHS regulations (use search_legislation)
2. Company data queries (get_personnel_count, get_recent_assessments)
3. Risk assessment interpretation

## TOOL USAGE

**search_legislation** — ALWAYS use for regulation questions. Never answer from memory.
**get_personnel_count** — Use for personnel queries.
**get_recent_assessments** — Use for risk assessment data.

## HALLUCINATION PROTECTION

NEVER:
- Make up regulation articles → use search_legislation
- Guess personnel counts → use get_personnel_count
- Give vague answers

## OUTPUT
- Short and clear (max 300 words)
- Structured (bullets, headers)
- Referenced (cite from tools)
- Respond in user's language`

function normalizeNovaLanguage(language?: string | null): NovaLanguage {
  if (!language) return 'tr'
  const normalized = String(language).trim().toLowerCase()
  return (SUPPORTED_NOVA_LANGUAGES as readonly string[]).includes(normalized)
    ? (normalized as NovaLanguage)
    : 'tr'
}

function isRecoverableNovaInfraError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message || error || '').toLowerCase()
  return [
    'schema cache',
    'does not exist',
    'relation ',
    '42p01',
    '42883',
    'failed to fetch',
    'network request failed',
  ].some((pattern) => message.includes(pattern))
}

function getRecoverableNovaFallback(language: NovaLanguage) {
  if (language === 'en') {
    return {
      answer: 'Nova is temporarily switching to safe mode while the latest server updates are being applied. Please try the same request again shortly.',
      summary: 'Nova temporarily unavailable',
    }
  }

  return {
    answer: 'Nova son sunucu guncellemeleri uygulanirken gecici olarak guvenli moda gecti. Lutfen ayni istegi biraz sonra tekrar deneyin.',
    summary: 'Nova gecici olarak kullanilamiyor',
  }
}

function getOperationalLanguage(language: NovaLanguage): 'tr' | 'en' {
  return language === 'tr' ? 'tr' : 'en'
}

function getNovaLanguageLabel(language: NovaLanguage): string {
  const labels: Record<NovaLanguage, string> = {
    tr: 'Turkish',
    en: 'English',
    ar: 'Arabic',
    ru: 'Russian',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    zh: 'Chinese',
    ja: 'Japanese',
    hi: 'Hindi',
    ko: 'Korean',
    az: 'Azerbaijani',
    id: 'Indonesian',
  }

  return labels[language]
}

function getSystemPrompt(language: NovaLanguage): string {
  const operationalLanguage = getOperationalLanguage(language)
  const basePrompt = operationalLanguage === 'tr' ? NOVA_SYSTEM_PROMPT_TR : NOVA_SYSTEM_PROMPT_EN
  const answerLanguageLabel = getNovaLanguageLabel(language)

  if (operationalLanguage === 'tr') {
    return `${basePrompt}

## YANIT DILI MODU
- Son yaniti ${answerLanguageLabel} dilinde ver.
- Resmi mevzuat adlarini, madde numaralarini ve kaynak basliklarini orijinal haliyle koru.
- Mevzuat yorumunda cevabi uc katmanda kur:
  1. Kaynaga dayali bulgu
  2. Nova yorumu / operasyonel yorum
  3. Onerilen sonraki adim
- Kullanici farkli bir dilde yazsa bile operasyon ve mevzuat tutarliligini bozma.`
  }

  return `${basePrompt}

## RESPONSE LANGUAGE MODE
- Deliver the final answer in ${answerLanguageLabel}.
- Keep official regulation titles, article numbers, and source names in their original form.
- For regulation-heavy answers, structure the response in three parts:
  1. Source-backed finding
  2. Nova interpretation
  3. Recommended operational next step
- Keep operational guidance concise and globally understandable.`
}

function detectMessageLanguage(text: string, fallback: 'tr' | 'en' = 'tr'): 'tr' | 'en' {
  const lower = text.toLowerCase()

  if (/\b(answer in english|respond in english|english please)\b/.test(lower)) return 'en'
  if (/\b(turkce cevapla|turkce yaz|türkçe cevapla|türkçe yaz)\b/.test(lower)) return 'tr'

  const trSignals = [
    've', 'ile', 'icin', 'nasil', 'nedir', 'hangi', 'egitim', 'eğitim', 'risk', 'mevzuat',
    'gorev', 'görev', 'olay', 'dokuman', 'doküman', 'planla', 'yap', 'goster', 'hazirla',
  ]
  const enSignals = [
    'and', 'with', 'how', 'what', 'which', 'training', 'incident', 'document', 'schedule',
    'plan', 'show', 'create', 'prepare', 'risk', 'regulation', 'compliance',
  ]

  const trScore =
    trSignals.reduce((sum, token) => sum + (lower.includes(token) ? 1 : 0), 0) +
    ((/[çğıöşü]/i.test(text) ? 2 : 0))
  const enScore =
    enSignals.reduce((sum, token) => sum + (lower.includes(token) ? 1 : 0), 0)

  if (enScore >= trScore + 2) return 'en'
  if (trScore > enScore) return 'tr'
  return fallback
}

function resolveConversationLanguage(
  message: string,
  requestedLanguage?: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): 'tr' | 'en' {
  const requested = requestedLanguage === 'en' ? 'en' : 'tr'
  const recentContext = history?.slice(-4).map((item) => item.content).join(' ') ?? ''
  return detectMessageLanguage(`${recentContext}\n${message}`, requested)
}

function detectNovaMessageLanguage(text: string, fallback: NovaLanguage = 'tr'): NovaLanguage {
  const lower = text.toLowerCase()

  if (/\b(answer in english|respond in english|english please)\b/.test(lower)) return 'en'
  if (/\b(answer in turkish|respond in turkish|turkish please|turkce cevapla|turkce yaz)\b/.test(lower)) return 'tr'
  if (/\b(responde en español|en español|habla español)\b/.test(lower)) return 'es'
  if (/\b(repondez en français|en français|parle français)\b/.test(lower)) return 'fr'
  if (/\b(auf deutsch|deutsch antworten|bitte deutsch)\b/.test(lower)) return 'de'
  if (/\b(на русском|ответь по-русски|по русски)\b/.test(lower)) return 'ru'
  if (/\b(bahasa indonesia|dalam bahasa indonesia)\b/.test(lower)) return 'id'
  if (/\b(azərbaycanca|azerbaycanca|azerice)\b/.test(lower)) return 'az'

  if (/[\u0600-\u06FF]/.test(text)) return 'ar'
  if (/[\u0400-\u04FF]/.test(text)) return 'ru'
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  if (/[\u3040-\u30FF]/.test(text)) return 'ja'
  if (/[\u0900-\u097F]/.test(text)) return 'hi'
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'

  const languageSignals: Record<NovaLanguage, string[]> = {
    tr: ['ve', 'ile', 'icin', 'nasil', 'nedir', 'hangi', 'egitim', 'risk', 'mevzuat', 'gorev', 'olay', 'dokuman', 'planla', 'hazirla'],
    en: ['and', 'with', 'how', 'what', 'which', 'training', 'incident', 'document', 'schedule', 'plan', 'show', 'prepare', 'regulation'],
    ar: ['السلام', 'مرحبا', 'التدريب', 'المخاطر', 'السلامة'],
    ru: ['как', 'что', 'обучение', 'риск', 'закон'],
    de: ['und', 'wie', 'was', 'schulung', 'risiko', 'verordnung'],
    fr: ['et', 'comment', 'formation', 'risque', 'règlement', 'reglement'],
    es: ['y', 'como', 'qué', 'capacitacion', 'riesgo', 'normativa'],
    zh: ['培训', '风险', '法规', '计划'],
    ja: ['教育', '研修', 'リスク', '法令'],
    hi: ['और', 'कैसे', 'प्रशिक्षण', 'जोखिम'],
    ko: ['교육', '위험', '법규', '계획'],
    az: ['və', 'necə', 'təlim', 'risk', 'qanunvericilik'],
    id: ['dan', 'bagaimana', 'pelatihan', 'risiko', 'regulasi'],
  }

  const best = Object.entries(languageSignals)
    .map(([lang, tokens]) => ({
      lang: lang as NovaLanguage,
      score: tokens.reduce((sum, token) => sum + (lower.includes(token) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0]

  if (best && best.score > 0) return best.lang
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr'
  return fallback
}

function resolveNovaConversationLanguage(
  message: string,
  requestedLanguage?: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): NovaLanguage {
  const requested = normalizeNovaLanguage(requestedLanguage)
  const recentContext = history?.slice(-4).map((item) => item.content).join(' ') ?? ''
  return detectNovaMessageLanguage(`${recentContext}\n${message}`, requested)
}

function detectNovaIntent(message: string): 'regulation' | 'training' | 'planning' | 'incident' | 'document' | 'navigation' | 'analysis' | 'general' {
  const lower = message.toLowerCase()

  if (/(mevzuat|yonetmelik|yönetmelik|kanun|madde|regulation|law|article|legal)/.test(lower)) return 'regulation'
  if (/(egitim|eğitim|training|sertifika|certificate)/.test(lower)) return 'training'
  if (/(ramak kala|is kazasi|iş kazası|incident|near miss|occupational disease|olay)/.test(lower)) return 'incident'
  if (/(dokuman|doküman|procedure|prosedur|prosedür|report|rapor|form|tutanak|document)/.test(lower)) return 'document'
  if (/(planla|takvim|gorev|görev|schedule|planner|task|kurul)/.test(lower)) return 'planning'
  if (/(ac|aç|gotur|götür|show|open|navigate|go to)/.test(lower)) return 'navigation'
  if (/(analiz|analysis|degerlendir|değerlendir|ozetle|özetle|risk)/.test(lower)) return 'analysis'
  return 'general'
}

function detectNovaIntentAdvanced(message: string): 'regulation' | 'training' | 'planning' | 'incident' | 'document' | 'navigation' | 'analysis' | 'general' {
  const normalized = message
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')

  if (/(mevzuat|yonetmelik|kanun|madde|regulation|law|article|legal|gesetz|verordnung|ley|leyes|loi|reglement|reglamento|normativa|isg uzmani|is guvenligi uzmani|isyeri hekimi|diger saglik personeli|dsp|tehlike sinifi|cok tehlikeli|az tehlikeli|tehlikeli sinif|calisan sayisi|personel sayisi|kac kisi|kac personel|ayda kac saat|bildirim suresi|zorunlu mu|gerekli mi|yasal|yukumluluk|sorumluluk)/.test(normalized)) return 'regulation'
  if (/(egitim|training|sertifika|certificate|schulung|formation|curso|capacitacion|pelatihan)/.test(normalized)) return 'training'
  if (/(ramak kala|is kazasi|incident|near miss|occupational disease|olay|unfall|incidente|accident|accidente)/.test(normalized)) return 'incident'
  if (/(dokuman|procedure|prosedur|report|rapor|form|tutanak|document|dokument|documento|rapport)/.test(normalized)) return 'document'
  if (/(planla|takvim|gorev|schedule|planner|task|kurul|planifier|programar|planen|aufgabe|agenda)/.test(normalized)) return 'planning'
  if (/(ac|gotur|show|open|navigate|go to|ouvrir|abrir|offnen|zeigen)/.test(normalized)) return 'navigation'
  if (/(analiz|analysis|degerlendir|ozetle|risk|analyse|analisis|analizar|bewerten|summary)/.test(normalized)) return 'analysis'
  return detectNovaIntent(message)
}

function buildIntentRoutingContext(message: string, language: string): string {
  const intent = detectNovaIntentAdvanced(message)

  if (language === 'en') {
    const hints: Record<string, string> = {
      regulation: 'Intent: regulation-first. Prioritize search_legislation and source-backed interpretation.',
      training: 'Intent: training operation. If the request opens a record, prepare the action and wait for approval.',
      planning: 'Intent: planning operation. Use planner/task tools and ask only for critical missing fields.',
      incident: 'Intent: incident workflow. Prefer creating a controlled draft instead of assuming facts.',
      document: 'Intent: document workflow. Prefer draft creation and operational guidance.',
      navigation: 'Intent: navigation. Route the user directly when the destination is clear.',
      analysis: 'Intent: analysis. Combine company context, recent data, and legislation when needed.',
      general: 'Intent: mixed/general. Answer clearly and choose tools conservatively.',
    }
    return `## INTENT ROUTING\n${hints[intent]}`
  }

  const hints: Record<string, string> = {
    regulation: 'Niyet: mevzuat-oncelikli. search_legislation ve kaynakli yorumlama kullan.',
    training: 'Niyet: egitim operasyonu. Kayit acilacaksa islemi once hazirla, sonra onay bekle.',
    planning: 'Niyet: planlama operasyonu. Planner/gorev toollarini kullan, sadece kritik eksik alanlari sor.',
    incident: 'Niyet: olay akisi. Varsayim yapma, kontrollu taslak olustur.',
    document: 'Niyet: dokuman akisi. Taslak olusturma ve operasyon yonlendirmesini one al.',
    navigation: 'Niyet: yonlendirme. Hedef netse kullaniciyi dogrudan ilgili sayfaya gotur.',
    analysis: 'Niyet: analiz. Firma baglami, son veriler ve gerekiyorsa mevzuati birlestir.',
    general: 'Niyet: genel/karma. Net cevap ver, toollari ihtiyatli sec.',
  }

  return `## NIYET YONLENDIRMESI\n${hints[intent]}`
}

function buildRegulatoryReasoningContext(message: string, language: 'tr' | 'en'): string {
  if (detectNovaIntentAdvanced(message) !== 'regulation') return ''

  if (language === 'en') {
    return [
      '## REGULATORY REASONING LAYER',
      '- When the user asks a legislation-heavy question, search first and anchor the answer to returned sources.',
      '- Clearly separate three parts: source-backed finding, Nova interpretation, and operational next step.',
      '- If multiple sources conflict or point to different duties, say so explicitly instead of flattening them.',
      '- Treat internal memory as an operational hint, never as regulatory evidence.',
    ].join('\n')
  }

  return [
    '## MEVZUAT YORUM KATMANI',
    '- Mevzuat agirlikli sorularda once arama yap ve cevabi donen kaynaklara dayandir.',
    '- Cevabi uc parcaya ayir: kaynaga dayali bulgu, Nova yorumu, operasyonel sonraki adim.',
    '- Birden fazla kaynak farkli yukumluluklere isaret ediyorsa bunu duzlestirme; acikca belirt.',
    '- Ic hafizayi sadece operasyon ipucu olarak kullan; mevzuat kaniti yerine koyma.',
  ].join('\n')
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const NOVA_TOOLS = [
  {
    name: 'search_legislation',
    description: 'Türk İSG mevzuatında arama yapar. Mevzuat sorularında MUTLAKA kullanın. Hafızadan cevap vermek yerine her zaman güncel mevzuat verisini bu tooldan alın.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Aranacak soru (Türkçe)' },
        law_number: { type: 'string', description: 'Opsiyonel kanun no filtresi' },
        max_results: { type: 'integer', description: 'Maksimum sonuç', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'get_personnel_count',
    description: 'Firma personel sayısı ve dağılımı. Kaç kişi, kaç kaynakçı gibi sorularda kullanın.',
    input_schema: {
      type: 'object',
      properties: {
        position_filter: { type: 'string', description: 'Pozisyon filtresi' },
        department_filter: { type: 'string', description: 'Departman filtresi' },
        company_workspace_id: { type: 'string', description: 'Firma ID (opsiyonel)' }
      }
    }
  },
  {
    name: 'get_recent_assessments',
    description: 'Son risk analizlerini listeler. Risk sorgularında kullanın.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', default: 5 },
        severity_filter: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        method_filter: { type: 'string', enum: ['r_skor', 'fine_kinney', 'l_matrix', 'fmea', 'hazop', 'bow_tie', 'fta', 'checklist', 'jsa', 'lopa'] },
        days_back: { type: 'integer', default: 90 }
      }
    }
  },
  {
    name: 'search_past_answers',
    description: 'Nova ve onceki ogrenme kayitlarinda benzer cevaplari arar. Tekrar eden sorularda, kullanicinin gecmis cozumlerini hatirlamada ve kurumsal kaliplari bulmada kullan.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Aranacak gecmis soru veya konu' },
        scope: {
          type: 'string',
          enum: ['user', 'global'],
          default: 'user',
          description: 'Yalnizca kullanicinin gecmisi veya genel ogrenme havuzu'
        },
        max_results: { type: 'integer', description: 'Maksimum sonuc sayisi', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'save_memory_note',
    description: 'Nova icin kalici hafiza notu kaydeder. Yalnizca kullanicinin acikca belirttigi kalici tercihleri, tekrar eden firma kaliplarini veya operasyon notlarini kaydetmek icin kullan.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Kisa hafiza basligi' },
        memory_text: { type: 'string', description: 'Kaydedilecek hafiza notu' },
        memory_type: {
          type: 'string',
          enum: ['user_preference', 'company_pattern', 'working_style', 'operational_note'],
          default: 'operational_note'
        },
        company_workspace_id: { type: 'string', description: 'Firma workspace ID (opsiyonel)' },
        confidence_score: { type: 'number', description: '0 ile 1 arasinda guven skoru', default: 0.8 }
      },
      required: ['title', 'memory_text']
    }
  },
  {
    name: 'get_active_workflows',
    description: 'Nova tarafindan baslatilmis aktif operasyon akislarini ve siradaki adimlari listeler. Kullanici "sirada ne var", "hangi adimdayiz", "devam et" veya "ne kaldi" diye sordugunda kullan.',
    input_schema: {
      type: 'object',
      properties: {
        max_results: { type: 'integer', description: 'Maksimum aktif workflow sayisi', default: 3 }
      }
    }
  },
  {
    name: 'complete_workflow_step',
    description: 'Kullanici bir workflow adimini tamamladigini soylediginde adimi kapatir ve siradaki takip adimini getirir.',
    input_schema: {
      type: 'object',
      properties: {
        step_id: { type: 'string', description: 'Opsiyonel workflow step ID' },
        workflow_id: { type: 'string', description: 'Opsiyonel workflow ID' },
        status: {
          type: 'string',
          enum: ['completed', 'skipped', 'cancelled'],
          default: 'completed',
          description: 'Adim sonucu'
        }
      }
    }
  },
  {
    name: 'get_proactive_operations',
    description: 'Nova kullanicinin aktif akislarini, yaklasan gorevlerini, taslaklarini ve siradaki oncelikli operasyonlarini toplu olarak getirir. Kullanici "bugun ne yapmaliyim", "oncelikli ne var", "beni yonlendir", "takip etmem gerekenler neler" gibi sorular sordugunda kullan.',
    input_schema: {
      type: 'object',
      properties: {
        max_results: { type: 'integer', description: 'Her kategori icin maksimum sonuc sayisi', default: 4 },
        company_workspace_id: { type: 'string', description: 'Opsiyonel firma workspace ID' }
      }
    }
  },
  {
    name: 'navigate_to_page',
    description: 'Kullaniciyi platform icinde bir sayfaya yonlendirir. Kullanici "ac", "goster", "git", "yonlendir" gibi eylem komutlari verdiginde kullan. ONEMLI URL YAPISI: Bu platformda firma yonetimi query param tab sistemiyle calisir (/companies/[id]?tab=slug). Personel, ekip, planlama, takip, arsiv gibi sayfalar BAGIMSIZ DEGIL, aktif firmanin alt tab\'larindadir. Kullanici "personel listesi" derse company_personnel kullan. "Ekip" derse company_people kullan. "Risk ve saha" derse company_risk kullan. "Son risk analizi" derse latest_risk_assessment kullan (ayri /risk-analysis sayfasina gider). "Firma sayfasi" derse active_company kullan (aktif firmanin overview\'una gider). Tek bir personelin detayi icin personnel_detail + record_id kullan. Bagimsiz sayfalar: dashboard, notifications, settings, profile, reports, calendar, incidents, documents, training.',
    input_schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          enum: [
            'dashboard', 'companies_list', 'active_company', 'company_detail',
            'company_overview', 'company_structure', 'company_risk', 'company_people',
            'company_personnel', 'company_planner', 'company_tracking', 'company_documents',
            'company_organization', 'company_history', 'personnel_list', 'personnel_detail',
            'risk_analysis_list', 'latest_risk_assessment', 'new_risk_analysis', 'specific_risk_assessment',
            'r_skor_2d', 'incidents_list', 'new_incident', 'incident_detail',
            'documents_list', 'new_document', 'document_detail', 'templates',
            'training_list', 'new_training', 'training_detail', 'certificates',
            'solution_center', 'planner', 'reports', 'tasks', 'findings',
            'hazard_library', 'emergency_plan', 'calendar', 'notifications', 'settings', 'profile',
            'executive_summary', 'deadline_tracking', 'health', 'medical_schedule'
          ],
          description: 'Hedef sayfa'
        },
        record_id: { type: 'string', description: 'Belirli bir kayıt ID (opsiyonel)' },
        reason: { type: 'string', description: 'Kullanıcıya neden oraya yönlendirdiğini açıklayan kısa metin (max 100 karakter)' }
      },
      required: ['destination', 'reason']
    }
  },
  {
    name: 'create_training_plan',
    description: 'Firma icin egitim planlar ve gerekli takip gorevini olusturur. Kullanici planla, takvime ekle, egitim olustur gibi operasyon komutlari verdiginde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Egitim basligi' },
        training_type: {
          type: 'string',
          enum: ['zorunlu', 'istege_bagli', 'yenileme'],
          description: 'Egitim tipi',
          default: 'zorunlu'
        },
        training_date: { type: 'string', description: 'Egitim tarihi (YYYY-MM-DD)' },
        duration_hours: { type: 'number', description: 'Egitim suresi saat cinsinden', default: 2 },
        trainer_name: { type: 'string', description: 'Egitmen adi (opsiyonel)' },
        location: { type: 'string', description: 'Lokasyon (opsiyonel)' },
        notes: { type: 'string', description: 'Ek notlar (opsiyonel)' },
        company_workspace_id: { type: 'string', description: 'Firma workspace ID (opsiyonel)' },
        confirmed: { type: 'boolean', description: 'Yalnizca kullanici acikca onay verdiyse true gonder' }
      },
      required: ['title', 'training_date']
    }
  },
  {
    name: 'create_planner_task',
    description: 'Firma icin planner veya takip gorevi olusturur. Toplanti, kontrol, saha turu, kurul veya genel planlama taleplerinde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Gorev basligi' },
        start_date: { type: 'string', description: 'Baslangic tarihi (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Bitis tarihi (YYYY-MM-DD, opsiyonel)' },
        description: { type: 'string', description: 'Gorev aciklamasi' },
        location: { type: 'string', description: 'Lokasyon (opsiyonel)' },
        recurrence: {
          type: 'string',
          enum: ['none', 'daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'],
          default: 'none'
        },
        reminder_days: { type: 'integer', description: 'Kac gun once hatirlatma yapilacagi', default: 7 },
        category_hint: {
          type: 'string',
          enum: ['genel', 'egitim', 'isg_kurul', 'periyodik_kontrol'],
          default: 'genel'
        },
        company_workspace_id: { type: 'string', description: 'Firma workspace ID (opsiyonel)' },
        confirmed: { type: 'boolean', description: 'Yalnizca kullanici acikca onay verdiyse true gonder' }
      },
      required: ['title', 'start_date']
    }
  },
  {
    name: 'create_incident_draft',
    description: 'Olay taslagi olusturur. Kullanici yeni olay, ramak kala, is kazasi veya meslek hastaligi kaydi baslatmak istediginde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        incident_type: {
          type: 'string',
          enum: ['work_accident', 'near_miss', 'occupational_disease'],
          description: 'Olay tipi'
        },
        company_workspace_id: { type: 'string', description: 'Firma workspace ID (opsiyonel)' },
        incident_date: { type: 'string', description: 'Olay tarihi (YYYY-MM-DD, opsiyonel)' },
        incident_time: { type: 'string', description: 'Olay saati (HH:MM, opsiyonel)' },
        incident_location: { type: 'string', description: 'Olay lokasyonu (opsiyonel)' },
        incident_department: { type: 'string', description: 'Bolum (opsiyonel)' },
        general_activity: { type: 'string', description: 'Genel faaliyet (opsiyonel)' },
        tool_used: { type: 'string', description: 'Kullanilan arac veya ekipman (opsiyonel)' },
        description: { type: 'string', description: 'Kisa olay aciklamasi (opsiyonel)' },
        severity_level: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'On degerlendirme siddeti (opsiyonel)'
        },
        dof_required: { type: 'boolean', default: false },
        ishikawa_required: { type: 'boolean', default: false },
        confirmed: { type: 'boolean', description: 'Yalnizca kullanici acikca onay verdiyse true gonder' }
      },
      required: ['incident_type']
    }
  },
  {
    name: 'create_document_draft',
    description: 'Editor icinde yeni bir dokuman taslagi olusturur. Prosedur, form, tutanak, plan veya rapor taslagi istendiginde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Dokuman basligi' },
        document_type: {
          type: 'string',
          enum: ['procedure', 'training_form', 'meeting_minutes', 'risk_report', 'emergency_plan', 'inspection_report', 'checklist', 'custom'],
          default: 'custom'
        },
        summary: { type: 'string', description: 'Taslak kapsam veya amac ozeti' },
        company_workspace_id: { type: 'string', description: 'Firma workspace ID (opsiyonel)' },
        confirmed: { type: 'boolean', description: 'Yalnizca kullanici acikca onay verdiyse true gonder' }
      },
      required: ['title']
    }
  },
  {
    name: 'confirm_pending_action',
    description: 'Nova tarafindan hazirlanmis bekleyen bir kritik aksiyonu onaylayip gerceklestirir. Kullanici evet, onayliyorum, devam et gibi acik onay verdiginde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        action_id: { type: 'string', description: 'Opsiyonel bekleyen aksiyon ID' }
      }
    }
  },
  {
    name: 'cancel_pending_action',
    description: 'Bekleyen bir kritik aksiyonu iptal eder. Kullanici iptal et, vazgectim, uygulama gibi komutlar verdiginde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        action_id: { type: 'string', description: 'Opsiyonel bekleyen aksiyon ID' },
        reason: { type: 'string', description: 'Iptal nedeni (opsiyonel)' }
      }
    }
  }
]

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

function inferLegislationMetadata(docTitle: string, articleNumber?: string | null) {
  const normalizedTitle = (docTitle || '').toLowerCase()

  let sourceType = 'official_document'
  let bindingLevel = 'high'

  if (normalizedTitle.includes('kanun')) {
    sourceType = 'law'
    bindingLevel = 'very_high'
  } else if (normalizedTitle.includes('yonetmelik')) {
    sourceType = 'regulation'
    bindingLevel = 'high'
  } else if (normalizedTitle.includes('teblig')) {
    sourceType = 'communique'
    bindingLevel = 'medium_high'
  } else if (normalizedTitle.includes('genelge') || normalizedTitle.includes('rehber')) {
    sourceType = 'guidance'
    bindingLevel = 'medium'
  }

  return {
    jurisdiction: 'TR',
    source_language: 'tr',
    source_type: sourceType,
    binding_level: bindingLevel,
    official_citation: articleNumber ? `${docTitle} md. ${articleNumber}` : docTitle,
  }
}

function applyEvidenceContext(
  metadata: ReturnType<typeof inferLegislationMetadata>,
  row: {
    jurisdiction_code?: string | null
    corpus_scope?: string | null
    workspace_id?: string | null
  },
) {
  const corpusScope = row.corpus_scope === 'tenant_private' ? 'tenant_private' : 'official'
  const jurisdictionCode = row.jurisdiction_code || metadata.jurisdiction
  const officialCitation = corpusScope === 'tenant_private'
    ? `[Tenant Private ${jurisdictionCode}] ${metadata.official_citation}`
    : metadata.official_citation

  return {
    ...metadata,
    jurisdiction: jurisdictionCode,
    official_citation: officialCitation,
    corpus_scope: corpusScope,
    jurisdiction_code: jurisdictionCode,
    workspace_id: row.workspace_id || null,
  }
}

async function resolveJurisdictionCode(
  supabase: SupabaseClient,
  workspaceId?: string | null,
  requestedCode?: string | null,
): Promise<string> {
  if (requestedCode && /^[A-Z]{2}$/.test(requestedCode)) {
    return requestedCode
  }

  if (!workspaceId) return 'TR'

  const { data, error } = await supabase
    .from('workspaces')
    .select('country_code')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[resolveJurisdictionCode] failed:', error.message)
    return 'TR'
  }

  return data?.country_code || 'TR'
}

function normalizeTurkishAscii(value: string): string {
  return value
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
}

function parseLawNumberFromQuery(query: string): string | null {
  const match = query.match(/\b(\d{3,5})\s*(?:sayili|sayılı)?\s*(?:kanun|kanunu|kanunun|law)?\b/i)
  if (match?.[1]) return match[1]

  const fallback = query.match(/\bkanun\s*(?:no|numarasi|numarası)?[:\s]+(\d{3,5})\b/i)
  return fallback?.[1] ?? null
}

function parseArticleReferenceFromQuery(query: string): string | null {
  const normalized = normalizeTurkishAscii(query)

  const gecici = normalized.match(/\bgecici\s+madde\s+(\d+(?:\/[a-z])?)\b/i)
  if (gecici?.[1]) return `Gecici Madde ${gecici[1].toUpperCase()}`

  const ek = normalized.match(/\bek\s+madde\s+(\d+(?:\/[a-z])?)\b/i)
  if (ek?.[1]) return `Ek Madde ${ek[1].toUpperCase()}`

  const normal = normalized.match(/\b(?:madde|md)\.?\s+(\d+(?:\/[a-z])?)\b/i)
  if (normal?.[1]) return `Madde ${normal[1].toUpperCase()}`

  return null
}

function buildArticleReferencePatterns(articleReference: string | null): string[] {
  if (!articleReference) return []

  const normalized = articleReference.trim()
  const articleNumber = normalized.match(/(\d+(?:\/[A-Z])?)/i)?.[1] ?? normalized

  if (/^gecici/i.test(normalized)) {
    return [`Geçici Madde ${articleNumber}`, `Gecici Madde ${articleNumber}`, `Madde ${articleNumber}`]
  }

  if (/^ek/i.test(normalized)) {
    return [`Ek Madde ${articleNumber}`, `Madde ${articleNumber}`]
  }

  return [`Madde ${articleNumber}`]
}

function resolveAsOfDate(value?: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Date().toISOString().slice(0, 10)
}

function normalizeSearchTerms(query: string): string[] {
  const stopWords = new Set(['bir', 'bu', 'ile', 'var', 'olan', 'gibi', 'daha', 'icin', 'olarak', 'nasil', 'kac', 'hangi', 'nedir', 'neler'])
  return (query || '')
    .toLowerCase()
    .replace(/[.,;:!?()]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 2 && !stopWords.has(w))
    .slice(0, 15)
}

function buildEvidenceKey(hit: LegalEvidenceHit): string {
  return [hit.document_id || hit.law, hit.version_id || '', hit.article || '', hit.title || ''].join('::')
}

function reciprocalRankFusion(resultSets: LegalEvidenceHit[][]): LegalEvidenceHit[] {
  const scores = new Map<string, LegalEvidenceHit>()

  resultSets.forEach((set, setIndex) => {
    set.forEach((hit, index) => {
      const key = buildEvidenceKey(hit)
      const current = scores.get(key)
      const contribution = 1 / (60 + index + 1 + setIndex)
      if (!current) {
        scores.set(key, {
          ...hit,
          rank_fusion_score: contribution,
        })
        return
      }

      current.rank_fusion_score = Number(current.rank_fusion_score || 0) + contribution
      current.relevance_score = Math.max(current.relevance_score || 0, hit.relevance_score || 0)
      current.match_type = current.match_type === 'exact' ? 'exact' : hit.match_type
    })
  })

  return Array.from(scores.values()).sort((a, b) => Number(b.rank_fusion_score || 0) - Number(a.rank_fusion_score || 0))
}

function rerankLegalHits(query: string, hits: LegalEvidenceHit[]): LegalEvidenceHit[] {
  const normalizedQuery = normalizeTurkishAscii(query)
  const lawNumber = parseLawNumberFromQuery(query)
  const articleRef = parseArticleReferenceFromQuery(query)

  return hits
    .map((hit, index) => {
      let score = Number(hit.rank_fusion_score || 0)

      if (hit.match_type === 'exact') score += 10
      if (hit.match_type === 'dense') score += 1.2
      if (lawNumber && hit.doc_number === lawNumber) score += 3
      if (articleRef && normalizeTurkishAscii(hit.article || '').includes(normalizeTurkishAscii(articleRef))) score += 4

      const haystack = normalizeTurkishAscii(`${hit.law} ${hit.title || ''} ${hit.content.slice(0, 600)}`)
      const queryTerms = normalizedQuery.split(/\s+/).filter((token) => token.length > 2)
      for (const term of queryTerms) {
        if (haystack.includes(term)) score += 0.15
      }

      return { ...hit, rerank_score: score + Math.max(0, 0.001 * (50 - index)) }
    })
    .sort((a, b) => Number(b.rerank_score || 0) - Number(a.rerank_score || 0))
}

async function saveLegalRetrievalRun(params: {
  supabase: SupabaseClient
  userId: string
  organizationId: string
  workspaceId?: string | null
  queryText: string
  asOfDate: string
  answerMode: 'extractive' | 'polish'
  trace: Record<string, unknown>
  answerPreview: string
  confidence: number
}): Promise<string | null> {
  try {
    const { data, error } = await params.supabase
      .from('legal_retrieval_runs')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        workspace_id: params.workspaceId ?? null,
        query_text: params.queryText,
        as_of_date: params.asOfDate,
        answer_mode: params.answerMode,
        retrieval_trace: params.trace,
        answer_preview: params.answerPreview.slice(0, 1000),
        confidence: params.confidence,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[saveLegalRetrievalRun] failed:', error)
      return null
    }

    return data?.id || null
  } catch (err) {
    console.error('[saveLegalRetrievalRun] unexpected:', err)
    return null
  }
}

function isOperationalCommandQuery(query: string): boolean {
  return /(olustur|oluştur|planla|ekle|kaydet|ac|aç|git|yonlendir|yönlendir|create|plan|open|navigate)/i.test(query)
}

function hasExplicitLegalAnchor(query: string): boolean {
  const normalized = normalizeTurkishAscii(query)
  return Boolean(
    parseLawNumberFromQuery(query) ||
    parseArticleReferenceFromQuery(query) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(query) ||
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(normalized) ||
    /\b(yururluk|yururluk tarihi|effective date|official gazette|resmi gazete)\b/i.test(normalized)
  )
}

function shouldUseDeterministicLegalMode(query: string): boolean {
  return detectNovaIntentAdvanced(query) === 'regulation' &&
    !isOperationalCommandQuery(query) &&
    hasExplicitLegalAnchor(query)
}

function summarizeLegalContentExtractively(content: string, maxLength = 260): string {
  const normalized = content
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()

  if (!normalized) return ''

  const sentence = normalized.split(/(?<=[.!?;:])\s+/)[0]?.trim() || normalized
  if (sentence.length <= maxLength) return sentence
  return `${sentence.slice(0, maxLength - 1).trim()}…`
}

async function exactLegalCitationLookup(
  query: string,
  context: ToolContext,
  maxResults = 5,
): Promise<LegalEvidenceHit[]> {
  const lawNumber = parseLawNumberFromQuery(query)
  const articlePatterns = buildArticleReferencePatterns(parseArticleReferenceFromQuery(query))

  if (!lawNumber) return []

  const { data, error } = await context.supabase.rpc('exact_legal_reference_lookup', {
    law_number: lawNumber,
    article_patterns: articlePatterns.length > 0 ? articlePatterns : null,
    as_of_date: context.session.as_of_date,
    result_limit: maxResults,
    jurisdiction_code: context.session.jurisdiction_code,
    workspace_id: context.session.workspace_id ?? null,
  })

  if (error || !data?.length) return []

  return data.map((chunk: any) => {
    const metadata = applyEvidenceContext(
      inferLegislationMetadata(chunk.doc_title || 'Mevzuat', chunk.article_number),
      chunk,
    )
    return {
      chunk_id: chunk.chunk_id || null,
      document_id: chunk.document_id || null,
      version_id: chunk.version_id || null,
      law: chunk.doc_title || 'Mevzuat',
      article: chunk.article_number || null,
      title: chunk.article_title || null,
      content: chunk.content || '',
      relevance_score: Number(chunk.match_rank || 0.95),
      doc_number: chunk.doc_number || null,
      match_type: 'exact',
      ...metadata,
    }
  })
}

function formatLegalSourcesForResponse(hits: LegalEvidenceHit[]) {
  return hits.map((hit) => ({
    doc_title: hit.law,
    doc_type: hit.source_type,
    doc_number: hit.doc_number || '',
    article_number: hit.article || '',
    article_title: hit.title || '',
    official_citation: hit.official_citation,
    binding_level: hit.binding_level,
    match_type: hit.match_type,
    citation_id: hit.citation_id || null,
    jurisdiction_code: hit.jurisdiction_code || null,
    corpus_scope: hit.corpus_scope || 'official',
  }))
}

function composeDeterministicLegalAnswer(params: {
  query: string
  hits: LegalEvidenceHit[]
  answerLanguage: NovaLanguage
}): { answer: string; confidence: number; sources: any[]; retrievalMode: string } {
  const { query, hits, answerLanguage } = params
  const topHits = hits.slice(0, 3).map((hit, index) => ({
    ...hit,
    citation_id: hit.citation_id || `CIT-${index + 1}`,
  }))
  const hasExact = topHits.some((hit) => hit.match_type === 'exact')
  const hasDense = topHits.some((hit) => hit.match_type === 'dense')
  const hasTenantPrivate = topHits.some((hit) => hit.corpus_scope === 'tenant_private')
  const confidence = hasExact ? 0.92 : 0.78
  const sources = formatLegalSourcesForResponse(topHits)

  if (!topHits.length) {
    if (answerLanguage === 'en') {
      return {
        answer: [
          '## Verified result',
          'I could not verify a source-backed regulation answer from the current legislation index.',
          'Please restate the question with a law number, article number, or an effective date.',
        ].join('\n'),
        confidence: 0.18,
        sources: [],
        retrievalMode: 'deterministic_abstain',
      }
    }

    return {
      answer: [
        '## Dogrulanmis sonuc',
        'Mevcut mevzuat indeksinde bu soruya kaynakla dogrulanmis bir cevap kesinlestiremedim.',
        'Lutfen kanun numarasi, madde numarasi veya yururluk tarihi ile soruyu daraltin.',
      ].join('\n'),
      confidence: 0.18,
      sources: [],
      retrievalMode: 'deterministic_abstain',
    }
  }

  const evidenceLines = topHits.map((hit) => {
    const snippet = summarizeLegalContentExtractively(hit.content)
    const citation = hit.article
      ? `${hit.law} - ${hit.article}`
      : hit.law
    return `- ${snippet} [${hit.citation_id}; ${citation}]`
  })

  if (answerLanguage === 'en') {
    return {
      answer: [
        '## Source-backed finding',
        ...evidenceLines,
        '',
        '## Nova interpretation',
        hasExact
          ? 'This answer was assembled directly from the matched law/article records in the legislation index.'
          : hasDense
            ? 'This answer was assembled from version-filtered legislation passages using hybrid retrieval and deterministic ranking.'
            : 'This answer was assembled from the closest indexed legislation passages; confirm the scope if your question depends on a specific date or exception.',
        hasTenantPrivate
          ? 'Tenant-private documents were also used. Treat those citations as organization-specific guidance, not as a replacement for official law.'
          : '',
        '',
        '## Recommended next step',
        'Use the cited article text as the primary authority. If you need a date-specific determination, repeat the query with an "as of" date.',
      ].join('\n'),
      confidence,
      sources,
      retrievalMode: hasExact ? 'deterministic_exact' : hasDense ? 'deterministic_hybrid' : 'deterministic_lexical',
    }
  }

  return {
    answer: [
      '## Kaynaga dayali bulgu',
      ...evidenceLines,
      '',
      '## Nova yorumu',
      hasExact
        ? 'Bu cevap, mevzuat indeksindeki eslesen kanun/madde kayitlarindan dogrudan derlendi.'
        : hasDense
          ? 'Bu cevap, yururluk tarihi filtreli hibrit retrieval ve deterministik siralama ile secilen mevzuat parcalarindan derlendi.'
          : 'Bu cevap, indeksteki en yakin mevzuat parcalarindan derlendi; tarih, istisna veya kapsam kritikse soruyu yururluk tarihiyle netlestirin.',
      hasTenantPrivate
        ? 'Bu cevapta tenant-private belgeler de kullanildi. Bu alintilari resmi mevzuatin yerine gecen dayanak olarak degil, kurumunuza ozel tamamlayici kaynak olarak degerlendirin.'
        : '',
      '',
      '## Onerilen sonraki adim',
      `Asil dayanak olarak alintilanan madde metnini kullanin. Gerekirse soruyu kanun numarasi veya yururluk tarihi ile yeniden sorun: "${query}".`,
    ].join('\n'),
    confidence,
    sources,
    retrievalMode: hasExact ? 'deterministic_exact' : hasDense ? 'deterministic_hybrid' : 'deterministic_lexical',
  }
}

async function polishDeterministicLegalAnswer(params: {
  anthropic: Anthropic
  draftAnswer: string
  citations: any[]
  evidence: LegalEvidenceHit[]
  language: NovaLanguage
}): Promise<{ mode: 'polished' | 'extractive_fallback'; answer: string }> {
  const citationIds = params.citations
    .map((citation: any) => citation.citation_id)
    .filter(Boolean)

  if (citationIds.length === 0) {
    return { mode: 'extractive_fallback', answer: params.draftAnswer }
  }

  const system = params.language === 'en'
    ? 'Rewrite only for readability. Do not add facts. Preserve every citation token exactly. Remove unsupported sentences.'
    : 'Sadece okunabilirlik icin yeniden yaz. Yeni olgu ekleme. Tum citation tokenlarini aynen koru. Desteksiz cumleyi sil.'

  const response = await requestClaude(
    params.anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      temperature: 0.1,
      system,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            draft_answer: params.draftAnswer,
            citations: params.citations,
            evidence: params.evidence.map((hit) => ({
              citation_id: hit.citation_id,
              law: hit.law,
              article: hit.article,
              content: hit.content,
            })),
          }),
        },
      ],
    },
    'solution_chat_legal_polish',
  )

  const textBlock = response?.content?.find((block: any) => block.type === 'text')
  const answer = typeof textBlock?.text === 'string' ? textBlock.text.trim() : ''
  if (!answer) {
    return { mode: 'extractive_fallback', answer: params.draftAnswer }
  }

  const usedCitationIds = Array.from(answer.matchAll(/\[([^\]]+)\]/g)).map((match) => {
    const groups = match as RegExpMatchArray
    return groups[1]
  })
  const invalidCitation = usedCitationIds.some((token) => token.includes('CIT-') && !citationIds.some((id: string) => token.includes(id)))

  return invalidCitation
    ? { mode: 'extractive_fallback', answer: params.draftAnswer }
    : { mode: 'polished', answer }
}

async function buildModelBackedLegalGuidanceAnswer(params: {
  anthropic: Anthropic
  query: string
  language: NovaLanguage
}): Promise<{ answer: string }> {
  const isEnglish = params.language === 'en'
  const system = isEnglish
    ? [
        'You are Nova, an occupational health and safety assistant.',
        'The legislation index did not return a reliable citation match for this question.',
        'Still answer the user with practical OHS guidance instead of refusing.',
        'Rules:',
        '- Do not stop with a refusal just because the current index had no citation match.',
        '- Do not invent law numbers, article numbers, dates, or fake quotations.',
        '- If a legal citation is uncertain, say that the official citation could not be verified from the current index, then continue with a useful answer.',
        '- For Turkish OHS staffing questions, explain the answer first through monthly service time per employee, then give an approximate full-time-equivalent interpretation if useful.',
        '- Keep the answer concise, practical, and directly helpful.',
      ].join('\n')
    : [
        'Sen Nova adli is sagligi ve guvenligi asistanisin.',
        'Bu soru icin mevzuat indeksinden guvenilir bir atif eslesmesi donmedi.',
        'Buna ragmen kullaniciya reddetmeden pratik ISG rehberligi ver.',
        'Kurallar:',
        '- Sirf mevcut indeks eslesmesi cikmadi diye cevap vermeyi kesme.',
        '- Kanun numarasi, madde numarasi, tarih veya dogrudan alinti uydurma.',
        '- Resmi atfi mevcut indeksle dogrulayamiyorsan bunu bir kez kisaca belirt, sonra kullanisli cevaba devam et.',
        '- Turk ISG gorevlendirme sorularinda cevabi once calisan basina aylik hizmet suresi mantigi ile acikla; faydaliysa bunu yaklasik tam zamanli uzman ihtiyacina cevir.',
        '- Cevabi kisa, pratik ve dogrudan yardimci olacak sekilde yaz.',
      ].join('\n')

  const response = await requestClaude(
    params.anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      temperature: 0.1,
      system,
      messages: [{ role: 'user', content: params.query }],
    },
    'solution_chat_legal_guidance_fallback',
  )

  const textBlock = response?.content?.find((block: any) => block.type === 'text')
  const answer = typeof textBlock?.text === 'string' ? textBlock.text.trim() : ''

  if (answer) {
    return { answer }
  }

  return {
    answer: isEnglish
      ? 'I could not verify an official citation from the current legislation index, but as a practical rule you should first calculate the monthly OHS service time required per employee and then convert that workload into the number of OHS professionals needed.'
      : 'Resmi atfi mevcut mevzuat indeksinden dogrulayamadim; ancak pratik olarak once calisan basina gerekli aylik ISG hizmet suresini hesaplayip, sonra bu is yukunu gereken profesyonel sayisina cevirmek gerekir.',
  }
}

async function buildDeterministicLegalAnswer(
  query: string,
  context: ToolContext,
  openai: OpenAI,
  anthropic: Anthropic,
): Promise<{ answer: string; confidence: number; sources: any[]; retrievalMode: string; trace: Record<string, unknown> }> {
  const exactHits = await exactLegalCitationLookup(query, context, 5)
  if (exactHits.length > 0) {
    const composed = composeDeterministicLegalAnswer({
      query,
      hits: exactHits,
      answerLanguage: context.session.answer_language,
    })
    return {
      ...composed,
      trace: {
        as_of_date: context.session.as_of_date,
        jurisdiction_code: context.session.jurisdiction_code,
        exact: exactHits,
        sparse: [],
        dense: [],
        reranked: exactHits,
      },
    }
  }

  const searchTerms = normalizeSearchTerms(query)
  const { data: lexicalRows, error: lexicalError } = await context.supabase.rpc('search_legal_chunks_v3', {
    search_terms: searchTerms,
    as_of_date: context.session.as_of_date,
    result_limit: 15,
    jurisdiction_code: context.session.jurisdiction_code,
    workspace_id: context.session.workspace_id ?? null,
  })
  if (lexicalError) {
    console.error('[buildDeterministicLegalAnswer] lexical retrieval failed:', lexicalError.message)
  }

  const lexicalHits: LegalEvidenceHit[] = (lexicalRows || []).map((hit: any) => {
    const metadata = applyEvidenceContext(
      inferLegislationMetadata(hit.doc_title || 'Mevzuat', hit.article_number),
      hit,
    )
    return {
      chunk_id: hit.chunk_id || null,
      document_id: hit.document_id || null,
      version_id: hit.version_id || null,
      law: hit.doc_title || 'Mevzuat',
      article: hit.article_number || null,
      title: hit.article_title || null,
      content: hit.content || '',
      relevance_score: Number(hit.rank || 0),
      doc_number: hit.doc_number || null,
      match_type: 'lexical',
      ...metadata,
    }
  })

  let denseHits: LegalEvidenceHit[] = []
  const queryEmbedding = await generateEmbedding(query, openai)
  if (queryEmbedding) {
    const { data: denseRows, error: denseError } = await context.supabase.rpc('search_legal_chunks_dense_v1', {
      query_embedding: queryEmbedding,
      as_of_date: context.session.as_of_date,
      match_threshold: 0.6,
      result_limit: 15,
      jurisdiction_code: context.session.jurisdiction_code,
      workspace_id: context.session.workspace_id ?? null,
    })

    if (denseError) {
      console.error('[buildDeterministicLegalAnswer] dense retrieval failed:', denseError.message)
    } else {
      denseHits = (denseRows || []).map((hit: any) => {
        const metadata = applyEvidenceContext(
          inferLegislationMetadata(hit.doc_title || 'Mevzuat', hit.article_number),
          hit,
        )
        return {
          chunk_id: hit.chunk_id || null,
          document_id: hit.document_id || null,
          version_id: hit.version_id || null,
          law: hit.doc_title || 'Mevzuat',
          article: hit.article_number || null,
          title: hit.article_title || null,
          content: hit.content || '',
          relevance_score: Number(hit.similarity || 0),
          doc_number: hit.doc_number || null,
          match_type: 'dense',
          ...metadata,
        }
      })
    }
  }

  const reranked = rerankLegalHits(query, reciprocalRankFusion([lexicalHits, denseHits])).slice(0, 8)
  if (reranked.length === 0) {
    const fallback = await buildModelBackedLegalGuidanceAnswer({
      anthropic,
      query,
      language: context.session.answer_language,
    })

    return {
      answer: fallback.answer,
      confidence: 0.56,
      sources: [],
      retrievalMode: 'model_guidance_fallback',
      trace: {
        as_of_date: context.session.as_of_date,
        jurisdiction_code: context.session.jurisdiction_code,
        exact: [],
        sparse: lexicalHits.slice(0, 15),
        dense: denseHits.slice(0, 15),
        reranked: [],
      },
    }
  }

  let composed = composeDeterministicLegalAnswer({
    query,
    hits: reranked,
    answerLanguage: context.session.answer_language,
  })

  if (context.session.answer_mode === 'polish' && reranked.length > 0) {
    const polished = await polishDeterministicLegalAnswer({
      anthropic,
      draftAnswer: composed.answer,
      citations: composed.sources,
      evidence: reranked,
      language: context.session.answer_language,
    })
    composed = {
      ...composed,
      answer: polished.answer,
      retrievalMode: polished.mode === 'polished' ? `${composed.retrievalMode}_polish` : composed.retrievalMode,
    }
  }

  return {
    ...composed,
    trace: {
      as_of_date: context.session.as_of_date,
      jurisdiction_code: context.session.jurisdiction_code,
      exact: [],
      sparse: lexicalHits.slice(0, 15),
      dense: denseHits.slice(0, 15),
      reranked,
    },
  }
}

async function executeSearchLegislation(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const searchTerms = normalizeSearchTerms(input.query || '')

    if (searchTerms.length === 0) {
      return { success: false, error: 'Arama terimi bulunamadi' }
    }

    const { data, error } = await context.supabase.rpc('search_legal_chunks_v3', {
      search_terms: searchTerms,
      as_of_date: context.session.as_of_date,
      result_limit: input.max_results || 5,
      jurisdiction_code: context.session.jurisdiction_code,
      workspace_id: context.session.workspace_id ?? null,
    })

    if (error) {
      console.error('search_legal_chunks_v3 error:', error.message)
      // Fallback: fulltext search
      const { data: ftData } = await context.supabase.rpc('search_legal_fulltext', {
        search_query: input.query,
        result_limit: input.max_results || 5
      })
      if (ftData && ftData.length > 0) {
        return {
          success: true,
          data: {
            count: ftData.length,
            results: ftData.map((chunk: any) => {
              const metadata = applyEvidenceContext(
                inferLegislationMetadata(chunk.doc_title || 'Mevzuat', chunk.article_number),
                chunk,
              )
              return {
                law: chunk.doc_title || 'Mevzuat',
                doc_number: chunk.doc_number || null,
                article: chunk.article_number,
                title: chunk.article_title,
                content: (chunk.content || '').substring(0, 500),
                relevance_score: chunk.rank || 0,
                corpus_scope: metadata.corpus_scope,
                jurisdiction_code: metadata.jurisdiction_code,
                official_citation: metadata.official_citation,
                binding_level: metadata.binding_level,
                source_type: metadata.source_type,
              }
            })
          }
        }
      }
      return { success: false, error: 'Mevzuat arama hatasi' }
    }

    return {
      success: true,
      data: {
        count: data?.length || 0,
        results: (data || []).map((chunk: any) => {
          const metadata = applyEvidenceContext(
            inferLegislationMetadata(chunk.doc_title || 'Mevzuat', chunk.article_number),
            chunk,
          )
          return {
            law: chunk.doc_title || 'Mevzuat',
            doc_number: chunk.doc_number || null,
            article: chunk.article_number,
            title: chunk.article_title,
            content: (chunk.content || '').substring(0, 500),
            relevance_score: chunk.rank || 0,
            corpus_scope: metadata.corpus_scope,
            jurisdiction_code: metadata.jurisdiction_code,
            official_citation: metadata.official_citation,
            binding_level: metadata.binding_level,
            source_type: metadata.source_type,
          }
        }),
        interpretation_guidance: context.session.language === 'en'
          ? 'Use these results by clearly separating source-backed statements, Nova interpretation, and operational next step.'
          : 'Bu sonuclari kullanirken kaynaga dayali bilgi, Nova yorumu ve operasyonel sonraki adimi acikca ayir.',
      }
    }
  } catch (err: any) {
    console.error('executeSearchLegislation error:', err)
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeGetPersonnelCount(input: any, context: ToolContext): Promise<ToolResult> {
  if (!context.subscription.allowed_tools.includes('get_personnel_count') &&
      !context.subscription.allowed_tools.includes('*')) {
    return {
      success: false,
      error: 'Bu özellik Starter plan ve üzeri için aktiftir',
      error_type: 'subscription_required'
    }
  }

  try {
    const { data, error } = await context.supabase.rpc('get_personnel_summary', {
      p_organization_id: context.user.organization_id,
      p_position_filter: input.position_filter || null,
      p_department_filter: input.department_filter || null,
      p_company_identity_id: input.company_workspace_id || null
    })

    if (error) {
      return { success: false, error: 'Personel sorgulama hatası' }
    }

    return { success: true, data: data }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeGetRecentAssessments(input: any, context: ToolContext): Promise<ToolResult> {
  if (!context.subscription.allowed_tools.includes('get_recent_assessments') &&
      !context.subscription.allowed_tools.includes('*')) {
    return {
      success: false,
      error: 'Bu özellik Starter plan ve üzeri için aktiftir',
      error_type: 'subscription_required'
    }
  }

  try {
    const limit = input.limit || 5
    const daysBack = input.days_back || 90
    const sinceDate = new Date(Date.now() - daysBack * 86400000).toISOString()

    let query = context.supabase
      .from('risk_assessments')
      .select(`
        id, title, method, assessment_date, status,
        overall_risk_level, highest_risk_level, item_count, ai_summary,
        risk_assessment_findings (
          id, title, category, severity, confidence, tracking_status, recommendation
        )
      `)
      .eq('organization_id', context.user.organization_id)
      .gte('assessment_date', sinceDate)
      .order('assessment_date', { ascending: false })
      .limit(limit)

    if (input.method_filter) {
      query = query.eq('method', input.method_filter)
    }

    const { data: assessments, error } = await query

    if (error) {
      return { success: false, error: 'Risk analizi sorgulama hatası' }
    }

    const processed = (assessments || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      method: a.method,
      date: a.assessment_date,
      status: a.status,
      overall_risk: a.overall_risk_level,
      highest_risk: a.highest_risk_level,
      total_items: a.item_count,
      ai_summary: a.ai_summary,
      findings_count: a.risk_assessment_findings?.length || 0,
      critical_findings: a.risk_assessment_findings?.filter(
        (f: any) => f.severity === 'critical' || f.severity === 'high'
      ).length || 0,
      findings: input.severity_filter
        ? a.risk_assessment_findings?.filter((f: any) => f.severity === input.severity_filter).slice(0, 10)
        : a.risk_assessment_findings?.slice(0, 10)
    }))

    return {
      success: true,
      data: { count: processed.length, assessments: processed }
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function getActiveWorkspaceId(
  context: ToolContext,
  preferredWorkspaceId?: string | null,
): Promise<string | null> {
  const requestedWorkspaceId = preferredWorkspaceId || context.session.company_workspace_id || null
  const hasOrganizationWideAccess = await hasOrganizationWideWorkspaceAccess(context)
  const accessibleWorkspaceIds = hasOrganizationWideAccess
    ? []
    : await getAccessibleWorkspaceIdsForUser(context)

  if (requestedWorkspaceId) {
    if (hasOrganizationWideAccess) {
      const inOrganization = await isWorkspaceInOrganization(context, requestedWorkspaceId)
      return inOrganization ? requestedWorkspaceId : null
    }

    return accessibleWorkspaceIds.includes(requestedWorkspaceId)
      ? requestedWorkspaceId
      : null
  }

  if (!hasOrganizationWideAccess) {
    return accessibleWorkspaceIds[0] || null
  }

  const { data: lastAssessment } = await context.supabase
    .from('risk_assessments')
    .select('company_workspace_id')
    .eq('organization_id', context.user.organization_id)
    .not('company_workspace_id', 'is', null)
    .order('assessment_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastAssessment?.company_workspace_id) return lastAssessment.company_workspace_id

  const { data: ws } = await context.supabase
    .from('company_workspaces')
    .select('id')
    .eq('organization_id', context.user.organization_id)
    .eq('is_archived', false)
    .limit(1)
    .maybeSingle()

  return ws?.id || null
}

function isCompatSchemaError(message?: string | null): boolean {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('relation') ||
    normalized.includes('schema cache') ||
    normalized.includes('does not exist')
  )
}

function flattenLegacyRoleCodes(
  rows: Array<{ roles?: { code?: string } | Array<{ code?: string }> | null }>,
): string[] {
  return rows.flatMap((row) => {
    if (Array.isArray(row.roles)) {
      return row.roles
        .map((role) => String(role?.code || '').trim().toLowerCase())
        .filter(Boolean)
    }

    const code = String(row.roles?.code || '').trim().toLowerCase()
    return code ? [code] : []
  })
}

async function isWorkspaceInOrganization(
  context: ToolContext,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await context.supabase
    .from('company_workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('organization_id', context.user.organization_id)
    .maybeSingle()

  if (error) return false
  return Boolean(data?.id)
}

async function hasOrganizationWideWorkspaceAccess(context: ToolContext): Promise<boolean> {
  const { data: membership, error: membershipError } = await context.supabase
    .from('organization_memberships')
    .select('role')
    .eq('organization_id', context.user.organization_id)
    .eq('user_id', context.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!membershipError) {
    return membership?.role === 'owner' || membership?.role === 'admin'
  }

  if (!isCompatSchemaError(membershipError.message)) {
    return false
  }

  const profileId = await getUserProfileId(context)
  if (!profileId) return false

  const { data: legacyRoles, error: legacyRolesError } = await context.supabase
    .from('user_roles')
    .select('roles(code)')
    .eq('user_profile_id', profileId)

  if (legacyRolesError) {
    return false
  }

  const roleCodes = flattenLegacyRoleCodes(
    (legacyRoles || []) as Array<{ roles?: { code?: string } | Array<{ code?: string }> | null }>,
  )

  return roleCodes.some((code) =>
    ['owner', 'admin', 'organization_admin', 'osgb_manager', 'super_admin', 'platform_admin'].includes(code),
  )
}

async function getAccessibleWorkspaceIdsForUser(context: ToolContext): Promise<string[]> {
  const { data: assignments, error: assignmentsError } = await context.supabase
    .from('workspace_assignments')
    .select('company_workspace_id')
    .eq('user_id', context.user.id)
    .eq('assignment_status', 'active')

  if (!assignmentsError) {
    return (assignments || [])
      .map((row: any) => row.company_workspace_id)
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
  }

  if (!isCompatSchemaError(assignmentsError.message)) {
    return []
  }

  const { data: memberships, error: membershipsError } = await context.supabase
    .from('company_memberships')
    .select('company_workspace_id')
    .eq('user_id', context.user.id)
    .eq('status', 'active')

  if (membershipsError) {
    return []
  }

  return (memberships || [])
    .map((row: any) => row.company_workspace_id)
    .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
}

async function getUserProfileId(context: ToolContext): Promise<string | null> {
  const { data: profile } = await context.supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', context.user.id)
    .maybeSingle()

  return profile?.id || null
}

async function buildUserPreferenceContext(context: ToolContext): Promise<string> {
  const [profileRes, preferenceRes] = await Promise.all([
    context.supabase
      .from('user_profiles')
      .select('full_name, title')
      .eq('auth_user_id', context.user.id)
      .maybeSingle(),
    context.supabase
      .from('user_preferences')
      .select('language, email_notifications, push_notifications')
      .eq('user_id', context.user.id)
      .maybeSingle(),
  ])

  const profile = profileRes.data
  const preferences = preferenceRes.data

  if (!profile && !preferences) return ''

  if (context.session.language === 'en') {
    return [
      '## USER PREFERENCE MEMORY',
      profile?.full_name ? `Operator: ${profile.full_name}` : null,
      profile?.title ? `Role title: ${profile.title}` : null,
      preferences?.language ? `Preferred interface language: ${preferences.language}` : null,
      preferences?.email_notifications != null
        ? `Email notifications: ${preferences.email_notifications ? 'enabled' : 'disabled'}`
        : null,
      preferences?.push_notifications != null
        ? `Push notifications: ${preferences.push_notifications ? 'enabled' : 'disabled'}`
        : null,
      'Keep the answer in the active language unless the user explicitly switches language.',
    ].filter(Boolean).join('\n')
  }

  return [
    '## KULLANICI TERCIH HAFIZASI',
    profile?.full_name ? `Operator: ${profile.full_name}` : null,
    profile?.title ? `Unvan: ${profile.title}` : null,
    preferences?.language ? `Tercih edilen arayuz dili: ${preferences.language}` : null,
    preferences?.email_notifications != null
      ? `E-posta bildirimleri: ${preferences.email_notifications ? 'acik' : 'kapali'}`
      : null,
    preferences?.push_notifications != null
      ? `Push bildirimleri: ${preferences.push_notifications ? 'acik' : 'kapali'}`
      : null,
    'Kullanici dili acikca degistirmedikce aktif dilde cevap ver.',
  ].filter(Boolean).join('\n')
}

async function buildStoredMemoryContext(context: ToolContext): Promise<string> {
  const workspaceId = await getActiveWorkspaceId(context)

  let query = context.supabase
    .from('nova_memories')
    .select('id, title, memory_text, memory_type, company_workspace_id, confidence_score, language')
    .eq('user_id', context.user.id)
    .eq('is_active', true)
    .order('confidence_score', { ascending: false })
    .order('last_used_at', { ascending: false })
    .limit(6)

  if (workspaceId) {
    query = query.or(`company_workspace_id.is.null,company_workspace_id.eq.${workspaceId}`)
  } else {
    query = query.is('company_workspace_id', null)
  }

  const { data } = await query
  if (!data || data.length === 0) return ''

  const memoryIds = data.map((item: any) => item.id).filter(Boolean)
  if (memoryIds.length > 0) {
    void context.supabase
      .from('nova_memories')
      .update({
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', memoryIds)
  }

  if (context.session.language === 'en') {
    return [
      '## STORED NOVA MEMORY',
      ...data.map((item: any) => `- [${item.memory_type}] ${item.title}: ${item.memory_text}`),
      'Treat these notes as user and company context. Never use them as a substitute for regulatory verification.',
    ].join('\n')
  }

  return [
    '## KAYITLI NOVA HAFIZASI',
    ...data.map((item: any) => `- [${item.memory_type}] ${item.title}: ${item.memory_text}`),
    'Bu notlari kullanici ve firma baglami olarak kullan. Mevzuat dogrulamasinin yerine gecirme.',
  ].join('\n')
}

async function upsertLongTermMemoryProfile(params: {
  profileScope: 'user' | 'company' | 'operation'
  profileKey: string
  title: string
  summaryText: string
  structuredProfile?: Record<string, unknown>
  companyWorkspaceId?: string | null
  confidenceScore?: number
  confirmObservation?: boolean
}, context: ToolContext): Promise<void> {
  try {
    let existingQuery = context.supabase
      .from('nova_memory_profiles')
      .select('id, observation_count')
      .eq('user_id', context.user.id)
      .eq('profile_scope', params.profileScope)
      .eq('profile_key', params.profileKey)

    if (params.companyWorkspaceId) {
      existingQuery = existingQuery.eq('company_workspace_id', params.companyWorkspaceId)
    } else {
      existingQuery = existingQuery.is('company_workspace_id', null)
    }

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing?.id) {
      await context.supabase
        .from('nova_memory_profiles')
        .update({
          title: params.title,
          summary_text: params.summaryText,
          structured_profile: params.structuredProfile || {},
          confidence_score: Math.max(0.4, Math.min(1, Number(params.confidenceScore ?? 0.8))),
          observation_count: Number(existing.observation_count ?? 0) + 1,
          last_observed_at: new Date().toISOString(),
          last_confirmed_at: params.confirmObservation ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await context.supabase
        .from('nova_memory_profiles')
        .insert({
          user_id: context.user.id,
          organization_id: context.user.organization_id,
          company_workspace_id: params.companyWorkspaceId ?? null,
          profile_scope: params.profileScope,
          profile_key: params.profileKey,
          title: params.title,
          summary_text: params.summaryText,
          structured_profile: params.structuredProfile || {},
          confidence_score: Math.max(0.4, Math.min(1, Number(params.confidenceScore ?? 0.8))),
          observation_count: 1,
          last_observed_at: new Date().toISOString(),
          last_confirmed_at: params.confirmObservation ? new Date().toISOString() : null,
        })
    }
  } catch (err) {
    console.error('[upsertLongTermMemoryProfile] failed:', err)
  }
}

async function recordLearningSignal(params: {
  signalSource: 'feedback' | 'workflow' | 'memory' | 'suggestion'
  signalKey: string
  signalLabel: string
  outcome: 'positive' | 'neutral' | 'negative'
  confidenceScore?: number
  queryId?: string | null
  workflowRunId?: string | null
  companyWorkspaceId?: string | null
  payload?: Record<string, unknown>
}, context: ToolContext): Promise<void> {
  try {
    await context.supabase
      .from('nova_learning_signals')
      .insert({
        user_id: context.user.id,
        organization_id: context.user.organization_id,
        company_workspace_id: params.companyWorkspaceId ?? null,
        query_id: params.queryId ?? null,
        workflow_run_id: params.workflowRunId ?? null,
        signal_source: params.signalSource,
        signal_key: params.signalKey,
        signal_label: params.signalLabel,
        outcome: params.outcome,
        confidence_score: Math.max(0.35, Math.min(1, Number(params.confidenceScore ?? 0.75))),
        payload: params.payload || {},
      })
  } catch (err) {
    console.error('[recordLearningSignal] failed:', err)
  }
}

async function buildLongTermProfileContext(context: ToolContext): Promise<string> {
  try {
    const workspaceId = await getActiveWorkspaceId(context)

    let query = context.supabase
      .from('nova_memory_profiles')
      .select('title, summary_text, profile_scope, profile_key, observation_count, confidence_score')
      .eq('user_id', context.user.id)
      .order('observation_count', { ascending: false })
      .order('confidence_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(5)

    if (workspaceId) {
      query = query.or(`company_workspace_id.is.null,company_workspace_id.eq.${workspaceId}`)
    } else {
      query = query.is('company_workspace_id', null)
    }

    const { data } = await query
    if (!data?.length) return ''

    if (context.session.language === 'en') {
      return [
        '## LONG-TERM NOVA MEMORY',
        ...data.map((item: any) => `- [${item.profile_scope}/${item.profile_key}] ${item.title}: ${item.summary_text}`),
        'Use these profiles as durable user and company operating patterns. Do not use them as legal authority.',
      ].join('\n')
    }

    return [
      '## UZUN DONEM NOVA HAFIZASI',
      ...data.map((item: any) => `- [${item.profile_scope}/${item.profile_key}] ${item.title}: ${item.summary_text}`),
      'Bu profilleri kalici kullanici ve firma operasyon kaliplari olarak kullan. Mevzuat kaynagi yerine koyma.',
    ].join('\n')
  } catch (_err) {
    return ''
  }
}

async function buildLearningSignalContext(context: ToolContext): Promise<string> {
  try {
    const workspaceId = await getActiveWorkspaceId(context)

    let query = context.supabase
      .from('nova_learning_signals')
      .select('signal_label, outcome, signal_key, created_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(6)

    if (workspaceId) {
      query = query.or(`company_workspace_id.is.null,company_workspace_id.eq.${workspaceId}`)
    } else {
      query = query.is('company_workspace_id', null)
    }

    const { data } = await query
    if (!data?.length) return ''

    const positiveSignals = data.filter((item: any) => item.outcome === 'positive').slice(0, 3)
    const negativeSignals = data.filter((item: any) => item.outcome === 'negative').slice(0, 2)
    if (!positiveSignals.length && !negativeSignals.length) return ''

    if (context.session.language === 'en') {
      return [
        '## LEARNING LOOP SIGNALS',
        ...positiveSignals.map((item: any) => `- Confirmed pattern: ${item.signal_label}`),
        ...negativeSignals.map((item: any) => `- Avoid repeating exactly: ${item.signal_label}`),
        'Use these signals to improve follow-up quality and next-step recommendations. Do not treat them as regulatory sources.',
      ].join('\n')
    }

    return [
      '## OGRENME DONGUSU SINYALLERI',
      ...positiveSignals.map((item: any) => `- Dogrulanan kalip: ${item.signal_label}`),
      ...negativeSignals.map((item: any) => `- Ayni sekilde tekrar etme: ${item.signal_label}`),
      'Bu sinyalleri sonraki adim kalitesini artirmak ve daha iyi operasyon yonlendirmesi yapmak icin kullan. Mevzuat kaynagi yerine koyma.',
    ].join('\n')
  } catch (_err) {
    return ''
  }
}

async function synthesizeStrategicMemorySnapshot(params: {
  snapshotScope: 'user' | 'company'
  snapshotKey: string
  companyWorkspaceId?: string | null
}, context: ToolContext): Promise<{
  snapshot_scope: 'user' | 'company'
  snapshot_key: string
  company_workspace_id: string | null
  title: string
  summary_text: string
  structured_snapshot: Record<string, unknown>
  confidence_score: number
  source_profile_count: number
  source_signal_count: number
} | null> {
  try {
    let profilesQuery = context.supabase
      .from('nova_memory_profiles')
      .select('profile_scope, profile_key, title, summary_text, observation_count, confidence_score, updated_at')
      .eq('user_id', context.user.id)
      .order('confidence_score', { ascending: false })
      .order('observation_count', { ascending: false })
      .limit(6)

    let signalsQuery = context.supabase
      .from('nova_learning_signals')
      .select('signal_label, outcome, signal_key, confidence_score, created_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(8)

    let workflowsQuery = context.supabase
      .from('nova_workflow_runs')
      .select('workflow_type, title, status, current_step, total_steps, updated_at')
      .eq('user_id', context.user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(3)

    if (params.snapshotScope === 'company' && params.companyWorkspaceId) {
      profilesQuery = profilesQuery.or(`company_workspace_id.is.null,company_workspace_id.eq.${params.companyWorkspaceId}`)
      signalsQuery = signalsQuery.or(`company_workspace_id.is.null,company_workspace_id.eq.${params.companyWorkspaceId}`)
      workflowsQuery = workflowsQuery.or(`company_workspace_id.is.null,company_workspace_id.eq.${params.companyWorkspaceId}`)
    } else {
      profilesQuery = profilesQuery.is('company_workspace_id', null)
      signalsQuery = signalsQuery.is('company_workspace_id', null)
    }

    const [profilesRes, signalsRes, workflowsRes] = await Promise.all([
      profilesQuery,
      signalsQuery,
      workflowsQuery,
    ])

    const profiles = profilesRes.data || []
    const signals = signalsRes.data || []
    const workflows = workflowsRes.data || []

    if (!profiles.length && !signals.length && !workflows.length) return null

    const topProfiles = profiles.slice(0, 3)
    const positiveSignals = signals.filter((item: any) => item.outcome === 'positive').slice(0, 3)
    const negativeSignals = signals.filter((item: any) => item.outcome === 'negative').slice(0, 2)
    const workflowTitles = workflows.map((item: any) => item.title).slice(0, 2)

    const title = params.snapshotScope === 'company'
      ? (context.session.language === 'en' ? 'Company operating profile' : 'Firma operasyon profili')
      : (context.session.language === 'en' ? 'User working profile' : 'Kullanici calisma profili')

    const summaryLines = context.session.language === 'en'
      ? [
          topProfiles.length ? `Top patterns: ${topProfiles.map((item: any) => item.title).join('; ')}` : null,
          positiveSignals.length ? `Confirmed habits: ${positiveSignals.map((item: any) => item.signal_label).join('; ')}` : null,
          negativeSignals.length ? `Avoid repeating: ${negativeSignals.map((item: any) => item.signal_label).join('; ')}` : null,
          workflowTitles.length ? `Active focus chains: ${workflowTitles.join('; ')}` : null,
        ].filter(Boolean)
      : [
          topProfiles.length ? `Temel kaliplar: ${topProfiles.map((item: any) => item.title).join('; ')}` : null,
          positiveSignals.length ? `Dogrulanan aliskanliklar: ${positiveSignals.map((item: any) => item.signal_label).join('; ')}` : null,
          negativeSignals.length ? `Tekrar edilmemesi gerekenler: ${negativeSignals.map((item: any) => item.signal_label).join('; ')}` : null,
          workflowTitles.length ? `Aktif odak akislari: ${workflowTitles.join('; ')}` : null,
        ].filter(Boolean)

    const confidenceCandidates = [
      ...topProfiles.map((item: any) => Number(item.confidence_score ?? 0.75)),
      ...positiveSignals.map((item: any) => Number(item.confidence_score ?? 0.75)),
    ]
    const confidenceScore = confidenceCandidates.length
      ? Math.max(0.55, Math.min(0.98, confidenceCandidates.reduce((sum, value) => sum + value, 0) / confidenceCandidates.length))
      : 0.7

    return {
      snapshot_scope: params.snapshotScope,
      snapshot_key: params.snapshotKey,
      company_workspace_id: params.companyWorkspaceId ?? null,
      title,
      summary_text: summaryLines.join(' | '),
      structured_snapshot: {
        top_profiles: topProfiles.map((item: any) => ({
          key: item.profile_key,
          title: item.title,
          summary: item.summary_text,
        })),
        positive_signals: positiveSignals.map((item: any) => item.signal_label),
        negative_signals: negativeSignals.map((item: any) => item.signal_label),
        active_workflows: workflowTitles,
      },
      confidence_score: confidenceScore,
      source_profile_count: profiles.length,
      source_signal_count: signals.length,
    }
  } catch (err) {
    console.error('[synthesizeStrategicMemorySnapshot] failed:', err)
    return null
  }
}

async function ensureStrategicMemorySnapshots(context: ToolContext): Promise<any[]> {
  try {
    const workspaceId = await getActiveWorkspaceId(context)
    const desiredSnapshots = [
      { snapshotScope: 'user' as const, snapshotKey: 'primary-user', companyWorkspaceId: null },
      ...(workspaceId ? [{ snapshotScope: 'company' as const, snapshotKey: `company:${workspaceId}`, companyWorkspaceId: workspaceId }] : []),
    ]

    const snapshotKeys = desiredSnapshots.map((item) => item.snapshotKey)
    let snapshotQuery = context.supabase
      .from('nova_memory_snapshots')
      .select('id, snapshot_scope, snapshot_key, title, summary_text, structured_snapshot, confidence_score, source_profile_count, source_signal_count, updated_at')
      .eq('user_id', context.user.id)
      .in('snapshot_key', snapshotKeys)

    if (workspaceId) {
      snapshotQuery = snapshotQuery.or(`company_workspace_id.is.null,company_workspace_id.eq.${workspaceId}`)
    } else {
      snapshotQuery = snapshotQuery.is('company_workspace_id', null)
    }

    const { data: existingSnapshots } = await snapshotQuery
    const existingMap = new Map<string, any>((existingSnapshots || []).map((item: any) => [item.snapshot_key, item]))
    let refreshNeeded = false

    for (const desired of desiredSnapshots) {
      const existing = existingMap.get(desired.snapshotKey)
      const isStale = existing?.updated_at
        ? (Date.now() - new Date(existing.updated_at).getTime()) > NOVA_STRATEGIC_MEMORY_STALE_MS
        : true

      if (existing && !isStale) continue

      const synthesized = await synthesizeStrategicMemorySnapshot(desired, context)
      if (!synthesized) continue

      refreshNeeded = true
      await context.supabase
        .from('nova_memory_snapshots')
        .upsert({
          user_id: context.user.id,
          organization_id: context.user.organization_id,
          company_workspace_id: desired.companyWorkspaceId ?? null,
          language: context.session.answer_language,
          snapshot_scope: synthesized.snapshot_scope,
          snapshot_key: synthesized.snapshot_key,
          title: synthesized.title,
          summary_text: synthesized.summary_text,
          structured_snapshot: synthesized.structured_snapshot,
          confidence_score: synthesized.confidence_score,
          source_profile_count: synthesized.source_profile_count,
          source_signal_count: synthesized.source_signal_count,
          last_compacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,snapshot_scope,snapshot_key',
        })
    }

    if (!refreshNeeded) {
      return existingSnapshots || []
    }

    const { data: refreshedSnapshots } = await context.supabase
      .from('nova_memory_snapshots')
      .select('id, snapshot_scope, snapshot_key, title, summary_text, structured_snapshot, confidence_score, source_profile_count, source_signal_count, updated_at')
      .eq('user_id', context.user.id)
      .in('snapshot_key', snapshotKeys)

    return refreshedSnapshots || existingSnapshots || []
  } catch (err) {
    console.error('[ensureStrategicMemorySnapshots] failed:', err)
    return []
  }
}

async function buildStrategicMemorySnapshotContext(context: ToolContext): Promise<string> {
  try {
    const snapshots = await ensureStrategicMemorySnapshots(context)
    if (!snapshots.length) return ''

    if (context.session.language === 'en') {
      return [
        '## STRATEGIC NOVA MEMORY SNAPSHOTS',
        ...snapshots.map((item: any) => `- [${item.snapshot_scope}] ${item.title}: ${item.summary_text}`),
        'Use these compressed snapshots as stable long-term user and company memory. Do not treat them as regulatory evidence.',
      ].join('\n')
    }

    return [
      '## STRATEJIK NOVA HAFIZA SNAPSHOTLARI',
      ...snapshots.map((item: any) => `- [${item.snapshot_scope}] ${item.title}: ${item.summary_text}`),
      'Bu snapshotlari istikrarli uzun donem kullanici ve firma hafizasi olarak kullan. Mevzuat kaniti yerine koyma.',
    ].join('\n')
  } catch (_err) {
    return ''
  }
}

async function buildWorkflowOrchestrationContext(context: ToolContext): Promise<string> {
  try {
    const proactive = await executeGetProactiveOperations({ max_results: 5 }, context)
    if (!proactive.success || !proactive.data) return ''

    const actions = Array.isArray(proactive.data.follow_up_actions) ? proactive.data.follow_up_actions.slice(0, 4) : []
    const workflows = Array.isArray(proactive.data.workflows) ? proactive.data.workflows.slice(0, 3) : []
    const insights = Array.isArray(proactive.data.insights) ? proactive.data.insights.slice(0, 3) : []

    if (!actions.length && !workflows.length && !insights.length) return ''

    if (context.session.language === 'en') {
      return [
        '## WORKFLOW ORCHESTRATION LAYER',
        ...workflows.map((item: any) => `- Active chain: ${item.title}`),
        ...actions.map((item: any, index: number) => `- Priority ${index + 1}: ${item.label}${item.description ? ` (${item.description})` : ''}`),
        ...insights.map((item: any) => `- Learning cue: ${item}`),
        'Use this layer to proactively sequence the next operational steps instead of only answering the last question.',
      ].join('\n')
    }

    return [
      '## WORKFLOW ORKESTRASYON KATMANI',
      ...workflows.map((item: any) => `- Aktif zincir: ${item.title}`),
      ...actions.map((item: any, index: number) => `- Oncelik ${index + 1}: ${item.label}${item.description ? ` (${item.description})` : ''}`),
      ...insights.map((item: any) => `- Ogrenme ipucu: ${item}`),
      'Bu katmani kullanarak yalnizca son soruya cevap verme; sonraki operasyon adimlarini da proaktif sekilde sirala.',
    ].join('\n')
  } catch (_err) {
    return ''
  }
}

async function getWorkflowLearningProfile(
  workflowType: string,
  companyWorkspaceId: string | null,
  context: ToolContext,
): Promise<{ shouldDeepenChain: boolean; positiveCount: number; negativeCount: number; hintLine: string | null }> {
  try {
    let query = context.supabase
      .from('nova_learning_signals')
      .select('outcome, signal_label, signal_key')
      .eq('user_id', context.user.id)
      .eq('signal_source', 'workflow')
      .ilike('signal_key', `%${workflowType}%`)
      .order('created_at', { ascending: false })
      .limit(12)

    if (companyWorkspaceId) {
      query = query.or(`company_workspace_id.is.null,company_workspace_id.eq.${companyWorkspaceId}`)
    } else {
      query = query.is('company_workspace_id', null)
    }

    const { data } = await query
    const positiveCount = (data || []).filter((item: any) => item.outcome === 'positive').length
    const negativeCount = (data || []).filter((item: any) => item.outcome === 'negative').length
    const shouldDeepenChain = positiveCount >= 2 || (positiveCount >= 1 && negativeCount === 0)

    return {
      shouldDeepenChain,
      positiveCount,
      negativeCount,
      hintLine: shouldDeepenChain
        ? (context.session.language === 'en'
          ? `Nova has seen this ${workflowType} flow complete successfully before and can suggest a deeper follow-up chain.`
          : `Nova bu ${workflowType} akisinin daha once basariyla tamamlandigini gordu; daha derin bir takip zinciri onerilebilir.`)
        : null,
    }
  } catch (_err) {
    return { shouldDeepenChain: false, positiveCount: 0, negativeCount: 0, hintLine: null }
  }
}

type NovaWorkflowStepDefinition = {
  stepKey: string
  title: string
  description?: string | null
  actionKind?: 'system' | 'navigate' | 'prompt' | 'review'
  targetUrl?: string | null
  promptText?: string | null
  initialStatus?: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled'
  metadata?: Record<string, unknown>
}

async function createNovaWorkflow(params: {
  workflowType: string
  title: string
  summary?: string | null
  companyWorkspaceId?: string | null
  queryId?: string | null
  navigation?: any | null
  metadata?: Record<string, unknown>
  steps: NovaWorkflowStepDefinition[]
}, context: ToolContext): Promise<{ workflow: Record<string, unknown>; followUpActions: Array<Record<string, unknown>> } | null> {
  try {
    const activeSteps = params.steps.filter((step) => !['completed', 'skipped', 'cancelled'].includes(step.initialStatus || 'pending'))
    const currentStep = activeSteps[0]?.stepKey
      ? (params.steps.findIndex((step) => step.stepKey === activeSteps[0].stepKey) + 1)
      : params.steps.length
    const workflowStatus = activeSteps.length === 0 ? 'completed' : 'active'

    const { data: workflowRun, error: workflowError } = await context.supabase
      .from('nova_workflow_runs')
      .insert({
        user_id: context.user.id,
        organization_id: context.user.organization_id,
        company_workspace_id: params.companyWorkspaceId ?? null,
        query_id: params.queryId ?? null,
        session_id: context.session.id,
        workflow_type: params.workflowType,
        title: params.title,
        summary: params.summary ?? null,
        status: workflowStatus,
        language: context.session.answer_language,
        current_step: Math.max(1, currentStep),
        total_steps: params.steps.length,
        navigation_url: params.navigation?.url ?? null,
        navigation_label: params.navigation?.label ?? null,
        metadata: params.metadata || {},
        completed_at: workflowStatus === 'completed' ? new Date().toISOString() : null,
      })
      .select('id, title, summary, status, current_step, total_steps')
      .single()

    if (workflowError || !workflowRun?.id) {
      console.error('[createNovaWorkflow] workflow insert failed:', workflowError)
      return null
    }

    const stepRows = params.steps.map((step, index) => ({
      workflow_run_id: workflowRun.id,
      step_order: index + 1,
      step_key: step.stepKey,
      title: step.title,
      description: step.description ?? null,
      action_kind: step.actionKind ?? 'review',
      target_url: step.targetUrl ?? null,
      prompt_text: step.promptText ?? null,
      status: step.initialStatus ?? 'pending',
      metadata: step.metadata || {},
      completed_at: ['completed', 'skipped', 'cancelled'].includes(step.initialStatus || '')
        ? new Date().toISOString()
        : null,
    }))

    const { data: insertedSteps, error: stepsError } = await context.supabase
      .from('nova_workflow_steps')
      .insert(stepRows)
      .select('id, step_order, title, description, action_kind, target_url, prompt_text, status')
      .order('step_order', { ascending: true })

    if (stepsError) {
      console.error('[createNovaWorkflow] workflow steps insert failed:', stepsError)
    }

    const followUpActions = (insertedSteps || [])
      .filter((step: any) => step.status === 'pending' || step.status === 'in_progress')
      .slice(0, 3)
      .map((step: any) => ({
        id: `${workflowRun.id}:${step.id}`,
        label: step.title,
        description: step.description || null,
        kind: step.action_kind === 'navigate' ? 'navigate' : 'prompt',
        url: step.target_url || null,
        prompt: step.prompt_text || null,
        workflow_run_id: workflowRun.id,
        workflow_step_id: step.id,
        status: step.status,
      }))

    return {
      workflow: {
        id: workflowRun.id,
        title: workflowRun.title,
        summary: workflowRun.summary,
        status: workflowRun.status,
        current_step: workflowRun.current_step,
        total_steps: workflowRun.total_steps,
        next_step_label: followUpActions[0]?.label ?? null,
      },
      followUpActions,
    }
  } catch (err) {
    console.error('[createNovaWorkflow] unexpected error:', err)
    return null
  }
}

async function attachWorkflowsToQuery(sessionId: string, userId: string, queryId: string | null, supabase: SupabaseClient): Promise<void> {
  if (!queryId) return

  try {
    const sinceIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await supabase
      .from('nova_workflow_runs')
      .update({
        query_id: queryId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .is('query_id', null)
      .gte('created_at', sinceIso)
  } catch (err) {
    console.error('[attachWorkflowsToQuery] failed:', err)
  }
}

async function buildActiveWorkflowContext(context: ToolContext): Promise<string> {
  try {
    const { data: runs } = await context.supabase
      .from('nova_workflow_runs')
      .select('id, title, summary, current_step, total_steps, status')
      .eq('user_id', context.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3)

    if (!runs?.length) return ''

    const runIds = runs.map((item: any) => item.id)
    const { data: steps } = await context.supabase
      .from('nova_workflow_steps')
      .select('id, workflow_run_id, step_order, title, description, action_kind, target_url, prompt_text, status')
      .in('workflow_run_id', runIds)
      .order('step_order', { ascending: true })

    const stepMap = new Map<string, any[]>()
    for (const step of steps || []) {
      stepMap.set(step.workflow_run_id, [...(stepMap.get(step.workflow_run_id) || []), step])
    }

    const lines = runs.map((run: any) => {
      const nextStep = (stepMap.get(run.id) || []).find((step: any) => step.status === 'pending' || step.status === 'in_progress')
      if (context.session.language === 'en') {
        return `- ${run.title} (${run.current_step}/${run.total_steps})${nextStep?.title ? ` -> Next: ${nextStep.title}` : ''}`
      }
      return `- ${run.title} (${run.current_step}/${run.total_steps})${nextStep?.title ? ` -> Siradaki: ${nextStep.title}` : ''}`
    })

    if (context.session.language === 'en') {
      return ['## ACTIVE NOVA WORKFLOWS', ...lines, 'Use these workflows to guide the user across screens and follow-up steps.'].join('\n')
    }

    return ['## AKTIF NOVA AKISLARI', ...lines, 'Bu akislar kullaniciyi ekranlar arasinda yonlendirmek ve sonraki adimlari takip etmek icin kullanilabilir.'].join('\n')
  } catch (_err) {
    return ''
  }
}

async function buildLearnedAnswerContext(queryText: string, context: ToolContext): Promise<string> {
  try {
    if (!queryText || queryText.trim().length < 8) return ''

    const { data, error } = await context.supabase.rpc('search_qa_cache', {
      query_text: queryText,
      similarity_threshold: 0.08,
      max_results: 2,
    })

    if (error || !Array.isArray(data) || data.length === 0) {
      return ''
    }

    const filtered = data.filter((item: any) => Number(item.similarity ?? 0) >= 0.08)
    if (filtered.length === 0) return ''

    if (context.session.language === 'en') {
      return [
        '## LEARNED ANSWER PATTERNS',
        ...filtered.map((item: any) => `- Similar Q: ${item.question}\n  Prior answer: ${String(item.answer || '').slice(0, 320)}\n  Reuse count: ${item.usage_count ?? 0}`),
        'Use these as retrieval hints, not as authoritative regulatory sources.',
      ].join('\n')
    }

    return [
      '## OGRENILMIS CEVAP KALIPLARI',
      ...filtered.map((item: any) => `- Benzer soru: ${item.question}\n  Onceki cevap: ${String(item.answer || '').slice(0, 320)}\n  Tekrar kullanimi: ${item.usage_count ?? 0}`),
      'Bunlari retrieval ipucu olarak kullan, baglayici mevzuat kaynagi yerine koyma.',
    ].join('\n')
  } catch (_err) {
    return ''
  }
}

async function buildActiveWorkspaceContext(context: ToolContext): Promise<string> {
  const workspaceId = await getActiveWorkspaceId(context)
  if (!workspaceId) return ''

  const today = new Date().toISOString().slice(0, 10)
  const last90Days = new Date(Date.now() - 90 * 86400000).toISOString()

  const [workspaceRes, tasksRes, incidentsRes, nextTrainingRes] = await Promise.all([
    context.supabase
      .from('company_workspaces')
      .select('id, display_name, company_identities(official_name, sector, nace_code, hazard_class, city)')
      .eq('id', workspaceId)
      .eq('organization_id', context.user.organization_id)
      .maybeSingle(),
    context.supabase
      .from('isg_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.user.organization_id)
      .eq('company_workspace_id', workspaceId)
      .in('status', ['planned', 'in_progress']),
    context.supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.user.organization_id)
      .eq('company_workspace_id', workspaceId)
      .gte('created_at', last90Days),
    context.supabase
      .from('company_trainings')
      .select('title, training_date')
      .eq('organization_id', context.user.organization_id)
      .eq('company_workspace_id', workspaceId)
      .gte('training_date', today)
      .order('training_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const workspace = workspaceRes.data
  if (!workspace?.id) return ''

  const identity = Array.isArray(workspace.company_identities)
    ? workspace.company_identities[0]
    : workspace.company_identities

  const companyName = workspace.display_name || identity?.official_name || 'Aktif firma'
  const openTaskCount = tasksRes.count ?? 0
  const recentIncidentCount = incidentsRes.count ?? 0
  const nextTraining = nextTrainingRes.data

  if (context.session.language === 'en') {
    return [
      '## ACTIVE COMPANY MEMORY',
      `Default company: ${companyName}`,
      identity?.sector ? `Sector: ${identity.sector}` : null,
      identity?.hazard_class ? `Hazard class: ${identity.hazard_class}` : null,
      identity?.nace_code ? `NACE: ${identity.nace_code}` : null,
      identity?.city ? `City: ${identity.city}` : null,
      `Open operational tasks: ${openTaskCount}`,
      `Incidents in the last 90 days: ${recentIncidentCount}`,
      nextTraining?.training_date
        ? `Next planned training: ${nextTraining.title || 'Training'} on ${nextTraining.training_date}`
        : null,
      'Use this company as the default action context unless the user clearly switches company.',
    ].filter(Boolean).join('\n')
  }

  return [
    '## AKTIF FIRMA HAFIZASI',
    `Varsayilan firma: ${companyName}`,
    identity?.sector ? `Sektor: ${identity.sector}` : null,
    identity?.hazard_class ? `Tehlike sinifi: ${identity.hazard_class}` : null,
    identity?.nace_code ? `NACE: ${identity.nace_code}` : null,
    identity?.city ? `Sehir: ${identity.city}` : null,
    `Acik operasyon gorevi: ${openTaskCount}`,
    `Son 90 gundeki olay sayisi: ${recentIncidentCount}`,
    nextTraining?.training_date
      ? `Siradaki planli egitim: ${nextTraining.title || 'Egitim'} - ${nextTraining.training_date}`
      : null,
    'Aksiyon toollarinda kullanici acikca farkli bir firma istemedikce bu firmayi varsayilan baglam olarak kullan.',
  ].filter(Boolean).join('\n')
}

function buildNovaDocumentContent(title: string, summary: string, language: string) {
  const intro = language === 'en'
    ? 'This draft was created by Nova as a starting point for operational work.'
    : 'Bu taslak Nova tarafindan operasyon akisini hizlandirmak icin olusturuldu.'
  const scope = summary
    ? (language === 'en' ? `Scope: ${summary}` : `Kapsam: ${summary}`)
    : (language === 'en'
      ? 'The scope and details of this draft are waiting for review.'
      : 'Bu taslagin kapsam ve detaylari gozden gecirilmeyi bekliyor.')

  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: title }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: intro }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: scope }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: language === 'en' ? 'Objectives and legal basis' : 'Amac ve yasal dayanak' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: language === 'en' ? 'Operational steps and responsibilities' : 'Operasyon adimlari ve sorumluluklar' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: language === 'en' ? 'Review and approval notes' : 'Gozden gecirme ve onay notlari' }] }],
          },
        ],
      },
    ],
  }
}

async function executeSearchPastAnswers(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const queryText = String(input.query || '').trim()
    if (!queryText) {
      return { success: false, error: 'Arama sorgusu gerekli' }
    }

    const maxResults = Math.max(1, Math.min(8, Number(input.max_results ?? 5)))
    const likeQuery = `%${queryText}%`

    const [userHistoryRes, globalLearningRes] = await Promise.all([
      context.supabase
        .from('solution_queries')
        .select('id, query_text, ai_response, created_at, is_saved, response_tokens')
        .eq('user_id', context.user.id)
        .or(`query_text.ilike.${likeQuery},ai_response.ilike.${likeQuery}`)
        .order('created_at', { ascending: false })
        .limit(maxResults),
      input.scope === 'global'
        ? context.supabase
            .from('ai_qa_learning')
            .select('id, question, answer, answer_sources, usage_count, user_feedback_score, success_rate')
            .or(`question.ilike.${likeQuery},answer.ilike.${likeQuery}`)
            .order('success_rate', { ascending: false })
            .order('usage_count', { ascending: false })
            .limit(maxResults)
        : Promise.resolve({ data: [], error: null } as any),
    ])

    const userMatches = (userHistoryRes.data || []).map((item: any) => ({
      source: 'user_history',
      id: item.id,
      question: item.query_text,
      answer: item.ai_response,
      created_at: item.created_at,
      saved: item.is_saved,
      response_tokens: item.response_tokens,
    }))

    const learningMatches = (globalLearningRes.data || []).map((item: any) => ({
      source: 'learning_pool',
      id: item.id,
      question: item.question,
      answer: item.answer,
      answer_sources: item.answer_sources,
      usage_count: item.usage_count,
      feedback_score: item.user_feedback_score,
      success_rate: item.success_rate,
    }))

    return {
      success: true,
      data: {
        query: queryText,
        user_matches: userMatches,
        learning_matches: learningMatches,
        summary: context.session.language === 'en'
          ? `Found ${userMatches.length} personal history matches and ${learningMatches.length} learned answer matches.`
          : `${userMatches.length} kisisel gecmis ve ${learningMatches.length} ogrenme havuzu sonucu bulundu.`,
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeSaveMemoryNote(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const title = String(input.title || '').trim()
    const memoryText = String(input.memory_text || '').trim()
    if (!title || !memoryText) {
      return { success: false, error: 'Hafiza basligi ve icerigi gerekli' }
    }

    const memoryType = ['user_preference', 'company_pattern', 'working_style', 'operational_note'].includes(input.memory_type)
      ? input.memory_type
      : 'operational_note'
    const workspaceId = await getActiveWorkspaceId(context, input.company_workspace_id || null)
    const confidenceScore = Math.max(0.3, Math.min(1, Number(input.confidence_score ?? 0.8)))

    const { data: existing } = await context.supabase
      .from('nova_memories')
      .select('id')
      .eq('user_id', context.user.id)
      .eq('memory_type', memoryType)
      .eq('title', title)
      .maybeSingle()

    let resultRow: { id: string } | null = null

    if (existing?.id) {
      const { data, error } = await context.supabase
        .from('nova_memories')
        .update({
          memory_text: memoryText,
          confidence_score: confidenceScore,
          company_workspace_id: workspaceId,
          language: context.session.answer_language,
          is_active: true,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id')
        .single()

      if (error || !data?.id) {
        return { success: false, error: 'Hafiza notu guncellenemedi.' }
      }
      resultRow = data
    } else {
      const { data, error } = await context.supabase
        .from('nova_memories')
        .insert({
          user_id: context.user.id,
          organization_id: context.user.organization_id,
          company_workspace_id: workspaceId,
          memory_type: memoryType,
          title,
          memory_text: memoryText,
          language: context.session.answer_language,
          confidence_score: confidenceScore,
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        return { success: false, error: 'Hafiza notu kaydedilemedi.' }
      }
      resultRow = data
    }

    await upsertLongTermMemoryProfile({
      profileScope: memoryType === 'company_pattern' ? 'company' : 'user',
      profileKey: memoryType,
      title,
      summaryText: memoryText,
      structuredProfile: {
        memory_type: memoryType,
        source: 'save_memory_note',
      },
      companyWorkspaceId: workspaceId,
      confidenceScore,
      confirmObservation: true,
    }, context)

    await recordLearningSignal({
      signalSource: 'memory',
      signalKey: `memory:${memoryType}`,
      signalLabel: title,
      outcome: 'positive',
      confidenceScore,
      companyWorkspaceId: workspaceId,
      payload: {
        memory_type: memoryType,
        title,
      },
    }, context)

    return {
      success: true,
      data: {
        memory_id: resultRow?.id ?? null,
        title,
        memory_type: memoryType,
        summary: context.session.language === 'en'
          ? `Nova saved the memory note: ${title}`
          : `Nova hafizaya su notu kaydetti: ${title}`,
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeGetProactiveOperations(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const maxResults = Math.max(1, Math.min(6, Number(input.max_results ?? 4)))
    const workspaceId = await getActiveWorkspaceId(context, input.company_workspace_id || null)
    const horizonDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

    let workflowRunsQuery = context.supabase
      .from('nova_workflow_runs')
      .select('id, title, summary, status, current_step, total_steps, company_workspace_id')
      .eq('user_id', context.user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(maxResults)

    if (workspaceId) {
      workflowRunsQuery = workflowRunsQuery.or(`company_workspace_id.is.null,company_workspace_id.eq.${workspaceId}`)
    }

    let taskQuery = context.supabase
      .from('isg_tasks')
      .select('id, title, start_date, status, company_workspace_id')
      .eq('organization_id', context.user.organization_id)
      .in('status', ['planned', 'in_progress', 'overdue'])
      .lte('start_date', horizonDate)
      .order('start_date', { ascending: true })
      .limit(maxResults)

    let trainingQuery = context.supabase
      .from('company_trainings')
      .select('id, title, training_date, status, company_workspace_id')
      .eq('organization_id', context.user.organization_id)
      .eq('status', 'planned')
      .lte('training_date', horizonDate)
      .order('training_date', { ascending: true })
      .limit(maxResults)

    let incidentQuery = context.supabase
      .from('incidents')
      .select('id, incident_code, status, company_workspace_id, created_at')
      .eq('organization_id', context.user.organization_id)
      .in('status', ['draft', 'investigating', 'dof_open'])
      .order('created_at', { ascending: false })
      .limit(maxResults)

    let documentQuery = context.supabase
      .from('editor_documents')
      .select('id, title, status, company_workspace_id, updated_at')
      .eq('organization_id', context.user.organization_id)
      .in('status', ['taslak', 'revizyon', 'onay_bekliyor'])
      .order('updated_at', { ascending: false })
      .limit(maxResults)

    let signalQuery = context.supabase
      .from('nova_learning_signals')
      .select('signal_label, outcome, signal_key, created_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(6)

    if (workspaceId) {
      taskQuery = taskQuery.eq('company_workspace_id', workspaceId)
      trainingQuery = trainingQuery.eq('company_workspace_id', workspaceId)
      incidentQuery = incidentQuery.eq('company_workspace_id', workspaceId)
      documentQuery = documentQuery.eq('company_workspace_id', workspaceId)
      signalQuery = signalQuery.or(`company_workspace_id.is.null,company_workspace_id.eq.${workspaceId}`)
    }

    const [
      workflowRunsRes,
      tasksRes,
      trainingsRes,
      incidentsRes,
      documentsRes,
      signalsRes,
    ] = await Promise.all([
      workflowRunsQuery,
      taskQuery,
      trainingQuery,
      incidentQuery,
      documentQuery,
      signalQuery,
    ])

    const runs = workflowRunsRes.data || []
    const runIds = runs.map((item: any) => item.id)
    const { data: steps } = runIds.length
      ? await context.supabase
          .from('nova_workflow_steps')
          .select('id, workflow_run_id, step_order, title, description, action_kind, target_url, prompt_text, status')
          .in('workflow_run_id', runIds)
          .in('status', ['pending', 'in_progress'])
          .order('step_order', { ascending: true })
      : { data: [] as any[] }

    const stepMap = new Map<string, any[]>()
    for (const step of steps || []) {
      stepMap.set(step.workflow_run_id, [...(stepMap.get(step.workflow_run_id) || []), step])
    }

    const workflows = runs.map((run: any) => ({
      id: run.id,
      title: run.title,
      summary: run.summary,
      status: run.status,
      current_step: run.current_step,
      total_steps: run.total_steps,
      next_step: (stepMap.get(run.id) || [])[0] || null,
    }))

    const followUpActions: Array<Record<string, unknown>> = []

    for (const workflow of workflows) {
      if (workflow.next_step) {
        followUpActions.push({
          id: `${workflow.id}:${workflow.next_step.id}`,
          label: workflow.next_step.title,
          description: workflow.next_step.description || null,
          kind: workflow.next_step.action_kind === 'navigate' ? 'navigate' : 'prompt',
          url: workflow.next_step.target_url || null,
          prompt: workflow.next_step.prompt_text || null,
          workflow_run_id: workflow.id,
          workflow_step_id: workflow.next_step.id,
          status: workflow.next_step.status,
        })
      }
    }

    for (const task of tasksRes.data || []) {
      followUpActions.push({
        id: `task:${task.id}`,
        label: context.session.language === 'en'
          ? `Review task: ${task.title}`
          : `Gorevi gozden gecir: ${task.title}`,
        description: context.session.language === 'en'
          ? `Task due on ${task.start_date}.`
          : `${task.start_date} tarihli gorevi kontrol et.`,
        kind: 'navigate',
        url: task.company_workspace_id ? `/companies/${task.company_workspace_id}?tab=planner` : '/planner',
        prompt: null,
        workflow_run_id: null,
        workflow_step_id: null,
        status: task.status,
      })
    }

    for (const training of trainingsRes.data || []) {
      followUpActions.push({
        id: `training:${training.id}`,
        label: context.session.language === 'en'
          ? `Follow up training: ${training.title}`
          : `Egitim takibini yap: ${training.title}`,
        description: context.session.language === 'en'
          ? `Training date ${training.training_date}.`
          : `${training.training_date} tarihli egitim icin takip yap.`,
        kind: 'navigate',
        url: training.company_workspace_id ? `/companies/${training.company_workspace_id}?tab=tracking` : '/planner',
        prompt: null,
        workflow_run_id: null,
        workflow_step_id: null,
        status: training.status,
      })
    }

    for (const incident of incidentsRes.data || []) {
      followUpActions.push({
        id: `incident:${incident.id}`,
        label: context.session.language === 'en'
          ? `Continue incident: ${incident.incident_code}`
          : `Olayi devam ettir: ${incident.incident_code}`,
        description: context.session.language === 'en'
          ? `Incident is currently ${incident.status}.`
          : `Olay su an ${incident.status} durumunda.`,
        kind: 'navigate',
        url: `/incidents/${incident.id}`,
        prompt: null,
        workflow_run_id: null,
        workflow_step_id: null,
        status: incident.status,
      })
    }

    for (const document of documentsRes.data || []) {
      followUpActions.push({
        id: `document:${document.id}`,
        label: context.session.language === 'en'
          ? `Review document: ${document.title}`
          : `Dokumani gozden gecir: ${document.title}`,
        description: context.session.language === 'en'
          ? `Document is currently ${document.status}.`
          : `Dokuman su an ${document.status} durumunda.`,
        kind: 'navigate',
        url: `/documents/${document.id}`,
        prompt: null,
        workflow_run_id: null,
        workflow_step_id: null,
        status: document.status,
      })
    }

    const insights = (signalsRes.data || [])
      .filter((item: any) => item.outcome === 'positive')
      .slice(0, 3)
      .map((item: any) => context.session.language === 'en'
        ? `Nova learned: ${item.signal_label}`
        : `Nova ogrendi: ${item.signal_label}`)

    const priorityRank = (action: Record<string, unknown>) => {
      const id = String(action.id || '')
      const status = String(action.status || '')

      if (id.startsWith('incident:')) return 100
      if (id.startsWith('training:')) return 92
      if (id.startsWith('task:')) return status === 'overdue' ? 96 : 88
      if (id.startsWith('document:')) return 80
      if (String(action.workflow_run_id || '')) return 90
      return 70
    }

    const uniqueActions = followUpActions
      .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((left, right) => priorityRank(right as Record<string, unknown>) - priorityRank(left as Record<string, unknown>))
      .slice(0, maxResults + 2)

    return {
      success: true,
      data: {
        workflows,
        follow_up_actions: uniqueActions,
        insights,
        summary: context.session.language === 'en'
          ? `Nova found ${workflows.length} active flows and ${uniqueActions.length} proactive follow-up actions.`
          : `Nova ${workflows.length} aktif akis ve ${uniqueActions.length} proaktif takip adimi buldu.`,
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeGetActiveWorkflows(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const maxResults = Math.max(1, Math.min(5, Number(input.max_results ?? 3)))
    const { data: runs } = await context.supabase
      .from('nova_workflow_runs')
      .select('id, title, summary, status, current_step, total_steps, navigation_url, navigation_label, metadata')
      .eq('user_id', context.user.id)
      .in('status', ['active', 'failed'])
      .order('created_at', { ascending: false })
      .limit(maxResults)

    if (!runs?.length) {
      return {
        success: true,
        data: {
          workflows: [],
          follow_up_actions: [],
          summary: context.session.language === 'en'
            ? 'There is no active Nova workflow right now.'
            : 'Su anda aktif bir Nova akisi bulunmuyor.',
        },
      }
    }

    const runIds = runs.map((item: any) => item.id)
    const { data: steps } = await context.supabase
      .from('nova_workflow_steps')
      .select('id, workflow_run_id, step_order, title, description, action_kind, target_url, prompt_text, status')
      .in('workflow_run_id', runIds)
      .order('step_order', { ascending: true })

    const stepMap = new Map<string, any[]>()
    for (const step of steps || []) {
      stepMap.set(step.workflow_run_id, [...(stepMap.get(step.workflow_run_id) || []), step])
    }

    const workflows = runs.map((run: any) => {
      const workflowSteps = stepMap.get(run.id) || []
      const nextStep = workflowSteps.find((step: any) => step.status === 'pending' || step.status === 'in_progress')
      return {
        id: run.id,
        title: run.title,
        summary: run.summary,
        status: run.status,
        current_step: run.current_step,
        total_steps: run.total_steps,
        next_step: nextStep
          ? {
              id: nextStep.id,
              title: nextStep.title,
              description: nextStep.description,
              action_kind: nextStep.action_kind,
              target_url: nextStep.target_url,
              prompt_text: nextStep.prompt_text,
              status: nextStep.status,
            }
          : null,
      }
    })

    const followUpActions = workflows
      .map((workflow: any) => workflow.next_step
        ? {
            id: `${workflow.id}:${workflow.next_step.id}`,
            label: workflow.next_step.title,
            description: workflow.next_step.description,
            kind: workflow.next_step.action_kind === 'navigate' ? 'navigate' : 'prompt',
            url: workflow.next_step.target_url || null,
            prompt: workflow.next_step.prompt_text || null,
            workflow_run_id: workflow.id,
            workflow_step_id: workflow.next_step.id,
            status: workflow.next_step.status,
          }
        : null)
      .filter(Boolean)

    return {
      success: true,
      data: {
        workflows,
        follow_up_actions: followUpActions,
        summary: context.session.language === 'en'
          ? `${workflows.length} active Nova workflows found.`
          : `${workflows.length} aktif Nova akisi bulundu.`,
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

function getActionLabel(actionName: string, language: string) {
  const labels = ACTION_LABELS[actionName] || { tr: 'kritik islem', en: 'critical action' }
  return language === 'en' ? labels.en : labels.tr
}

async function buildPendingActionContext(context: ToolContext): Promise<string> {
  try {
    const nowIso = new Date().toISOString()
    const { data } = await context.supabase
      .from('nova_action_runs')
      .select('id, action_name, action_title, action_summary, expires_at')
      .eq('user_id', context.user.id)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(2)

    if (!data?.length) return ''

    if (context.session.language === 'en') {
      return [
        'Open pending Nova actions:',
        ...data.map((item: any) => `- ${item.action_title}: ${item.action_summary || getActionLabel(item.action_name, 'en')}. If the user approves, use confirm_pending_action. If the user declines, use cancel_pending_action.`),
      ].join('\n')
    }

    return [
      'Nova icin bekleyen onayli islemler:',
      ...data.map((item: any) => `- ${item.action_title}: ${item.action_summary || getActionLabel(item.action_name, 'tr')}. Kullanici onay verirse confirm_pending_action, vazgecerse cancel_pending_action kullan.`),
    ].join('\n')
  } catch (_err) {
    return ''
  }
}

async function queueActionConfirmation(params: {
  actionName: string
  actionTitle: string
  actionSummary: string
  actionPayload: Record<string, unknown>
  companyWorkspaceId?: string | null
}, context: ToolContext): Promise<ToolResult> {
  try {
    const nowIso = new Date().toISOString()
    const basePayload = {
      ...params.actionPayload,
      company_workspace_id: params.companyWorkspaceId ?? params.actionPayload.company_workspace_id ?? null,
    }

    const { data: existing } = await context.supabase
      .from('nova_action_runs')
      .select('id')
      .eq('user_id', context.user.id)
      .eq('session_id', context.session.id)
      .eq('status', 'pending')
      .eq('action_name', params.actionName)
      .eq('action_title', params.actionTitle)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)

    let actionId: string | null = existing?.[0]?.id ?? null

    if (actionId) {
      const { error } = await context.supabase
        .from('nova_action_runs')
        .update({
          action_summary: params.actionSummary,
          action_payload: basePayload,
          company_workspace_id: params.companyWorkspaceId ?? null,
          updated_at: nowIso,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', actionId)

      if (error) {
        return { success: false, error: 'Onay bekleyen islem guncellenemedi.' }
      }
    } else {
      const { data, error } = await context.supabase
        .from('nova_action_runs')
        .insert({
          user_id: context.user.id,
          organization_id: context.user.organization_id,
          company_workspace_id: params.companyWorkspaceId ?? null,
          session_id: context.session.id,
          action_name: params.actionName,
          action_title: params.actionTitle,
          action_summary: params.actionSummary,
          action_payload: basePayload,
          language: context.session.answer_language,
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        return { success: false, error: 'Onay bekleyen islem kaydedilemedi.' }
      }

      actionId = data.id
    }

    const confirmationText = context.session.language === 'en'
      ? `${params.actionTitle} is ready. I am waiting for your approval before I execute it.`
      : `${params.actionTitle} hazir. Uygulamadan once onayinizi bekliyorum.`

    return {
      success: true,
      data: {
        requires_confirmation: true,
        action_run_id: actionId,
        action_name: params.actionName,
        action_title: params.actionTitle,
        action_summary: params.actionSummary,
        summary: confirmationText,
        confirmation_prompt: context.session.language === 'en'
          ? 'If you approve, say "approve it" or "go ahead".'
          : 'Onay veriyorsan "onayliyorum" veya "devam et" yazabilirsin.',
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function findPendingAction(actionId: string | null, context: ToolContext) {
  const nowIso = new Date().toISOString()
  let query = context.supabase
    .from('nova_action_runs')
    .select('id, action_name, action_title, action_summary, action_payload, company_workspace_id, status, expires_at')
    .eq('user_id', context.user.id)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)

  if (actionId) {
    query = query.eq('id', actionId)
  }

  const { data } = await query
  return data?.[0] ?? null
}

function detectPendingActionIntent(message: string): 'confirm' | 'cancel' | null {
  const normalized = message
    .toLocaleLowerCase('tr-TR')
    .replace(/[.!?,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return null

  const confirmPatterns = [
    /\bonay\b/,
    /\bonayliyorum\b/,
    /\bonayladim\b/,
    /\bdevam et\b/,
    /\bdevam\b/,
    /\buygula\b/,
    /\byap\b/,
    /\btamam\b/,
    /\bev(et)?\b/,
    /\bgo ahead\b/,
    /\bapprove\b/,
    /\bconfirm\b/,
    /\bproceed\b/,
  ]

  const cancelPatterns = [
    /\biptal\b/,
    /\bvazgectim\b/,
    /\bvazgec\b/,
    /\bdurma?n?\b/,
    /\byapma\b/,
    /\bhayir\b/,
    /\bcancel\b/,
    /\bstop\b/,
    /\bignore\b/,
  ]

  if (cancelPatterns.some((pattern) => pattern.test(normalized))) {
    return 'cancel'
  }

  if (confirmPatterns.some((pattern) => pattern.test(normalized))) {
    return 'confirm'
  }

  return null
}

async function inferPendingActionResolution(message: string, context: ToolContext) {
  const action = detectPendingActionIntent(message)
  if (!action) return null

  const pendingAction = await findPendingAction(null, context)
  if (!pendingAction?.id) return null

  return {
    action,
    actionId: pendingAction.id as string,
  }
}

async function findActionRunById(actionId: string, context: ToolContext) {
  const { data } = await context.supabase
    .from('nova_action_runs')
    .select('id, action_name, action_title, action_summary, action_payload, company_workspace_id, status, expires_at, confirmed_at, executed_at, cancelled_at, result_snapshot')
    .eq('id', actionId)
    .eq('user_id', context.user.id)
    .limit(1)

  return data?.[0] ?? null
}

function buildActionReplayPayload(actionRun: any, context: ToolContext) {
  const snapshot = actionRun?.result_snapshot && typeof actionRun.result_snapshot === 'object'
    ? actionRun.result_snapshot
    : {}

  return {
    ...(snapshot || {}),
    action_run_id: actionRun?.id ?? null,
    action_name: actionRun?.action_name ?? snapshot?.action_name ?? null,
    action_title: actionRun?.action_title ?? snapshot?.action_title ?? null,
    summary:
      snapshot?.summary ??
      (actionRun?.status === 'completed'
        ? (context.session.language === 'en'
          ? `${actionRun?.action_title || 'Nova action'} was already completed.`
          : `${actionRun?.action_title || 'Nova islemi'} daha once tamamlandi.`)
        : actionRun?.status === 'cancelled'
          ? (context.session.language === 'en'
            ? `${actionRun?.action_title || 'Nova action'} was already cancelled.`
            : `${actionRun?.action_title || 'Nova islemi'} daha once iptal edildi.`)
          : actionRun?.action_summary || null),
    idempotent_replay: true,
  }
}

async function updateActionRunStatus(actionId: string, patch: Record<string, unknown>, context: ToolContext) {
  await context.supabase
    .from('nova_action_runs')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
}

async function executeConfirmedPendingAction(actionRun: any, context: ToolContext): Promise<ToolResult> {
  const payload = {
    ...(actionRun.action_payload && typeof actionRun.action_payload === 'object' ? actionRun.action_payload : {}),
    confirmed: true,
    company_workspace_id: actionRun.company_workspace_id ?? actionRun.action_payload?.company_workspace_id ?? null,
  }

  let result: ToolResult
  switch (actionRun.action_name) {
    case 'create_training_plan':
      result = await executeCreateTrainingPlan(payload, context)
      break
    case 'create_planner_task':
      result = await executeCreatePlannerTask(payload, context)
      break
    case 'create_incident_draft':
      result = await executeCreateIncidentDraft(payload, context)
      break
    case 'create_document_draft':
      result = await executeCreateDocumentDraft(payload, context)
      break
    default:
      return { success: false, error: 'Desteklenmeyen bekleyen aksiyon.' }
  }

  if (result.success) {
    const previousSnapshot = actionRun.result_snapshot && typeof actionRun.result_snapshot === 'object'
      ? actionRun.result_snapshot
      : {}
    await updateActionRunStatus(actionRun.id, {
      status: 'completed',
      executed_at: new Date().toISOString(),
      result_snapshot: {
        ...(previousSnapshot || {}),
        ...(result.data || {}),
        execution_state: 'completed',
        action_run_id: actionRun.id,
        action_name: actionRun.action_name,
        action_title: actionRun.action_title,
      },
    }, context)
  } else {
    const previousSnapshot = actionRun.result_snapshot && typeof actionRun.result_snapshot === 'object'
      ? actionRun.result_snapshot
      : {}
    await updateActionRunStatus(actionRun.id, {
      status: 'failed',
      result_snapshot: {
        ...(previousSnapshot || {}),
        error: result.error ?? 'Execution failed',
        execution_state: 'failed',
        action_run_id: actionRun.id,
        action_name: actionRun.action_name,
        action_title: actionRun.action_title,
      },
    }, context)
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      action_run_id: actionRun.id,
      action_name: actionRun.action_name,
      action_title: actionRun.action_title,
    },
  }
}

async function executeConfirmPendingAction(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const actionId = typeof input.action_id === 'string' ? input.action_id : null
    const executionKey = typeof input.idempotency_key === 'string' ? input.idempotency_key : crypto.randomUUID()

    if (!actionId) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'A pending Nova action id is required for confirmation.'
          : 'Onay icin bekleyen Nova aksiyon kimligi gerekli.',
      }
    }

    const anyActionRun = await findActionRunById(actionId, context)

    if (!anyActionRun?.id) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'There is no pending Nova action waiting for approval.'
          : 'Onay bekleyen bir Nova islemi bulunamadi.',
      }
    }

    if (anyActionRun.status === 'completed') {
      return {
        success: true,
        data: buildActionReplayPayload(anyActionRun, context),
      }
    }

    if (anyActionRun.status === 'cancelled') {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'This Nova action was already cancelled.'
          : 'Bu Nova islemi zaten iptal edildi.',
      }
    }

    if (anyActionRun.status === 'confirmed') {
      const currentSnapshot =
        anyActionRun.result_snapshot && typeof anyActionRun.result_snapshot === 'object'
          ? anyActionRun.result_snapshot
          : {}
      const currentKey = currentSnapshot.execution_key ?? null
      const currentState = currentSnapshot.execution_state ?? null

      if (currentKey === executionKey && anyActionRun.executed_at) {
        return {
          success: true,
          data: buildActionReplayPayload(anyActionRun, context),
        }
      }

      if (currentKey === executionKey && (currentState === 'queued' || currentState === 'processing')) {
        await updateActionRunStatus(anyActionRun.id, {
          result_snapshot: {
            ...(currentSnapshot || {}),
            execution_key: executionKey,
            execution_state: 'processing',
            processing_started_at: new Date().toISOString(),
          },
        }, context)

        return await executeConfirmedPendingAction(anyActionRun, context)
      }

      return {
        success: false,
        error: context.session.language === 'en'
          ? 'This Nova action is already being processed.'
          : 'Bu Nova islemi zaten isleniyor.',
      }
    }

    const actionRun = await findPendingAction(actionId, context)

    if (!actionRun?.id) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'There is no pending Nova action waiting for approval.'
          : 'Onay bekleyen bir Nova islemi bulunamadi.',
      }
    }

    await updateActionRunStatus(actionRun.id, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      result_snapshot: {
        ...(actionRun.result_snapshot && typeof actionRun.result_snapshot === 'object' ? actionRun.result_snapshot : {}),
        execution_key: executionKey,
        execution_state: 'processing',
      },
    }, context)

    return await executeConfirmedPendingAction(actionRun, context)
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCancelPendingAction(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const actionId = typeof input.action_id === 'string' ? input.action_id : null
    if (!actionId) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'A pending Nova action id is required for cancellation.'
          : 'Iptal icin bekleyen Nova aksiyon kimligi gerekli.',
      }
    }

    const anyActionRun = await findActionRunById(actionId, context)

    if (anyActionRun?.status === 'cancelled') {
      return {
        success: true,
        data: buildActionReplayPayload(anyActionRun, context),
      }
    }

    if (anyActionRun?.status === 'completed') {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'This Nova action was already completed and can no longer be cancelled.'
          : 'Bu Nova islemi zaten tamamlandi ve artik iptal edilemez.',
      }
    }

    const actionRun = await findPendingAction(actionId, context)

    if (!actionRun?.id) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'There is no pending Nova action to cancel.'
          : 'Iptal edilecek bekleyen bir Nova islemi bulunamadi.',
      }
    }

    await updateActionRunStatus(actionRun.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      result_snapshot: {
        ...(actionRun.result_snapshot && typeof actionRun.result_snapshot === 'object' ? actionRun.result_snapshot : {}),
        cancelled_reason: typeof input.reason === 'string' ? input.reason : null,
        action_run_id: actionRun.id,
        action_name: actionRun.action_name,
        action_title: actionRun.action_title,
      },
    }, context)

    return {
      success: true,
      data: {
        action_run_id: actionRun.id,
        action_name: actionRun.action_name,
        action_title: actionRun.action_title,
        summary: context.session.language === 'en'
          ? `${actionRun.action_title} was cancelled.`
          : `${actionRun.action_title} iptal edildi.`,
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCompleteWorkflowStep(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const desiredStatus = ['completed', 'skipped', 'cancelled'].includes(input.status)
      ? input.status
      : 'completed'

    let stepId = typeof input.step_id === 'string' ? input.step_id : null

    if (!stepId && typeof input.workflow_id === 'string') {
      const { data: step } = await context.supabase
        .from('nova_workflow_steps')
        .select('id')
        .eq('workflow_run_id', input.workflow_id)
        .in('status', ['pending', 'in_progress'])
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      stepId = step?.id ?? null
    }

    if (!stepId) {
      const { data: run } = await context.supabase
        .from('nova_workflow_runs')
        .select('id')
        .eq('user_id', context.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (run?.id) {
        const { data: step } = await context.supabase
          .from('nova_workflow_steps')
          .select('id')
          .eq('workflow_run_id', run.id)
          .in('status', ['pending', 'in_progress'])
          .order('step_order', { ascending: true })
          .limit(1)
          .maybeSingle()

        stepId = step?.id ?? null
      }
    }

    if (!stepId) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'There is no active workflow step to complete.'
          : 'Tamamlanacak aktif bir workflow adimi bulunamadi.',
      }
    }

    const { data, error } = await context.supabase.rpc('update_nova_workflow_step', {
      p_step_id: stepId,
      p_status: desiredStatus,
    })

    if (error || !data) {
      return { success: false, error: 'Workflow adimi guncellenemedi.' }
    }

    const nextStep = data.next_step ?? null

    return {
      success: true,
      data: {
        workflow_run_id: data.workflow_run_id,
        workflow_title: data.workflow_title,
        workflow_status: data.workflow_status,
        current_step: data.current_step,
        total_steps: data.total_steps,
        completed_step_id: data.completed_step_id,
        completed_step_title: data.completed_step_title,
        summary: context.session.language === 'en'
          ? `${data.completed_step_title} marked as ${desiredStatus}.`
          : `${data.completed_step_title} adimi ${desiredStatus === 'completed' ? 'tamamlandi' : desiredStatus === 'skipped' ? 'atlandi' : 'iptal edildi'}.`,
        follow_up_actions: nextStep
          ? [{
              id: `${data.workflow_run_id}:${stepId}:next`,
              label: nextStep.title,
              description: nextStep.description || null,
              kind: nextStep.action_kind === 'navigate' ? 'navigate' : 'prompt',
              url: nextStep.target_url || null,
              prompt: nextStep.prompt_text || null,
              workflow_run_id: data.workflow_run_id,
              workflow_step_id: nextStep.id || null,
              status: nextStep.status || 'pending',
            }]
          : [],
        navigation: nextStep?.target_url
          ? {
              action: 'navigate',
              url: nextStep.target_url,
              label: nextStep.title,
              reason: nextStep.description || (context.session.language === 'en'
                ? 'Continue with the next Nova workflow step.'
                : 'Nova workflow icin siradaki adima gecin.'),
              destination: 'workflow_follow_up',
              auto_navigate: false,
            }
          : null,
      },
    }
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCreateTrainingPlan(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const title = String(input.title || '').trim()
    const trainingDate = String(input.training_date || '').trim()

    if (!title) {
      return { success: false, error: 'Egitim basligi gerekli' }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trainingDate)) {
      return { success: false, error: 'Egitim tarihi YYYY-MM-DD formatinda olmali' }
    }

    const workspaceId = await getActiveWorkspaceId(
      context,
      input.company_workspace_id || null,
    )

    if (!workspaceId) {
      return {
        success: false,
        error: 'Aktif bir firma workspace bulunamadi. Once bir firma secin veya firma olusturun.',
      }
    }

    const { data: workspace } = await context.supabase
      .from('company_workspaces')
      .select('id, display_name')
      .eq('id', workspaceId)
      .eq('organization_id', context.user.organization_id)
      .maybeSingle()

    if (!workspace?.id) {
      return { success: false, error: 'Egitim planlanacak firma bulunamadi.' }
    }

    const workflowLearning = await getWorkflowLearningProfile('training_plan', workspaceId, context)

    const durationHours = Math.max(1, Number(input.duration_hours ?? 2))
    const trainingType = ['zorunlu', 'istege_bagli', 'yenileme'].includes(input.training_type)
      ? input.training_type
      : 'zorunlu'

    const notes = String(input.notes || '').trim()
    const trainerName = String(input.trainer_name || '').trim()
    const location = String(input.location || '').trim()

    if (input.confirmed !== true) {
      return await queueActionConfirmation({
        actionName: 'create_training_plan',
        actionTitle: context.session.language === 'en' ? `Training plan: ${title}` : `Egitim plani: ${title}`,
        actionSummary: context.session.language === 'en'
          ? `${title} will be planned for ${trainingDate}${workspace.display_name ? ` for ${workspace.display_name}` : ''}.`
          : `${title}, ${trainingDate} tarihine${workspace.display_name ? ` ${workspace.display_name} icin` : ''} planlanacak.`,
        actionPayload: {
          title,
          training_type: trainingType,
          training_date: trainingDate,
          duration_hours: durationHours,
          trainer_name: trainerName || null,
          location: location || null,
          notes: notes || null,
          company_workspace_id: workspaceId,
        },
        companyWorkspaceId: workspaceId,
      }, context)
    }

    const { data: trainingRow, error: trainingError } = await context.supabase
      .from('company_trainings')
      .insert({
        organization_id: context.user.organization_id,
        company_workspace_id: workspaceId,
        title,
        training_type: trainingType,
        trainer_name: trainerName || null,
        training_date: trainingDate,
        duration_hours: durationHours,
        location: location || null,
        status: 'planned',
        notes: notes || null,
      })
      .select('id, title, training_date, status')
      .single()

    if (trainingError || !trainingRow?.id) {
      console.error('[create_training_plan] company_trainings insert failed:', trainingError)
      return { success: false, error: 'Egitim plani olusturulamadi.' }
    }

    const taskDescriptionParts = [
      trainerName ? `Egitmen: ${trainerName}` : null,
      `Sure: ${durationHours} saat`,
      location ? `Lokasyon: ${location}` : null,
      notes || null,
    ].filter(Boolean)

    const { data: taskRow, error: taskError } = await context.supabase
      .from('isg_tasks')
      .insert({
        organization_id: context.user.organization_id,
        company_workspace_id: workspaceId,
        title: `Egitim: ${title}`,
        description: taskDescriptionParts.join(' | '),
        category_id: ISG_TASK_CATEGORY_EGITIM,
        start_date: trainingDate,
        end_date: trainingDate,
        status: 'planned',
        location: location || null,
        reminder_days: 3,
      })
      .select('id')
      .single()

    if (taskError) {
      console.error('[create_training_plan] isg_tasks insert failed:', taskError)
    }

    const navigation = {
      action: 'navigate',
      url: `/companies/${workspaceId}?tab=tracking`,
      label: 'Egitim plani olusturuldu',
      reason: 'Olusan egitim planini takip ekraninda gorebilirsiniz.',
      destination: 'company_tracking',
      auto_navigate: false,
    }

    const trainingWorkflowSteps: NovaWorkflowStepDefinition[] = [
      {
        stepKey: 'training_created',
        title: context.session.language === 'en' ? 'Training plan created' : 'Egitim plani olusturuldu',
        description: context.session.language === 'en'
          ? 'Nova created the training record and linked follow-up task.'
          : 'Nova egitim kaydini ve takip gorevini olusturdu.',
        actionKind: 'system',
        initialStatus: 'completed',
      },
      {
        stepKey: 'review_training_tracking',
        title: context.session.language === 'en' ? 'Review training tracking tab' : 'Egitim takip sekmesini gozden gecir',
        description: context.session.language === 'en'
          ? 'Open the company tracking tab and verify schedule details.'
          : 'Takip sekmesini acip plan detaylarini kontrol et.',
        actionKind: 'navigate',
        targetUrl: `/companies/${workspaceId}?tab=tracking`,
        initialStatus: 'pending',
      },
      {
        stepKey: 'prepare_training_followup',
        title: context.session.language === 'en' ? 'Prepare participant follow-up' : 'Katilimci takibini hazirla',
        description: context.session.language === 'en'
          ? 'Ask Nova to prepare participant or reminder follow-up for this training.'
          : 'Bu egitim icin katilimci veya hatirlatma takibini Nova ile hazirla.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Prepare participant follow-up for the training "${title}".`
          : `"${title}" egitimi icin katilimci takibini hazirla.`,
        initialStatus: 'pending',
      },
    ]

    if (workflowLearning.shouldDeepenChain) {
      trainingWorkflowSteps.push({
        stepKey: 'prepare_training_reminder_chain',
        title: context.session.language === 'en' ? 'Prepare reminder and attendance chain' : 'Hatirlatma ve katilim zincirini hazirla',
        description: context.session.language === 'en'
          ? 'Nova learned that this company benefits from reminder and attendance follow-up after planning trainings.'
          : 'Nova bu firmada egitim planlamasindan sonra hatirlatma ve katilim takibinin faydali oldugunu ogrendi.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Create a reminder and attendance follow-up checklist for the training "${title}".`
          : `"${title}" egitimi icin hatirlatma ve katilim takip kontrol listesini hazirla.`,
        initialStatus: 'pending',
      })
    }

    const workflowBundle = await createNovaWorkflow({
      workflowType: 'training_plan',
      title: context.session.language === 'en' ? `Training workflow: ${title}` : `Egitim akisi: ${title}`,
      summary: context.session.language === 'en'
        ? `${title} was scheduled for ${trainingDate}.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`
        : `${title} ${trainingDate} tarihine planlandi.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`,
      companyWorkspaceId: workspaceId,
      navigation,
      metadata: {
        training_id: trainingRow.id,
        task_id: taskRow?.id ?? null,
        training_type: trainingType,
      },
      steps: trainingWorkflowSteps,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'company',
      profileKey: 'training_planning_pattern',
      title: context.session.language === 'en' ? 'Training planning rhythm' : 'Egitim planlama ritmi',
      summaryText: context.session.language === 'en'
        ? `${workspace.display_name || 'The company'} regularly plans ${trainingType} trainings through Nova. Latest plan: ${title} on ${trainingDate}.`
        : `${workspace.display_name || 'Firma'} Nova uzerinden ${trainingType} egitimleri planliyor. Son plan: ${title} - ${trainingDate}.`,
      structuredProfile: {
        action: 'create_training_plan',
        title,
        training_type: trainingType,
        training_date: trainingDate,
        duration_hours: durationHours,
        trainer_name: trainerName || null,
        location: location || null,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.84,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'user',
      profileKey: 'preferred_operations',
      title: context.session.language === 'en' ? 'Preferred Nova operations' : 'Tercih edilen Nova operasyonlari',
      summaryText: context.session.language === 'en'
        ? 'The user prefers Nova to create training plans together with follow-up guidance.'
        : 'Kullanici Nova ile egitim plani olusturmayi ve sonraki adim yonlendirmesini tercih ediyor.',
      structuredProfile: {
        last_action: 'create_training_plan',
        workspace_id: workspaceId,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.76,
    }, context)

    await recordLearningSignal({
      signalSource: 'workflow',
      signalKey: 'workflow-start:training_plan',
      signalLabel: context.session.language === 'en'
        ? `Training flow started for ${title}`
        : `${title} icin egitim akisi baslatildi`,
      outcome: 'neutral',
      confidenceScore: 0.74,
      companyWorkspaceId: workspaceId,
      payload: {
        action: 'create_training_plan',
        training_id: trainingRow.id,
        task_id: taskRow?.id ?? null,
      },
    }, context)

    return {
      success: true,
      data: {
        training_id: trainingRow.id,
        task_id: taskRow?.id ?? null,
        title: trainingRow.title,
        training_date: trainingRow.training_date,
        status: trainingRow.status,
        company_workspace_id: workspaceId,
        company_name: workspace.display_name ?? null,
        summary: `${title} egitimi ${trainingDate} tarihine planlandi.`,
        navigation,
        workflow: workflowBundle?.workflow ?? null,
        follow_up_actions: workflowBundle?.followUpActions ?? [],
      },
    }
  } catch (err: any) {
    console.error('[create_training_plan] error:', err)
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCreatePlannerTask(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const title = String(input.title || '').trim()
    const startDate = String(input.start_date || '').trim()

    if (!title) return { success: false, error: 'Gorev basligi gerekli' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { success: false, error: 'Baslangic tarihi YYYY-MM-DD formatinda olmali' }
    }

    const workspaceId = await getActiveWorkspaceId(context, input.company_workspace_id || null)
    if (!workspaceId) {
      return { success: false, error: 'Gorev olusturmak icin aktif firma bulunamadi.' }
    }

    const { data: workspace } = await context.supabase
      .from('company_workspaces')
      .select('id, display_name')
      .eq('id', workspaceId)
      .eq('organization_id', context.user.organization_id)
      .maybeSingle()

    if (!workspace?.id) {
      return { success: false, error: 'Gorev olusturulacak firma bulunamadi.' }
    }

    const workflowLearning = await getWorkflowLearningProfile('planner_task', workspaceId, context)

    const categoryHint = String(input.category_hint || 'genel')
    const categoryId = categoryHint === 'egitim'
      ? ISG_TASK_CATEGORY_EGITIM
      : categoryHint === 'isg_kurul'
        ? ISG_TASK_CATEGORY_ISG_KURUL
        : categoryHint === 'periyodik_kontrol'
          ? ISG_TASK_CATEGORY_PERIYODIK_KONTROL
          : null

    const endDate = typeof input.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.end_date)
      ? input.end_date
      : null
    const recurrence = ['none', 'daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'].includes(input.recurrence)
      ? input.recurrence
      : 'none'
    const reminderDays = Math.max(0, Math.min(365, Number(input.reminder_days ?? 7)))

    if (input.confirmed !== true) {
      return await queueActionConfirmation({
        actionName: 'create_planner_task',
        actionTitle: context.session.language === 'en' ? `Planner task: ${title}` : `Planner gorevi: ${title}`,
        actionSummary: context.session.language === 'en'
          ? `${title} will be planned for ${startDate}${workspace.display_name ? ` in ${workspace.display_name}` : ''}.`
          : `${title}, ${startDate} icin${workspace.display_name ? ` ${workspace.display_name} firmasinda` : ''} planlanacak.`,
        actionPayload: {
          title,
          start_date: startDate,
          end_date: endDate,
          description: String(input.description || '').trim() || null,
          location: String(input.location || '').trim() || null,
          recurrence,
          reminder_days: reminderDays,
          category_hint: categoryHint,
          company_workspace_id: workspaceId,
        },
        companyWorkspaceId: workspaceId,
      }, context)
    }

    const { data: taskRow, error: taskError } = await context.supabase
      .from('isg_tasks')
      .insert({
        organization_id: context.user.organization_id,
        company_workspace_id: workspaceId,
        title,
        description: String(input.description || '').trim() || null,
        category_id: categoryId,
        start_date: startDate,
        end_date: endDate,
        recurrence,
        status: 'planned',
        location: String(input.location || '').trim() || null,
        reminder_days: reminderDays,
      })
      .select('id, title, start_date, status')
      .single()

    if (taskError || !taskRow?.id) {
      console.error('[create_planner_task] isg_tasks insert failed:', taskError)
      return { success: false, error: 'Planner gorevi olusturulamadi.' }
    }

    const navigation = {
      action: 'navigate',
      url: `/companies/${workspaceId}?tab=planner`,
      label: 'Planner gorevi olusturuldu',
      reason: 'Gorevi planner sekmesinde gorebilir ve duzenleyebilirsiniz.',
      destination: 'company_planner',
      auto_navigate: false,
    }

    const plannerWorkflowSteps: NovaWorkflowStepDefinition[] = [
      {
        stepKey: 'task_created',
        title: context.session.language === 'en' ? 'Planner task created' : 'Planner gorevi olusturuldu',
        description: context.session.language === 'en'
          ? 'Nova created the operational task.'
          : 'Nova operasyon gorevini olusturdu.',
        actionKind: 'system',
        initialStatus: 'completed',
      },
      {
        stepKey: 'review_planner',
        title: context.session.language === 'en' ? 'Open planner tab' : 'Planner sekmesini ac',
        description: context.session.language === 'en'
          ? 'Review scheduling details in the company planner.'
          : 'Firma planner ekraninda plan detaylarini gozden gecir.',
        actionKind: 'navigate',
        targetUrl: `/companies/${workspaceId}?tab=planner`,
        initialStatus: 'pending',
      },
      {
        stepKey: 'assign_owner',
        title: context.session.language === 'en' ? 'Prepare owner follow-up' : 'Sorumlu atama takibini hazirla',
        description: context.session.language === 'en'
          ? 'Ask Nova to prepare responsible person follow-up for this task.'
          : 'Bu gorev icin sorumlu atama takibini Nova ile hazirla.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Prepare follow-up guidance for assigning an owner to the task "${title}".`
          : `"${title}" gorevi icin sorumlu atama takibini hazirla.`,
        initialStatus: 'pending',
      },
    ]

    if (workflowLearning.shouldDeepenChain) {
      plannerWorkflowSteps.push({
        stepKey: 'review_deadline_risk',
        title: context.session.language === 'en' ? 'Review deadline risk and reminder' : 'Termin riskini ve hatirlatmayi gozden gecir',
        description: context.session.language === 'en'
          ? 'Nova learned that this company benefits from deadline reminders after task creation.'
          : 'Nova bu firmada gorev olusturduktan sonra termin hatirlatmasinin faydali oldugunu ogrendi.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Prepare a deadline reminder and owner follow-up plan for "${title}".`
          : `"${title}" gorevi icin termin hatirlatma ve sorumlu takip plani hazirla.`,
        initialStatus: 'pending',
      })
    }

    const workflowBundle = await createNovaWorkflow({
      workflowType: 'planner_task',
      title: context.session.language === 'en' ? `Planner workflow: ${title}` : `Planner akisi: ${title}`,
      summary: context.session.language === 'en'
        ? `${title} was planned for ${startDate}.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`
        : `${title} gorevi ${startDate} icin planlandi.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`,
      companyWorkspaceId: workspaceId,
      navigation,
      metadata: {
        task_id: taskRow.id,
        category_hint: categoryHint,
        recurrence,
      },
      steps: plannerWorkflowSteps,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'company',
      profileKey: 'task_followup_pattern',
      title: context.session.language === 'en' ? 'Operational task rhythm' : 'Operasyon gorev ritmi',
      summaryText: context.session.language === 'en'
        ? `${workspace.display_name || 'The company'} uses Nova for planner-driven follow-up tasks. Latest task: ${title}.`
        : `${workspace.display_name || 'Firma'} Nova ile planner odakli takip gorevleri yurutuyor. Son gorev: ${title}.`,
      structuredProfile: {
        action: 'create_planner_task',
        title,
        start_date: startDate,
        end_date: endDate,
        recurrence,
        category_hint: categoryHint,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.82,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'user',
      profileKey: 'preferred_operations',
      title: context.session.language === 'en' ? 'Preferred Nova operations' : 'Tercih edilen Nova operasyonlari',
      summaryText: context.session.language === 'en'
        ? 'The user prefers Nova to create planner tasks together with follow-up guidance.'
        : 'Kullanici Nova ile planner gorevi olusturmayi ve sonraki adimlari takip etmeyi tercih ediyor.',
      structuredProfile: {
        last_action: 'create_planner_task',
        workspace_id: workspaceId,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.75,
    }, context)

    await recordLearningSignal({
      signalSource: 'workflow',
      signalKey: 'workflow-start:planner_task',
      signalLabel: context.session.language === 'en'
        ? `Planner flow started for ${title}`
        : `${title} icin planner akisi baslatildi`,
      outcome: 'neutral',
      confidenceScore: 0.72,
      companyWorkspaceId: workspaceId,
      payload: {
        action: 'create_planner_task',
        task_id: taskRow.id,
        category_hint: categoryHint,
      },
    }, context)

    return {
      success: true,
      data: {
        task_id: taskRow.id,
        title: taskRow.title,
        start_date: taskRow.start_date,
        status: taskRow.status,
        company_workspace_id: workspaceId,
        company_name: workspace.display_name ?? null,
        summary: `${title} gorevi ${startDate} icin planlandi.`,
        navigation,
        workflow: workflowBundle?.workflow ?? null,
        follow_up_actions: workflowBundle?.followUpActions ?? [],
      },
    }
  } catch (err: any) {
    console.error('[create_planner_task] error:', err)
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCreateIncidentDraft(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const incidentType = String(input.incident_type || '').trim()
    if (!['work_accident', 'near_miss', 'occupational_disease'].includes(incidentType)) {
      return { success: false, error: 'Gecerli bir olay tipi gerekli' }
    }

    const workspaceId = await getActiveWorkspaceId(context, input.company_workspace_id || null)
    if (!workspaceId) {
      return { success: false, error: 'Olay taslagi icin aktif firma bulunamadi.' }
    }

    const { data: workspace } = await context.supabase
      .from('company_workspaces')
      .select('id, display_name')
      .eq('id', workspaceId)
      .eq('organization_id', context.user.organization_id)
      .maybeSingle()

    if (!workspace?.id) {
      return { success: false, error: 'Olay taslagi olusturulacak firma bulunamadi.' }
    }

    const workflowLearning = await getWorkflowLearningProfile('incident_draft', workspaceId, context)

    const payload: Record<string, unknown> = {
      organization_id: context.user.organization_id,
      company_workspace_id: workspaceId,
      incident_type: incidentType,
      status: 'draft',
      description: String(input.description || '').trim() || null,
      incident_location: String(input.incident_location || '').trim() || null,
      incident_department: String(input.incident_department || '').trim() || null,
      general_activity: String(input.general_activity || '').trim() || null,
      tool_used: String(input.tool_used || '').trim() || null,
      dof_required: Boolean(input.dof_required ?? false),
      ishikawa_required: Boolean(input.ishikawa_required ?? false),
      created_by: context.user.id,
    }

    if (typeof input.incident_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.incident_date)) {
      payload.incident_date = input.incident_date
    }
    if (typeof input.incident_time === 'string' && /^\d{2}:\d{2}$/.test(input.incident_time)) {
      payload.incident_time = input.incident_time
    }
    if (typeof input.severity_level === 'string' && ['low', 'medium', 'high', 'critical'].includes(input.severity_level)) {
      payload.severity_level = input.severity_level
    }

    if (input.confirmed !== true) {
      const incidentLabel = incidentType === 'work_accident'
        ? (context.session.language === 'en' ? 'work accident' : 'is kazasi')
        : incidentType === 'near_miss'
          ? (context.session.language === 'en' ? 'near miss' : 'ramak kala')
          : (context.session.language === 'en' ? 'occupational disease' : 'meslek hastaligi')

      return await queueActionConfirmation({
        actionName: 'create_incident_draft',
        actionTitle: context.session.language === 'en' ? `Incident draft: ${incidentLabel}` : `Olay taslagi: ${incidentLabel}`,
        actionSummary: context.session.language === 'en'
          ? `${incidentLabel} draft will be created${workspace.display_name ? ` for ${workspace.display_name}` : ''}.`
          : `${incidentLabel} taslagi${workspace.display_name ? ` ${workspace.display_name} icin` : ''} olusturulacak.`,
        actionPayload: {
          incident_type: incidentType,
          company_workspace_id: workspaceId,
          incident_date: payload.incident_date ?? null,
          incident_time: payload.incident_time ?? null,
          incident_location: payload.incident_location ?? null,
          incident_department: payload.incident_department ?? null,
          general_activity: payload.general_activity ?? null,
          tool_used: payload.tool_used ?? null,
          description: payload.description ?? null,
          severity_level: payload.severity_level ?? null,
          dof_required: payload.dof_required ?? false,
          ishikawa_required: payload.ishikawa_required ?? false,
        },
        companyWorkspaceId: workspaceId,
      }, context)
    }

    const { data: incidentRow, error: incidentError } = await context.supabase
      .from('incidents')
      .insert(payload)
      .select('id, incident_code, incident_type, status')
      .single()

    if (incidentError || !incidentRow?.id) {
      console.error('[create_incident_draft] incidents insert failed:', incidentError)
      return { success: false, error: 'Olay taslagi olusturulamadi.' }
    }

    const navigation = {
      action: 'navigate',
      url: `/incidents/${incidentRow.id}`,
      label: 'Olay taslagi hazir',
      reason: 'Taslagi detay ekraninda tamamlayabilirsiniz.',
      destination: 'incident_detail',
      auto_navigate: false,
    }

    const incidentWorkflowSteps: NovaWorkflowStepDefinition[] = [
      {
        stepKey: 'incident_draft_created',
        title: context.session.language === 'en' ? 'Incident draft created' : 'Olay taslagi olusturuldu',
        description: context.session.language === 'en'
          ? 'Nova created the controlled incident draft.'
          : 'Nova kontrollu olay taslagini olusturdu.',
        actionKind: 'system',
        initialStatus: 'completed',
      },
      {
        stepKey: 'open_incident_detail',
        title: context.session.language === 'en' ? 'Open incident detail' : 'Olay detayini ac',
        description: context.session.language === 'en'
          ? 'Review and complete the draft on the incident detail screen.'
          : 'Taslagi olay detay ekraninda gozden gecirip tamamla.',
        actionKind: 'navigate',
        targetUrl: `/incidents/${incidentRow.id}`,
        initialStatus: 'pending',
      },
      {
        stepKey: 'continue_incident_followup',
        title: context.session.language === 'en' ? 'Continue incident follow-up' : 'Olay takibini surdur',
        description: context.session.language === 'en'
          ? 'Ask Nova to prepare DOF or root cause follow-up if needed.'
          : 'Gerekirse DOF veya kok neden takibini Nova ile hazirla.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Prepare the next incident follow-up actions for ${incidentRow.incident_code}.`
          : `${incidentRow.incident_code} icin sonraki olay takip adimlarini hazirla.`,
        initialStatus: 'pending',
      },
    ]

    if (workflowLearning.shouldDeepenChain) {
      incidentWorkflowSteps.push({
        stepKey: 'prepare_root_cause_chain',
        title: context.session.language === 'en' ? 'Prepare root cause and DOF chain' : 'Kok neden ve DOF zincirini hazirla',
        description: context.session.language === 'en'
          ? 'Nova learned that this organization benefits from continuing the incident flow with corrective action planning.'
          : 'Nova bu organizasyonda olay akisindan sonra duzeltici faaliyet planlamasinin faydali oldugunu ogrendi.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Prepare a root cause and corrective action follow-up chain for ${incidentRow.incident_code}.`
          : `${incidentRow.incident_code} icin kok neden ve duzeltici faaliyet takip zinciri hazirla.`,
        initialStatus: 'pending',
      })
    }

    const workflowBundle = await createNovaWorkflow({
      workflowType: 'incident_draft',
      title: context.session.language === 'en' ? `Incident workflow: ${incidentRow.incident_code}` : `Olay akisi: ${incidentRow.incident_code}`,
      summary: context.session.language === 'en'
        ? `${incidentRow.incident_code} draft was created.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`
        : `${incidentRow.incident_code} taslagi olusturuldu.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`,
      companyWorkspaceId: workspaceId,
      navigation,
      metadata: {
        incident_id: incidentRow.id,
        incident_type: incidentRow.incident_type,
      },
      steps: incidentWorkflowSteps,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'company',
      profileKey: 'incident_followup_pattern',
      title: context.session.language === 'en' ? 'Incident follow-up rhythm' : 'Olay takip ritmi',
      summaryText: context.session.language === 'en'
        ? `${workspace.display_name || 'The company'} uses Nova to open incident drafts and continue follow-up from the detail screen.`
        : `${workspace.display_name || 'Firma'} Nova ile olay taslagi acip detaya giderek takibi surduruyor.`,
      structuredProfile: {
        action: 'create_incident_draft',
        incident_type: incidentType,
        severity_level: payload.severity_level ?? null,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.8,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'user',
      profileKey: 'preferred_operations',
      title: context.session.language === 'en' ? 'Preferred Nova operations' : 'Tercih edilen Nova operasyonlari',
      summaryText: context.session.language === 'en'
        ? 'The user uses Nova to start controlled incident drafts and follow the next operational step.'
        : 'Kullanici Nova ile kontrollu olay taslagi baslatip sonraki operasyon adimini takip ediyor.',
      structuredProfile: {
        last_action: 'create_incident_draft',
        workspace_id: workspaceId,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.74,
    }, context)

    await recordLearningSignal({
      signalSource: 'workflow',
      signalKey: 'workflow-start:incident_draft',
      signalLabel: context.session.language === 'en'
        ? `Incident flow started for ${incidentRow.incident_code}`
        : `${incidentRow.incident_code} icin olay akisi baslatildi`,
      outcome: 'neutral',
      confidenceScore: 0.71,
      companyWorkspaceId: workspaceId,
      payload: {
        action: 'create_incident_draft',
        incident_id: incidentRow.id,
        incident_type: incidentRow.incident_type,
      },
    }, context)

    return {
      success: true,
      data: {
        incident_id: incidentRow.id,
        incident_code: incidentRow.incident_code,
        incident_type: incidentRow.incident_type,
        status: incidentRow.status,
        company_workspace_id: workspaceId,
        company_name: workspace.display_name ?? null,
        summary: `${incidentRow.incident_code} olay taslagi olusturuldu.`,
        navigation,
        workflow: workflowBundle?.workflow ?? null,
        follow_up_actions: workflowBundle?.followUpActions ?? [],
      },
    }
  } catch (err: any) {
    console.error('[create_incident_draft] error:', err)
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCreateDocumentDraft(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const title = String(input.title || '').trim()
    if (!title) return { success: false, error: 'Dokuman basligi gerekli' }

    const documentType = String(input.document_type || 'custom').trim()
    const groupKeyMap: Record<string, string> = {
      procedure: 'procedure',
      training_form: 'training_form',
      meeting_minutes: 'meeting_minutes',
      risk_report: 'risk_report',
      emergency_plan: 'emergency_plan',
      inspection_report: 'inspection_report',
      checklist: 'checklist',
      custom: 'custom',
    }
    const groupKey = groupKeyMap[documentType] || 'custom'
    const summary = String(input.summary || '').trim()

    const profileId = await getUserProfileId(context)
    const workspaceId = await getActiveWorkspaceId(context, input.company_workspace_id || null)
    const workflowLearning = await getWorkflowLearningProfile('document_draft', workspaceId, context)

    if (input.confirmed !== true) {
      return await queueActionConfirmation({
        actionName: 'create_document_draft',
        actionTitle: context.session.language === 'en' ? `Document draft: ${title}` : `Dokuman taslagi: ${title}`,
        actionSummary: context.session.language === 'en'
          ? `${title} document draft will be created${summary ? ` with scope: ${summary}` : ''}.`
          : `${title} dokuman taslagi${summary ? `, kapsam: ${summary}` : ''} ile olusturulacak.`,
        actionPayload: {
          title,
          document_type: documentType,
          summary: summary || null,
          company_workspace_id: workspaceId,
        },
        companyWorkspaceId: workspaceId,
      }, context)
    }

    const { data: documentRow, error: documentError } = await context.supabase
      .from('editor_documents')
      .insert({
        organization_id: context.user.organization_id,
        company_workspace_id: workspaceId,
        template_id: null,
        group_key: groupKey,
        title,
        content_json: buildNovaDocumentContent(title, summary, context.session.language),
        variables_data: {
          generated_by: 'nova',
          document_type: documentType,
          request_summary: summary || null,
          company_workspace_id: workspaceId,
        },
        status: 'taslak',
        prepared_by: profileId,
      })
      .select('id, title, group_key, status')
      .single()

    if (documentError || !documentRow?.id) {
      console.error('[create_document_draft] editor_documents insert failed:', documentError)
      return { success: false, error: 'Dokuman taslagi olusturulamadi.' }
    }

    const navigation = {
      action: 'navigate',
      url: `/documents/${documentRow.id}`,
      label: 'Dokuman taslagi hazir',
      reason: 'Taslagi editor ekraninda tamamlayabilirsiniz.',
      destination: 'document_detail',
      auto_navigate: false,
    }

    const documentWorkflowSteps: NovaWorkflowStepDefinition[] = [
      {
        stepKey: 'document_draft_created',
        title: context.session.language === 'en' ? 'Document draft created' : 'Dokuman taslagi olusturuldu',
        description: context.session.language === 'en'
          ? 'Nova created the document draft in the editor.'
          : 'Nova editor icinde dokuman taslagini olusturdu.',
        actionKind: 'system',
        initialStatus: 'completed',
      },
      {
        stepKey: 'review_document_editor',
        title: context.session.language === 'en' ? 'Open document editor' : 'Dokuman editorunu ac',
        description: context.session.language === 'en'
          ? 'Review and enrich the draft in the document editor.'
          : 'Taslagi dokuman editorunde gozden gecir ve genislet.',
        actionKind: 'navigate',
        targetUrl: `/documents/${documentRow.id}`,
        initialStatus: 'pending',
      },
      {
        stepKey: 'request_document_revision',
        title: context.session.language === 'en' ? 'Prepare revision follow-up' : 'Revizyon takibini hazirla',
        description: context.session.language === 'en'
          ? 'Ask Nova to refine this draft further when needed.'
          : 'Gerekirse bu taslagi Nova ile bir adim daha olgunlastir.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Refine the document draft "${title}" with the next revision step.`
          : `"${title}" dokuman taslagini bir sonraki revizyon adimiyla gelistir.`,
        initialStatus: 'pending',
      },
    ]

    if (workflowLearning.shouldDeepenChain) {
      documentWorkflowSteps.push({
        stepKey: 'prepare_document_approval_chain',
        title: context.session.language === 'en' ? 'Prepare approval chain' : 'Onay zincirini hazirla',
        description: context.session.language === 'en'
          ? 'Nova learned that this company benefits from a revision and approval follow-up after the first draft.'
          : 'Nova bu firmada ilk taslaktan sonra revizyon ve onay takibinin faydali oldugunu ogrendi.',
        actionKind: 'prompt',
        promptText: context.session.language === 'en'
          ? `Prepare a revision and approval follow-up plan for the document "${title}".`
          : `"${title}" dokumani icin revizyon ve onay takip plani hazirla.`,
        initialStatus: 'pending',
      })
    }

    const workflowBundle = await createNovaWorkflow({
      workflowType: 'document_draft',
      title: context.session.language === 'en' ? `Document workflow: ${title}` : `Dokuman akisi: ${title}`,
      summary: context.session.language === 'en'
        ? `${title} draft was created for editor review.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`
        : `${title} taslagi editor incelemesi icin olusturuldu.${workflowLearning.hintLine ? ` ${workflowLearning.hintLine}` : ''}`,
      companyWorkspaceId: workspaceId,
      navigation,
      metadata: {
        document_id: documentRow.id,
        document_type: documentType,
      },
      steps: documentWorkflowSteps,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'company',
      profileKey: 'document_workflow_pattern',
      title: context.session.language === 'en' ? 'Document workflow preference' : 'Dokuman akisi tercihi',
      summaryText: context.session.language === 'en'
        ? 'Nova is used as the first draft engine before the editor review stage.'
        : 'Nova, editor incelemesi oncesinde ilk taslak motoru olarak kullaniliyor.',
      structuredProfile: {
        action: 'create_document_draft',
        document_type: documentType,
        title,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.83,
    }, context)

    await upsertLongTermMemoryProfile({
      profileScope: 'user',
      profileKey: 'preferred_operations',
      title: context.session.language === 'en' ? 'Preferred Nova operations' : 'Tercih edilen Nova operasyonlari',
      summaryText: context.session.language === 'en'
        ? 'The user uses Nova to generate drafts before moving into the editor.'
        : 'Kullanici editor asamasina gecmeden once taslak uretimi icin Nova kullaniyor.',
      structuredProfile: {
        last_action: 'create_document_draft',
        workspace_id: workspaceId,
      },
      companyWorkspaceId: workspaceId,
      confidenceScore: 0.74,
    }, context)

    await recordLearningSignal({
      signalSource: 'workflow',
      signalKey: 'workflow-start:document_draft',
      signalLabel: context.session.language === 'en'
        ? `Document flow started for ${title}`
        : `${title} icin dokuman akisi baslatildi`,
      outcome: 'neutral',
      confidenceScore: 0.72,
      companyWorkspaceId: workspaceId,
      payload: {
        action: 'create_document_draft',
        document_id: documentRow.id,
        document_type: documentType,
      },
    }, context)

    return {
      success: true,
      data: {
        document_id: documentRow.id,
        title: documentRow.title,
        group_key: documentRow.group_key,
        status: documentRow.status,
        company_workspace_id: workspaceId,
        summary: `${title} dokuman taslagi olusturuldu.`,
        navigation,
        workflow: workflowBundle?.workflow ?? null,
        follow_up_actions: workflowBundle?.followUpActions ?? [],
      },
    }
  } catch (err: any) {
    console.error('[create_document_draft] error:', err)
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeNavigateToPage(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const destination = input.destination
    const recordId = input.record_id
    const reason = input.reason || 'Sayfaya yonlendiriyorum'

    const STANDALONE_ROUTES: Record<string, string> = {
      'dashboard': '/dashboard',
      'companies_list': '/companies',
      'new_incident': '/incidents/new',
      'incidents_list': '/incidents',
      'documents_list': '/documents',
      'new_document': '/documents/new',
      'templates': '/templates',
      'training_list': '/training',
      'new_training': '/training/new',
      'certificates': '/training/certificates',
      'solution_center': '/solution-center',
      'planner': '/planner',
      'reports': '/reports',
      'tasks': '/tasks',
      'findings': '/findings',
      'hazard_library': '/hazard-library',
      'emergency_plan': '/emergency',
      'calendar': '/calendar',
      'notifications': '/notifications',
      'settings': '/settings',
      'profile': '/profile',
      'executive_summary': '/executive-summary',
      'deadline_tracking': '/deadline-tracking',
      'health': '/health',
      'medical_schedule': '/medical-schedule',
      'r_skor_2d': '/r-skor-2d'
    }

    const COMPANY_TAB_MAP: Record<string, string> = {
      'company_overview': 'overview',
      'company_structure': 'structure',
      'company_risk': 'risk',
      'company_people': 'people',
      'company_personnel': 'personnel',
      'company_planner': 'planner',
      'company_tracking': 'tracking',
      'company_documents': 'documents',
      'company_organization': 'organization',
      'company_history': 'history',
      'personnel_list': 'personnel',
      'company_team': 'people'
    }

    let url: string | null = null
    let label = reason

    if (STANDALONE_ROUTES[destination]) {
      url = STANDALONE_ROUTES[destination]
    }
    else if (destination === 'personnel_detail') {
      if (!recordId) return { success: false, error: 'Personel ID gerekli' }
      url = `/personnel/${recordId}`
    }
    else if (COMPANY_TAB_MAP[destination]) {
      let workspaceId = recordId
      if (!workspaceId) {
        workspaceId = await getActiveWorkspaceId(context)
        if (!workspaceId) return { success: false, error: 'Aktif bir firma workspace bulunamadi. Once bir firma olusturun.' }
      }
      url = `/companies/${workspaceId}?tab=${COMPANY_TAB_MAP[destination]}`
    }
    else if (destination === 'company_detail' || destination === 'active_company') {
      let workspaceId = recordId
      if (!workspaceId) {
        workspaceId = await getActiveWorkspaceId(context)
        if (!workspaceId) return { success: false, error: 'Aktif bir firma workspace bulunamadi.' }
      }
      url = `/companies/${workspaceId}`
    }
    else if (destination === 'risk_analysis_list') {
      const workspaceId = await getActiveWorkspaceId(context)
      url = workspaceId ? `/companies/${workspaceId}?tab=risk` : '/risk-analysis'
    }
    else if (destination === 'new_risk_analysis') {
      const workspaceId = await getActiveWorkspaceId(context)
      url = workspaceId ? `/risk-analysis?companyId=${workspaceId}` : '/risk-analysis'
    }
    else if (destination === 'latest_risk_assessment') {
      const { data: last } = await context.supabase
        .from('risk_assessments')
        .select('id, title, method, assessment_date, company_workspace_id')
        .eq('organization_id', context.user.organization_id)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!last) return { success: false, error: 'Henuz risk analizi olusturulmamis.' }
      url = last.company_workspace_id
        ? `/risk-analysis?companyId=${last.company_workspace_id}&loadId=${last.id}`
        : `/risk-analysis?loadId=${last.id}`
      label = `${last.title || 'Son analiz'} (${last.method})`
    }
    else if (destination === 'specific_risk_assessment') {
      if (!recordId) return { success: false, error: 'Risk analizi ID gerekli' }
      const workspaceId = await getActiveWorkspaceId(context)
      url = workspaceId
        ? `/risk-analysis?companyId=${workspaceId}&loadId=${recordId}`
        : `/risk-analysis?loadId=${recordId}`
    }
    else if (destination === 'incident_detail') {
      if (!recordId) return { success: false, error: 'Olay ID gerekli' }
      url = `/incidents/${recordId}`
    }
    else if (destination === 'document_detail') {
      if (!recordId) return { success: false, error: 'Dokuman ID gerekli' }
      url = `/documents/${recordId}`
    }
    else if (destination === 'training_detail') {
      if (!recordId) return { success: false, error: 'Egitim ID gerekli' }
      url = `/training/${recordId}`
    }
    else {
      return { success: false, error: `Bilinmeyen hedef: ${destination}` }
    }

    if (!url) return { success: false, error: 'URL olusturulamadi' }

    return {
      success: true,
      data: { action: 'navigate', url, label, reason, destination, auto_navigate: false }
    }
  } catch (err: any) {
    return { success: false, error: `Navigation error: ${err.message}` }
  }
}

async function executeTool(toolName: string, input: any, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now()
  let result: ToolResult

  try {
    const isReadMode = context.session.mode === 'read'
    const isBlockedInPhaseOne = PHASE1_BLOCKED_TOOLS.includes(toolName)
    const isDraftTool = PHASE1_DRAFT_TOOLS.includes(toolName)

    if (isBlockedInPhaseOne || (isReadMode && isDraftTool)) {
      result = {
        success: false,
        error: context.session.language === 'en'
          ? 'This Nova phase only supports read-only and draft-preparation actions.'
          : 'Nova’nin bu fazi yalnizca salt-okunur ve taslak hazirlama aksiyonlarini destekler.',
      }
    } else {
      const normalizedInput =
        isDraftTool
          ? { ...(input || {}), confirmed: false }
          : input

      switch (toolName) {
        case 'search_legislation':
          result = await executeSearchLegislation(normalizedInput, context)
          break
        case 'get_personnel_count':
          result = await executeGetPersonnelCount(normalizedInput, context)
          break
        case 'get_recent_assessments':
          result = await executeGetRecentAssessments(normalizedInput, context)
          break
        case 'search_past_answers':
          result = await executeSearchPastAnswers(normalizedInput, context)
          break
        case 'get_proactive_operations':
          result = await executeGetProactiveOperations(normalizedInput, context)
          break
        case 'save_memory_note':
          result = await executeSaveMemoryNote(normalizedInput, context)
          break
        case 'get_active_workflows':
          result = await executeGetActiveWorkflows(normalizedInput, context)
          break
        case 'complete_workflow_step':
          result = await executeCompleteWorkflowStep(normalizedInput, context)
          break
        case 'confirm_pending_action':
          result = await executeConfirmPendingAction(normalizedInput, context)
          break
        case 'cancel_pending_action':
          result = await executeCancelPendingAction(normalizedInput, context)
          break
        case 'navigate_to_page':
          result = await executeNavigateToPage(normalizedInput, context)
          break
        case 'create_training_plan':
          result = await executeCreateTrainingPlan(normalizedInput, context)
          break
        case 'create_planner_task':
          result = await executeCreatePlannerTask(normalizedInput, context)
          break
        case 'create_incident_draft':
          result = await executeCreateIncidentDraft(normalizedInput, context)
          break
        case 'create_document_draft':
          result = await executeCreateDocumentDraft(normalizedInput, context)
          break
        default:
          result = { success: false, error: `Bilinmeyen tool: ${toolName}` }
      }
    }
  } catch (err: any) {
    result = { success: false, error: `Tool hatası: ${err.message}` }
  }

  const duration = Date.now() - startTime
  await logToolCall(context, toolName, input, result, duration)
  return result
}

async function logToolCall(
  context: ToolContext,
  toolName: string,
  input: any,
  result: ToolResult,
  durationMs: number
) {
  try {
    await context.supabase.from('agent_tool_calls').insert({
      session_id: context.session.id,
      user_id: context.user.id,
      organization_id: context.user.organization_id,
      tool_name: toolName,
      tool_input: input,
      tool_output: result.success ? result.data : null,
      status: result.success ? 'success' : 'error',
      error_message: result.error,
      duration_ms: durationMs
    })
  } catch (err) {
    console.error('Failed to log tool call:', err)
  }
}

// ============================================================================
// NAVIGATION EXTRACTOR
// ============================================================================

function extractNavigation(_toolsUsed: string[], messages: any[]): any | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!Array.isArray(msg.content)) continue

    for (const block of msg.content) {
      if (block?.type !== 'tool_result') continue

      try {
        let parsedContent: any = block.content

        // block.content string ise parse et
        if (typeof parsedContent === 'string') {
          parsedContent = JSON.parse(parsedContent)
        }
        // block.content array ise (Claude'un yeni formatı) ilk text block'u al
        else if (Array.isArray(parsedContent)) {
          const textBlock = parsedContent.find((b: any) => b?.type === 'text')
          if (textBlock?.text) {
            parsedContent = JSON.parse(textBlock.text)
          }
        }

        if (parsedContent?.success && parsedContent?.data?.action === 'navigate') {
          return parsedContent.data
        }

        if (parsedContent?.success && parsedContent?.data?.navigation?.action === 'navigate') {
          return parsedContent.data.navigation
        }
      } catch (e) {
        continue
      }
    }
  }
  return null
}

// ============================================================================
// SEMANTIC CACHE (OpenAI Embeddings + pgvector)
// ============================================================================

async function generateEmbedding(text: string, openai: OpenAI): Promise<number[] | null> {
  try {
    const resilientResponse = await executeWithResilience({
      serviceKey: 'openai.embeddings',
      displayName: 'OpenAI Embeddings',
      serviceType: 'external_api',
      operationName: 'solution_chat_generate_embedding',
      fallbackMessage: 'Embedding servisi gecici olarak kullanilamiyor.',
      onFallback: async () => null,
      operation: () => openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS
      })
    })

    const response = resilientResponse.ok
      ? resilientResponse.data
      : (resilientResponse.fallbackData ?? null)

    return response?.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('Embedding generation error:', err)
    return null
  }
}

function extractFollowUpActions(messages: any[]): any[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!Array.isArray(msg.content)) continue

    for (const block of msg.content) {
      if (block?.type !== 'tool_result') continue

      try {
        let parsedContent: any = block.content

        if (typeof parsedContent === 'string') {
          parsedContent = JSON.parse(parsedContent)
        } else if (Array.isArray(parsedContent)) {
          const textBlock = parsedContent.find((b: any) => b?.type === 'text')
          if (textBlock?.text) {
            parsedContent = JSON.parse(textBlock.text)
          }
        }

        if (parsedContent?.success && Array.isArray(parsedContent?.data?.follow_up_actions)) {
          return parsedContent.data.follow_up_actions
        }
      } catch (_err) {
        continue
      }
    }
  }
  return []
}

function extractWorkflow(messages: any[]): any | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!Array.isArray(msg.content)) continue

    for (const block of msg.content) {
      if (block?.type !== 'tool_result') continue

      try {
        let parsedContent: any = block.content

        if (typeof parsedContent === 'string') {
          parsedContent = JSON.parse(parsedContent)
        } else if (Array.isArray(parsedContent)) {
          const textBlock = parsedContent.find((b: any) => b?.type === 'text')
          if (textBlock?.text) {
            parsedContent = JSON.parse(textBlock.text)
          }
        }

        if (parsedContent?.success && parsedContent?.data?.workflow?.id) {
          return parsedContent.data.workflow
        }

        if (parsedContent?.success && Array.isArray(parsedContent?.data?.workflows) && parsedContent.data.workflows[0]?.id) {
          return parsedContent.data.workflows[0]
        }
      } catch (_err) {
        continue
      }
    }
  }
  return null
}

function extractPendingActionHint(messages: any[]): Record<string, unknown> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!Array.isArray(msg.content)) continue

    for (const block of msg.content) {
      if (block?.type !== 'tool_result') continue

      try {
        let parsedContent: any = block.content

        if (typeof parsedContent === 'string') {
          parsedContent = JSON.parse(parsedContent)
        } else if (Array.isArray(parsedContent)) {
          const textBlock = parsedContent.find((b: any) => b?.type === 'text')
          if (textBlock?.text) {
            parsedContent = JSON.parse(textBlock.text)
          }
        }

        if (parsedContent?.success && parsedContent?.data?.requires_confirmation) {
          return {
            action_run_id: parsedContent.data.action_run_id ?? null,
            action_name: parsedContent.data.action_name ?? null,
            action_title: parsedContent.data.action_title ?? null,
            action_summary: parsedContent.data.action_summary ?? null,
            summary: parsedContent.data.summary ?? null,
            confirmation_prompt: parsedContent.data.confirmation_prompt ?? null,
          }
        }
      } catch (_err) {
        continue
      }
    }
  }

  return null
}

function classifyNovaTaskType(params: {
  deterministicLegalMode?: boolean
  toolsUsed?: string[]
  navigation?: any | null
  workflow?: any | null
  actionHint?: Record<string, unknown> | null
  sources?: any[]
}): string {
  if (params.deterministicLegalMode || (params.sources?.length ?? 0) > 0 || (params.toolsUsed || []).includes('search_legislation')) {
    return 'legal_research_answer'
  }

  if (params.actionHint?.action_name && typeof params.actionHint.action_name === 'string') {
    return params.actionHint.action_name
  }

  if ((params.toolsUsed || []).includes('create_document_draft')) return 'draft_document'
  if ((params.toolsUsed || []).includes('create_incident_draft')) return 'draft_incident'
  if ((params.toolsUsed || []).includes('create_training_plan') || (params.toolsUsed || []).includes('create_planner_task')) {
    return 'draft_training_or_task_plan'
  }
  if (params.workflow?.id) return 'build_followup_workflow'
  if (params.navigation?.action === 'navigate') return 'navigate_to_page'
  if ((params.toolsUsed || []).includes('get_proactive_operations')) return 'summarize_records'

  return 'message'
}

function deriveAgentResponseType(params: {
  actionHint?: Record<string, unknown> | null
  workflow?: any | null
  navigation?: any | null
  toolsUsed?: string[]
}): 'message' | 'tool_preview' | 'draft_ready' | 'workflow_started' {
  if (params.actionHint) return 'tool_preview'
  if ((params.toolsUsed || []).some((tool) => PHASE1_DRAFT_TOOLS.includes(tool))) return 'draft_ready'
  if (params.workflow?.id) return 'workflow_started'
  if (params.navigation?.action === 'navigate') return 'tool_preview'
  return 'message'
}

function buildAgentTelemetry(params: {
  taskType: string
  cacheStatus: 'hit' | 'weak_hit' | 'miss'
  iterations?: number
  toolsUsed?: string[]
  sources?: any[]
  navigation?: any | null
  workflow?: any | null
  actionHint?: Record<string, unknown> | null
  promptTokens?: number
  completionTokens?: number
  answerMode?: string
  jurisdictionCode?: string
  contextSurface?: string
  retrievalTrace?: Record<string, unknown> | null
}) {
  const trace = params.retrievalTrace ?? null
  const exactCount = Array.isArray(trace?.exact) ? trace.exact.length : 0
  const sparseCount = Array.isArray(trace?.sparse) ? trace.sparse.length : 0
  const denseCount = Array.isArray(trace?.dense) ? trace.dense.length : 0
  const rerankedCount = Array.isArray(trace?.reranked) ? trace.reranked.length : 0

  return {
    task_type: params.taskType,
    cache_status: params.cacheStatus,
    iterations: params.iterations ?? 0,
    tools_used: params.toolsUsed ?? [],
    final_source_count: params.sources?.length ?? 0,
    retrieval_candidate_count: exactCount + sparseCount + denseCount,
    final_context_count: rerankedCount,
    prompt_tokens: params.promptTokens ?? 0,
    completion_tokens: params.completionTokens ?? 0,
    answer_mode: params.answerMode ?? null,
    jurisdiction_code: params.jurisdictionCode ?? null,
    context_surface: params.contextSurface ?? null,
    has_navigation: Boolean(params.navigation),
    has_workflow: Boolean(params.workflow?.id),
    has_action_hint: Boolean(params.actionHint),
  }
}

async function requestClaude(
  anthropic: Anthropic,
  payload: Parameters<Anthropic['messages']['create']>[0],
  operationName: string,
): Promise<any | null> {
  const resilientResponse = await executeWithResilience({
    serviceKey: 'anthropic.api.solution_chat',
    displayName: 'Anthropic Solution Chat',
    serviceType: 'external_api',
    operationName,
    fallbackMessage: 'Nova AI servisi gecici olarak yanit vermiyor.',
    onFallback: async () => null,
    operation: () => anthropic.messages.create(payload),
  })

  if (!resilientResponse.ok) {
    return resilientResponse.fallbackData ?? null
  }

  return resilientResponse.data
}

async function checkSemanticCache(
  question: string,
  openai: OpenAI,
  supabase: SupabaseClient
): Promise<{ hit: boolean; answer?: string; sources?: any[]; similarity?: number; isWeakMatch?: boolean }> {
  try {
    const embedding = await generateEmbedding(question, openai)
    if (!embedding) {
      return { hit: false }
    }

    const { data, error } = await supabase.rpc('search_qa_cache', {
      query_embedding: embedding,
      similarity_threshold: CACHE_WEAK_MATCH,
      max_results: 1
    })

    if (error || !data || data.length === 0) {
      return { hit: false }
    }

    const match = data[0]

    if (match.similarity >= CACHE_STRONG_MATCH) {
      await supabase
        .from('ai_qa_learning')
        .update({
          usage_count: (match.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', match.id)

      return {
        hit: true,
        answer: match.answer,
        sources: match.answer_sources,
        similarity: match.similarity,
        isWeakMatch: false
      }
    }

    return {
      hit: false,
      answer: match.answer,
      sources: match.answer_sources,
      similarity: match.similarity,
      isWeakMatch: true
    }
  } catch (err: any) {
    console.error('[checkSemanticCache] Error:', err.message)
    return { hit: false }
  }
}

async function saveToCache(
  question: string,
  answer: string,
  sources: any[],
  openai: OpenAI,
  supabase: SupabaseClient
): Promise<void> {
  try {
    if (question.length < 10 || answer.length < 50) return

    // Fallback mesajlarini cache'e yazma
    if (answer.includes('cevap üretemiyorum') ||
        answer.includes('tekrar deneyin') ||
        answer.startsWith('Üzgünüm, şu an')) {
      return
    }

    const embedding = await generateEmbedding(question, openai)
    if (!embedding) return

    await supabase.from('ai_qa_learning').insert({
      question: question,
      question_embedding: embedding,
      answer: answer,
      answer_sources: sources || [],
      usage_count: 0,
      success_rate: 0
    })
  } catch (err) {
    console.error('Cache save error:', err)
  }
}

async function saveSolutionQueryRecord(params: {
  supabase: SupabaseClient
  userId: string
  organizationId: string
  workspaceId?: string | null
  companyWorkspaceId?: string | null
  queryText: string
  answer: string
  sources: any[]
  responseTokens: number
  sessionId: string
  toolsUsed: string[]
  language: string
  navigation: any | null
  workflow?: any | null
  followUpActions?: any[]
  cached: boolean
  legalRetrieval?: Record<string, unknown> | null
}): Promise<string | null> {
  try {
    const { data, error } = await params.supabase
      .from('solution_queries')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        workspace_id: params.workspaceId ?? null,
        query_text: params.queryText,
        ai_response: params.answer,
        sources_used: params.sources || [],
        response_tokens: params.responseTokens,
        response_metadata: {
          session_id: params.sessionId,
          workspace_id: params.workspaceId ?? null,
          company_workspace_id: params.companyWorkspaceId ?? null,
          tools_used: params.toolsUsed,
          language: params.language,
          navigation: params.navigation,
          workflow: params.workflow ?? null,
          follow_up_actions: params.followUpActions ?? [],
          cached: params.cached,
          legal_retrieval: params.legalRetrieval ?? null,
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error('[saveSolutionQueryRecord] insert failed:', error)
      return null
    }

    return data?.id || null
  } catch (err) {
    console.error('[saveSolutionQueryRecord] unexpected error:', err)
    return null
  }
}

// ============================================================================
// SUBSCRIPTION
// ============================================================================

async function checkSubscriptionLimit(
  userId: string,
  action: 'message' | 'analysis' | 'document',
  supabase: SupabaseClient
): Promise<{ allowed: boolean; message?: string; plan_key?: string; remaining?: number; subscription_id?: string }> {
  const { data, error } = await supabase.rpc('check_subscription_limit', {
    p_user_id: userId,
    p_action: action
  })

  if (error) {
    console.error('Subscription check error:', error)
    return { allowed: false, message: 'Abonelik kontrolü hatası' }
  }

  return {
    allowed: data.allowed,
    message: data.message,
    plan_key: data.plan_key,
    remaining: data.remaining,
    subscription_id: data.subscription_id
  }
}

async function incrementUsage(
  subscriptionId: string,
  userId: string,
  action: string,
  toolName: string | null,
  inputTokens: number,
  outputTokens: number,
  wasCacheHit: boolean,
  supabase: SupabaseClient
): Promise<void> {
  if (!subscriptionId) return
  try {
    await supabase.rpc('increment_usage', {
      p_subscription_id: subscriptionId,
      p_user_id: userId,
      p_action: action,
      p_tool_name: toolName,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_was_cache_hit: wasCacheHit
    })
  } catch (err) {
    console.error('Usage increment error:', err)
  }
}

// ============================================================================
// SESSION
// ============================================================================

async function getOrCreateSession(
  userId: string,
  orgId: string,
  sessionId: string | undefined,
  language: string,
  supabase: SupabaseClient
): Promise<string> {
  if (sessionId) {
    const { data } = await supabase
      .from('agent_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (data) {
      await supabase
        .from('agent_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId)
      return sessionId
    }
  }

  const { data, error } = await supabase
    .from('agent_sessions')
    .insert({
      user_id: userId,
      organization_id: orgId,
      language: language,
      status: 'active'
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Session oluşturulamadı')
  }

  return data.id
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  let requestedLanguage: NovaLanguage = 'tr'

  try {
    const body: ChatRequest = await req.json()
    const parsedBody = chatRequestSchema.safeParse(body)
    if (!parsedBody.success) {
      return await jsonErrorResponse(req, {
        status: 400,
        error: 'invalid_request',
        message: 'Gecersiz istek verisi',
        details: {
          validation: parsedBody.error.flatten(),
        },
      })
    }

    const userMessage = parsedBody.data.message
    requestedLanguage = normalizeNovaLanguage(parsedBody.data.language)
    const answerLanguage = resolveNovaConversationLanguage(
      userMessage,
      parsedBody.data.language,
      parsedBody.data.history,
    )
    const operationalLanguage = getOperationalLanguage(answerLanguage)
    const asOfDate = resolveAsOfDate(parsedBody.data.as_of_date)
    const answerMode = parsedBody.data.answer_mode ?? 'extractive'
    const requestMode = parsedBody.data.mode ?? 'agent'
    const contextSurface = parsedBody.data.context_surface ?? 'solution_center'

    if (!userMessage || userMessage.trim().length === 0) {
      return await jsonErrorResponse(req, {
        status: 400,
        error: 'empty_message',
        message: 'Mesaj bos olamaz',
      })
    }

    if (!userMessage || userMessage.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Mesaj boş olamaz' }),
        { status: 400, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    const internalAuthHeader = req.headers.get('x-nova-internal-auth')
    const internalUserId = req.headers.get('x-nova-user-id')
    const internalOrganizationId = req.headers.get('x-nova-organization-id')
    const bodyRecord = body as unknown as Record<string, unknown>
    const internalBodyToken = typeof bodyRecord.internal_auth_token === 'string'
      ? String(bodyRecord.internal_auth_token)
      : null
    const internalBodyUserId = typeof bodyRecord.internal_user_id === 'string'
      ? String(bodyRecord.internal_user_id)
      : null
    const internalBodyOrganizationId = typeof bodyRecord.internal_organization_id === 'string'
      ? String(bodyRecord.internal_organization_id)
      : null
    const effectiveInternalToken = internalAuthHeader || internalBodyToken
    const effectiveInternalUserId = internalUserId || internalBodyUserId
    const effectiveInternalOrganizationId = internalOrganizationId || internalBodyOrganizationId
    const internalAuthAllowed =
      !!effectiveInternalToken &&
      effectiveInternalToken === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') &&
      !!effectiveInternalUserId &&
      !!effectiveInternalOrganizationId

    if (!authHeader && !internalAuthAllowed) {
      return await jsonErrorResponse(req, {
        status: 401,
        error: 'missing_auth',
        message: 'Yetkilendirme gerekli',
      })
    }

    // Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      authHeader
        ? { global: { headers: { Authorization: authHeader } } }
        : undefined
    )

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!
    })

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    })

    let user: { id: string } | null = null
    let authError: { message?: string } | null = null

    if (internalAuthAllowed) {
      user = { id: effectiveInternalUserId! }
      body.organization_id = effectiveInternalOrganizationId!
    } else {
      const authResult = await supabase.auth.getUser(
        authHeader!.replace('Bearer ', '')
      )
      user = authResult.data.user
      authError = authResult.error
    }

    if (authError || !user) {
      return await jsonErrorResponse(req, {
        status: 401,
        error: 'auth_failed',
        message: 'Kullanici dogrulanamadi',
        details: {
          auth_error: authError?.message ?? null,
        },
      })
    }

    // Subscription kontrolü
    const subCheck = await checkSubscriptionLimit(user.id, 'message', supabase)

    if (!subCheck.allowed) {
      return await jsonErrorResponse(req, {
        status: 429,
        error: 'subscription_limit',
        message: subCheck.message || 'Aylik mesaj limitiniz doldu',
        details: {
          plan_key: subCheck.plan_key ?? null,
          remaining: subCheck.remaining ?? null,
        },
        userId: user.id,
        organizationId: body.organization_id ?? null,
      })
    }

    if (!subCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'subscription_limit',
          message: subCheck.message || 'Aylık mesaj limitiniz doldu',
          plan_key: subCheck.plan_key
        }),
        { status: 429, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { data: aiDailyLimitData, error: aiDailyLimitError } = await supabase.rpc('resolve_ai_daily_limit', {
      p_user_id: user.id,
    })

    const aiDailyLimitRow = Array.isArray(aiDailyLimitData) ? aiDailyLimitData[0] : aiDailyLimitData
    const aiDailyLimit = Number(aiDailyLimitRow?.daily_limit ?? 25)
    const aiPlanKey = String(aiDailyLimitRow?.plan_key ?? subCheck.plan_key ?? 'free')

    if (aiDailyLimitError) {
      console.error('[solution-chat] resolve_ai_daily_limit failed:', aiDailyLimitError)
    }

    const { data: aiRateData, error: aiRateError } = await supabase.rpc('consume_rate_limit', {
      p_user_id: user.id,
      p_endpoint: '/functions/v1/solution-chat',
      p_scope: 'ai',
      p_limit_count: aiDailyLimit,
      p_window_seconds: 86400,
      p_plan_key: aiPlanKey,
      p_organization_id: body.organization_id ?? null,
      p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      p_user_agent: req.headers.get('user-agent') ?? null,
      p_metadata: { source: 'solution-chat' },
    })

    if (aiRateError) {
      console.error('[solution-chat] consume_rate_limit failed:', aiRateError)
    }

    const aiRateRow = Array.isArray(aiRateData) ? aiRateData[0] : aiRateData
    if (aiRateRow && aiRateRow.allowed !== true) {
      return await jsonErrorResponse(req, {
        status: 429,
        error: 'rate_limit_exceeded',
        message: 'Gunluk AI limitiniz doldu. Lutfen daha sonra tekrar deneyin.',
        details: {
          remaining: Number(aiRateRow.remaining ?? 0),
          reset_at: aiRateRow.reset_at ?? null,
        },
        userId: user.id,
        organizationId: body.organization_id ?? null,
      })
    }

    if (aiRateRow && aiRateRow.allowed !== true) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: 'Gunluk AI limitiniz doldu. Lutfen daha sonra tekrar deneyin.',
          remaining: Number(aiRateRow.remaining ?? 0),
          reset_at: aiRateRow.reset_at ?? null,
        }),
        { status: 429, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const allowedTools = subData?.subscription_plans?.allowed_tools || ['search_legislation']
    const deterministicLegalMode = shouldUseDeterministicLegalMode(userMessage)
    const jurisdictionCode = await resolveJurisdictionCode(
      supabase,
      body.workspace_id ?? null,
      parsedBody.data.jurisdiction_code ?? null,
    )

    // Session
    const sessionId = await getOrCreateSession(
      user.id,
      body.organization_id,
      body.session_id,
      answerLanguage,
      supabase
    )

    // ========================================================================
    // STEP 1: Semantic Cache Check (Embedding)
    // ========================================================================

    const cacheResult = deterministicLegalMode
      ? { hit: false as const }
      : await checkSemanticCache(userMessage, openai, supabase)

    if (cacheResult.hit && cacheResult.answer) {
      // Güçlü eşleşme: direkt cache'den dön
      await incrementUsage(
        subCheck.subscription_id!,
        user.id,
        'message',
        null,
        0, 0, true,
        supabase
      )

      const queryId = await saveSolutionQueryRecord({
        supabase,
        userId: user.id,
        organizationId: body.organization_id,
        workspaceId: body.workspace_id ?? null,
        companyWorkspaceId: body.company_workspace_id ?? null,
        queryText: userMessage,
        answer: cacheResult.answer,
        sources: cacheResult.sources || [],
        responseTokens: 0,
        sessionId,
        toolsUsed: ['cache_hit'],
        language: answerLanguage,
        navigation: null,
        workflow: null,
        followUpActions: [],
        cached: true,
        legalRetrieval: null,
      })

      const cacheTelemetry = buildAgentTelemetry({
        taskType: classifyNovaTaskType({
          sources: cacheResult.sources || [],
        }),
        cacheStatus: 'hit',
        toolsUsed: ['cache_hit'],
        sources: cacheResult.sources || [],
        answerMode,
        jurisdictionCode,
        contextSurface,
      })

      await logEdgeAiUsage({
        userId: user.id,
        organizationId: body.organization_id,
        model: 'semantic-cache',
        endpoint: '/functions/v1/solution-chat',
        promptTokens: 0,
        completionTokens: 0,
        success: true,
        metadata: {
          sessionId,
          similarity: cacheResult.similarity,
          ...cacheTelemetry,
        },
      })

      return new Response(
        JSON.stringify({
          type: 'message',
          answer: cacheResult.answer,
          sources: cacheResult.sources || [],
          similarity: cacheResult.similarity,
          session_id: sessionId,
          query_id: queryId,
          jurisdiction_code: jurisdictionCode,
          cached: true,
          telemetry: cacheTelemetry,
        }),
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // ========================================================================
    // STEP 2: Claude Tool Use Loop
    // ========================================================================

    let systemPrompt = getSystemPrompt(answerLanguage)

    systemPrompt += operationalLanguage === 'tr'
      ? `\n\n## NOVA AKSIYON MODU\nNova yalnizca bilgi veren bir asistan degil, kontrollu bir operasyon ajanidir.\n- Kullanici planla, gorev olustur, olay baslat, dokuman taslagi hazirla, takvime ekle, baslat veya yonlendir gibi bir is istediginde uygun tool'u kullan.\n- Egitim planlama taleplerinde create_training_plan; genel gorevlerde create_planner_task; yeni olaylarda create_incident_draft; editor taslaklarinda create_document_draft kullan.\n- Benzer sorularda search_past_answers ile onceki basarili cevaplari ve kullanicinin gecmisini kontrol et.\n- Kullanici kalici bir tercih, tekrar eden operasyon kalibi veya firma icin uzun omurlu bir not verirse save_memory_note ile hafizaya al.\n- Kullanici \"sirada ne var\", \"ne kaldi\", \"devam edelim\", \"bugun bende ne var\" gibi ifadeler kullanirsa once get_proactive_operations; aktif akis odakliysa get_active_workflows kullan.\n- Kullanici bir adimi tamamladigini soyluyorsa complete_workflow_step ile ilgili adimi kapat ve siradaki adimi sun.\n- Kritik kayit acan islemlerde ilk adimda islemi hemen tamamlama; once bekleyen aksiyon hazirla ve acik kullanici onayi bekle.\n- Kullanici acikca \"onayliyorum\", \"devam et\", \"uygula\" derse confirm_pending_action kullan. \"Iptal et\", \"vazgectim\" derse cancel_pending_action kullan.\n- Kullanici tarihi dogal dilde soylese bile tool'a YYYY-MM-DD formatinda aktar.\n- Bilgi yeterliyse islemi hazirla; kritik eksik varsa sadece kisa ve net ek bilgi sor.\n- Islem tamamlandiginda sonucu ozetle, workflow ve sonraki adimlari belirt, gerekiyorsa kullaniciyi ilgili sayfaya yonlendir.\n- Mevzuat yorumunda mutlaka arama tool'lariyla dogrula; tercih ve operasyon bilgisini hafizada tut ama mevzuati ezberden uydurma.\n- Ogrenme sinyallerini ve firma hafizasini kullanarak ayni tur operasyonlarda daha iyi takip zinciri oner.`
      : `\n\n## NOVA ACTION MODE\nNova is not just an informational assistant; it is a controlled operations agent.\n- When the user asks to plan, create tasks, start incidents, draft documents, schedule, start, or navigate, use the most appropriate tool.\n- Use create_training_plan for training scheduling, create_planner_task for general tasks, create_incident_draft for incidents, and create_document_draft for editor drafts.\n- Use search_past_answers to inspect previous successful answers and the user's own history for recurring requests.\n- Use save_memory_note only for durable user preferences, repeated company patterns, or stable operational notes.\n- When the user asks what is next, what remains, how to continue, or what needs attention today, use get_proactive_operations first; when the request is about an active operational chain, use get_active_workflows.\n- When the user says a step is done, use complete_workflow_step to close the current step and surface the next one.\n- For critical record-creating operations, do not complete the action immediately on the first turn; prepare a pending action and wait for explicit approval.\n- When the user clearly says approve, go ahead, or proceed, use confirm_pending_action. When the user cancels or declines, use cancel_pending_action.\n- Convert natural language dates into YYYY-MM-DD before calling tools.\n- If the information is sufficient, prepare the action; only ask a short follow-up when a critical field is missing.\n- After completing an action, summarize the result, mention the workflow and next steps, and guide the user to the relevant page when useful.\n- Use tools to verify legislation; keep operational preferences in memory, but never invent regulatory content from memory.\n- Use learning signals and company memory to suggest better follow-up chains for recurring operational work.`

    // Zayıf cache eşleşmesi varsa, Claude'a ipucu olarak ver
    if (cacheResult.isWeakMatch && cacheResult.answer) {
      systemPrompt += `\n\n## GEÇMİŞ BENZER SORU (Referans olarak kullan)
Benzer bir soruya daha önce şu cevap verilmiş:
"${cacheResult.answer.substring(0, 500)}"

Bu referansı kullanabilirsin ama mutlaka güncel tool sonuçlarıyla doğrula.`
    }

    const phaseTools = requestMode === 'read'
      ? PHASE1_READ_ONLY_TOOLS
      : [...PHASE1_READ_ONLY_TOOLS, ...PHASE1_DRAFT_TOOLS]
    const availableTools = NOVA_TOOLS.filter(tool =>
      phaseTools.includes(tool.name) ||
      allowedTools.includes(tool.name) ||
      allowedTools.includes('*')
    )

    const messages: any[] = [
      ...(body.history || []).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage }
    ]

    const toolContext: ToolContext = {
      user: {
        id: user.id,
        organization_id: body.organization_id,
        role: 'ohs_specialist',
        preferred_language: answerLanguage
      },
      subscription: {
        plan_key: subCheck.plan_key || 'free',
        allowed_tools: allowedTools,
        subscription_id: subCheck.subscription_id || ''
      },
      supabase: supabase,
      session: {
        id: sessionId,
        language: operationalLanguage,
        answer_language: answerLanguage,
        as_of_date: asOfDate,
        answer_mode: answerMode,
        mode: requestMode,
        context_surface: contextSurface,
        confirmation_token: parsedBody.data.confirmation_token ?? null,
        jurisdiction_code: jurisdictionCode,
        workspace_id: body.workspace_id ?? null,
        company_workspace_id: body.company_workspace_id ?? null
      }
    }

    const inferredPendingAction = !parsedBody.data.confirmation_token
      ? await inferPendingActionResolution(userMessage, toolContext)
      : null
    const confirmationToken = parsedBody.data.confirmation_token ?? inferredPendingAction?.actionId ?? null
    const confirmationAction = parsedBody.data.confirmation_action ?? inferredPendingAction?.action ?? null
    const confirmationSource = parsedBody.data.confirmation_token ? 'explicit' : inferredPendingAction ? 'natural_language' : null

    if (confirmationToken && confirmationAction) {
      const confirmationResult = confirmationAction === 'cancel'
        ? await executeCancelPendingAction({
            action_id: confirmationToken,
            reason: userMessage,
          }, toolContext)
        : await executeConfirmPendingAction({
            action_id: confirmationToken,
            idempotency_key: parsedBody.data.idempotency_key ?? null,
          }, toolContext)

      const confirmationData =
        confirmationResult.data && typeof confirmationResult.data === 'object'
          ? confirmationResult.data
          : {}
      const navigation = confirmationData.navigation ?? null
      const workflow = confirmationData.workflow ?? null
      const followUpActions = Array.isArray(confirmationData.follow_up_actions)
        ? confirmationData.follow_up_actions
        : []
      const answer = confirmationResult.success
        ? String(confirmationData.summary || confirmationData.action_summary || 'Nova aksiyonu tamamlandi.')
        : String(confirmationResult.error || 'Nova aksiyonu tamamlanamadi.')
      const taskType = classifyNovaTaskType({
        toolsUsed: [
          confirmationAction === 'cancel'
            ? 'cancel_pending_action'
            : String(confirmationData.action_name || 'confirm_pending_action'),
        ],
        navigation,
        workflow,
        sources: [],
      })
      const telemetry = buildAgentTelemetry({
        taskType,
        cacheStatus: 'miss',
        toolsUsed: [confirmationAction === 'cancel' ? 'cancel_pending_action' : 'confirm_pending_action'],
        actionHint:
          confirmationData.action_name
            ? {
                action_name: confirmationData.action_name,
                action_title: confirmationData.action_title ?? null,
              }
            : null,
        sources: [],
        navigation,
        workflow,
        promptTokens: 0,
        completionTokens: 0,
        answerMode,
        jurisdictionCode,
        contextSurface,
      })
      const responseType = confirmationResult.success
        ? deriveAgentResponseType({
            workflow,
            navigation,
            toolsUsed: [confirmationAction === 'cancel' ? 'cancel_pending_action' : 'confirm_pending_action'],
          })
        : 'safety_block'

      const queryId = await saveSolutionQueryRecord({
        supabase,
        userId: user.id,
        organizationId: body.organization_id,
        workspaceId: body.workspace_id ?? null,
        companyWorkspaceId: body.company_workspace_id ?? null,
        queryText: userMessage,
        answer,
        sources: [],
        responseTokens: 0,
        sessionId,
        toolsUsed: [confirmationAction === 'cancel' ? 'cancel_pending_action' : 'confirm_pending_action'],
        language: answerLanguage,
        navigation,
        workflow,
        followUpActions,
        cached: false,
        legalRetrieval: null,
      })

      await logEdgeAiUsage({
        userId: user.id,
        organizationId: body.organization_id,
        model: 'nova-action-executor',
        endpoint: '/functions/v1/solution-chat',
        promptTokens: 0,
        completionTokens: 0,
        success: confirmationResult.success,
        metadata: {
          sessionId,
          actionRunId: confirmationData.action_run_id ?? confirmationToken,
          confirmationAction,
          confirmationSource,
          ...telemetry,
        },
      })

      if (workflow?.id && queryId) {
        await attachWorkflowsToQuery(sessionId, user.id, queryId, supabase)
      }

      return new Response(
        JSON.stringify({
          type: responseType,
          answer,
          navigation,
          workflow,
          follow_up_actions: followUpActions,
          tools_used: [confirmationAction === 'cancel' ? 'cancel_pending_action' : 'confirm_pending_action'],
          session_id: sessionId,
          query_id: queryId,
          cached: false,
          jurisdiction_code: jurisdictionCode,
          telemetry,
          ...(confirmationResult.success
            ? {}
            : {
                safety_block: {
                  code: 'nova_action_execution_failed',
                  title: operationalLanguage === 'en' ? 'Nova action could not run' : 'Nova aksiyonu calistirilamadi',
                  message: answer,
                },
              }),
        }),
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (deterministicLegalMode) {
      const legalAnswer = await buildDeterministicLegalAnswer(userMessage, toolContext, openai, anthropic)
      const retrievalRunId = await saveLegalRetrievalRun({
        supabase,
        userId: user.id,
        organizationId: body.organization_id,
        workspaceId: body.workspace_id ?? null,
        queryText: userMessage,
        asOfDate,
        answerMode,
        trace: legalAnswer.trace,
        answerPreview: legalAnswer.answer,
        confidence: legalAnswer.confidence,
      })

      await incrementUsage(
        subCheck.subscription_id!,
        user.id,
        'message',
        'search_legislation',
        0,
        0,
        false,
        supabase
      )

      const legalTaskType = classifyNovaTaskType({
        deterministicLegalMode: true,
        sources: legalAnswer.sources,
        toolsUsed: ['deterministic_legal_answer'],
      })
      const legalTelemetry = buildAgentTelemetry({
        taskType: legalTaskType,
        cacheStatus: 'miss',
        toolsUsed: ['deterministic_legal_answer'],
        sources: legalAnswer.sources,
        answerMode,
        jurisdictionCode,
        contextSurface,
        retrievalTrace: legalAnswer.trace,
      })

      await logEdgeAiUsage({
        userId: user.id,
        organizationId: body.organization_id,
        model: 'deterministic-legal-engine',
        endpoint: '/functions/v1/solution-chat',
        promptTokens: 0,
        completionTokens: 0,
        success: true,
        metadata: {
          retrievalMode: legalAnswer.retrievalMode,
          confidence: legalAnswer.confidence,
          retrievalRunId,
          answerMode,
          asOfDate,
          jurisdictionCode,
          sessionId,
          ...legalTelemetry,
        },
      })

      const queryId = await saveSolutionQueryRecord({
        supabase,
        userId: user.id,
        organizationId: body.organization_id,
        workspaceId: body.workspace_id ?? null,
        companyWorkspaceId: body.company_workspace_id ?? null,
        queryText: userMessage,
        answer: legalAnswer.answer,
        sources: legalAnswer.sources,
        responseTokens: 0,
        sessionId,
        toolsUsed: ['deterministic_legal_answer'],
        language: answerLanguage,
        navigation: null,
        workflow: null,
        followUpActions: [],
        cached: false,
        legalRetrieval: {
          retrieval_run_id: retrievalRunId,
          mode: legalAnswer.retrievalMode,
          confidence: legalAnswer.confidence,
          as_of_date: asOfDate,
          answer_mode: answerMode,
          jurisdiction_code: jurisdictionCode,
        },
      })

      return new Response(
        JSON.stringify({
          type: 'message',
          answer: legalAnswer.answer,
          sources: legalAnswer.sources,
          confidence: legalAnswer.confidence,
          retrieval_run_id: retrievalRunId,
          as_of_date: asOfDate,
          answer_mode: answerMode,
          jurisdiction_code: jurisdictionCode,
          session_id: sessionId,
          query_id: queryId,
          cached: false,
          telemetry: {
            ...legalTelemetry,
            retrieval_mode: legalAnswer.retrievalMode,
            confidence: legalAnswer.confidence,
            retrieval_run_id: retrievalRunId,
          },
        }),
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const intentRoutingContext = buildIntentRoutingContext(userMessage, operationalLanguage)
    const regulatoryReasoningContext = buildRegulatoryReasoningContext(userMessage, operationalLanguage)

    const [userMemory, storedMemory, longTermProfileMemory, strategicMemorySnapshotContext, learningSignalContext, workspaceMemory, activeWorkflowMemory, workflowOrchestrationContext, pendingActionMemory, learnedAnswerContext] = await Promise.all([
      buildUserPreferenceContext(toolContext),
      buildStoredMemoryContext(toolContext),
      buildLongTermProfileContext(toolContext),
      buildStrategicMemorySnapshotContext(toolContext),
      buildLearningSignalContext(toolContext),
      buildActiveWorkspaceContext(toolContext),
      buildActiveWorkflowContext(toolContext),
      buildWorkflowOrchestrationContext(toolContext),
      buildPendingActionContext(toolContext),
      buildLearnedAnswerContext(userMessage, toolContext),
    ])

    if (intentRoutingContext) {
      systemPrompt += `\n\n${intentRoutingContext}`
    }

    if (userMemory) {
      systemPrompt += `\n\n${userMemory}`
    }

    if (storedMemory) {
      systemPrompt += `\n\n${storedMemory}`
    }

    if (longTermProfileMemory) {
      systemPrompt += `\n\n${longTermProfileMemory}`
    }

    if (strategicMemorySnapshotContext) {
      systemPrompt += `\n\n${strategicMemorySnapshotContext}`
    }

    if (learningSignalContext) {
      systemPrompt += `\n\n${learningSignalContext}`
    }

    if (workspaceMemory) {
      systemPrompt += `\n\n${workspaceMemory}`
    }

    if (activeWorkflowMemory) {
      systemPrompt += `\n\n${activeWorkflowMemory}`
    }

    if (workflowOrchestrationContext) {
      systemPrompt += `\n\n${workflowOrchestrationContext}`
    }

    if (pendingActionMemory) {
      systemPrompt += `\n\n${pendingActionMemory}`
    }

    if (regulatoryReasoningContext) {
      systemPrompt += `\n\n${regulatoryReasoningContext}`
    }

    if (learnedAnswerContext) {
      systemPrompt += `\n\n${learnedAnswerContext}`
    }

    // Tool Use Loop
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let finalAnswer = ''
    const toolsUsed: string[] = []
    let sources: any[] = []
    let iterations = 0
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      const response = await requestClaude(
        anthropic,
        {
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          system: systemPrompt,
          tools: availableTools as any,
          messages: messages
        },
        'solution_chat_main_loop',
      )

      if (!response) {
        finalAnswer = operationalLanguage === 'tr'
          ? 'Nova AI servisi gecici olarak kullanilamiyor. Elle devam edebilir veya biraz sonra tekrar deneyebilirsiniz.'
          : 'Nova AI is temporarily unavailable. You can continue manually or try again shortly.'
        break
      }

      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens

      if (response.stop_reason === 'tool_use') {
        // Response içindeki TÜM tool_use bloklarını bul
        const toolUseBlocks = response.content.filter((c: any) => c.type === 'tool_use')

        if (toolUseBlocks.length === 0) break

        // Her tool'u paralel execute et
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block: any) => {
            const result = await executeTool(block.name, block.input, toolContext)
            toolsUsed.push(block.name)

            // Sources collection (search_legislation için)
            if (block.name === 'search_legislation' && result.success && result.data?.results) {
              sources = sources.concat(result.data.results)
            }

            return {
              tool_use_id: block.id,
              tool_name: block.name,
              result: result
            }
          })
        )

        // Asistan mesajını ekle (tüm tool_use blokları dahil)
        messages.push({ role: 'assistant', content: response.content })

        // TÜM tool_result bloklarını TEK user mesajında gönder
        messages.push({
          role: 'user',
          content: toolResults.map((tr: { tool_use_id: string; result: ToolResult }) => ({
            type: 'tool_result',
            tool_use_id: tr.tool_use_id,
            content: JSON.stringify(tr.result)
          }))
        })

        continue
      }

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((c: any) => c.type === 'text')
        finalAnswer = textBlock ? (textBlock as any).text : ''
        break
      }

      break
    }

    // Loop max iterasyona takıldıysa Claude'a tool'suz son çağrı
    if (!finalAnswer && iterations >= MAX_TOOL_ITERATIONS) {
      try {
        const fallbackResponse = await requestClaude(
          anthropic,
          {
            model: ANTHROPIC_MODEL,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE,
            system: systemPrompt + '\n\nONEMLI: Artik tool kullanma. Simdiye kadar topladigin bilgilerle kullanicinin sorusunu cevapla. Eger yeterli bilgi bulamadiysan, bunu durust bir sekilde soyle. Bos cevap verme.',
            messages: messages
          },
          'solution_chat_final_fallback',
        )

        if (!fallbackResponse) {
          finalAnswer = operationalLanguage === 'tr'
            ? 'Nova AI servisi gecici olarak kullanilamiyor. Elle devam edebilir veya daha sonra tekrar deneyebilirsiniz.'
            : 'Nova AI is temporarily unavailable. Please continue manually or try again later.'
        }

        totalInputTokens += fallbackResponse.usage.input_tokens
        totalOutputTokens += fallbackResponse.usage.output_tokens

        const fallbackText = fallbackResponse.content.find((c: any) => c.type === 'text')
        if (fallbackText) {
          finalAnswer = (fallbackText as any).text
        }
      } catch (fallbackErr) {
        console.error('Fallback call failed:', fallbackErr)
      }
    }

    if (!finalAnswer) {
      finalAnswer = 'Üzgünüm, şu an cevap üretemiyorum. Lütfen sorunuzu tekrar deneyin.'
    }

    // ========================================================================
    // STEP 3: Save + Increment
    // ========================================================================

    // Cache'e kaydet (asenkron, bekleme)
    saveToCache(userMessage, finalAnswer, sources, openai, supabase).catch(err =>
      console.error('Cache save error:', err)
    )

    // Sayaçları artır
    await incrementUsage(
      subCheck.subscription_id!,
      user.id,
      'message',
      toolsUsed[0] || null,
      totalInputTokens,
      totalOutputTokens,
      false,
      supabase
    )

    const navigation = extractNavigation(toolsUsed, messages)
    const workflow = extractWorkflow(messages)
    const followUpActions = extractFollowUpActions(messages)
    const actionHint = extractPendingActionHint(messages)
    const taskType = classifyNovaTaskType({
      toolsUsed,
      navigation,
      workflow,
      actionHint,
      sources,
    })
    const responseType = deriveAgentResponseType({
      actionHint,
      workflow,
      navigation,
      toolsUsed,
    })
    const telemetry = buildAgentTelemetry({
      taskType,
      cacheStatus: cacheResult.isWeakMatch ? 'weak_hit' : 'miss',
      iterations,
      toolsUsed,
      sources,
      navigation,
      workflow,
      actionHint,
      promptTokens: totalInputTokens,
      completionTokens: totalOutputTokens,
      answerMode,
      jurisdictionCode,
      contextSurface,
    })

    await logEdgeAiUsage({
      userId: user.id,
      organizationId: body.organization_id,
      model: ANTHROPIC_MODEL,
      endpoint: '/functions/v1/solution-chat',
      promptTokens: totalInputTokens,
      completionTokens: totalOutputTokens,
      success: true,
      metadata: {
        sessionId,
        ...telemetry,
      },
    })

    // ========================================================================
    // STEP 4: Response
    // ========================================================================

    const queryId = await saveSolutionQueryRecord({
      supabase,
      userId: user.id,
      organizationId: body.organization_id,
      workspaceId: toolContext.session.workspace_id ?? null,
      companyWorkspaceId: toolContext.session.company_workspace_id ?? null,
      queryText: userMessage,
      answer: finalAnswer,
      sources,
      responseTokens: totalOutputTokens,
      sessionId,
      toolsUsed,
      language: answerLanguage,
      navigation,
      workflow,
      followUpActions,
      cached: false,
      legalRetrieval: null,
    })

    await attachWorkflowsToQuery(sessionId, user.id, queryId, supabase)

    return new Response(
      JSON.stringify({
        type: responseType,
        answer: finalAnswer,
        sources: sources,
        navigation,
        workflow,
        action_hint: actionHint,
        follow_up_actions: followUpActions,
        tools_used: toolsUsed,
        session_id: sessionId,
        query_id: queryId,
        iterations: iterations,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
        cached: false,
        jurisdiction_code: jurisdictionCode,
        remaining_messages: (subCheck.remaining || 0) - 1,
        telemetry,
      }),
      { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Nova error:', error)
    if (isRecoverableNovaInfraError(error)) {
      await logEdgeErrorEvent({
        level: 'warn',
        source: 'solution-chat',
        endpoint: '/functions/v1/solution-chat',
        message: error?.message ?? 'Recoverable Nova infrastructure error',
        context: {
          feature: 'solution_chat',
          recoverable: true,
        },
      })
      const fallback = getRecoverableNovaFallback(requestedLanguage)
      return new Response(
        JSON.stringify({
          type: 'degraded_response',
          answer: fallback.answer,
          sources: [],
          navigation: null,
          workflow: null,
          follow_up_actions: [],
          degraded: true,
          summary: fallback.summary,
        }),
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }
    await logEdgeAiUsage({
      model: ANTHROPIC_MODEL,
      endpoint: '/functions/v1/solution-chat',
      success: false,
      metadata: {
        error: error?.message ?? 'unknown',
      },
    })
    await logEdgeErrorEvent({
      level: 'error',
      source: 'solution-chat',
      endpoint: '/functions/v1/solution-chat',
      message: error?.message ?? 'Nova error',
      stackTrace: error?.stack ?? null,
      context: {
        feature: 'solution_chat',
      },
    })
    return new Response(
      JSON.stringify({
        error: 'Nova hatası',
        message: error.message
      }),
      { status: 500, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// DEPLOY
// ============================================================================
// Komut: supabase functions deploy solution-chat
//
// Gerekli env vars (4 adet):
// - SUPABASE_URL (otomatik)
// - SUPABASE_SERVICE_ROLE_KEY (otomatik)
// - ANTHROPIC_API_KEY (v12'den var)
// - OPENAI_API_KEY (YENI - supabase secrets ile eklenmeli)
//
// OpenAI key ekleme:
// supabase secrets set OPENAI_API_KEY=sk-proj-...


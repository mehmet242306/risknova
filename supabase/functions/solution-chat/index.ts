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

// ============================================================================
// CONFIG
// ============================================================================

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

function buildCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : (ALLOWED_ORIGINS[0] ?? '')

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

const MAX_TOOL_ITERATIONS = 10
const MAX_TOKENS = 4096
const TEMPERATURE = 0.3

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
  company_workspace_id?: string
  language?: string
  history?: Array<{ role: 'user' | 'assistant', content: string }>
}

interface ToolContext {
  user: { id: string; organization_id: string; role: string; preferred_language: string }
  subscription: { plan_key: string; allowed_tools: string[]; subscription_id: string }
  supabase: SupabaseClient
  session: { id: string; language: string }
}

interface ToolResult {
  success: boolean
  data?: any
  error?: string
  error_type?: string
}

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

function getSystemPrompt(language: string): string {
  return language === 'tr' ? NOVA_SYSTEM_PROMPT_TR : NOVA_SYSTEM_PROMPT_EN
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
  }
]

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

async function executeSearchLegislation(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    // Build search_terms array from query string
    const stopWords = new Set(['bir', 'bu', 'ile', 'var', 'olan', 'gibi', 'daha', 'icin', 'olarak', 'nasil', 'kac', 'hangi', 'nedir', 'neler'])
    const searchTerms = (input.query || '')
      .toLowerCase()
      .replace(/[.,;:!?()\d]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 2 && !stopWords.has(w))
      .slice(0, 15)

    if (searchTerms.length === 0) {
      return { success: false, error: 'Arama terimi bulunamadi' }
    }

    // RPC: search_legal_chunks_v2(search_terms text[], result_limit integer)
    const { data, error } = await context.supabase.rpc('search_legal_chunks_v2', {
      search_terms: searchTerms,
      result_limit: input.max_results || 5
    })

    if (error) {
      console.error('search_legal_chunks_v2 error:', error.message)
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
            results: ftData.map((chunk: any) => ({
              law: chunk.doc_title || 'Mevzuat',
              article: chunk.article_number,
              title: chunk.article_title,
              content: (chunk.content || '').substring(0, 500),
              relevance_score: chunk.rank || 0
            }))
          }
        }
      }
      return { success: false, error: 'Mevzuat arama hatasi' }
    }

    return {
      success: true,
      data: {
        count: data?.length || 0,
        results: (data || []).map((chunk: any) => ({
          law: chunk.doc_title || 'Mevzuat',
          article: chunk.article_number,
          title: chunk.article_title,
          content: (chunk.content || '').substring(0, 500),
          relevance_score: chunk.rank || 0
        }))
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

async function executeNavigateToPage(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const destination = input.destination
    const recordId = input.record_id
    const reason = input.reason || 'Sayfaya yonlendiriyorum'

    async function getActiveWorkspaceId(): Promise<string | null> {
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
        workspaceId = await getActiveWorkspaceId()
        if (!workspaceId) return { success: false, error: 'Aktif bir firma workspace bulunamadi. Once bir firma olusturun.' }
      }
      url = `/companies/${workspaceId}?tab=${COMPANY_TAB_MAP[destination]}`
    }
    else if (destination === 'company_detail' || destination === 'active_company') {
      let workspaceId = recordId
      if (!workspaceId) {
        workspaceId = await getActiveWorkspaceId()
        if (!workspaceId) return { success: false, error: 'Aktif bir firma workspace bulunamadi.' }
      }
      url = `/companies/${workspaceId}`
    }
    else if (destination === 'risk_analysis_list') {
      const workspaceId = await getActiveWorkspaceId()
      url = workspaceId ? `/companies/${workspaceId}?tab=risk` : '/risk-analysis'
    }
    else if (destination === 'new_risk_analysis') {
      const workspaceId = await getActiveWorkspaceId()
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
      const workspaceId = await getActiveWorkspaceId()
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
    switch (toolName) {
      case 'search_legislation':
        result = await executeSearchLegislation(input, context)
        break
      case 'get_personnel_count':
        result = await executeGetPersonnelCount(input, context)
        break
      case 'get_recent_assessments':
        result = await executeGetRecentAssessments(input, context)
        break
      case 'navigate_to_page':
        result = await executeNavigateToPage(input, context)
        break
      default:
        result = { success: false, error: `Bilinmeyen tool: ${toolName}` }
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

function extractNavigation(toolsUsed: string[], messages: any[]): any | null {
  if (!toolsUsed.includes('navigate_to_page')) return null

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
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS
    })
    return response.data[0].embedding
  } catch (err) {
    console.error('Embedding generation error:', err)
    return null
  }
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

  try {
    const body: ChatRequest = await req.json()
    const userMessage = body.message
    const language = body.language || 'tr'

    if (!userMessage || userMessage.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Mesaj boş olamaz' }),
        { status: 400, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Yetkilendirme gerekli' }),
        { status: 401, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!
    })

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı doğrulanamadı' }),
        { status: 401, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Subscription kontrolü
    const subCheck = await checkSubscriptionLimit(user.id, 'message', supabase)

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

    // Session
    const sessionId = await getOrCreateSession(
      user.id,
      body.organization_id,
      body.session_id,
      language,
      supabase
    )

    // ========================================================================
    // STEP 1: Semantic Cache Check (Embedding)
    // ========================================================================

    const cacheResult = await checkSemanticCache(userMessage, openai, supabase)

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

      return new Response(
        JSON.stringify({
          type: 'cache_hit',
          answer: cacheResult.answer,
          sources: cacheResult.sources || [],
          similarity: cacheResult.similarity,
          session_id: sessionId,
          cached: true
        }),
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // ========================================================================
    // STEP 2: Claude Tool Use Loop
    // ========================================================================

    let systemPrompt = getSystemPrompt(language)

    // Zayıf cache eşleşmesi varsa, Claude'a ipucu olarak ver
    if (cacheResult.isWeakMatch && cacheResult.answer) {
      systemPrompt += `\n\n## GEÇMİŞ BENZER SORU (Referans olarak kullan)
Benzer bir soruya daha önce şu cevap verilmiş:
"${cacheResult.answer.substring(0, 500)}"

Bu referansı kullanabilirsin ama mutlaka güncel tool sonuçlarıyla doğrula.`
    }

    const FREE_TOOLS = ['search_legislation', 'search_past_answers', 'navigate_to_page']
    const availableTools = NOVA_TOOLS.filter(tool =>
      FREE_TOOLS.includes(tool.name) ||
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
        preferred_language: language
      },
      subscription: {
        plan_key: subCheck.plan_key || 'free',
        allowed_tools: allowedTools,
        subscription_id: subCheck.subscription_id || ''
      },
      supabase: supabase,
      session: {
        id: sessionId,
        language: language
      }
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

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemPrompt,
        tools: availableTools as any,
        messages: messages
      })

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
          content: toolResults.map(tr => ({
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
        const fallbackResponse = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          system: systemPrompt + '\n\nONEMLI: Artik tool kullanma. Simdiye kadar topladigin bilgilerle kullanicinin sorusunu cevapla. Eger yeterli bilgi bulamadiysan, bunu durust bir sekilde soyle. Bos cevap verme.',
          messages: messages
        })

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

    // ========================================================================
    // STEP 4: Response
    // ========================================================================

    return new Response(
      JSON.stringify({
        type: 'response',
        answer: finalAnswer,
        sources: sources,
        navigation: extractNavigation(toolsUsed, messages),
        tools_used: toolsUsed,
        session_id: sessionId,
        iterations: iterations,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
        cached: false,
        remaining_messages: (subCheck.remaining || 0) - 1
      }),
      { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Nova error:', error)
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


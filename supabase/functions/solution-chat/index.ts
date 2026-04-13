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
  session: { id: string; language: string; company_workspace_id?: string | null }
}

interface ToolResult {
  success: boolean
  data?: any
  error?: string
  error_type?: string
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

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  company_workspace_id: z.string().uuid().optional(),
  language: z.enum(['tr', 'en']).optional(),
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

async function getActiveWorkspaceId(
  context: ToolContext,
  preferredWorkspaceId?: string | null,
): Promise<string | null> {
  if (preferredWorkspaceId) return preferredWorkspaceId
  if (context.session.company_workspace_id) return context.session.company_workspace_id

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
          language: context.session.language,
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
          language: context.session.language,
          confidence_score: confidenceScore,
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        return { success: false, error: 'Hafiza notu kaydedilemedi.' }
      }
      resultRow = data
    }

    return {
      success: true,
      data: {
        memory_id: resultRow.id,
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
          language: context.session.language,
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
    await updateActionRunStatus(actionRun.id, {
      status: 'completed',
      confirmed_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      result_snapshot: result.data || null,
    }, context)
  } else {
    await updateActionRunStatus(actionRun.id, {
      status: 'failed',
      confirmed_at: new Date().toISOString(),
      result_snapshot: { error: result.error ?? 'Execution failed' },
    }, context)
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      action_run_id: actionRun.id,
    },
  }
}

async function executeConfirmPendingAction(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const actionId = typeof input.action_id === 'string' ? input.action_id : null
    const actionRun = await findPendingAction(actionId, context)

    if (!actionRun?.id) {
      return {
        success: false,
        error: context.session.language === 'en'
          ? 'There is no pending Nova action waiting for approval.'
          : 'Onay bekleyen bir Nova islemi bulunamadi.',
      }
    }

    return await executeConfirmedPendingAction(actionRun, context)
  } catch (err: any) {
    return { success: false, error: `Hata: ${err.message}` }
  }
}

async function executeCancelPendingAction(input: any, context: ToolContext): Promise<ToolResult> {
  try {
    const actionId = typeof input.action_id === 'string' ? input.action_id : null
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
        cancelled_reason: typeof input.reason === 'string' ? input.reason : null,
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
        navigation: {
          action: 'navigate',
          url: `/companies/${workspaceId}?tab=tracking`,
          label: 'Egitim plani olusturuldu',
          reason: 'Olusan egitim planini takip ekraninda gorebilirsiniz.',
          destination: 'company_tracking',
          auto_navigate: false,
        },
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
        navigation: {
          action: 'navigate',
          url: `/companies/${workspaceId}?tab=planner`,
          label: 'Planner gorevi olusturuldu',
          reason: 'Gorevi planner sekmesinde gorebilir ve duzenleyebilirsiniz.',
          destination: 'company_planner',
          auto_navigate: false,
        },
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
        navigation: {
          action: 'navigate',
          url: `/incidents/${incidentRow.id}`,
          label: 'Olay taslagi hazir',
          reason: 'Taslagi detay ekraninda tamamlayabilirsiniz.',
          destination: 'incident_detail',
          auto_navigate: false,
        },
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

    return {
      success: true,
      data: {
        document_id: documentRow.id,
        title: documentRow.title,
        group_key: documentRow.group_key,
        status: documentRow.status,
        company_workspace_id: workspaceId,
        summary: `${title} dokuman taslagi olusturuldu.`,
        navigation: {
          action: 'navigate',
          url: `/documents/${documentRow.id}`,
          label: 'Dokuman taslagi hazir',
          reason: 'Taslagi editor ekraninda tamamlayabilirsiniz.',
          destination: 'document_detail',
          auto_navigate: false,
        },
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
      case 'search_past_answers':
        result = await executeSearchPastAnswers(input, context)
        break
      case 'save_memory_note':
        result = await executeSaveMemoryNote(input, context)
        break
      case 'confirm_pending_action':
        result = await executeConfirmPendingAction(input, context)
        break
      case 'cancel_pending_action':
        result = await executeCancelPendingAction(input, context)
        break
      case 'navigate_to_page':
        result = await executeNavigateToPage(input, context)
        break
      case 'create_training_plan':
        result = await executeCreateTrainingPlan(input, context)
        break
      case 'create_planner_task':
        result = await executeCreatePlannerTask(input, context)
        break
      case 'create_incident_draft':
        result = await executeCreateIncidentDraft(input, context)
        break
      case 'create_document_draft':
        result = await executeCreateDocumentDraft(input, context)
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

async function requestClaude(
  anthropic: Anthropic,
  payload: Parameters<Anthropic['messages']['create']>[0],
  operationName: string,
) {
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
  queryText: string
  answer: string
  sources: any[]
  responseTokens: number
  sessionId: string
  toolsUsed: string[]
  language: string
  navigation: any | null
  cached: boolean
}): Promise<string | null> {
  try {
    const { data, error } = await params.supabase
      .from('solution_queries')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        query_text: params.queryText,
        ai_response: params.answer,
        sources_used: params.sources || [],
        response_tokens: params.responseTokens,
        response_metadata: {
          session_id: params.sessionId,
          tools_used: params.toolsUsed,
          language: params.language,
          navigation: params.navigation,
          cached: params.cached,
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

  try {
    const body: ChatRequest = await req.json()
    const parsedBody = chatRequestSchema.safeParse(body)
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: 'Gecersiz istek verisi',
          details: parsedBody.error.flatten(),
        }),
        { status: 400, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const userMessage = parsedBody.data.message
    const language = parsedBody.data.language || 'tr'

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

      const queryId = await saveSolutionQueryRecord({
        supabase,
        userId: user.id,
        organizationId: body.organization_id,
        queryText: userMessage,
        answer: cacheResult.answer,
        sources: cacheResult.sources || [],
        responseTokens: 0,
        sessionId,
        toolsUsed: ['cache_hit'],
        language,
        navigation: null,
        cached: true,
      })

      return new Response(
        JSON.stringify({
          type: 'cache_hit',
          answer: cacheResult.answer,
          sources: cacheResult.sources || [],
          similarity: cacheResult.similarity,
          session_id: sessionId,
          query_id: queryId,
          cached: true
        }),
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // ========================================================================
    // STEP 2: Claude Tool Use Loop
    // ========================================================================

    let systemPrompt = getSystemPrompt(language)

    systemPrompt += language === 'tr'
      ? `\n\n## NOVA AKSIYON MODU\nNova yalnizca bilgi veren bir asistan degil, kontrollu bir operasyon ajanidir.\n- Kullanici planla, gorev olustur, olay baslat, dokuman taslagi hazirla, takvime ekle, baslat veya yonlendir gibi bir is istediginde uygun tool'u kullan.\n- Egitim planlama taleplerinde create_training_plan; genel gorevlerde create_planner_task; yeni olaylarda create_incident_draft; editor taslaklarinda create_document_draft kullan.\n- Benzer sorularda search_past_answers ile onceki basarili cevaplari ve kullanicinin gecmisini kontrol et.\n- Kullanici kalici bir tercih, tekrar eden operasyon kalibi veya firma icin uzun omurlu bir not verirse save_memory_note ile hafizaya al.\n- Kritik kayit acan islemlerde ilk adimda islemi hemen tamamlama; once bekleyen aksiyon hazirla ve acik kullanici onayi bekle.\n- Kullanici acikca \"onayliyorum\", \"devam et\", \"uygula\" derse confirm_pending_action kullan. \"Iptal et\", \"vazgectim\" derse cancel_pending_action kullan.\n- Kullanici tarihi dogal dilde soylese bile tool'a YYYY-MM-DD formatinda aktar.\n- Bilgi yeterliyse islemi hazirla; kritik eksik varsa sadece kisa ve net ek bilgi sor.\n- Islem tamamlandiginda sonucu ozetle ve gerekiyorsa kullaniciyi ilgili sayfaya yonlendir.\n- Mevzuat yorumunda mutlaka arama tool'lariyla dogrula; tercih ve operasyon bilgisini hafizada tut ama mevzuati ezberden uydurma.`
      : `\n\n## NOVA ACTION MODE\nNova is not just an informational assistant; it is a controlled operations agent.\n- When the user asks to plan, create tasks, start incidents, draft documents, schedule, start, or navigate, use the most appropriate tool.\n- Use create_training_plan for training scheduling, create_planner_task for general tasks, create_incident_draft for incidents, and create_document_draft for editor drafts.\n- Use search_past_answers to inspect previous successful answers and the user's own history for recurring requests.\n- Use save_memory_note only for durable user preferences, repeated company patterns, or stable operational notes.\n- For critical record-creating operations, do not complete the action immediately on the first turn; prepare a pending action and wait for explicit approval.\n- When the user clearly says approve, go ahead, or proceed, use confirm_pending_action. When the user cancels or declines, use cancel_pending_action.\n- Convert natural language dates into YYYY-MM-DD before calling tools.\n- If the information is sufficient, prepare the action; only ask a short follow-up when a critical field is missing.\n- After completing an action, summarize the result and guide the user to the relevant page when useful.\n- Use tools to verify legislation; keep operational preferences in memory, but never invent regulatory content from memory.`

    // Zayıf cache eşleşmesi varsa, Claude'a ipucu olarak ver
    if (cacheResult.isWeakMatch && cacheResult.answer) {
      systemPrompt += `\n\n## GEÇMİŞ BENZER SORU (Referans olarak kullan)
Benzer bir soruya daha önce şu cevap verilmiş:
"${cacheResult.answer.substring(0, 500)}"

Bu referansı kullanabilirsin ama mutlaka güncel tool sonuçlarıyla doğrula.`
    }

    const FREE_TOOLS = [
      'search_legislation',
      'search_past_answers',
      'save_memory_note',
      'confirm_pending_action',
      'cancel_pending_action',
      'navigate_to_page',
      'create_training_plan',
      'create_planner_task',
      'create_incident_draft',
      'create_document_draft',
    ]
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
        language: language,
        company_workspace_id: body.company_workspace_id ?? null
      }
    }

    const [userMemory, storedMemory, workspaceMemory, pendingActionMemory] = await Promise.all([
      buildUserPreferenceContext(toolContext),
      buildStoredMemoryContext(toolContext),
      buildActiveWorkspaceContext(toolContext),
      buildPendingActionContext(toolContext),
    ])

    if (userMemory) {
      systemPrompt += `\n\n${userMemory}`
    }

    if (storedMemory) {
      systemPrompt += `\n\n${storedMemory}`
    }

    if (workspaceMemory) {
      systemPrompt += `\n\n${workspaceMemory}`
    }

    if (pendingActionMemory) {
      systemPrompt += `\n\n${pendingActionMemory}`
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
        finalAnswer = language === 'tr'
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
          finalAnswer = language === 'tr'
            ? 'Nova AI servisi gecici olarak kullanilamiyor. Elle devam edebilir veya daha sonra tekrar deneyebilirsiniz.'
            : 'Nova AI is temporarily unavailable. Please continue manually or try again later.'
          break
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

    await logEdgeAiUsage({
      userId: user.id,
      organizationId: body.organization_id,
      model: ANTHROPIC_MODEL,
      endpoint: '/functions/v1/solution-chat',
      promptTokens: totalInputTokens,
      completionTokens: totalOutputTokens,
      success: true,
      metadata: {
        toolsUsed,
        iterations,
        cached: false,
        sessionId,
      },
    })

    // ========================================================================
    // STEP 4: Response
    // ========================================================================

    const navigation = extractNavigation(toolsUsed, messages)
    const queryId = await saveSolutionQueryRecord({
      supabase,
      userId: user.id,
      organizationId: body.organization_id,
      queryText: userMessage,
      answer: finalAnswer,
      sources,
      responseTokens: totalOutputTokens,
      sessionId,
      toolsUsed,
      language,
      navigation,
      cached: false,
    })

    return new Response(
      JSON.stringify({
        type: 'response',
        answer: finalAnswer,
        sources: sources,
        navigation,
        tools_used: toolsUsed,
        session_id: sessionId,
        query_id: queryId,
        iterations: iterations,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
        cached: false,
        remaining_messages: (subCheck.remaining || 0) - 1
      }),
      { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Nova error:', error)
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


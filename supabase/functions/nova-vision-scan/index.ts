import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
import { z } from 'https://esm.sh/zod@3.23.8'
import { executeWithResilience } from '../_shared/resilience.ts'
import { logEdgeAiUsage, logEdgeErrorEvent } from '../_shared/observability.ts'

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

function buildCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : (LOCAL_DEV_ORIGIN_PATTERN.test(requestOrigin)
      ? requestOrigin
      : (ALLOWED_ORIGINS[0] ?? requestOrigin))

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
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
    source: 'nova-vision-scan',
    endpoint: '/functions/v1/nova-vision-scan',
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
      headers: buildCorsHeaders(req),
    },
  )
}

const requestSchema = z.object({
  image_base64: z.string().trim().min(100),
  risk_method: z.string().trim().min(1).max(50).default('r2d'),
  language: z.string().trim().min(2).max(10).default('tr'),
  company_workspace_id: z.string().uuid().optional(),
  source: z.string().trim().min(1).max(50).default('mobile_live_scan'),
  voice_note_text: z.string().trim().max(2000).optional(),
  manual_annotations: z.array(
    z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      note: z.string().trim().max(500).optional(),
    }),
  ).max(20).optional(),
})

const METHOD_PROMPTS: Record<string, string> = {
  fine_kinney: 'Risk yontemi: Fine-Kinney. Her risk icin probability, frequency, severity ve risk_score hesapla.',
  l_matrix: 'Risk yontemi: 5x5 L Matrix. Her risk icin likelihood, severity ve risk_score hesapla.',
  r2d: 'Risk yontemi: R2D. Her risk icin dinamik saha kosullarini, etkilelimleri ve bileşik skoru yorumla.',
  fmea: 'Risk yontemi: FMEA. Her risk icin severity_score, occurrence_score, detection_score ve rpn uret.',
  hazop: 'Risk yontemi: HAZOP. Her risk icin guide_word, deviation, cause, consequence ve action_required ekle.',
  bowtie: 'Risk yontemi: Bow-Tie. Her risk icin top_event, threats, prevention_barriers, consequences ve mitigation_barriers ekle.',
  fta: 'Risk yontemi: FTA. Her risk icin top_event, intermediate_events, basic_events, gate_type ve probability_estimate ekle.',
  checklist: 'Risk yontemi: Checklist. Her risk icin checklist_item, compliant, regulation_ref ve corrective_action ekle.',
  jsa: 'Risk yontemi: JSA. Her risk icin job_step, hazard_type, exposure_level, ppe_required ve safe_procedure ekle.',
  lopa: 'Risk yontemi: LOPA. Her risk icin initiating_event, initiating_frequency, ipl_layers ve gap_analysis ekle.',
}

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  tr: 'Yanit ve ozet alanlarini Turkce yaz.',
  en: 'Write all descriptive fields in English.',
  de: 'Schreibe erklarende alanlari auf Deutsch.',
  fr: 'Ecris les champs descriptifs en francais.',
  es: 'Responde en espanol.',
  ar: 'اكتب الحقول التوضيحية بالعربية.',
  ru: 'Пиши поясняющие поля по-русски.',
}

function buildPrompt(params: {
  riskMethod: string
  language: string
  source: string
  voiceNoteText?: string
  manualAnnotations?: Array<{ x: number; y: number; note?: string }>
}) {
  const methodPrompt = METHOD_PROMPTS[params.riskMethod] ?? METHOD_PROMPTS.r2d
  const languageInstruction = LANGUAGE_INSTRUCTIONS[params.language] ?? LANGUAGE_INSTRUCTIONS.tr

  const voiceContext = params.voiceNoteText
    ? `Kullanicinin sesli notu: "${params.voiceNoteText}". Bunu sadece destekleyici baglam olarak kullan.`
    : ''

  const manualContext = params.manualAnnotations?.length
    ? `Kullanici tarafindan isaretlenen manuel odak noktalarini onceliklendir: ${params.manualAnnotations.map((item, index) => `#${index + 1} x=${item.x}, y=${item.y}${item.note ? `, not=${item.note}` : ''}`).join(' | ')}.`
    : ''

  return `Sen RiskNova Nova Vision'sin. Bir saha taramasi gorselini profesyonel ISG uzmani gibi incele.

Gorevlerin:
1. Gorseldeki riskleri katmanli ve somut sekilde tespit et.
2. Her riski numaralandirilabilir annotation mantigina uygun tekil bir kayit olarak dondur.
3. Riskleri ilgili operasyon akisina yonlendirmek icin uygun rota oner.
4. Gerekirse canli saha, olay, egitim, dokuman, risk analizi veya planlama akislarina isaret et.

${methodPrompt}
${languageInstruction}
Kaynak: ${params.source}
${voiceContext}
${manualContext}

Kurallar:
- Sadece gorselde gercekten gozlemledigini yaz.
- location_hint alanini mutlaka su degerlerden biriyle doldur: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right.
- Her risk icin risk_level: critical|high|medium|low kullan.
- Her risk icin risk_category: kkd|dusme|elektrik|yangin|mekanik|kimyasal|ergonomik|cevresel|duzen|trafik|diger kullan.
- Her risk icin route_target alani belirt: risk_analysis | incidents | training | documents | planner | digital_twin.
- Olay niteligindeki kritik tehlikeleri incidents'a; KKD ve davranis aciklarini training'e; dokumantasyon eksiklerini documents'a; takip gerektiren isleri planner'a yonlendir.
- PPE denetimini ayri bir ppe_audit listesi olarak dondur.
- Yuz tespiti icin faces listesi dondur.

JSON disinda hicbir sey dondurme.

Beklenen format:
{
  "risks": [
    {
      "risk_name": "Baretsiz calisma",
      "risk_level": "high",
      "risk_category": "kkd",
      "confidence": 92,
      "description": "...",
      "location_hint": "top-right",
      "recommended_action": "...",
      "route_target": "training",
      "regulation_ref": "...",
      "affected_workers": 1
    }
  ],
  "faces": [
    { "x_percent": 10, "y_percent": 15, "width_percent": 12, "height_percent": 18 }
  ],
  "ppe_audit": [],
  "overall_risk_score": 0,
  "critical_findings_count": 0,
  "scene_description": "...",
  "summary": "...",
  "routing_targets": [
    {
      "target": "training",
      "reason": "...",
      "priority": "high"
    }
  ]
}`
}

function normalizeResult(parsed: Record<string, unknown>) {
  const risks = Array.isArray(parsed.risks) ? parsed.risks : []
  const routingTargets = Array.isArray(parsed.routing_targets) ? parsed.routing_targets : []

  return {
    risks,
    faces: Array.isArray(parsed.faces) ? parsed.faces : [],
    ppe_audit: Array.isArray(parsed.ppe_audit) ? parsed.ppe_audit : [],
    overall_risk_score: typeof parsed.overall_risk_score === 'number' ? parsed.overall_risk_score : null,
    critical_findings_count: typeof parsed.critical_findings_count === 'number' ? parsed.critical_findings_count : 0,
    scene_description: typeof parsed.scene_description === 'string' ? parsed.scene_description : '',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    routing_targets: routingTargets,
  }
}

function parseJsonResponse(text: string) {
  try {
    return normalizeResult(JSON.parse(text))
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return normalizeResult(JSON.parse(match[0]))
      } catch {
        return normalizeResult({})
      }
    }
    return normalizeResult({})
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return await jsonErrorResponse(req, {
      status: 405,
      error: 'method_not_allowed',
      message: 'Sadece POST destekleniyor',
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return await jsonErrorResponse(req, {
        status: 401,
        error: 'missing_auth',
        message: 'Yetkilendirme gerekli',
      })
    }

    const body = requestSchema.parse(await req.json())

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )

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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, company_workspace_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const organizationId = profile?.organization_id ?? user.app_metadata?.organization_id ?? user.user_metadata?.organization_id ?? null
    if (!organizationId) {
      return await jsonErrorResponse(req, {
        status: 400,
        error: 'organization_missing',
        message: 'Kullanicinin organizasyon bilgisi bulunamadi',
        userId: user.id,
      })
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    })

    const analysisResult = await executeWithResilience<any>({
      serviceKey: 'anthropic_vision_mobile',
      displayName: 'Anthropic Vision Mobile',
      serviceType: 'ai',
      operationName: 'nova_vision_scan',
      fallbackMessage: 'Gorsel analiz servisi gecici olarak kullanilamiyor. Elle not alarak devam edin.',
      operation: async () => {
        const response = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: body.image_base64,
                  },
                },
                {
                  type: 'text',
                  text: buildPrompt({
                    riskMethod: body.risk_method,
                    language: body.language,
                    source: body.source,
                    voiceNoteText: body.voice_note_text,
                    manualAnnotations: body.manual_annotations,
                  }),
                },
              ],
            },
          ],
        })

        const text = response.content?.find((item) => item.type === 'text')?.text ?? '{}'
        return {
          parsed: parseJsonResponse(text),
          usage: response.usage,
        }
      },
    })

    if (!analysisResult.ok || !analysisResult.data?.parsed) {
      return await jsonErrorResponse(req, {
        status: 503,
        error: 'vision_unavailable',
        message: analysisResult.fallbackMessage,
        userId: user.id,
        organizationId,
      })
    }

    const parsed = analysisResult.data.parsed
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.map((risk: any, index: number) => ({
          ...risk,
          annotation_number: index + 1,
        }))
      : []

    await logEdgeAiUsage({
      userId: user.id,
      organizationId,
      model: ANTHROPIC_MODEL,
      endpoint: '/functions/v1/nova-vision-scan',
      promptTokens: analysisResult.data.usage?.input_tokens ?? 0,
      completionTokens: analysisResult.data.usage?.output_tokens ?? 0,
      success: true,
      metadata: {
        source: body.source,
        company_workspace_id: body.company_workspace_id ?? profile?.company_workspace_id ?? null,
        risk_count: risks.length,
      },
    })

    return new Response(
      JSON.stringify({
        ...parsed,
        risks,
        organization_id: organizationId,
        company_workspace_id: body.company_workspace_id ?? profile?.company_workspace_id ?? null,
        degraded: analysisResult.degraded,
      }),
      {
        status: 200,
        headers: buildCorsHeaders(req),
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return await jsonErrorResponse(req, {
      status: 500,
      error: 'vision_boot_error',
      message,
    })
  }
})

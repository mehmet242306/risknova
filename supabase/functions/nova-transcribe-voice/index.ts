// =============================================================================
// nova-transcribe-voice — Sesli not transkripsiyon edge function
// =============================================================================
// Girdi: { voice_note_path: string (storage path), answer_id: string, language?: "tr" }
// Akış:
//   1. Auth: Bearer token -> supabase.auth.getUser (ES256 uyumlu)
//   2. Storage'dan ses dosyasını indir (service role)
//   3. OpenAI Whisper API'ye gönder (multipart/form-data)
//   4. Transkripti inspection_answers.voice_transcript'e yaz
//   5. { transcript, language } döndür
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { logEdgeAiUsage, logEdgeErrorEvent } from "../_shared/observability.ts";

const FN_NAME = "nova-transcribe-voice";
const WHISPER_MODEL = "whisper-1";
const BUCKET = "inspection-photos";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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

type RequestBody = {
  voice_note_path: string;
  answer_id: string;
  language?: string;
};

function validatePayload(body: unknown): RequestBody | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.voice_note_path !== "string" || !b.voice_note_path.trim()) {
    return { error: "voice_note_path required" };
  }
  if (typeof b.answer_id !== "string" || !b.answer_id.trim()) {
    return { error: "answer_id required" };
  }
  const language = typeof b.language === "string" ? b.language.trim() : "tr";
  return {
    voice_note_path: b.voice_note_path.trim(),
    answer_id: b.answer_id.trim(),
    language,
  };
}

async function downloadAudio(path: string): Promise<Blob | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error(`Storage download failed: ${error?.message ?? "no data"}`);
    return null;
  }
  return data;
}

async function transcribeWithWhisper(
  audio: Blob,
  language: string,
  apiKey: string,
): Promise<{ text: string; language: string } | { error: string }> {
  const form = new FormData();
  form.append("file", audio, "voice_note.webm");
  form.append("model", WHISPER_MODEL);
  form.append("language", language);
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Whisper ${res.status}: ${text.slice(0, 300)}` };
  }
  const result = (await res.json()) as {
    text: string;
    language?: string;
    duration?: number;
  };
  return { text: result.text, language: result.language ?? language };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) {
    await logEdgeErrorEvent({
      level: "critical",
      source: FN_NAME,
      message: "OPENAI_API_KEY not configured",
    });
    return json(
      { error: "server_misconfigured", message: "OpenAI API key missing" },
      500,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "invalid_json" }, 400);
  }

  const validated = validatePayload(body);
  if ("error" in validated) {
    return json({ error: "invalid_input", message: validated.error }, 400);
  }

  const auth = await resolveCallerOrg(req);
  if (!auth) return json({ error: "unauthorized", message: "Invalid or missing auth token" }, 401);

  // Security: verify the voice_note_path belongs to this org
  if (!validated.voice_note_path.startsWith(`${auth.orgId}/`)) {
    return json(
      { error: "forbidden", message: "Voice note not in caller's org scope" },
      403,
    );
  }

  try {
    const audio = await downloadAudio(validated.voice_note_path);
    if (!audio) {
      return json({ error: "download_failed", message: "Ses dosyası indirilemedi" }, 500);
    }

    const result = await transcribeWithWhisper(audio, validated.language ?? "tr", openAiKey);
    if ("error" in result) {
      throw new Error(result.error);
    }

    // Write transcript to DB
    const supabase = getServiceClient();
    const { error: updateErr } = await supabase
      .from("inspection_answers")
      .update({
        voice_transcript: result.text,
        voice_transcript_lang: result.language,
        voice_transcript_at: new Date().toISOString(),
      })
      .eq("id", validated.answer_id)
      .eq("organization_id", auth.orgId); // double-check org scope
    if (updateErr) {
      console.warn("DB update failed:", updateErr.message);
    }

    // Non-blocking usage log (estimated; Whisper bills per minute)
    const sizeKb = audio.size / 1024;
    void logEdgeAiUsage({
      userId: auth.userId,
      organizationId: auth.orgId,
      model: WHISPER_MODEL,
      endpoint: FN_NAME,
      promptTokens: Math.round(sizeKb),
      completionTokens: result.text.length,
      success: true,
      metadata: {
        audio_size_kb: Math.round(sizeKb),
        language: result.language,
        answer_id: validated.answer_id,
      },
    });

    return json({
      transcript: result.text,
      language: result.language,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEdgeErrorEvent({
      level: "error",
      source: FN_NAME,
      message: `nova-transcribe-voice failed: ${message}`,
      userId: auth.userId,
      organizationId: auth.orgId,
      context: { answer_id: validated.answer_id },
    });
    return json({ error: "transcribe_failed", message }, 500);
  }
});

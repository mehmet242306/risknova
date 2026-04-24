import { NextRequest, NextResponse } from "next/server";
import { logAiUsage, logErrorEvent } from "@/lib/admin-observability/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  resolveAiDailyLimit,
  validateUploadedFile,
} from "@/lib/security/server";

export const maxDuration = 60;

const OPENAI_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
] as const;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const plan = await resolveAiDailyLimit(auth.userId);
  const rateLimitResponse = await enforceRateLimit(request, {
    userId: auth.userId,
    organizationId: auth.organizationId,
    endpoint: "/api/nova/transcribe",
    scope: "ai",
    limit: plan.dailyLimit,
    windowSeconds: 24 * 60 * 60,
    planKey: plan.planKey,
    metadata: { feature: "nova_voice_transcription" },
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const language = String(formData.get("language") || "tr").slice(0, 12);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Transkripsiyon icin ses dosyasi gerekli." },
        { status: 400 },
      );
    }

    const fileError = await validateUploadedFile(file, {
      allowedMimeTypes: [...ALLOWED_AUDIO_MIME_TYPES],
      allowedExtensions: [".webm", ".wav", ".mp3", ".m4a", ".ogg"],
      maxBytes: 12 * 1024 * 1024,
    });
    if (fileError) {
      return NextResponse.json({ message: fileError }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "OPENAI_API_KEY tanimli degil." },
        { status: 500 },
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name || "nova-voice.webm");
    upstreamForm.append("model", OPENAI_TRANSCRIBE_MODEL);
    upstreamForm.append("language", language);
    upstreamForm.append("response_format", "verbose_json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: upstreamForm,
    });

    const rawText = await response.text();
    if (!response.ok) {
      await logAiUsage({
        userId: auth.userId,
        organizationId: auth.organizationId,
        model: OPENAI_TRANSCRIBE_MODEL,
        endpoint: "/api/nova/transcribe",
        success: false,
        metadata: {
          status: response.status,
          fileName: file.name,
          fileSize: file.size,
        },
      });

      return NextResponse.json(
        {
          message: rawText || "Ses metne cevrilemedi.",
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const payload = rawText
      ? (JSON.parse(rawText) as { text?: string; language?: string; duration?: number })
      : {};

    await logAiUsage({
      userId: auth.userId,
      organizationId: auth.organizationId,
      model: OPENAI_TRANSCRIBE_MODEL,
      endpoint: "/api/nova/transcribe",
      promptTokens: Math.round(file.size / 1024),
      completionTokens: String(payload.text || "").length,
      success: true,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        language: payload.language || language,
        duration: payload.duration ?? null,
      },
    });

    return NextResponse.json({
      transcript: String(payload.text || "").trim(),
      language: payload.language || language,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await logErrorEvent({
      level: "error",
      source: "nova-transcribe",
      endpoint: "/api/nova/transcribe",
      message,
      userId: auth.userId,
      organizationId: auth.organizationId,
    });
    return NextResponse.json({ message }, { status: 500 });
  }
}

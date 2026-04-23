"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Square, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  signInspectionPhotoUrls,
  uploadInspectionAudio,
  uploadInspectionPhoto,
} from "@/lib/supabase/inspection-storage";

type Props = {
  runId: string;
  answerId: string;
  photoUrls: string[];
  voiceNoteUrl: string | null;
  voiceTranscript: string | null;
  onPhotosChange: (paths: string[]) => void;
  onVoiceNoteChange: (path: string | null, transcript?: string | null) => void;
  disabled?: boolean;
};

export function EvidenceWidget({
  runId,
  answerId,
  photoUrls,
  voiceNoteUrl,
  voiceTranscript,
  onPhotosChange,
  onVoiceNoteChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
      <PhotoSection
        runId={runId}
        answerId={answerId}
        paths={photoUrls}
        onChange={onPhotosChange}
        disabled={disabled}
      />
      <VoiceSection
        runId={runId}
        answerId={answerId}
        path={voiceNoteUrl}
        transcript={voiceTranscript}
        onChange={onVoiceNoteChange}
        disabled={disabled}
      />
    </div>
  );
}

async function transcribeVoiceNote(
  voiceNotePath: string,
  answerId: string,
): Promise<{ transcript: string; language?: string } | { error: string }> {
  const supabase = createClient();
  if (!supabase) return { error: "no_client" };
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: "no_session" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !apikey) return { error: "env_missing" };

  const res = await fetch(`${url}/functions/v1/nova-transcribe-voice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey,
    },
    body: JSON.stringify({
      voice_note_path: voiceNotePath,
      answer_id: answerId,
      language: "tr",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `${res.status}: ${text.slice(0, 200) || "yanıt boş"}` };
  }
  const data = (await res.json()) as { transcript?: string; language?: string };
  if (!data.transcript) return { error: "transkript alınamadı" };
  return { transcript: data.transcript, language: data.language };
}

// -----------------------------------------------------------------------------
// PHOTOS
// -----------------------------------------------------------------------------

function PhotoSection({
  runId,
  answerId,
  paths,
  onChange,
  disabled,
}: {
  runId: string;
  answerId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paths.length === 0) {
      setSignedUrls({});
      return;
    }
    let cancelled = false;
    void signInspectionPhotoUrls(paths).then((urls) => {
      if (!cancelled) setSignedUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const newPaths: string[] = [];
    for (const file of Array.from(files)) {
      const result = await uploadInspectionPhoto(runId, answerId, file);
      if (result) newPaths.push(result.path);
    }
    setUploading(false);
    if (newPaths.length === 0) {
      setError("Yükleme başarısız oldu.");
      return;
    }
    onChange([...paths, ...newPaths]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (path: string) => {
    onChange(paths.filter((p) => p !== path));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Camera className="h-3.5 w-3.5" />
          <span>Fotoğraf ({paths.length})</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => handleUpload(e.target.files)}
          disabled={disabled || uploading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? "Yükleniyor..." : "Fotoğraf ekle"}
        </Button>
      </div>
      {error ? (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {paths.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {paths.map((path) => {
            const url = signedUrls[path];
            return (
              <div
                key={path}
                className="group relative overflow-hidden rounded-lg border border-border bg-muted/30 pb-[75%]"
              >
                {url ? (
                  <img
                    src={url}
                    alt="Kanıt"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                    yükleniyor
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(path)}
                  disabled={disabled}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Fotoğrafı kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// VOICE NOTE
// -----------------------------------------------------------------------------

function VoiceSection({
  runId,
  answerId,
  path,
  transcript,
  onChange,
  disabled,
}: {
  runId: string;
  answerId: string;
  path: string | null;
  transcript: string | null;
  onChange: (path: string | null, transcript?: string | null) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    void signInspectionPhotoUrls([path]).then((urls) => {
      if (!cancelled) setSignedUrl(urls[path] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tarayıcı ses kaydını desteklemiyor.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setUploading(true);
        const result = await uploadInspectionAudio(runId, answerId, blob);
        setUploading(false);
        if (!result) {
          setError("Ses notu yüklenemedi.");
          return;
        }
        // Save path immediately (optimistic), transcript arrives async
        onChange(result.path, null);
        // Trigger transcription in background
        setTranscribing(true);
        const tx = await transcribeVoiceNote(result.path, answerId);
        setTranscribing(false);
        if ("error" in tx) {
          setError(`Transkripsiyon: ${tx.error}`);
        } else {
          onChange(result.path, tx.transcript);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Mikrofon izni reddedildi."
          : `Mikrofon açılamadı: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const removeVoiceNote = () => {
    onChange(null, null);
    setSignedUrl(null);
  };

  const retranscribe = async () => {
    if (!path) return;
    setError(null);
    setTranscribing(true);
    const tx = await transcribeVoiceNote(path, answerId);
    setTranscribing(false);
    if ("error" in tx) {
      setError(`Transkripsiyon: ${tx.error}`);
    } else {
      onChange(path, tx.transcript);
    }
  };

  const mmss = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Mic className="h-3.5 w-3.5" />
          <span>Sesli not{path ? " (kaydedildi)" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {recording ? (
            <>
              <span className="text-xs font-mono text-red-600">● {mmss(elapsed)}</span>
              <Button variant="outline" size="sm" onClick={stopRecording}>
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Durdur
              </Button>
            </>
          ) : path ? (
            <Button
              variant="outline"
              size="sm"
              onClick={removeVoiceNote}
              disabled={disabled}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Sil
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startRecording}
              disabled={disabled || uploading}
            >
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              {uploading ? "Yükleniyor..." : "Kaydet"}
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {path && signedUrl ? (
        <audio
          controls
          src={signedUrl}
          className={cn("h-10 w-full", disabled && "opacity-60")}
        />
      ) : null}
      {path ? (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Transkript</span>
            {transcribing ? (
              <span className="text-[var(--gold)]">AI yazıyor...</span>
            ) : transcript ? (
              <button
                type="button"
                onClick={retranscribe}
                disabled={disabled}
                className="text-[10px] underline hover:text-foreground"
              >
                Yeniden transkribe et
              </button>
            ) : null}
          </div>
          {transcribing ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--gold)]" />
              <span>Ses metne çevriliyor (OpenAI Whisper)...</span>
            </div>
          ) : transcript ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {transcript}
            </p>
          ) : (
            <button
              type="button"
              onClick={retranscribe}
              disabled={disabled}
              className="text-xs text-[var(--gold)] underline"
            >
              Transkript oluştur
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

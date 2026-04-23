-- =============================================================================
-- Saha Denetimi — Sesli not transkripsiyon sütunu
-- =============================================================================
-- nova-transcribe-voice edge function (OpenAI Whisper) sesli notu metne
-- çevirir, çıktıyı voice_transcript kolonuna yazar. Aynı zamanda manuel
-- düzeltme için kullanıcı editleyebilir.
-- =============================================================================

begin;

alter table public.inspection_answers
  add column if not exists voice_transcript text,
  add column if not exists voice_transcript_lang text,
  add column if not exists voice_transcript_at timestamptz;

commit;

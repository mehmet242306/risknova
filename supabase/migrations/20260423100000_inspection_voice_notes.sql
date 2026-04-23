-- =============================================================================
-- Saha Denetimi — Sesli not desteği
-- =============================================================================
-- inspection_answers'a voice_note_url kolonu + inspection-photos bucket'ına
-- ses MIME tipleri. Fotoğraf + ses aynı bucket'ta, farklı prefix ile:
--   {orgId}/{runId}/{answerId}/photo_{uuid}.jpg
--   {orgId}/{runId}/{answerId}/voice_{uuid}.webm
-- =============================================================================

begin;

alter table public.inspection_answers
  add column if not exists voice_note_url text;

-- Bucket MIME listesini ses formatlarını içerecek şekilde güncelle
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a'
]::text[],
    file_size_limit = 20971520  -- 20 MB (ses notları için büyütüldü)
where id = 'inspection-photos';

commit;

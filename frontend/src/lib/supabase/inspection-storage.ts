import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";

// =============================================================================
// Saha Denetimi — Fotoğraf yükleme helper
// Bucket: inspection-photos (10 MB, image/* only, org-scoped RLS)
// Yol: {orgId}/{runId}/{answerId}/{uuid}_{filename}
// =============================================================================

const BUCKET = "inspection-photos";

function safeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export type UploadResult = {
  path: string;
  signedUrl: string | null;
};

export async function uploadInspectionPhoto(
  runId: string,
  answerId: string,
  file: File,
): Promise<UploadResult | null> {
  return uploadToBucket(runId, answerId, file, "photo");
}

export async function uploadInspectionAudio(
  runId: string,
  answerId: string,
  blob: Blob,
  extension = "webm",
): Promise<UploadResult | null> {
  const file = new File([blob], `voice_note.${extension}`, {
    type: blob.type || `audio/${extension}`,
  });
  return uploadToBucket(runId, answerId, file, "voice");
}

async function uploadToBucket(
  runId: string,
  answerId: string,
  file: File,
  prefix: "photo" | "voice",
): Promise<UploadResult | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) {
    console.warn(`upload (${prefix}): no auth / organization`);
    return null;
  }

  const safe = safeFileName(file.name);
  const path = `${auth.orgId}/${runId}/${answerId}/${prefix}_${crypto.randomUUID()}_${safe}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || (prefix === "photo" ? "image/jpeg" : "audio/webm"),
      upsert: false,
    });
  if (uploadErr) {
    console.warn(`upload (${prefix}):`, uploadErr.message);
    return null;
  }

  const { data: signedData, error: signedErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (signedErr) {
    console.warn(`upload (${prefix}) signedUrl:`, signedErr.message);
  }

  return { path, signedUrl: signedData?.signedUrl ?? null };
}

export async function signInspectionPhotoUrls(
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = createClient();
  if (!supabase) return {};

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error) {
    console.warn("signInspectionPhotoUrls:", error.message);
    return {};
  }
  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}

export async function deleteInspectionPhoto(path: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.warn("deleteInspectionPhoto:", error.message);
    return false;
  }
  return true;
}

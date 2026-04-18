import { createClient } from "./client";

const CORRECTIVE_ACTION_BUCKET = "corrective-action-files";

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function uploadCorrectiveActionFile(correctiveActionId: string, file: File) {
  const supabase = createClient();
  if (!supabase) {
    throw new Error("Supabase bağlantısı kurulamadı.");
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "ek-dosya";
  const finalName = extension ? `${baseName}.${extension}` : baseName;
  const path = `${correctiveActionId}/${Date.now()}-${finalName}`;

  const { error } = await supabase.storage
    .from(CORRECTIVE_ACTION_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(CORRECTIVE_ACTION_BUCKET).getPublicUrl(path);
  return {
    path,
    url: data.publicUrl,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

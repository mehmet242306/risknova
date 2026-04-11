import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  validateUploadedFile,
} from "@/lib/security/server";

export const maxDuration = 60;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".mp4",
  ".webm",
  ".pdf",
];

const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const rateLimitResponse = await enforceRateLimit(req, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/slide-media-upload",
      scope: "api",
      limit: 60,
      windowSeconds: 60,
      metadata: { feature: "slide_media_upload" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
    }

    const fileError = await validateUploadedFile(file, {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      maxBytes: MAX_SIZE,
      allowedExtensions: ALLOWED_EXTENSIONS,
    });
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Organizasyon bulunamadi" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
    const storagePath = `${profile.organization_id}/${user.id}/${Date.now()}_${safeName}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("slide-media")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("upload error:", uploadErr);
      return NextResponse.json({ error: `Yukleme hatasi: ${uploadErr.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("slide-media").getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const assetType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : "document";

    const { data: asset, error: assetErr } = await supabase
      .from("slide_media_assets")
      .insert({
        organization_id: profile.organization_id,
        uploaded_by: user.id,
        asset_type: assetType,
        file_name: file.name,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (assetErr) {
      console.warn("asset insert warning:", assetErr.message);
    }

    return NextResponse.json({
      url: publicUrl,
      path: storagePath,
      asset_id: asset?.id || null,
      asset_type: assetType,
    });
  } catch (error) {
    console.error("slide-media-upload error:", error);
    await logSecurityEvent(req, "api.slide_media_upload.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      },
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hata" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("slide_media_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: data || [] });
  } catch (error) {
    await logSecurityEvent(req, "api.slide_media_assets.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
      },
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hata" }, { status: 500 });
  }
}

-- Workplace OHS Archive (İşyeri İSG Dosyası) — Phase A: infrastructure only.
--
-- A long-running job that packages every piece of OHS data belonging to a
-- company_workspace for a calendar year into a ZIP stored in Supabase
-- Storage. The API endpoint only writes the job row; a background worker
-- (Edge Function + cron, added in a later PR) picks it up, produces the ZIP,
-- uploads to storage and flips status to 'completed'.
--
-- This migration is additive. It touches no existing table's RLS or schema.
-- The actual data collection and worker live in PR B. The company-page UI
-- and panel widget live in PR C.
--
-- TR-first. Future jurisdictions (US/OSHA, GB/HSE, DE/ArbSchG) plug in by
-- swapping the 'scope' JSON template and adding country-specific collectors
-- on the worker side; no schema change needed here.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Table: ohs_archive_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ohs_archive_jobs (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_workspace_id      uuid        NOT NULL REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  company_identity_id       uuid        NOT NULL REFERENCES public.company_identities(id) ON DELETE CASCADE,
  jurisdiction_code         text        NOT NULL DEFAULT 'TR',
  year                      integer     NOT NULL,
  requested_by              uuid        NOT NULL REFERENCES auth.users(id),

  -- Lifecycle
  status                    text        NOT NULL DEFAULT 'pending',
  progress                  integer     NOT NULL DEFAULT 0,
  error_message             text,
  error_code                text,

  -- Scope: which sections (risk assessments, training, incidents, …).
  -- Shape is a versioned JSON so new categories can be added without a
  -- breaking schema change.
  --   { "version": 1, "categories": ["risk_assessments", "training_records", ...] }
  scope                     jsonb       NOT NULL,

  -- Output
  storage_bucket            text        NOT NULL DEFAULT 'ohs-archives',
  storage_path              text,                        -- e.g. 'org-<uuid>/company-<uuid>/2026/<jobid>.zip'
  file_size_bytes           bigint,
  file_sha256               text,                        -- integrity check
  download_url              text,                        -- signed URL, expires
  download_url_expires_at   timestamptz,
  download_count            integer     NOT NULL DEFAULT 0,
  last_downloaded_at        timestamptz,
  last_downloaded_by        uuid        REFERENCES auth.users(id),

  -- Timing
  started_at                timestamptz,
  completed_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ohs_archive_jobs_status_enum CHECK (status IN (
    'pending',      -- queued, worker hasn't picked up yet
    'processing',   -- worker collecting data / zipping
    'completed',    -- ZIP ready, download_url valid
    'failed',       -- worker errored; error_message / error_code populated
    'expired',      -- signed URL expired, ZIP still in storage (can regenerate URL)
    'cancelled'     -- user cancelled before completion
  )),
  CONSTRAINT ohs_archive_jobs_progress_range CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT ohs_archive_jobs_year_range CHECK (year BETWEEN 2000 AND 2100),
  CONSTRAINT ohs_archive_jobs_jurisdiction_format CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  CONSTRAINT ohs_archive_jobs_scope_shape CHECK (
    jsonb_typeof(scope) = 'object'
    AND jsonb_typeof(scope -> 'categories') = 'array'
  )
);

CREATE INDEX IF NOT EXISTS ohs_archive_jobs_org_idx       ON public.ohs_archive_jobs (organization_id);
CREATE INDEX IF NOT EXISTS ohs_archive_jobs_company_idx   ON public.ohs_archive_jobs (company_workspace_id);
CREATE INDEX IF NOT EXISTS ohs_archive_jobs_status_idx    ON public.ohs_archive_jobs (status);
CREATE INDEX IF NOT EXISTS ohs_archive_jobs_pending_idx   ON public.ohs_archive_jobs (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ohs_archive_jobs_year_idx      ON public.ohs_archive_jobs (company_workspace_id, year DESC);

COMMENT ON TABLE  public.ohs_archive_jobs IS 'Async job rows for generating Workplace OHS File archives (İşyeri İSG Dosyası). One row per (company_workspace, year, request).';
COMMENT ON COLUMN public.ohs_archive_jobs.jurisdiction_code IS 'ISO 3166-1 alpha-2 country code that drives which collector set the worker runs.';
COMMENT ON COLUMN public.ohs_archive_jobs.scope IS 'Versioned JSON: { version: 1, categories: [...] }. Drives what the worker packages.';
COMMENT ON COLUMN public.ohs_archive_jobs.storage_path IS 'Object key inside storage_bucket once the ZIP is uploaded.';
COMMENT ON COLUMN public.ohs_archive_jobs.file_sha256 IS 'SHA-256 of the produced ZIP; used for integrity checks and dedup.';


-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS ohs_archive_jobs_set_updated_at ON public.ohs_archive_jobs;
CREATE TRIGGER ohs_archive_jobs_set_updated_at
  BEFORE UPDATE ON public.ohs_archive_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.ohs_archive_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the requesting organization can see its archive jobs.
DROP POLICY IF EXISTS "ohs_archive_jobs_read_org" ON public.ohs_archive_jobs;
CREATE POLICY "ohs_archive_jobs_read_org"
  ON public.ohs_archive_jobs
  FOR SELECT
  USING (organization_id = public.current_user_organization_id());

-- INSERT: user must belong to the organization. Worker (service_role) bypasses.
DROP POLICY IF EXISTS "ohs_archive_jobs_insert_own_org" ON public.ohs_archive_jobs;
CREATE POLICY "ohs_archive_jobs_insert_own_org"
  ON public.ohs_archive_jobs
  FOR INSERT
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND requested_by = auth.uid()
  );

-- UPDATE: only the requester can cancel their own job (status -> 'cancelled').
-- The worker bypasses RLS via service_role; end users cannot flip any other
-- status or column directly.
DROP POLICY IF EXISTS "ohs_archive_jobs_cancel_own" ON public.ohs_archive_jobs;
CREATE POLICY "ohs_archive_jobs_cancel_own"
  ON public.ohs_archive_jobs
  FOR UPDATE
  USING (
    organization_id = public.current_user_organization_id()
    AND requested_by = auth.uid()
    AND status IN ('pending', 'processing')
  )
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND requested_by = auth.uid()
    AND status = 'cancelled'
  );

-- DELETE: we prefer hard-delete via storage TTL + job expiry; no user-facing
-- delete policy. Service_role can clean up.


-- ---------------------------------------------------------------------------
-- 4. Storage bucket
--   Private (no public access). Signed URLs only, issued by the worker.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ohs-archives', 'ohs-archives', false, 5368709120)  -- 5 GB cap
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read objects only via signed URL paths
-- tied to their organization. The worker (service_role) writes; end users
-- never upload directly to this bucket.
-- NOTE: Supabase Storage objects are keyed by (bucket_id, name). We enforce
--       that the path prefix contains the caller's organization_id.

DROP POLICY IF EXISTS "ohs_archives_read_own_org" ON storage.objects;
CREATE POLICY "ohs_archives_read_own_org"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ohs-archives'
    AND (storage.foldername(name))[1] = 'org-' || public.current_user_organization_id()::text
  );

-- No INSERT/UPDATE/DELETE policies for end users — writes happen from the
-- worker which runs as service_role and bypasses RLS.


COMMIT;

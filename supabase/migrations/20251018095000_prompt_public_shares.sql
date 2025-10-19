-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Public share table
CREATE TABLE IF NOT EXISTS public.prompt_public_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  version_mode text NOT NULL DEFAULT 'live' CHECK (version_mode IN ('live','fixed')),
  fixed_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT false,
  allow_copy boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.prompt_public_shares ENABLE ROW LEVEL SECURITY;

-- Anyone can read active public shares (metadata)
DROP POLICY IF EXISTS "Anyone can view active public shares" ON public.prompt_public_shares;
CREATE POLICY "Anyone can view active public shares"
ON public.prompt_public_shares FOR SELECT
USING (
  is_active = true
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
);

-- Owner manages share entries
DROP POLICY IF EXISTS "Owners manage public shares (insert)" ON public.prompt_public_shares;
CREATE POLICY "Owners manage public shares (insert)"
ON public.prompt_public_shares FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners manage public shares (update)" ON public.prompt_public_shares;
CREATE POLICY "Owners manage public shares (update)"
ON public.prompt_public_shares FOR UPDATE
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners manage public shares (delete)" ON public.prompt_public_shares;
CREATE POLICY "Owners manage public shares (delete)"
ON public.prompt_public_shares FOR DELETE
USING (auth.uid() = owner_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_prompt_public_shares_prompt_id ON public.prompt_public_shares(prompt_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_public_shares_slug ON public.prompt_public_shares(slug);

-- RPC: resolve public prompt by slug (security definer to safely read underlying tables)
CREATE OR REPLACE FUNCTION public.get_public_prompt_by_slug(_slug text)
RETURNS TABLE (
  slug text,
  prompt_id uuid,
  version_id uuid,
  title text,
  description text,
  prompt_template text,
  version_number integer,
  allow_copy boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.slug,
    s.prompt_id,
    COALESCE(s.fixed_version_id, v_live.id) AS version_id,
    p.title,
    p.description,
    pv.prompt_template,
    pv.version_number,
    s.allow_copy
  FROM public.prompt_public_shares s
  JOIN public.prompts p ON p.id = s.prompt_id
  LEFT JOIN LATERAL (
    SELECT id FROM public.prompt_versions WHERE prompt_id = p.id AND is_live = true LIMIT 1
  ) v_live ON TRUE
  JOIN public.prompt_versions pv ON pv.id = COALESCE(s.fixed_version_id, v_live.id)
  WHERE s.slug = _slug
    AND s.is_active = true
    AND s.revoked_at IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_public_prompt_by_slug(text) TO anon, authenticated;
-- Allow owners to SELECT their public share rows for management
-- Postgres does not support IF NOT EXISTS for CREATE POLICY; ensure idempotency by dropping first
DROP POLICY IF EXISTS "Owners view their public shares" ON public.prompt_public_shares;
CREATE POLICY "Owners view their public shares"
ON public.prompt_public_shares FOR SELECT
USING (auth.uid() = owner_id);
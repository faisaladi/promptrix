# Prompt Sharing Feature Spec

## Goals
- Enable sharing of prompts publicly and via invites with role-based access.
- Preserve version history; allow editors to create new versions; viewers can copy or save.

## Definitions
- Live Version: the current published version of a prompt.
- Fixed Snapshot: a specific version at share time that doesn’t change.
- Roles: `owner`, `viewer`, `editor`.

## Access Types
- Public Share
  - Dedicated URL for anonymous access.
  - View-only of Live version; Copy and optional “Save to Library” then redirect user to sign-in page.
  - Owner controls: toggle on/off, set version mode, expiry, revoke.
- Invite Share
  - Access granted to emails with `viewer` or `editor` role.
  - Viewer: read-only, Copy, Save to Library; cannot see full edit controls.
  - Editor: can see version history and create new versions.

## UX & Routes
- Public Page: `GET /p/:slug`
  - Read-only UI with Copy, optional Save to Library; banner “Public Prompt”.
- Invite Acceptance: `GET /invite/:token`
  - Handles auth, accepts invite, routes user to prompt.
- Share Dialog (inside existing Prompt modal)
  - Tabs: Public Link (toggle, live/fixed, expiry, copy URL, preview) and Invites (add emails, role, expiry, list & revoke/change role).
- Visual identifiers in modal & library
  - Owned: subtle badge “Owned”.
  - Viewer: blue badge “Shared • View only”, lock icon; inputs disabled.
  - Editor: amber badge “Shared • Edit access”, pencil icon; version actions enabled.
  - Filters on the prompt library : All prompts, Owned by me, Shared with me

## Data Model (new tables)
- `prompt_public_shares`
  - `id`, `prompt_id`, `owner_id`, `slug`, `is_active`, `version_mode` (`live|fixed`), `fixed_version_id?`, `allow_copy` (bool), `expires_at?`, `created_at`, `revoked_at?`.
- `prompt_invites`
  - `id`, `prompt_id`, `inviter_id`, `invitee_email`, `role` (`viewer|editor`), `token`, `status` (`pending|accepted|expired|revoked`), `expires_at?`, `accepted_user_id?`, `accepted_at?`, timestamps.
- `prompt_acl`
  - `prompt_id`, `user_id`, `role` (`viewer|editor`), `created_at`.
- Optional on `prompts`: `live_version_id` for faster lookups.

## Access Control & RLS
- Helper functions
  - `has_prompt_role(uid, prompt_id, roles[])` → checks `prompt_acl`.
  - `is_public_share_active(prompt_id)` → checks active share.
- Policies (illustrative)
  - `prompts.select`: owner OR `has_prompt_role(..., ['viewer','editor'])` OR public via view.
  - `prompts.update/insert/delete`: owner OR `has_prompt_role(..., ['editor'])`.
  - `prompt_versions.select`: same as `prompts.select`.
  - `prompt_versions.insert`: owner OR `editor`.
  - `prompt_public_shares/prompt_invites/prompt_acl.insert/update/delete`: owner only; limited select for necessary flows.

## API Outline
- Public
  - `GET /public/prompts/:slug` → Live or Fixed content + flags.
- Invites
  - `POST /prompts/:id/invites` → create invite (role, expiry).
  - `POST /invites/accept` → accept token → create `prompt_acl`.
  - `POST /prompts/:id/shares/public` → create/update public share.
  - `DELETE /prompts/:id/shares/public` → revoke.
  - `DELETE /prompts/:id/invites/:inviteId` → revoke.
  - `POST /prompts/:id/copy` → copy current viewable version to user’s library.

## Email & Tokens
- Invite emails: prompt name, role, expiry; link to `/invite/:token`.
- Tokens: opaque, short-lived; single-use optional; store securely.
- Ensure Supabase `SITE_URL` is correct per environment.

## Security
- Sanitize public content; avoid secrets.
- Rate limit public endpoints.
- Audit events (share, accept, revoke, copy).
- Enforce HTTPS and strict CORS.

## Migrations & Views
- Create tables: `prompt_public_shares`, `prompt_invites`, `prompt_acl`.
- Add RLS + helper functions.
- Optional `public_prompts_view` to expose safe fields for public access.
- Triggers to keep `live_version_id` in sync when publishing.

## Testing
- Unit: ACL checks, token verification.
- Integration: public fetch, invite accept, viewer restrictions, editor version creation.
- E2E: owner shares → recipient accepts → permissions enforced.
- Security: RLS denies for viewer/anon where appropriate; expired/revoked shares blocked.

## Rollout
- Ship migrations and functions.
- Implement endpoints.
- Build Share Dialog, Public Prompt page, Invite Acceptance page.
- Update routing in `App.tsx`.
- Configure email templates and `SITE_URL`.
- Test in staging; enable in production.

## Open Questions
- Should public shares allow “Save to Library” for anon (forcing auth at action)? --> yes
- Do we support organization-wide sharing in addition to user invites? --> yes
- Should editors be able to publish Live, or only owners? --> yes, can

---

# Implementation Details

## Public Share (Step-by-step)

- Database migration (create table + policies):

```sql
-- Table
CREATE TABLE public.prompt_public_shares (
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

-- Policies
CREATE POLICY "Anyone can view active public shares"
ON public.prompt_public_shares FOR SELECT
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE POLICY "Owners manage public shares"
ON public.prompt_public_shares FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update/revoke public shares"
ON public.prompt_public_shares FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete public shares"
ON public.prompt_public_shares FOR DELETE
USING (auth.uid() = owner_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_prompt_public_shares_prompt_id ON public.prompt_public_shares(prompt_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_public_shares_slug ON public.prompt_public_shares(slug);
```

- Optional view to expose resolved content:

```sql
CREATE OR REPLACE VIEW public.public_prompt_resolved AS
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
WHERE s.is_active = true AND (s.expires_at IS NULL OR s.expires_at > now());

ALTER VIEW public.public_prompt_resolved SET (security_invoker = true);
```

- Frontend
  - Route: add `Route path="/p/:slug"` to `App.tsx`.
  - Page: `src/pages/PublicPrompt.tsx` fetches by `slug` from `public_prompt_resolved` or `prompt_public_shares` and renders read-only UI.
  - Actions: `Copy` button; `Save to Library` requires auth (if not logged in, prompt sign-in).

- Share Dialog (Public tab)
  - Toggle `Public share` (`Switch`) → create/upsert row in `prompt_public_shares`.
  - Slug strategy: `kebab-case(title) + '-' + short-id`.
  - Controls: choose `version_mode` (`live|fixed`), set expiry, allow copy.
  - Show URL `SITE_URL + '/p/' + slug` with `Copy` action and "Preview" link.

- Supabase settings
  - Ensure `SITE_URL` points to the current environment to generate links correctly.

## Invite Share (Step-by-step)

- Database migration (create tables + policies):

```sql
-- ACL mapping
CREATE TABLE public.prompt_acl (
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, user_id)
);
ALTER TABLE public.prompt_acl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ACL entries that involve them"
ON public.prompt_acl FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Owners can grant access"
ON public.prompt_acl FOR INSERT
WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.prompts WHERE id = prompt_id)
);

CREATE POLICY "Owners can revoke access"
ON public.prompt_acl FOR DELETE
USING (
  auth.uid() = (SELECT user_id FROM public.prompts WHERE id = prompt_id)
);

-- Invites table
CREATE TABLE public.prompt_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer','editor')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prompt_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can create invites"
ON public.prompt_invites FOR INSERT
WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Owners can update/revoke invites"
ON public.prompt_invites FOR UPDATE
USING (inviter_id = auth.uid());

CREATE POLICY "Owners can delete invites"
ON public.prompt_invites FOR DELETE
USING (inviter_id = auth.uid());

CREATE POLICY "Users can view invites they sent or received"
ON public.prompt_invites FOR SELECT
USING (inviter_id = auth.uid() OR accepted_user_id = auth.uid());

-- RPC: accept invite by token
CREATE OR REPLACE FUNCTION public.accept_prompt_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.prompt_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.prompt_invites WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_invite.status <> 'pending' OR (v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now()) THEN
    RAISE EXCEPTION 'Invite is not valid';
  END IF;

  -- Grant access (upsert)
  INSERT INTO public.prompt_acl (prompt_id, user_id, role)
  VALUES (v_invite.prompt_id, auth.uid(), v_invite.role)
  ON CONFLICT (prompt_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Mark invite accepted
  UPDATE public.prompt_invites 
  SET status = 'accepted', accepted_user_id = auth.uid(), accepted_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.prompt_id;
END;
$$;
```

- Frontend
  - Invite Acceptance page: `src/pages/AcceptInvite.tsx` → on load, call `supabase.rpc('accept_prompt_invite', { _token: token })`, then route to the prompt (or `/library`).
  - Share Dialog (Invites tab): email input, role selector (`viewer|editor`), optional expiry; on submit, insert into `prompt_invites` with generated token (`crypto.randomUUID()`), show link and allow copying; use mail provider or Supabase templates to send email.

- UI cues
  - In Prompt modal, show banner/badge reflecting access level (Owned / Viewer / Editor).
  - In Prompt Library list, display badges: Owned, Shared • View only, Shared • Edit.

- Types
  - Update `src/integrations/supabase/types.ts` to include `prompt_public_shares`, `prompt_invites`, and `prompt_acl` so TypeScript knows the tables.
  - Alternatively, use `(supabase as any).from('prompt_invites')` temporarily during development.

- Settings
  - Ensure `SITE_URL` in Supabase Auth is set per environment (localhost vs production) so invite/public links open in the correct host.

## Acceptance Criteria
- Public link renders a read-only prompt page by `slug` with copy action.
- Owner can enable/disable a public share, choose live/fixed mode, set expiry.
- Invites can be created for `viewer` and `editor` roles; invite acceptance grants ACL and redirects.
- Prompt Library filters: All prompts, Owned by me, Shared with me.
- RLS prevents unauthorized access; anon can only view active public shares.

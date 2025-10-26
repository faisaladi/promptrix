# Code Review Action Items — 2025-10-19

This document captures concrete follow-ups from the recent codebase review. Items are grouped by priority with brief context and implementation notes.

High Priority

- [ ] SharePromptDialog: convert expiration to UTC ISO before saving
  - Context: `datetime-local` produces local time strings; saving directly to `timestamptz` can misinterpret timezones.
  - Implementation: In `src/components/SharePromptDialog.tsx`, before calling Supabase, transform `expiresAt` via `expiresAt ? new Date(expiresAt).toISOString() : null`.
  - Success criteria: Expiration comparisons in DB reflect intended UTC time; public shares expire reliably regardless of client timezone.

- [ ] Edge Functions: tighten CORS and unify OPTIONS handling
  - Context: Current CORS headers exist but should restrict origins and ensure consistent preflight responses across `chat-session`, `run-prompt`, and `public-prompts`.
  - Implementation: Read allowed origins from env; set `Access-Control-Allow-Origin` conditionally; include `Authorization`, `Content-Type`; handle `OPTIONS` early with 200 and no body.
  - Success criteria: All functions return correct CORS headers for allowed domains and reject disallowed origins; preflight requests succeed uniformly.

- [ ] Add basic rate limiting and structured logging with correlation IDs
  - Context: Prevent abuse and improve traceability across requests.
  - Implementation: In each Edge Function, generate `X-Request-ID` (use header or `crypto.randomUUID()`); add structured logs (JSON) with user_id, model/slug, conversation_id. Implement a simple sliding-window rate limit per user/IP (DB table or lightweight cache) for write-heavy endpoints.
  - Success criteria: Excessive requests return 429 with friendly message; logs show correlation IDs enabling end-to-end tracing.

- [ ] Validate and clamp chat input size
  - Context: Extremely large user messages can degrade performance and increase costs.
  - Implementation: In `chat-session/index.ts`, enforce max content length (e.g., 8–16k chars) and return 400 with clear error if exceeded.
  - Success criteria: Oversized inputs are rejected predictably with user-friendly errors; normal inputs unaffected.

- [ ] Deep-review remaining migrations for conversations/messages RLS, indexes, and constraints
  - Context: Ensure consistent RLS coverage and query performance for chat-related tables.
  - Implementation: Audit migrations under `supabase/migrations/` for `conversations`, `messages`, and related policies; add missing RLS policies, foreign key indexes, and useful composite indexes.
  - Success criteria: Clear documentation of RLS behavior; indexes exist for frequent lookups; no unintended data access paths.

Medium Priority

- [ ] SharePromptDialog: improve slug validation and duplicate handling
  - Context: UI generates slugs and checks for collisions, but DB unique constraint is authoritative. Improve UX and guard reserved paths.
  - Implementation: Validate slugs via regex (lowercase, hyphen-separated, 3–40 chars); block reserved words (e.g., `signin`, `library`, `privacy`, `terms`, `docs`, `settings`, `p`); on insert `23505` duplicates, show friendly message and regenerate.
  - Success criteria: Slug inputs are constrained; duplicate errors surface clear remediation.

- [ ] Public Prompts Gallery page
  - Context: Index has a “View Public Prompts” link but no gallery page.
  - Implementation: Create `src/pages/PublicPromptsGallery.tsx` to list active shares with search/filter. Since prompt titles/descriptions may require joining, add an RPC `get_public_prompt_list()` (SECURITY DEFINER) that returns `slug, title, description, version_number, allow_copy` for active shares.
  - Success criteria: Gallery loads public shares anonymously; clicking an item navigates to `/p/:slug`.

- [ ] Update Index header link to route to the new gallery
  - Context: Current link points to `#features`.
  - Implementation: Change in `src/pages/Index.tsx` to route to `/public` (or chosen path).
  - Success criteria: Header link opens the gallery page.

- [ ] Observability: unify error shapes and telemetry
  - Context: Standardize error payloads and track key events.
  - Implementation: Edge Functions return consistent JSON error format `{ error: { code, message } }`; track share link visits and copy/save actions via Mixpanel (anonymous + authenticated).
  - Success criteria: Errors parse consistently in UI; Mixpanel reflects meaningful event streams.

Low Priority

- [ ] Load fonts referenced by index.css
  - Context: `index.css` references Montserrat and Open Sans without loading them.
  - Implementation: Add `<link>` tags in `index.html` to Google Fonts (preconnect + stylesheet) or self-host fonts.
  - Success criteria: Typography matches design tokens consistently.

- [ ] Minor UX polish for public prompt page
  - Context: Copy disabled respects `allow_copy` but users can still manually copy text shown.
  - Implementation: Add helper text clarifying copy policy; consider trimming metadata display; optional CTA to sign in before saving to library.
  - Success criteria: Clear expectations; smoother flow for non-authenticated users.

References

- Files: `src/components/SharePromptDialog.tsx`, `src/pages/PublicPrompt.tsx`, `src/pages/Index.tsx`, `supabase/functions/*`, `supabase/migrations/*`
- RPC: `public.get_public_prompt_by_slug` (existing); propose `public.get_public_prompt_list`
- Config: `supabase/config.toml` (JWT verification), `index.html` (fonts)
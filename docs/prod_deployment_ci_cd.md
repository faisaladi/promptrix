# Production Deployment & CI/CD

This document outlines production deployment, CI/CD, environment/secrets management, Supabase releases, and operational guidance for the project.

## Overview
- Frontend: React 18 + Vite SPA, built to `dist/`.
- Backend: Supabase (Auth, Postgres, Storage) and Supabase Edge Functions.
- Source control: GitHub.
- Goal: reliable deployments with preview builds, automated checks, and typed safety.

## Hosting Options (Frontend)
Choose one path based on needs and cost. All options serve `dist/`.

### Recommended (Static SPA)
- Cloudflare Pages
  - Pros: global CDN, fast, generous free tier, easy GitHub integration.
  - Cons: CLI deploys use Wrangler; some learning curve.
- Vercel
  - Pros: excellent previews, edge network, simple setup.
  - Cons: pricing scales with usage; serverless features unused for SPA.
- Netlify
  - Pros: mature static hosting, previews, simple env mgmt.
  - Cons: pricing tiers and plugins complexity.

### Alternative (Container Hosting)
- Fly.io
  - Pros: full control, run a container (Node/static server), good edge regions.
  - Cons: more ops responsibility vs static hosts; paid usage beyond free.
  - Use when: you need custom Node server, websockets, long-running process.

## Quick Start — Cloudflare Pages
1) Connect repo in Cloudflare Pages UI.
2) Build command: `npm run build`; output dir: `dist`.
3) Set environment variables in Pages project:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4) On push to `main`, Pages builds and deploys automatically. PRs create preview deployments.

CLI (optional):
- Install Wrangler: `npm i -D wrangler`
- Deploy: `npx wrangler pages deploy dist --project-name <your-project>`

## Quick Start — Vercel
1) Import GitHub repo in Vercel.
2) Framework: Vite; Build: `npm run build`; Output: `dist`.
3) Set env vars in Vercel project for Production/Preview:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4) Push to `main` → production; PRs → previews.

Optional `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

## Quick Start — Netlify
1) Create site from GitHub.
2) Build: `npm run build`; Publish directory: `dist`.
3) Add env vars in Netlify UI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4) Push to `main` to deploy; PRs create previews.

Optional `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

## Quick Start — Fly.io (Container)
Use a simple container to serve static assets built by Vite.

`Dockerfile`:
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm i -g serve
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
```

`fly.toml` (generated via `flyctl launch`, then edit):
```toml
app = "glyph-prompt-vault"
primary_region = "sin"

[env]
PORT = "8080"

[[services]]
internal_port = 8080
protocol = "tcp"
[[services.ports]]
  port = 80
[[services.ports]]
  port = 443
```

Deploy:
- Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
- Create app: `flyctl launch` (choose region, skip DB)
- Set secrets (do not commit in `fly.toml`):
  - `flyctl secrets set VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=...`
- Deploy: `flyctl deploy --remote-only`
- Minimum spec: `shared-cpu-1x`, `256–512MB` RAM is sufficient for static serving.

## Supabase Deploys (Migrations & Edge Functions)
Production changes flow through the Supabase CLI with project linking and GitHub Actions.

### Requirements
- Supabase project ref: `SUPABASE_PROJECT_REF` (from dashboard)
- GitHub secrets:
  - `SUPABASE_ACCESS_TOKEN` (personal access token)
  - `SUPABASE_PROJECT_REF` (project ref)

### Migrations
- Keep SQL in `supabase/migrations/`.
- Apply to production via CLI:
  - Link: `supabase link --project-ref $SUPABASE_PROJECT_REF`
  - Push: `supabase db push`

### Edge Functions
- Functions live in `supabase/functions/*`.
- Deploy:
  - `supabase link --project-ref $SUPABASE_PROJECT_REF`
  - `supabase functions deploy chat-session`
  - `supabase functions deploy public-prompts`
  - `supabase functions deploy run-prompt`

## GitHub Actions — CI
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck || npx tsc --noEmit
      - run: npm run lint || npx eslint .
      - run: npm run build
```

## GitHub Actions — Deploy Frontend
Choose one workflow matching your host. Add env vars in your host’s dashboard.

### Vercel
`.github/workflows/deploy_web_vercel.yml`:
```yaml
name: Deploy Web (Vercel)
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci && npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: .
          prod: true
```

### Netlify
`.github/workflows/deploy_web_netlify.yml`:
```yaml
name: Deploy Web (Netlify)
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci && npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --dir=dist --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Cloudflare Pages (CLI option)
`.github/workflows/deploy_web_cloudflare.yml`:
```yaml
name: Deploy Web (Cloudflare Pages)
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci && npm run build
      - run: npm i -g wrangler
      - run: wrangler pages deploy dist --project-name ${{ secrets.CF_PAGES_PROJECT }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### Fly.io
`.github/workflows/deploy_web_fly.yml`:
```yaml
name: Deploy Web (Fly.io)
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@v1
      - run: flyctl deploy --remote-only --detach
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## GitHub Actions — Supabase Deploys
`.github/workflows/deploy_supabase.yml`:
```yaml
name: Deploy Supabase
on:
  push:
    branches: [ main ]

jobs:
  supabase:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Link project
        run: supabase link --project-ref $SUPABASE_PROJECT_REF
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
      - name: Push migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - name: Deploy functions
        run: |
          supabase functions deploy chat-session
          supabase functions deploy public-prompts
          supabase functions deploy run-prompt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Environment & Secrets Management
- Frontend env vars (set in hosting provider):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- GitHub Secrets:
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (if Vercel)
  - `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` (if Netlify)
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT` (if CF Pages)
  - `FLY_API_TOKEN` (if Fly.io)
  - `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (always)
- Never commit secrets; use provider dashboards and GitHub Secrets.

## Release Strategy
- Branches:
  - `main`: production releases
  - `develop` (optional): staging
  - PRs: preview deployments
- Versioning: tag releases with `vX.Y.Z`; include migration notes.
- Rollback:
  - Vercel/Netlify/CF Pages: revert to prior deployment via dashboard.
  - Fly.io: `flyctl releases` then `flyctl rollback <release>`.
  - Supabase: revert by restoring migrations and redeploying; keep SQL reversible.

## Monitoring & Observability
- Frontend: enable error reporting (Sentry or similar) and performance metrics.
- Supabase Functions: `supabase functions logs --project-ref <ref>` for runtime logs.
- Cost controls: estimate eval batch cost; add concurrency limits in functions.
- Analytics: integrate Mixpanel (see `docs/mixpanel.md`).

## Notes & Best Practices
- Treat all CI/CD payloads as `unknown` and narrow before use.
- Use strict TypeScript and ESLint rules to catch issues in CI.
- Keep deployments atomic; do not partially apply migrations without function updates.
- Document provider-specific configs in the repo (`vercel.json`, `netlify.toml`, `fly.toml`).

## Choosing a Host
- If you just need to serve `dist/`: pick Cloudflare Pages (fast, simple) or Vercel.
- If you plan Node SSR/websockets or custom runtime: pick Fly.io with a Dockerfile.
- Supabase stays the backend for DB/Auth/Edge Functions regardless of chosen host.

## Security for Payments and SSO

### Payment Safety
- Use a compliant processor (Stripe, Lemon Squeezy, Paddle); never handle card data yourself.
- Prefer hosted checkout pages; avoid custom card forms to reduce PCI scope.
- Verify webhook signatures (HMAC) and make processing idempotent using event IDs.
- Store only non-PCI data (plan, status, amount, customer ref). Keep PII minimal.
- Gate entitlements (subscriptions, credits) in Edge Functions; never trust the client.
- Restrict provider keys to server-side; mask in logs; rotate keys periodically.

### SSO & Auth Safety
- Use Supabase Auth for OAuth providers (Google, GitHub). For enterprise SSO (SAML/Okta/Azure AD), use a managed IdP (Auth0/WorkOS) and map identities to Supabase users.
- Enforce multi-tenancy via `org_id` + `user_id` on tables and Row Level Security (RLS).
- Store roles in `org_memberships` (owner/editor/viewer) and enforce permissions in RLS.
- Prefer provider-managed sessions; apply strict CSP and avoid storing sensitive tokens in `localStorage`.
- Audit login events and admin actions; add rate limiting and anomaly detection for auth flows.

### Supabase Policy Templates (RLS)
```sql
-- Example: org_memberships table (membership and role)
create table if not exists org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz default now()
);

-- Wallets example (only members of org can read/write as per role)
create policy wallets_select on wallets
for select using (
  exists (
    select 1 from org_memberships m
    where m.org_id = wallets.org_id and m.user_id = auth.uid()
  )
);

create policy wallets_insert on wallets
for insert with check (
  exists (
    select 1 from org_memberships m
    where m.org_id = wallets.org_id and m.user_id = auth.uid() and m.role in ('owner','editor')
  )
);

create policy wallets_update on wallets
for update using (
  exists (
    select 1 from org_memberships m
    where m.org_id = wallets.org_id and m.user_id = auth.uid() and m.role in ('owner','editor')
  )
);
```

### Webhook Handler Essentials (Edge Functions)
```ts
// Pseudocode (Deno) for Stripe-like webhook verification and idempotent processing
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  // Verify signature (use provider SDK or HMAC with shared secret)
  const verified = verifySignature(rawBody, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  if (!verified) return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 400, headers: jsonHeaders });

  const event = JSON.parse(rawBody) as { id: string; type: string; data: unknown };
  // Idempotency: ensure event.id is processed only once
  const already = await hasProcessedEvent(event.id);
  if (already) return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: jsonHeaders });

  // Narrow and apply business logic (update subscriptions/wallets)
  await processEvent(event);
  await markEventProcessed(event.id);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
});
```

### Implementation Checklist
- Payments: hosted checkout, webhook verification, idempotency, minimal data storage, entitlements gating.
- Auth/SSO: provider-managed identity, `org_id` multi-tenancy, role-based RLS, audit + rate limiting.
- Secrets: server-side only, rotation and masking, strict origin/CORS for Edge Functions.
- Observability: structured logs with request IDs, alerts on webhook failures and auth anomalies.
- Compliance: tax/VAT via processor; publish privacy policy and consent flows (BYOK, training).
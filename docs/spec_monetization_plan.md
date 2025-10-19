# Monetization Plan — Specification

## Objectives
- Monetize high-value compute (prompt runs, evals, batch matrices) while keeping core usage accessible.
- Let cost-sensitive users run via BYOK; charge for platform features and convenience.
- Enable creator revenue via a prompt marketplace; support teams and enterprise contracts.

## Offerings
- BYOK (Bring Your Own Key): Users supply LLM provider keys; you monetize features, not tokens.
- Credits Wallet: Pay-as-you-go for platform-hosted runs/evals and premium features.
- Subscriptions: Tiered feature gates, monthly credit bundles, seats.
- Prompt Marketplace: Sell prompts/templates; revenue share with creators.
- Long-term (opt-in) Training/Optimization: Effectiveness modeling on stored prompts by consent.

## Pricing & Tiers (examples)
- Free: BYOK-only runs, limited private prompts, small eval cap (e.g., 100 credits/mo), public shares.
- Starter ($9/mo): 1–2k credits/mo, version history, basic batch runs, marketplace listings.
- Pro ($29/mo): 10k credits/mo, full batch evals, compare tools, boosted marketplace listings, 3 seats.
- Team ($99/mo): 25k credits/mo, 10 seats, SSO, advanced analytics, priority support.
- Enterprise (custom): SLAs, custom limits, private marketplace, on-prem options.

## Credits Model
- Definition: 1 credit per 1k processed tokens OR per-criterion evaluation per run (pick one; keep it simple).
- Pre-run estimate: `combos × repetitions × (criteria cost or token estimate)`; show $ equivalent.
- Packs: $10 → 10k credits; $50 → 60k; $100 → 150k.
- Guardrails: daily caps, concurrency limits, warnings at 80% usage, hard stops at 100% unless user confirms top-up.

## BYOK (Reduce Cost)
- Providers: OpenAI, Anthropic, Azure OpenAI (extendable).
- Storage: encrypt keys at rest; scope by `user_id`; never expose client-side.
- Validation: provider ping + model whitelist; redact logs.
- Fallback: Offer platform key runs with explicit credit charges when BYOK fails.

## Prompt Marketplace
- Business model: creator revenue share (e.g., 80/20); optional listing fees; featured placements.
- Commerce: Stripe Connect or Lemon Squeezy; handle global taxes (VAT/GST) via provider.
- Governance: moderation, ratings/reviews, DMCA takedown, refund policy.
- Discovery: tags, use cases, collections, featured promos.

## Subscriptions & Teams
- Feature gates: batch size, eval concurrency, history retention, collaboration/sharing options.
- Seats & roles: owner, editor, viewer; map to Supabase RLS.
- Overages: when caps hit, fall back to credits wallet; keep UX smooth.

## Consent-Based Training (Long-term)
- Opt-in toggle per prompt with clear data usage statement.
- Use anonymized inputs/outputs and eval metadata; maintain audit trail.
- Incentives: reduced credit prices or optimization tools; possible revenue share for improvements.

## Technical Architecture
- Supabase: typed tables for wallets, transactions, usage events, subscriptions, marketplace listings/purchases/payouts, BYOK keys.
- Edge Functions: stateless, short-lived, typed payloads; concurrency limits for evals.
- Frontend: wallet UI, pricing page, BYOK management, marketplace listing/purchase, eval pre-run estimates.

## Data Model (Supabase)
- `wallets`: `id`, `user_id`, `balance_credits`, `created_at`.
- `wallet_transactions`: `id`, `wallet_id`, `type` (purchase/topup/charge/refund), `credits`, `amount_cents`, `meta`.
- `usage_events`: `id`, `user_id`, `kind` (run/eval/batch), `units` (tokens/criteria), `credits`, `model`, `prompt_version_id`, `created_at`.
- `subscriptions`: `id`, `user_id`/`org_id`, `plan`, `status`, `renewal_at`, `meta`.
- `marketplace_listings`: `id`, `owner_user_id`, `title`, `description`, `tags[]`, `price_cents`, `visibility`, `created_at`.
- `marketplace_purchases`: `id`, `buyer_user_id`, `listing_id`, `price_cents`, `status`, `created_at`.
- `payouts`: `id`, `owner_user_id`, `amount_cents`, `status`, `created_at`.
- `byok_keys`: `id`, `user_id`, `provider`, `encrypted_key`, `created_at`.
- RLS: enforce `user_id` (and `org_id`) for all sensitive tables.

## Edge Functions
- `billing-webhook`: Stripe/Lemon Squeezy events; idempotent; update wallets/subscriptions.
- `usage-meter`: record credits and tokens per run/eval; emit usage events.
- `credits-charge`: estimate + reserve + finalize charges; enforce caps.
- `byok-keys`: CRUD, provider validation; encryption and redaction.
- `marketplace`: listing CRUD, purchase entitlement checks, payouts.

## Security & Compliance
- Secrets: KMS or provider-managed encryption for BYOK; rotate keys, mask in logs.
- Commerce: tax/VAT via payment processor; dispute handling; PCI via provider.
- Privacy: transparent consent for training; opt-out and data deletion flows.

## UX & Flows
- Wallet: balance, usage logs, add credits, alerts at 80% usage.
- Pricing: plan comparison, credit packs, upgrade/downgrade.
- BYOK: add key → validate → provider/model selection.
- Marketplace: create listing → moderation → purchase → entitlement view.
- Evals: pre-run estimate (credits/$), progress, post-run usage summary.

## Rollout Plan
- Phase 1: Credits + BYOK (wallet, metering, BYOK storage/validation, pre-run estimates).
- Phase 2: Subscriptions (tier gates, seats, webhooks, upgrade/downgrade).
- Phase 3: Marketplace (listings, purchases, payouts, moderation).
- Phase 4: Consent-based training (toggles, anonymization, optimization tooling).

## KPIs
- Conversion (free → paid), ARPU, credit burn rate, BYOK adoption.
- Marketplace GMV, take rate, refund rate, rating distribution.
- Reliability: failed runs %, latency; webhook failure rate.

## Risks & Mitigations
- LLM cost volatility: caps, estimates, cheaper models for evals.
- Fraud/abuse: rate limits, device checks, risk scoring; manual review of marketplace.
- Compliance: use processors for global taxes; publish clear policies.
- Data privacy: strict BYOK secrecy, revocable consent, audit trails.

## Next Steps
- Migrations for wallets, usage, subscriptions, marketplace, BYOK.
- Edge Functions scaffolding: `billing-webhook`, `usage-meter`, `credits-charge`, `byok-keys`, `marketplace`.
- Pricing page and wallet UI; BYOK settings; marketplace MVP.
- Add pre-run credit estimates and concurrency caps to eval runner.
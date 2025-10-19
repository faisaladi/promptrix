# Prompt Evals — Specification

## Overview
Introduce a first-class evaluation system for prompts: standard evals, custom evals, historical tracking, and multi-run test matrices. The goal is to help users prove prompt reliability and production readiness with repeatable, transparent metrics.

## Goals
- Give users clear, trustworthy scores for each prompt version.
- Support both turnkey standard evals and flexible custom evals.
- Persist all runs, inputs, and results for traceability and auditing.
- Enable multi-run testing across test cases and criteria to surface stability and regressions.

## Feature Scope
### 1) Standard Eval
- Built-in criteria: security (injection resilience), accuracy (ground truth / LLM-judge), consistency (variance across runs), harmfulness/toxicity, latency, cost.
- One-click run against selected prompt version + sample inputs.
- Weighted aggregate score with per-criterion breakdown.
- Acceptance: Users can run and see a scorecard with details and evidence.

### 2) Custom Eval
- Users define eval templates: name, criteria, weights, thresholds, and input sources.
- Criteria types: rule-based (regex/contains), reference-based (expected answers), LLM-judge (rubrics), external service (moderation APIs).
- Acceptance: Users can create, save, reuse templates; run templates against any prompt version.

### 3) Evals History
- Timeline of runs per prompt version: scores, inputs, outputs, criteria, and decisions.
- Ability to compare two runs (diff inputs, outputs, scores).
- Acceptance: Users can filter by version/date/status and export run summaries.

### 4) Multiple Run Test & Eval
- Batch runs across combinations: prompt versions × test cases × criteria sets.
- Controls for repetitions (n), temperature overrides, and concurrency.
- Acceptance: Users can configure a matrix, run it, monitor progress, and view aggregated statistics (mean, stddev, pass rate).

## Architecture
- UI (React + shadcn/ui): Evals tab on prompt page; Custom Eval builder; History timeline; Batch matrix runner.
- Edge Functions (Deno): `eval-run`, `eval-batch`, `eval-history`, `eval-templates` to execute evaluations and manage state.
- Supabase (typed client): Tables for templates, criteria, test cases, runs, results, batches.

## Data Model (Supabase)
- `eval_templates`
  - `id uuid pk`, `user_id uuid`, `name text`, `description text`, `weights jsonb`, `config jsonb`, `created_at timestamptz`
- `eval_criteria`
  - `id uuid pk`, `template_id uuid fk`, `type text` (enum: `rule`, `reference`, `llm_judge`, `external`), `name text`, `config jsonb`, `weight numeric`, `created_at timestamptz`
- `eval_test_cases`
  - `id uuid pk`, `user_id uuid`, `prompt_id uuid fk`, `prompt_version_id uuid fk`, `name text`, `input jsonb`, `expected jsonb`, `created_at timestamptz`
- `prompt_eval_batches`
  - `id uuid pk`, `user_id uuid`, `name text`, `matrix jsonb` (versions, criteria sets, repetitions), `status text` (enum: `pending`,`running`,`completed`,`failed`), `created_at timestamptz`
- `prompt_eval_runs`
  - `id uuid pk`, `user_id uuid`, `prompt_id uuid fk`, `prompt_version_id uuid fk`, `batch_id uuid fk nullable`, `template_id uuid fk nullable`, `test_case_id uuid fk nullable`, `settings jsonb` (temp, repetitions), `status text` (enum), `started_at timestamptz`, `ended_at timestamptz`, `aggregate_score numeric`, `cost_cents integer`, `latency_ms integer`
- `prompt_eval_results`
  - `id uuid pk`, `run_id uuid fk`, `criterion_id uuid fk nullable`, `score numeric`, `passed boolean`, `details jsonb` (evidence, diffs), `model_output text`, `judge_output text`, `created_at timestamptz`

Indexes & RLS
- Indexes on `prompt_version_id`, `batch_id`, `template_id`.
- RLS: `user_id = auth.uid()` for templates, test cases, batches, runs, results.

## APIs (Edge Functions)
- `POST /eval-run`
  - Input: `prompt_version_id`, optional `template_id` or inline `criteria[]`, optional `test_case_id` or `inputs[]`, `settings` (temp, repetitions).
  - Output: `run` with `results[]`, aggregate score, cost, latency.
- `POST /eval-batch`
  - Input: `matrix` (version IDs, criteria sets, test cases, repetitions), concurrency.
  - Output: `batch` entity; progress updates; final aggregate stats.
- `GET /eval-history`
  - Query by `prompt_id` or `prompt_version_id`, filters (date, status).
  - Output: paginated runs with scores and summaries.
- `POST /eval-templates`
  - CRUD for templates and criteria definitions.

## Scoring & Metrics
- Aggregate score = weighted sum of per-criterion scores (0–1).
- Accuracy: compare model output to expected via LLM-judge rubric or exact/regex match.
- Consistency: variance across `n` runs; score = `1 - normalized_variance`.
- Security: injection-resilience tests (red team prompts); score = pass rate.
- Harmfulness: moderation API score inverted (safer → higher score).
- Latency & Cost: measured per run; included in score by configured weights.

## UX Flows
- Standard Eval Runner: select version → sample inputs → run → scorecard with evidence.
- Custom Eval Builder: define criteria and weights → save template → run against version/test cases.
- History: list runs with filters → view details → compare runs.
- Batch Matrix: configure combinations and repetitions → run → progress bar → aggregated stats and per-combination results.

## Roadmap & Milestones
- M1: Standard eval (runner, scorecard, basic tables, single run, history list).
- M2: Custom eval (templates/criteria CRUD, run with templates, LLM-judge rubric support).
- M3: History enhancements (diff compare, export, filters, pagination).
- M4: Batch runs (matrix config, progress tracking, aggregate stats, concurrency controls).

## Risks & Notes
- Cost control: batch runs can be expensive; add concurrency limits, warnings, and cost estimates.
- Consistency caveats: model determinism varies; document temp settings and retry policy.
- Security coverage: heuristics are evolving; allow users to add custom red team cases.
- Provenance: store inputs/outputs/judge rationale for auditing; support export.

## Non-Functional
- Typed end-to-end: payloads as `unknown` → narrowed; Supabase types used throughout.
- Observability: structured logs with run IDs; basic progress events.
- Performance: streaming where possible; avoid large payloads in a single response.
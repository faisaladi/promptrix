# TypeScript Type Safety Rules (Trae Workspace)

Always write type‑safe code in TypeScript. Use explicit, precise types everywhere and avoid implicit `any`.

## Core Principles
- Never use `any`. Prefer precise types, `unknown`, or generics.
- Treat all external inputs (API, storage, query params, user events) as `unknown` and narrow safely.
- Avoid `as` casts unless at a trusted boundary. Prefer `satisfies` for compile‑time validation.
- Model domain data using generated types (e.g., `Database["public"]["Tables"]["..."]["Row"|"Insert"|"Update"]`).
- Keep error handling typed as `unknown`; extract messages via safe narrowing.

## Prohibited Patterns
- `any` in variables, parameters, return types, or error handlers.
- `as any` or blanket `as Type` casts to silence compiler errors.
- Unspecified generics when a function expects them (e.g., `useQuery`, `invoke`).

## Preferred Alternatives
- Use `unknown` for untrusted values, then narrow:
  ```ts
  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    // ...
  };
  ```
- Use generics to type function results:
  ```ts
  // Supabase Edge Functions
  type MyFnResponse = { foo: string };
  const { data, error } = await supabase.functions.invoke<MyFnResponse>("my-fn", { body: payload });
  ```
- Validate payloads with `satisfies` (no runtime cost, strong compile‑time checks):
  ```ts
  import type { Database } from "@/integrations/supabase/types";
  type PromptInsert = Database["public"]["Tables"]["prompts"]["Insert"];

  const payload = {
    title: "Hello",
    prompt_template: "...",
    user_id: user.id,
    use_case: "other",
    is_active: true,
  } satisfies PromptInsert;
  ```
- Narrow selected fields with `Pick` to match `select()` projections:
  ```ts
  type PVRow = Database["public"]["Tables"]["prompt_versions"]["Row"];
  type PVList = Pick<PVRow, "id" | "version_number" | "is_live">[];

  const { data } = await supabase
    .from("prompt_versions")
    .select("id, version_number, is_live")
    .eq("prompt_id", promptId);
  const versions = data as PVList;
  ```

## Supabase Typing Rules
- Use the typed client everywhere (ensure it’s initialized with `Database`).
- Queries: always provide generics in consumers when needed (React Query, helpers):
  ```ts
  import type { Database } from "@/integrations/supabase/types";
  type PromptRow = Database["public"]["Tables"]["prompts"]["Row"];

  const { data: prompts } = useQuery<PromptRow[] | null>({
    queryKey: ["prompts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prompts").select("*");
      if (error) throw error;
      return data as PromptRow[];
    },
  });
  ```
- Edge Functions: generically type `invoke<T>()` responses. Never cast the `data` to `T` without the generic.
- Inserts/Updates: prefer `satisfies` to validate payloads; avoid `as Insert` unless unavoidable.

## React Props and Events
- Component props must be explicitly typed with real domain types:
  ```ts
  interface SharePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prompt: Database["public"]["Tables"]["prompts"]["Row"];
  }
  ```
- Event handlers must use precise React types:
  ```ts
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
  const onSelect = (v: string) => setOption(v);
  ```

## Error Handling
- Always type errors as `unknown` and narrow to `Error`:
  ```ts
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    toast({ title: "Error", description: message, variant: "destructive" });
  },
  ```
- Never rely on `error.message` without narrowing.

## Generics and Casting Discipline
- Prefer generics over `as`:
  - Good: `invoke<MyResponse>(...)`, `useQuery<MyRow[]>(...)`.
  - Avoid: `(data as MyResponse)` unless unavoidable and at a trusted boundary.
- If casting is absolutely required (interop, legacy), isolate at the boundary and add comments explaining why.

## Configuration (enforcement)
- TypeScript (tsconfig): enable strictness (adjust if already enabled)
  ```jsonc
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "exactOptionalPropertyTypes": true,
      "noUncheckedIndexedAccess": true
    }
  }
  ```
- ESLint: disallow explicit `any`
  ```js
  // eslint.config.js (excerpt)
  import ts from "typescript-eslint";
  export default [
    // ...
    ts.config({
      // ...
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/explicit-module-boundary-types": "warn",
        // Recommended: ensure promises are handled
        "@typescript-eslint/no-floating-promises": "error",
      },
    }),
  ];
  ```

## Quick Examples
- React Query with typed rows and safe errors:
  ```ts
  type PVRow = Database["public"]["Tables"]["prompt_versions"]["Row"];

  const versionsQuery = useQuery<PVRow[]>({
    queryKey: ["prompt-versions", promptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_versions")
        .select("*")
        .eq("prompt_id", promptId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data as PVRow[];
    },
  });

  const setLiveMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const { error: unsetError } = await supabase
        .from("prompt_versions")
        .update({ is_live: false })
        .eq("prompt_id", promptId);
      if (unsetError) throw unsetError;
      const { error: setError } = await supabase
        .from("prompt_versions")
        .update({ is_live: true })
        .eq("id", versionId);
      if (setError) throw setError;
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to update live version";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });
  ```

- Supabase Edge Function response typing:
  ```ts
  type PublicPromptResponse = { prompt: { slug: string; prompt_id: string; prompt_template: string; allow_copy: boolean; } };
  const { data, error } = await supabase.functions.invoke<PublicPromptResponse>("public-prompts", { body: { slug } });
  if (error) throw error;
  const template = data.prompt.prompt_template;
  ```

Adopt these rules across components, hooks, and edge functions. If a feature appears hard to type, default to `unknown` and narrow rather than using `any`.

## Additional Project Rules and Context

### Project Stack
- React 18 + Vite + TypeScript
- TanStack React Query for data fetching and caching
- Supabase typed client (`Database` types, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums` helpers)
- shadcn/ui + Tailwind CSS for UI components and styling
- Supabase Edge Functions (Deno runtime) for server-side logic

### Environment & Secrets
- Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`. Never ship service role keys to the client.
- Edge Functions read secrets from the function environment; avoid hardcoding.
- Do not log secrets. Scrub sensitive data in error paths.

### Supabase Practices
- Always initialize and use the typed Supabase client. Prefer the helper types (e.g., `Tables<"prompts">`) over raw `Database[...]` paths for readability.
- Match `select()` projections with types via `Pick<Row, ...>` to keep responses aligned.
- Prefer `satisfies` for insert/update payload validation over `as` casts.
- Keep query keys stable and descriptive: `['prompts']`, `['prompt-versions', promptId]`.

### Edge Functions Standards
- Use `Deno.serve` for handlers; do not import `serve` from `jsr:@supabase/functions-js`.
- Handle `OPTIONS` preflight and set CORS headers consistently for public endpoints.
- Return structured JSON responses with explicit status codes and content-type.
- Validate all inputs; treat request bodies as `unknown` until parsed and narrowed.

### React Query Patterns
- Type query results with generics: `useQuery<MyRow[]>`.
- Use `enabled` to guard queries that depend on IDs or auth.
- Handle errors as `unknown`; narrow to `Error` for messages.
- Invalidate by stable keys after mutations to keep UI in sync.

### UI & Styling
- Use shadcn/ui components; avoid custom untyped components without props typed.
- Prefer Tailwind utility classes; avoid inline styles.
- Keep accessibility in mind: semantic tags, labels, focus states.

### Naming & Structure
- Components: `PascalCase` files exporting named components.
- Hooks: `useCamelCase` in `src/hooks/`.
- Supabase integration: `src/integrations/supabase/` (client, types, helpers).
- Edge functions: `supabase/functions/<feature>/index.ts` with typed handlers.

### Testing & Build
- Run `npm run build` (or `tsc --noEmit`) to catch type errors before pushing.
- Manual smoke tests for key flows (auth, library CRUD, sharing, public view).
- Prefer small, isolated changes with clear rationale and documentation updates.

### Linting & TS Config Enforcement
- Enable strict TypeScript options: `strict`, `noImplicitAny`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- ESLint rules to enforce safety:
  - `@typescript-eslint/no-explicit-any`: error
  - `@typescript-eslint/consistent-type-imports`: error
  - `@typescript-eslint/no-floating-promises`: error
  - Optional: `@typescript-eslint/no-misused-promises`: error

### Migrations & Types Update
- Add schema changes via SQL files in `supabase/migrations/`.
- After migrations, update local `Database` types (codegen or manual sync) and refactor inserts/rows accordingly.
- Review RLS policies and ensure the UI follows auth constraints.

### Security
- Never expose service role keys or privileged endpoints to the client.
- Validate and sanitize all user input on both client and edge functions.
- Use least privilege; rely on RLS for data access.

### PR & Code Review Guidelines
- Include a short summary of changes, rationale, and affected areas.
- Call out any schema changes and updated types.
- Keep diffs focused; avoid drive-by refactors unless necessary.
- Ensure type safety, lint, and build pass before requesting review.
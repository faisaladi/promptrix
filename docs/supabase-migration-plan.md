**Supabase Migration Plan**

**Overview**
- Goal: Migrate the application from the current Supabase project (`baotwmfkvvwpkvgizfbc`) to a new Supabase account/project with minimal downtime and no data loss.
- Scope: Database schema and data, Auth users, Storage buckets, Edge Functions, environment configuration, and app validation.

**Prerequisites**
- Access to the new Supabase account with permission to create projects.
- New project created in Supabase and basic quotas confirmed.
- Keys and URLs from the new project available: `Project Ref`, `API URL`, `Anon Key`, `Service Role Key`, `DB connection string`.
- Local environment able to run `npm run dev` and `npm run build`.
- Optional: Supabase CLI configured to target the new project (update `supabase/config.toml` and login with an access token).

**Inventory**
- App configuration:
  - `.env` currently contains `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`.
  - `src/integrations/supabase/client.ts` uses `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - `supabase/config.toml` sets `project_id = "baotwmfkvvwpkvgizfbc"` and requires JWT verification for functions.
- Database schema (public): `prompts`, `prompt_versions`, `conversations`, `messages`, `chat_history`, `organizations`, `organization_members`, `profiles`; enum `use_case_type`; SQL functions: `has_org_role`, `is_org_member`.
- Migrations: `supabase/migrations/*.sql` (timestamped order).
- Edge Functions: `supabase/functions/chat-session`, `supabase/functions/run-prompt`.
- Auth: Supabase Auth with email/password; JWT required for edge functions.
- Storage: Any buckets/files your app uses (confirm in Supabase Storage dashboard).

**Data Freeze & Timeline**
- Schedule a short maintenance window (read-only mode recommended) during data export/import.
- Communicate: users may be signed out; password resets may be required depending on Auth migration method.

**Create New Project & Collect Keys**
- In the new Supabase account, create a project.
- Collect:
  - `Project Ref` (e.g., `abcd1234...`).
  - `API URL` (e.g., `https://<project>.supabase.co`).
  - `Anon Key` and `Service Role Key` from Project Settings → API.
  - `DB connection string` from Project Settings → Database.

**Option A: Apply Schema via Migrations (Recommended)**
- Use the existing SQL migration files to create the schema on the new project.
- Methods:
  - SQL Editor: paste each migration file sequentially (by timestamp) into the new project’s SQL editor and run.
  - `psql` from local to remote DB:
    - Set env for connection and run each file in order:
      - `psql "<NEW_DB_CONNECTION_STRING>" -f supabase/migrations/20250930092932_*.sql`
      - Repeat for every migration in chronological order.
- Verify: tables, enums, functions, and RLS policies are present after applying all migrations.

**Option B: Dump and Restore (Alternative)**
- If your current project has changes not reflected in `supabase/migrations`, you can:
  - `pg_dump` schema from old project and restore to new.
  - Create a new migration from the diff and save into `supabase/migrations` for future maintenance.

**Import Application Data (Non-Auth)**
- Export from old project and import to new, table by table:
  - `pg_dump --data-only --schema=public --table=prompts --table=prompt_versions ... -f data.sql`
  - `psql "<NEW_DB_CONNECTION_STRING>" -f data.sql`
- Alternatively, use CSV `COPY` for large tables:
  - Export CSVs per table and import via SQL Editor or `psql` `\copy`.
- Order considerations: import parent tables before children to satisfy foreign keys (`prompts` before `prompt_versions`, etc.).

**Auth Users Migration**
- Passwords and identities are managed by GoTrue; direct copying of `auth.users` is not supported.
- Options:
  - Re-registration: simplest, but users must sign up again.
  - Admin import: use Supabase Auth import tooling or APIs to import users (requires careful handling; some providers may need re-linking).
- Consequences: existing sessions and tokens will be invalid; communicate a forced sign-out and re-auth.

**Storage Migration**
- For each bucket in the old project:
  - Export files (download locally or via a script using `@supabase/supabase-js`).
  - Re-create buckets in the new project (same names and policies).
  - Upload files to the new buckets.
- Simple Node script approach:
  - Old client: `createClient(oldUrl, oldKey)` → list and download objects.
  - New client: `createClient(newUrl, serviceRoleKey)` → upload to the destination bucket.
- Update any public URLs or signed URL code that depends on bucket names or project.

**Edge Functions Migration**
- Update project reference in `supabase/config.toml`:
  - Set `project_id = "<NEW_PROJECT_REF>"`.
- Deploy functions to the new project:
  - `supabase functions deploy chat-session --project-ref <NEW_PROJECT_REF>`
  - `supabase functions deploy run-prompt --project-ref <NEW_PROJECT_REF>`
- Set function secrets as needed (examples):
  - `supabase functions secrets set SUPABASE_URL="<NEW_API_URL>" --project-ref <NEW_PROJECT_REF>`
  - `supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY="<NEW_SERVICE_ROLE_KEY>" --project-ref <NEW_PROJECT_REF>`
- Verify JWT enforcement remains correct (`verify_jwt = true` is set).

**Update Environment Configuration**
- Edit `.env` with new project values:
  - `VITE_SUPABASE_PROJECT_ID="<NEW_PROJECT_REF>"`
  - `VITE_SUPABASE_URL="<NEW_API_URL>"`
  - `VITE_SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"`
- Confirm `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- If edge functions require secrets, set them via the CLI (as above).

**Application Validation**
- Start dev server and verify flows:
  - `npm run dev` and sign in on `http://localhost:8081/signin`.
  - Navigate to `http://localhost:8081/library`.
  - Confirm prompts load, filter by use case and tags works.
  - Create/edit/delete prompt; verify Supabase writes and RLS policies.
  - Run chat flows and ensure conversations/messages insert correctly.
- TypeScript check:
  - `npx tsc --noEmit` should pass.
  - `npm run build` should succeed.

**Cutover & Rollback**
- Cutover:
  - Point your production `.env` to the new project values.
  - Restart the app/services to pick up new envs.
- Keep the old project intact for a short period as a rollback option.
- Rollback plan:
  - Revert `.env` to old values.
  - Redeploy edge functions pointing back to old `project_id` if needed.

**Post-Migration Tasks**
- Update internal documentation and secrets vaults with new keys.
- Audit RLS policies and test with several real user roles.
- Monitor error logs and metrics; run through critical user journeys.

**Checklists**
- New project ready: `Project Ref`, `API URL`, `Anon Key`, `Service Role Key`, `DB string`.
- Migrations applied sequentially; schema verified.
- Data imported; referential integrity validated.
- Auth approach decided; user communication sent.
- Buckets replicated; object counts match.
- Edge functions deployed; secrets set; JWT verified.
- `.env` updated; client reads new values; build passes.
- End-to-end testing complete; rollback window defined.

FROM SUPABASE CS:
To migrate your Lovable Cloud project to another Supabase instance, follow these steps:

Prerequisites
Create a new Supabase project where you want to migrate your data
Note that user migration is not currently possible, so plan this before your app has real users you don't want to lose
Migration Steps
1. Update Configuration
In your Lovable project:
Go to Code and locate the supabase/config.toml file
Replace your Lovable Cloud project ID with your new Supabase project ID
Save the changes
2. Run Database Migrations
Your Lovable Cloud project includes SQL migration files in the supabase/migrations/ folder:
Run them in chronological order based on the timestamp in the filename (earliest to latest)
For each migration file:
Copy the entire SQL content
Paste it into the SQL editor in your new Supabase project
Run and wait for success message
If a migration fails, check the migration order, table dependencies, and SQL syntax errors

3. Export and Import Data
Export from Lovable Cloud:
Go to Cloud → Database → Table
Click Export CSV for each table with data
Save the files
Import to new Supabase:
Go to Table Editor in your new Supabase project
For each table, click Insert → Import data from CSV
Map columns correctly and click Import data

4. Migrate Storage Files
In your Lovable project, go to Cloud → Storage
Download files from your storage buckets
In your new Supabase project, go to Storage and upload files to corresponding buckets

5. Reconfigure Authentication
If your project uses authentication:
In your new Supabase project, go to Authentication → Sign In / Providers
Enable and configure each provider you were using
Update redirect URLs in your OAuth app settings (Google Console, GitHub, etc.) to use your new Supabase project URL

Important Notes
This migration is possible because Lovable wants you to stay by choice, not necessity
User data cannot be migrated at this time
Plan carefully if you have existing users to avoid data loss
The process requires some technical knowledge, but following these steps in order should successfully migrate your project to your new Supabase instance.
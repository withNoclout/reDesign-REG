# Local PostgreSQL cutover blueprint

## Target state
- Application public URL: `https://redesign-reg.kmutnb.ac.th`
- Web runtime: Next.js behind Apache reverse proxy on `127.0.0.1:3333`
- Primary database: local PostgreSQL on `127.0.0.1:5432`
- File storage: local filesystem first, MinIO optional later
- External dependency kept: KMUTNB REG APIs for authentication and student data

## Current database and storage footprint
### Tables used by the application
- `students`
- `student_profiles`
- `evaluation_submissions`
- `news_items`
- `portfolio_collaborators`
- `user_directory`
- `user_settings`
- `user_verifications`

### Supabase-specific features currently in use
- `@supabase/supabase-js` query client in API routes and adapters
- Supabase Storage bucket `portfolio-assets`
- Supabase Storage bucket `profile-images`
- Row Level Security scripts written for Supabase/PostgreSQL semantics

### Schema sources that must be consolidated
- `supabase-schema.sql`
- `scripts/setup-db.js`
- `scripts/create-student-profiles-table.js`
- `scripts/create-user-settings-table.js`
- `scripts/create-user-directory-table.js`
- `scripts/create-portfolio-collaborators-table.js`
- `scripts/add-email-verified-col.js`
- `scripts/add-is-visible-pg.js`
- `scripts/add-missing-columns.js`
- `scripts/add-topic-column.js`
- `scripts/fix-user-settings-type.js`
- `scripts/fix-user-verifications-rls.js`

## Required PostgreSQL features
- Extension: `pgcrypto`
- Extension: `pg_trgm`
- Types used by current code: `UUID`, `TEXT`, `BOOLEAN`, `JSONB`, `TIMESTAMPTZ`

## Execution plan
### Phase 1 — freeze the current schema
1. Build a single baseline SQL migration from the schema sources above.
2. Remove bucket-name drift by standardizing on:
   - `portfolio-assets`
   - `profile-images`
3. Keep table and column names unchanged during cutover.

### Phase 2 — stand up local PostgreSQL
1. Create database `redesign_reg`.
2. Create application role `redesign_reg` with a strong password.
3. Enable required extensions:
   - `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
   - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
4. Apply the consolidated baseline migration.

### Phase 3 — export and import data from Supabase
1. Export all rows from the eight application tables.
2. Export storage objects from:
   - `portfolio-assets`
   - `profile-images`
3. Import tables into local PostgreSQL without renaming columns.
4. Import files into local storage under deterministic paths.

### Phase 4 — application cutover
1. Replace `lib/supabase.js` with a local adapter layer backed by PostgreSQL.
2. Update API routes that call `getServiceSupabase()`.
3. Replace Supabase Storage calls in:
   - `app/api/news/route.js`
   - `app/api/user/upload-image/route.js`
   - `app/api/portfolio/*`
   - `lib/supabaseStorage.js`
4. Preserve current response contracts while swapping persistence.

### Phase 5 — validation
1. Login with a real REG account.
2. Verify these flows end-to-end:
   - login and logout
   - student profile cache
   - grade page
   - schedule page
   - evaluation submission cache
   - portfolio create/edit/delete
   - portfolio collaborator flow
   - profile image upload
3. After application parity is confirmed, rotate env to local PostgreSQL and local storage only.

## Cutover guardrails
- Do not change the external REG API integration during the database move.
- Do not introduce MariaDB or SQLite for the primary app database.
- Do not change route payload shapes during persistence replacement.
- Keep a rollback path by retaining the current Supabase credentials until parity is proven.

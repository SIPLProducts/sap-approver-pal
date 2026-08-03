# 06 — Database Setup (schema + data)

The Supabase stack from guide 05 has an **empty** database. This guide loads
the application's schema (26 public tables, RLS policies, functions such as
`has_role`, `is_admin`, `handle_new_user`) and its data.

---

## 1. Export from the existing Lovable Cloud database

Run this from your workstation, where you have the source connection string.
Two dumps, so schema problems can be fixed before data is touched.

```bash
export SRC="postgresql://postgres:<password>@<host>:5432/postgres"

# Schema only — public schema plus the auth users you need
pg_dump "$SRC" --schema-only --no-owner --no-privileges \
  --schema=public > resl-schema.sql

# Data only
pg_dump "$SRC" --data-only --no-owner --no-privileges \
  --schema=public > resl-data.sql

# Auth users (accounts + identities). Order matters.
pg_dump "$SRC" --data-only --no-owner --no-privileges \
  -t 'auth.users' -t 'auth.identities' > resl-auth.sql
```

Copy them to the server:

```bash
scp resl-*.sql deploy@your-server:/data/webapplication/resl_approval/Quality/backups/
```

> If you cannot reach the source database directly, export each table as CSV
> from the admin UI and use `\copy` instead — the restore order in section 3
> still applies.

## 2. Prepare the target

```bash
cd /data/webapplication/resl_approval/Quality/supabase
docker compose -p resl_quality exec db psql -U postgres -d postgres -c \
  "select count(*) from information_schema.tables where table_schema='public';"
# 0 (or only Supabase's own objects)
```

Take a safety snapshot before importing anything:

```bash
docker compose -p resl_quality exec -T db \
  pg_dump -U postgres postgres | gzip > ../backups/pre-import-$(date +%F-%H%M).sql.gz
```

## 3. Restore, in this order

```bash
cd /data/webapplication/resl_approval/Quality
CID=$(docker compose -p resl_quality -f supabase/docker-compose.yml ps -q db)

# 1. auth users first — public.profiles references auth.users(id)
docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backups/resl-auth.sql

# 2. schema
docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backups/resl-schema.sql

# 3. data
docker exec -i "$CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backups/resl-data.sql
```

Common, harmless errors you can ignore: `role "supabase_admin" does not exist`
on `ALTER ... OWNER` lines (we dumped `--no-owner`, but extensions may still
emit them), and `extension "pgcrypto" already exists`.

Errors you must **not** ignore: any `relation ... does not exist` during step 3
(schema incomplete) and any `duplicate key` (data already partially loaded —
truncate and retry).

## 4. Repair grants

The dump carries no privileges (`--no-privileges`), so PostgREST cannot see
anything yet. Re-grant across the whole public schema:

```sql
-- psql -U postgres -d postgres
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL    ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
```

`anon` deliberately receives **no** table privileges: this application has no
public, unauthenticated data. Every screen requires a signed-in user.

## 5. Verify RLS and the security functions

```sql
-- Every public table must have RLS on
SELECT tablename, rowsecurity
FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
-- expect: 0 rows

-- Policies exist
SELECT tablename, count(*) FROM pg_policies
WHERE schemaname='public' GROUP BY 1 ORDER BY 1;

-- Role helper functions restored
SELECT proname, prosecdef FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND proname IN ('has_role','is_admin','handle_new_user',
                  'is_doc_raiser','user_has_step_on_doc','touch_updated_at');
```

`handle_new_user` must be `SECURITY DEFINER` (`prosecdef = t`); the trigger
functions (`touch_updated_at`) are `SECURITY INVOKER` by design.

Recreate the `auth.users` trigger if the dump omitted it (it lives in the
`auth` schema, which we did not dump wholesale):

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 6. Confirm at least one administrator exists

```sql
SELECT u.email, r.role
FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'Admin';
```

If empty, grant it explicitly:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'Admin' FROM auth.users WHERE email = 'admin@example.com'
ON CONFLICT DO NOTHING;
```

## 7. End-to-end API check

```bash
ANON=<ANON_KEY from Quality/supabase/.env>
curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  'http://127.0.0.1:8000/rest/v1/profiles?select=id&limit=1'
```

An empty array `[]` is the **correct** answer — RLS hides rows from `anon`. A
`permission denied for table profiles` means section 4 was skipped.

## 8. Verification checklist

```bash
docker compose -p resl_quality exec db psql -U postgres -c \
  "select count(*) from information_schema.tables where table_schema='public';"   # 26
docker compose -p resl_quality exec db psql -U postgres -c \
  "select count(*) from auth.users;"                                              # > 0
```

Next: [07 — Backend Deployment](./07-backend-deploy.md)

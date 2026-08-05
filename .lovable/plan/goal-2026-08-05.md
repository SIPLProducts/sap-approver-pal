Remove standalone deployment folders

## Goal
Delete the `nginx/`, `deploy/`, and `docs/` folders from the repository because they are not required for the application.

## What will be removed
- `nginx/` — middleware Nginx configs for production and quality environments.
- `deploy/` — Docker/Pm2 scripts, Nginx configs for quality/production, environment examples, and bootstrap/backup/restore scripts.
- `docs/` — deployment and self-hosting markdown guides.

## Why this is safe
A search of the source code (`src/`) found no references to these folders, their files, or any build/deploy scripts that depend on them. Removing them only affects offline documentation and deployment assets; the running app and its build are unchanged.

## Steps
1. Delete the `nginx/`, `deploy/`, and `docs/` directories at the project root.
2. Verify the deletions.
3. Run a quick build/typecheck to confirm nothing is broken.

## Out of scope
- No application code changes.
- No database changes.

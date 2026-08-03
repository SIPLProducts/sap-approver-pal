# RESL Approval — Self-Hosting Documentation

Complete guide to running this application on your own Ubuntu server under
`/data/webapplication/resl_approval`, with **self-hosted Supabase**, in two
isolated environments (Quality + Production).

All supporting files referenced by these documents live in
[`deploy/data/`](../../deploy/data) in this repository and are copied to the
server in step 01.

## Read in this order

| # | Document | What it covers |
|---|---|---|
| 00 | [Overview & architecture](./00-overview.md) | Topology, port map, prerequisites, sizing |
| 01 | [Server preparation](./01-server-prep.md) | OS, deploy user, `/data` layout, firewall, swap |
| 02 | [Docker](./02-docker.md) | Docker Engine + Compose v2, daemon tuning |
| 03 | [Nginx & TLS](./03-nginx-ssl.md) | Reverse proxy, certificates, timeouts |
| 04 | [Self-hosted Supabase](./04-supabase-selfhost.md) | Postgres, Auth, Storage, Studio, keys |
| 05 | [Data migration](./05-migrate-data.md) | Moving schema, data, users, storage over |
| 06 | [Application deployment](./06-app-deploy.md) | Building and running the frontend/server |
| 07 | [SAP middleware](./07-middleware.md) | Middleware containers + app wiring |
| 08 | [Operations](./08-operations.md) | Logs, backups, upgrades, troubleshooting |

## Quick checklist

```text
[ ] 01  Server prepared, /data tree created, firewall on
[ ] 02  Docker + Compose installed and verified
[ ] 03  Nginx installed, certificates issued, configs enabled
[ ] 04  Supabase Quality stack healthy   (Studio reachable)
[ ] 04  Supabase Production stack healthy
[ ] 05  Schema + data + users migrated into Quality, verified
[ ] 06  App image built, Quality app reachable over HTTPS
[ ] 07  Middleware Quality reachable, "Test middleware" returns 200
[ ] 07  SAP API Settings wired to the Quality middleware, one API tested
[ ] 05/06/07  Repeat for Production
[ ] 08  Nightly backup cron installed and one restore drill completed
```

## Go-live verification

1. `https://<prod-app-host>/login` loads and a real SAP user can sign in.
2. Admin → User Management lists users, plants and roles.
3. Admin → SAP API Settings → **Test middleware** returns `200 OK`.
4. One MM screen (e.g. PR Release) and one SD screen (e.g. Contract Approvals)
   return SAP data end to end.
5. Auth e-mails (forgot password) arrive through your SMTP relay.
6. `scripts/backup.sh` has produced a dump and `scripts/restore.sh` has been
   rehearsed against the Quality stack.

## Honest caveats

- Self-hosting Supabase means **you** own upgrades, backups and key rotation.
  There is no managed safety net. Do the restore drill in step 08.
- The Lovable Cloud service-role key and database password cannot be exported.
  Step 05 therefore generates a **fresh key set** on your server and imports a
  schema/data dump; you run the export step from your side.
- Nothing in the application code changes for this deployment, with one
  documented exception in step 06 (choosing a runtime for the built server).
  The Lovable-hosted version keeps working while you build this out.

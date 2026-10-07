# Project rules

- SAP API Settings move between environments only via `scripts/generate-sap-sync.py`, which writes both `scripts/sync-sap-config.sql` (idempotent, one transaction) and the read-only `scripts/check-sap-config.sql`; regenerate both together — why: settings live in the database, not the app build, and the check must match the sync's expected list.

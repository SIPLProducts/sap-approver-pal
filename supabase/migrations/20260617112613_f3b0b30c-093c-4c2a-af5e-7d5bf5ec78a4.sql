ALTER TABLE public.sap_global_settings
  ADD COLUMN IF NOT EXISTS sap_environment text,
  ADD COLUMN IF NOT EXISTS sap_base_url text,
  ADD COLUMN IF NOT EXISTS sap_username text;

ALTER TABLE public.sap_global_secrets
  ADD COLUMN IF NOT EXISTS sap_password text;
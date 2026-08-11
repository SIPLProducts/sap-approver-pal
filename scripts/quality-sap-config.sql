-- Quality (self-hosted) SAP configuration seed — safe to re-run.
-- Run on the Quality server:
--   docker exec -i supabase-db psql -U postgres -d postgres < quality-sap-config.sql
--
-- Replace the two placeholders first:
--   REPLACE_MIDDLEWARE_SECRET -> value of MIDDLEWARE_SHARED_SECRET in middleware/.env
--   REPLACE_SAP_PASSWORD      -> SAP service-user password (leave as '' if unused)

insert into public.sap_global_settings
  (id, connection_mode, deployment_mode, middleware_port, middleware_url,
   sap_environment, sap_base_url, sap_username, updated_at)
values
  ('default', 'via_proxy', 'self_hosted', 3002, 'http://127.0.0.1:3002',
   'quality', 'http://10.150.150.155:8005', 'SHARVI_INFO', now())
on conflict (id) do update set
  connection_mode = excluded.connection_mode,
  deployment_mode = excluded.deployment_mode,
  middleware_port = excluded.middleware_port,
  middleware_url  = excluded.middleware_url,
  sap_environment = excluded.sap_environment,
  sap_base_url    = excluded.sap_base_url,
  sap_username    = excluded.sap_username,
  updated_at      = now();

insert into public.sap_global_secrets (id, proxy_secret, sap_password, updated_at)
values ('default', 'REPLACE_MIDDLEWARE_SECRET', 'REPLACE_SAP_PASSWORD', now())
on conflict (id) do update set
  proxy_secret = excluded.proxy_secret,
  sap_password = excluded.sap_password,
  updated_at   = now();

-- Verify
select id, connection_mode, deployment_mode, middleware_url, sap_base_url
from public.sap_global_settings where id = 'default';

select id, (proxy_secret is not null and proxy_secret <> '') as has_proxy_secret,
       (sap_password is not null and sap_password <> '') as has_sap_password
from public.sap_global_secrets where id = 'default';

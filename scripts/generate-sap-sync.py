#!/usr/bin/env python3
"""Generate scripts/sync-sap-config.sql from the CURRENT database.

Run this whenever SAP API Settings change locally, then run the produced
sync-sap-config.sql on Quality / Production. It emits one idempotent script
that installs or refreshes every SAP API endpoint, its request/response field
mappings, and the role/permission/strategy/tenant rows.

Environment-specific values (middleware URL/port, proxy secret, SAP base URL,
SAP username/password) and credentials are deliberately NOT exported.

Usage (PG* env vars must point at the source database):
    python3 scripts/generate-sap-sync.py
"""
import os
import subprocess
import sys

OUT = os.path.join(os.path.dirname(__file__), "sync-sap-config.sql")

CLEAN = "translate({0}, E'\\n\\r', '  ')"


def q(sql: str) -> list[str]:
    """Run a query with psql and return non-empty result lines."""
    res = subprocess.run(
        ["psql", "-tAX", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True,
    )
    if res.returncode != 0:
        sys.stderr.write(res.stderr)
        raise SystemExit("psql failed")
    return [ln for ln in res.stdout.splitlines() if ln.strip()]


CONFIGS = """
select format(
  'insert into public.sap_api_configs (name,description,module,endpoint_url,http_method,auth_type,middleware_url,proxy_secret_ref,api_type,auto_sync_enabled,schedule_cron,is_active) values (%%L,%%L,%%L,%%L,%%L,%%L,%%L,%%L,%%L,%%L,%%L,%%L) on conflict (name) do update set description=excluded.description,module=excluded.module,endpoint_url=excluded.endpoint_url,http_method=excluded.http_method,auth_type=excluded.auth_type,middleware_url=excluded.middleware_url,proxy_secret_ref=excluded.proxy_secret_ref,api_type=excluded.api_type,auto_sync_enabled=excluded.auto_sync_enabled,schedule_cron=excluded.schedule_cron,is_active=excluded.is_active,updated_at=now();',
  name, %s, module, endpoint_url, http_method, auth_type, middleware_url,
  proxy_secret_ref, api_type, auto_sync_enabled, schedule_cron, is_active)
from public.sap_api_configs order by name;
""" % CLEAN.format("description")

REQUEST_FIELDS = """
select format(
  'insert into public.sap_api_request_fields (config_id,field_name,source,default_value,required,sort_order) select c.id,%%L,%%L,%%L,%%L,%%L from public.sap_api_configs c where c.name=%%L;',
  f.field_name, f.source, %s, f.required, f.sort_order, c.name)
from public.sap_api_request_fields f
join public.sap_api_configs c on c.id = f.config_id
order by c.name, f.sort_order, f.field_name;
""" % CLEAN.format("f.default_value")

RESPONSE_FIELDS = """
select format(
  'insert into public.sap_api_response_fields (config_id,field_name,target_table,target_column,transform_expr,sort_order) select c.id,%%L,%%L,%%L,%%L,%%L from public.sap_api_configs c where c.name=%%L;',
  f.field_name, f.target_table, f.target_column, %s, f.sort_order, c.name)
from public.sap_api_response_fields f
join public.sap_api_configs c on c.id = f.config_id
order by c.name, f.sort_order, f.field_name;
""" % CLEAN.format("f.transform_expr")

TENANTS = """
select format(
  'insert into public.tenants (id,code,name,is_active) values (%L,%L,%L,%L) on conflict (id) do update set code=excluded.code,name=excluded.name,is_active=excluded.is_active,updated_at=now();',
  id, code, name, is_active)
from public.tenants order by code;
"""

CUSTOM_ROLES = """
select format(
  'insert into public.custom_roles (id,name,description,tenant_id,is_active) values (%L,%L,%L,%L,%L) on conflict (id) do update set name=excluded.name,description=excluded.description,tenant_id=excluded.tenant_id,is_active=excluded.is_active,updated_at=now();',
  id, name, description, tenant_id, is_active)
from public.custom_roles order by name;
"""

ROLE_PERMISSIONS = """
select format(
  'insert into public.role_permissions (id,custom_role_id,built_in_role,screen_key,action,allowed) values (%L,%L,%L,%L,%L,%L) on conflict (id) do update set custom_role_id=excluded.custom_role_id,built_in_role=excluded.built_in_role,screen_key=excluded.screen_key,action=excluded.action,allowed=excluded.allowed;',
  id, custom_role_id, built_in_role, screen_key, action, allowed)
from public.role_permissions order by screen_key, action;
"""

STRATEGIES = """
select format(
  'insert into public.approval_strategies (id,doc_type,business_unit,company_code,min_value,max_value,roles_in_order,active) values (%L,%L,%L,%L,%L,%L,%L,%L) on conflict (id) do update set doc_type=excluded.doc_type,business_unit=excluded.business_unit,company_code=excluded.company_code,min_value=excluded.min_value,max_value=excluded.max_value,roles_in_order=excluded.roles_in_order,active=excluded.active;',
  id, doc_type, business_unit, company_code, min_value, max_value,
  roles_in_order, active)
from public.approval_strategies order by doc_type;
"""

configs = q(CONFIGS)
req = q(REQUEST_FIELDS)
res = q(RESPONSE_FIELDS)
tenants = q(TENANTS)
roles = q(CUSTOM_ROLES)
perms = q(ROLE_PERMISSIONS)
strategies = q(STRATEGIES)
names = q("select name from public.sap_api_configs order by name;")

HEADER = """-- =========================================================================
-- sync-sap-config.sql — ONE script that installs/updates ALL SAP API Settings.
--
-- Generated by scripts/generate-sap-sync.py from the reference database.
-- Do not edit by hand: regenerate instead.
--
-- Contains : sap_api_configs, sap_api_request_fields, sap_api_response_fields,
--            tenants, custom_roles, role_permissions, approval_strategies.
-- Excludes : middleware URL/port, proxy secret, SAP base URL, SAP credentials.
--            Those are per-environment -> scripts/quality-sap-config.sql.
--
-- Endpoints are matched BY NAME, so it works even when a server already has
-- rows with different ids (e.g. Login_API). Safe to re-run any number of times.
-- Everything runs in one transaction: on error nothing is applied.
--
-- Quality:
--   docker exec -i supabase-db psql -U postgres -d postgres < sync-sap-config.sql
-- Production:
--   psql "postgresql://postgres:<PASSWORD>@127.0.0.1:5442/postgres" \\
--        -f sync-sap-config.sql
-- =========================================================================

begin;
"""

VERIFY_NAMES = ",".join("('%s')" % n.replace("'", "''") for n in names)

FOOTER = """
commit;

-- ---------------------------------------------------------------------------
-- Verification — row counts
-- ---------------------------------------------------------------------------
select 'sap_api_configs' as t, count(*) from public.sap_api_configs
union all select 'request_fields',      count(*) from public.sap_api_request_fields
union all select 'response_fields',     count(*) from public.sap_api_response_fields
union all select 'tenants',             count(*) from public.tenants
union all select 'custom_roles',        count(*) from public.custom_roles
union all select 'role_permissions',    count(*) from public.role_permissions
union all select 'approval_strategies', count(*) from public.approval_strategies;

-- Verification — every endpoint this script expects.
-- An EMPTY result means nothing is missing.
with expected(name) as (values
%s
)
select e.name,
       case when c.id is null then 'MISSING' else 'INACTIVE' end as problem
from expected e
left join public.sap_api_configs c on c.name = e.name
where c.id is null or c.is_active is not true
order by 1;
""" % VERIFY_NAMES


def section(title, rows):
    return ["", "-- " + "-" * 72, "-- " + title, "-- " + "-" * 72] + rows


out = [HEADER]
out += section("1/7 — SAP API endpoints (%d)" % len(configs), configs)
out += section("2/7 — request field mappings (%d) — replaced wholesale" % len(req),
               ["delete from public.sap_api_request_fields;"] + req)
out += section("3/7 — response field mappings (%d) — replaced wholesale" % len(res),
               ["delete from public.sap_api_response_fields;"] + res)
out += section("4/7 — tenants (%d)" % len(tenants), tenants)
out += section("5/7 — custom roles (%d)" % len(roles), roles)
out += section("6/7 — role permissions (%d)" % len(perms), perms)
out += section("7/7 — approval strategies (%d)" % len(strategies), strategies)
out.append(FOOTER)

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(out) + "\n")

print("wrote %s (%.1f KB)" % (OUT, os.path.getsize(OUT) / 1024))
print("endpoints=%d request_fields=%d response_fields=%d tenants=%d "
      "custom_roles=%d role_permissions=%d strategies=%d"
      % (len(configs), len(req), len(res), len(tenants), len(roles),
         len(perms), len(strategies)))

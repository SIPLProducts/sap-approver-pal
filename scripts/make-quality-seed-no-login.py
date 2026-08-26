#!/usr/bin/env python3
"""Generate a Login_API-safe variant of scripts/quality-seed-data.sql.

The Quality server already owns a row named Login_API with a different id, so the
plain seed fails on the unique name constraint. This script:
  * drops the Login_API config insert (existing row is left untouched)
  * rewires Login_API field-mapping rows to the existing row, looked up by name
  * emits one combined file plus three standalone parts small enough for the SQL editor
"""
import os
import re

SRC = os.path.join(os.path.dirname(__file__), "quality-seed-data.sql")
OUT = os.path.join(os.path.dirname(__file__), "quality-seed-data-sql-editor.sql")
LOGIN_ID = "f91324c1-7ba1-48fd-a10e-f7c951d2670a"
LOGIN_LOOKUP = "(select id from public.sap_api_configs where name = 'Login_API')"

HEADER = """-- Quality (self-hosted) configuration seed — Login_API safe variant.
-- The Login_API endpoint row already exists on the Quality server (different id),
-- so it is NOT inserted here; its field mappings are attached to that existing row.
-- Safe to re-run.
"""

with open(SRC, encoding="utf-8") as fh:
    lines = fh.read().splitlines()

sections = {"configs": [], "request": [], "response": [], "other": []}
current = "other"
seen_login_config = False

for line in lines:
    stripped = line.strip()
    if not stripped or stripped in ("begin;", "commit;"):
        continue
    if stripped.startswith("--"):
        if "sap_api_configs" in stripped:
            current = "configs"
        elif "sap_api_request_fields" in stripped:
            current = "request"
        elif "sap_api_response_fields" in stripped:
            current = "response"
        elif re.match(r"^--\s*\w", stripped):
            current = "other"
        continue
    if stripped.startswith("select ") or stripped.startswith("union all"):
        continue  # verification block is re-emitted per part

    if current == "configs" and LOGIN_ID in stripped:
        seen_login_config = True
        continue  # keep the server's own Login_API row
    if current in ("request", "response") and LOGIN_ID in stripped:
        stripped = stripped.replace("'%s'" % LOGIN_ID, LOGIN_LOOKUP, 1)

    sections[current].append(stripped)

assert seen_login_config, "Login_API config row not found in source seed"

VERIFY = """
select 'sap_api_configs' as t, count(*) from public.sap_api_configs
union all select 'request_fields', count(*) from public.sap_api_request_fields
union all select 'response_fields', count(*) from public.sap_api_response_fields
union all select 'custom_roles', count(*) from public.custom_roles
union all select 'role_permissions', count(*) from public.role_permissions
union all select 'approval_strategies', count(*) from public.approval_strategies;
"""

PURGE_REQ = ("delete from public.sap_api_request_fields where config_id in "
             "(select id from public.sap_api_configs where name = 'Login_API');")
PURGE_RES = ("delete from public.sap_api_response_fields where config_id in "
             "(select id from public.sap_api_configs where name = 'Login_API');")


def block(title, body):
    return ["", "-- " + title] + body


part1 = block("sap_api_configs (46 rows — Login_API intentionally skipped)", sections["configs"]) \
    + block("custom_roles / role_permissions / approval_strategies / tenants", sections["other"])
part2 = block("sap_api_request_fields", [PURGE_REQ] + sections["request"])
part3 = block("sap_api_response_fields", [PURGE_RES] + sections["response"])


def write(path, title, body, verify=True):
    out = [HEADER, "-- " + title, "", "begin;"]
    out += body
    out += ["", "commit;"]
    if verify:
        out.append(VERIFY)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    return os.path.getsize(path)


base = os.path.dirname(__file__)

# ---------------------------------------------------------------------------
# One-shot deployment script: scripts/sync-sap-config.sql
# Everything (endpoints + both field-mapping tables + roles/permissions) in a
# single transaction, plus a verification tail that names anything missing.
# ---------------------------------------------------------------------------
CONFIG_ROW = re.compile(r"values \('([0-9a-f-]{36})','((?:[^']|'')*)'")
config_ids, config_names = [], []
for line in sections["configs"]:
    m = CONFIG_ROW.search(line)
    if m:
        config_ids.append(m.group(1))
        config_names.append(m.group(2).replace("''", "'"))
config_names.append("Login_API")  # pre-existing row, not inserted here

id_list = ",".join("'%s'" % i for i in config_ids)
name_list = ",".join("('%s')" % n.replace("'", "''") for n in sorted(config_names))

PURGE_ALL = [
    "-- remove stale mappings for every endpoint this script owns",
    "delete from public.sap_api_request_fields where config_id in (%s);" % id_list,
    "delete from public.sap_api_response_fields where config_id in (%s);" % id_list,
]

SYNC_VERIFY = """
-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
select 'sap_api_configs' as t, count(*) from public.sap_api_configs
union all select 'request_fields', count(*) from public.sap_api_request_fields
union all select 'response_fields', count(*) from public.sap_api_response_fields
union all select 'custom_roles', count(*) from public.custom_roles
union all select 'role_permissions', count(*) from public.role_permissions
union all select 'approval_strategies', count(*) from public.approval_strategies;

-- Anything listed below still needs attention.
with expected(name) as (values
%s
)
select e.name,
       case when c.id is null then 'MISSING'
            when c.is_active is not true then 'INACTIVE'
       end as problem
from expected e
left join public.sap_api_configs c on c.name = e.name
where c.id is null or c.is_active is not true
order by 1;
""" % name_list

SYNC_HEADER = """-- =========================================================================
-- sync-sap-config.sql — ONE script to install/update ALL SAP API Settings.
-- Generated by scripts/make-quality-seed-no-login.py — do not edit by hand.
--
-- Contains: sap_api_configs, sap_api_request_fields, sap_api_response_fields,
--           custom_roles, role_permissions, approval_strategies, tenants.
-- Excludes: middleware URL/port, proxy secret, SAP base URL and credentials.
--           Those are environment-specific — use scripts/quality-sap-config.sql.
--
-- Safe to re-run. Runs in a single transaction; nothing is applied on error.
--
-- Quality:
--   docker exec -i supabase-db psql -U postgres -d postgres < sync-sap-config.sql
-- Production:
--   psql "postgresql://postgres:<PASSWORD>@127.0.0.1:5442/postgres" \\
--        -f sync-sap-config.sql
--
-- The Login_API row already exists on the servers with a different id, so it is
-- not inserted; its field mappings attach to the existing row by name.
-- =========================================================================
"""

SYNC_PATH = os.path.join(base, "sync-sap-config.sql")
sync_body = (
    block("1/4 — sap_api_configs (%d endpoints, Login_API skipped)" % len(config_ids),
          sections["configs"])
    + block("2/4 — roles, permissions, strategies, tenants", sections["other"])
    + block("3/4 — sap_api_request_fields",
            PURGE_ALL + [PURGE_REQ] + sections["request"])
    + block("4/4 — sap_api_response_fields", [PURGE_RES] + sections["response"])
)
with open(SYNC_PATH, "w", encoding="utf-8") as fh:
    fh.write("\n".join([SYNC_HEADER, "begin;"] + sync_body + ["", "commit;", SYNC_VERIFY]) + "\n")

sizes = {
    "sync-sap-config.sql": os.path.getsize(SYNC_PATH),
    "quality-seed-data-sql-editor.sql": write(OUT, "Combined (psql)", part1 + part2 + part3),
    "quality-seed-part1-configs-roles.sql": write(
        os.path.join(base, "quality-seed-part1-configs-roles.sql"),
        "Part 1 of 3 — endpoints, roles, permissions, strategies", part1, verify=False),
    "quality-seed-part2-request-fields.sql": write(
        os.path.join(base, "quality-seed-part2-request-fields.sql"),
        "Part 2 of 3 — request field mappings", part2, verify=False),
    "quality-seed-part3-response-fields.sql": write(
        os.path.join(base, "quality-seed-part3-response-fields.sql"),
        "Part 3 of 3 — response field mappings", part3),
}

for name, size in sizes.items():
    print("%-42s %8.1f KB" % (name, size / 1024))
print("configs=%d request=%d response=%d other=%d" % (
    len(sections["configs"]), len(sections["request"]),
    len(sections["response"]), len(sections["other"])))


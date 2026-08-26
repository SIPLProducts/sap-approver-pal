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


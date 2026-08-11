#!/bin/sh
# Custom entrypoint for Kong that builds Lua expressions for request-transformer
# and performs environment variable substitution in the declarative config.
#
# Build Lua expressions for translating opaque API keys to asymmetric JWTs.
# When opaque keys are not configured (empty env vars), expressions fall through
# to legacy-only behavior - just passing apikey as-is.
#
# Full expression logic (when opaque keys are configured):
#   1. If Authorization header exists and is NOT an sb_ key -> pass through (user session JWT)
#   2. If apikey matches secret key -> set service_role asymmetric JWT internal "API key"
#   3. If apikey matches publishable key -> set anon asymmetric JWT internal "API key"
#   4. Fallback: pass apikey as-is (legacy HS256 JWT)

# ---------------------------------------------------------------------------
# Guard against duplicate key-auth credentials.
#
# kong.yml declares the legacy key AND the modern opaque key for each consumer.
# Kong refuses to boot ("uniqueness violation: 'keyauth_credentials' entity with
# key ... already declared") when two entries hold the SAME value — which is what
# happens on legacy-only installs where SUPABASE_PUBLISHABLE_KEY was filled in
# with a copy of ANON_KEY (or SUPABASE_SECRET_KEY with a copy of SERVICE_ROLE_KEY),
# whether from .env or from an inherited shell variable.
#
# Empty duplicates are stripped further down; here we neutralise value duplicates
# so a mis-set variable can never take the whole gateway down.
# ---------------------------------------------------------------------------
if [ -n "$SUPABASE_PUBLISHABLE_KEY" ] && [ "$SUPABASE_PUBLISHABLE_KEY" = "$SUPABASE_ANON_KEY" ]; then
    echo "[kong-entrypoint] SUPABASE_PUBLISHABLE_KEY duplicates SUPABASE_ANON_KEY — ignoring the duplicate."
    SUPABASE_PUBLISHABLE_KEY=""
    export SUPABASE_PUBLISHABLE_KEY
fi
if [ -n "$SUPABASE_SECRET_KEY" ] && [ "$SUPABASE_SECRET_KEY" = "$SUPABASE_SERVICE_KEY" ]; then
    echo "[kong-entrypoint] SUPABASE_SECRET_KEY duplicates SUPABASE_SERVICE_KEY — ignoring the duplicate."
    SUPABASE_SECRET_KEY=""
    export SUPABASE_SECRET_KEY
fi

# Status line — names and configured/absent only, never values.
echo "[kong-entrypoint] credentials:" \
  "anon=$([ -n "$SUPABASE_ANON_KEY" ] && echo set || echo empty)" \
  "publishable=$([ -n "$SUPABASE_PUBLISHABLE_KEY" ] && echo set || echo empty)" \
  "service=$([ -n "$SUPABASE_SERVICE_KEY" ] && echo set || echo empty)" \
  "secret=$([ -n "$SUPABASE_SECRET_KEY" ] && echo set || echo empty)"

if [ -n "$SUPABASE_SECRET_KEY" ] && [ -n "$SUPABASE_PUBLISHABLE_KEY" ]; then
    # Opaque keys configured -> full translation expressions
    export LUA_AUTH_EXPR="\$((headers.authorization ~= nil and headers.authorization:sub(1, 10) ~= 'Bearer sb_' and headers.authorization) or (headers.apikey == '$SUPABASE_SECRET_KEY' and 'Bearer $SERVICE_ROLE_KEY_ASYMMETRIC') or (headers.apikey == '$SUPABASE_PUBLISHABLE_KEY' and 'Bearer $ANON_KEY_ASYMMETRIC') or headers.apikey)"

    # Realtime WebSocket: reads from query_params.apikey (supabase-js sends apikey
    # via query string), outputs to x-api-key header which Realtime checks first.
    export LUA_RT_WS_EXPR="\$((query_params.apikey == '$SUPABASE_SECRET_KEY' and '$SERVICE_ROLE_KEY_ASYMMETRIC') or (query_params.apikey == '$SUPABASE_PUBLISHABLE_KEY' and '$ANON_KEY_ASYMMETRIC') or query_params.apikey)"
else
    # Legacy API keys, not sb_ API keys -> pass apikey through unchanged
    export LUA_AUTH_EXPR="\$((headers.authorization ~= nil and headers.authorization:sub(1, 10) ~= 'Bearer sb_' and headers.authorization) or headers.apikey)"
    export LUA_RT_WS_EXPR="\$(query_params.apikey)"
fi

# Substitute environment variables in the Kong declarative config.
# Uses awk instead of eval/echo to preserve YAML quoting (eval strips double
# quotes, breaking "Header: value" patterns that YAML parses as mappings).
awk '{
  result = ""
  rest = $0
  while (match(rest, /\$[A-Za-z_][A-Za-z_0-9]*/)) {
    varname = substr(rest, RSTART + 1, RLENGTH - 1)
    if (varname in ENVIRON) {
      result = result substr(rest, 1, RSTART - 1) ENVIRON[varname]
    } else {
      result = result substr(rest, 1, RSTART + RLENGTH - 1)
    }
    rest = substr(rest, RSTART + RLENGTH)
  }
  print result rest
}' /home/kong/temp.yml > "$KONG_DECLARATIVE_CONFIG"

# Remove empty key-auth credentials (unconfigured opaque keys)
sed -i '/^[[:space:]]*- key:[[:space:]]*$/d' "$KONG_DECLARATIVE_CONFIG"

# Last-resort safety net: drop any '- key:' line whose value was already
# declared earlier in the file. Without this Kong aborts at init and the whole
# stack (auth, database API, storage) becomes unreachable on port 8000.
awk '
  /^[[:space:]]*- key:[[:space:]]*/ {
    value = $0
    sub(/^[[:space:]]*- key:[[:space:]]*/, "", value)
    if (value != "" && (value in seen)) {
      print "[kong-entrypoint] dropped a duplicate key-auth credential" > "/dev/stderr"
      next
    }
    seen[value] = 1
  }
  { print }
' "$KONG_DECLARATIVE_CONFIG" > "$KONG_DECLARATIVE_CONFIG.dedup" \
  && mv "$KONG_DECLARATIVE_CONFIG.dedup" "$KONG_DECLARATIVE_CONFIG"

exec /entrypoint.sh kong docker-start

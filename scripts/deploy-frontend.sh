#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Bring up the app server (port 8080) from a deployed dist/ folder.
#
# Usage (from inside the deployed dist/ folder):
#   bash deploy-frontend.sh [--no-restart] [--port 8080]
#
# Never touches the SAP middleware process, nginx, Docker or the database.
# ---------------------------------------------------------------------------
set -u

PORT=8080
REINSTALL=0
RESTART=1
PM2_NAME="${PM2_NAME:-Qty_App}"

while [ $# -gt 0 ]; do
  case "$1" in
    --reinstall) REINSTALL=1 ;;
    --no-restart) RESTART=0 ;;
    --port) shift; PORT="${1:-8080}" ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
  shift
done

cd "$(dirname "$0")" || exit 1
HERE="$(pwd)"

FAILED=0
step()  { printf '\n== %s\n' "$1"; }
ok()    { printf '   OK   %s\n' "$1"; }
warn()  { printf '   WARN %s\n' "$1"; }
fail()  { printf '   FAIL %s\n' "$1"; FAILED=1; }
die()   { printf '\n   FAIL %s\n\n' "$1"; exit 1; }

printf 'App server deploy helper\n  folder : %s\n  port   : %s\n  pm2    : %s\n' "$HERE" "$PORT" "$PM2_NAME"
# ---------------------------------------------------------------------------
step "1/7 Checking the deployed folder"
HELPER_REV="2026-08-11c"
ok "deploy helper revision: $HELPER_REV"
for f in server/index.mjs start.mjs build-info.json; do
  [ -e "$f" ] || die "$f is missing — this dist/ folder is incomplete or stale. Rebuild with 'npm run build:selfhost', package it with 'npm run package:dist', then extract the WHOLE archive into an EMPTY dist/ folder."
  ok "$f"
done

MODE="$(sed -n 's/.*"mode"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' build-info.json | head -n1)"
[ -n "$MODE" ] && ok "build mode: $MODE"
if [ "$MODE" != "selfhost-node" ]; then
  die "this dist/ was built with 'npm run build' (mode: ${MODE:-unknown}). The self-hosted app server needs 'npm run build:selfhost'."
fi

# In self-host mode the app server renders every page. A static index.html here
# is always a leftover from an older build, and nginx will happily serve it —
# which is exactly how the browser ends up 404ing on hashed asset files.
if [ -e index.html ]; then
  die "index.html must NOT exist in a self-host bundle (mode: $MODE) — this folder is a MIX of an old build and a new one. Do not patch it: move it aside, create an empty dist/, and extract one freshly built archive into it."
fi
ok "no stale static index.html"

# A mixed folder (HTML from one build, assets/ from another) is the classic
# cause of "404 on every /assets/*.js" in the browser. Refuse to start it.
miss=0
for html in *.html; do
  [ -e "$html" ] || continue
  for ref in $(grep -ao 'assets/[^"]*\.\(js\|css\)' "$html" | sort -u); do
    if [ ! -f "$ref" ]; then printf '   MISS %s -> %s\n' "$html" "$ref"; miss=1; fi
  done
done
[ "$miss" = "0" ] || die "this dist/ is inconsistent: HTML references asset files that are not here. Rebuild and redeploy the whole folder as one unit."
ok "no dangling asset references"


# ---------------------------------------------------------------------------
step "2/7 Removing stale installs from the asset folder"
# node_modules inside dist/ makes the server abort with "Asset too large"
# (the workerd binary is ~122 MiB). Runtime deps belong in .runtime/.
for stale in node_modules package-lock.json; do
  if [ -e "$stale" ]; then
    rm -rf "$stale" && ok "removed $stale"
  fi
done
ok "asset folder clean"

# ---------------------------------------------------------------------------
step "3/7 Runtime environment (.env.runtime)"
SHARED_ENV="../.env"
if [ -f "$SHARED_ENV" ]; then
  # Single source of truth: the frontend folder's .env. Regenerated every run.
  {
    tr -d '\r' < "$SHARED_ENV"
    echo ""
    grep -q '^PORT=' "$SHARED_ENV" || echo "PORT=$PORT"
    grep -q '^HOST=' "$SHARED_ENV" || echo "HOST=127.0.0.1"
    grep -q '^NODE_ENV=' "$SHARED_ENV" || echo "NODE_ENV=production"
  } > .env.runtime
  ok "copied from frontend/.env"
elif [ ! -f .env.runtime ]; then
  cat > .env.runtime <<EOF
PORT=$PORT
HOST=127.0.0.1
NODE_ENV=production
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MIDDLEWARE_URL=http://127.0.0.1:3002
MIDDLEWARE_SHARED_SECRET=
EOF
  chmod 600 .env.runtime
  die "no ../.env found, so .env.runtime was created as a template. Fill in SUPABASE_SERVICE_ROLE_KEY and MIDDLEWARE_SHARED_SECRET (or better: create ../.env in the frontend folder with those keys), then run this script again."
fi


chmod 600 .env.runtime

missing=""
for key in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY MIDDLEWARE_URL MIDDLEWARE_SHARED_SECRET; do
  value="$(grep -m1 "^${key}=" .env.runtime | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'" | sed 's/^ *//; s/ *$//')"
  if [ -z "$value" ]; then
    missing="$missing $key"
  else
    ok "$key is set"
  fi
done
if [ -n "$missing" ]; then
  if [ -f "$SHARED_ENV" ]; then
    die "these keys are missing or empty in $(cd .. && pwd)/.env:$missing (SUPABASE_* come from the self-hosted supabase/.env; MIDDLEWARE_SHARED_SECRET must match middleware/.env)"
  fi
  die "these values are empty in .env.runtime:$missing"
fi



# ---------------------------------------------------------------------------
step "4/7 Server bundle"
if [ ! -f server/index.mjs ]; then
  die "server/index.mjs is missing — rebuild with 'npm run build:selfhost' and copy the whole dist/ folder."
fi
if [ -d .runtime ]; then
  rm -rf .runtime && ok "removed the obsolete .runtime folder (no wrangler needed any more)"
fi
if [ "$REINSTALL" = "1" ]; then
  warn "--reinstall is obsolete: the app server is a plain Node bundle with no runtime install"
fi
ok "server/index.mjs present (plain Node server — no npm install required)"

# ---------------------------------------------------------------------------
step "5/7 Launcher syntax"
if node --check start.mjs; then ok "start.mjs parses"; else die "start.mjs has a syntax error — redeploy a freshly built dist/."; fi

# ---------------------------------------------------------------------------
if [ "$RESTART" = "1" ]; then
  step "6/7 Restarting the app server with pm2"
  if ! command -v pm2 >/dev/null 2>&1; then
    warn "pm2 not found — start manually: PORT=$PORT node start.mjs"
  elif pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_NAME" --update-env >/dev/null && ok "restarted $PM2_NAME"
    pm2 save >/dev/null 2>&1
  else
    pm2 start "$HERE/start.mjs" --name "$PM2_NAME" --cwd "$HERE" --interpreter node --time >/dev/null \
      && ok "started $PM2_NAME"
    pm2 save >/dev/null 2>&1
  fi
else
  step "6/7 Restart skipped (--no-restart)"
fi

# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
step "7/7 Connectivity checks"
printf '   waiting for port %s' "$PORT"
up=0
i=0
while [ "$i" -lt 40 ]; do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then up=1; break; fi
  # Stop early when the process already died — no point waiting 80 seconds.
  if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PM2_NAME" 2>/dev/null | grep -q 'errored\|stopped'; then
    printf '\n'; fail "$PM2_NAME is not running (pm2 reports it errored/stopped)"; break
  fi
  printf '.'
  i=$((i + 1)); sleep 2
done
printf '\n'

if [ "$up" = "1" ]; then
  ok "app server answers on http://127.0.0.1:$PORT/"
else
  fail "nothing answering on port $PORT"
  echo "   The launcher exits with an explicit error when the bundle opens no listener;"
  echo "   check the log lines printed below for '[start]' or '[server]' messages."
fi

if [ "$up" = "1" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/public/middleware/config" \
    -H 'content-type: application/json' -d '{"name":"Login_API"}' 2>/dev/null)"
  case "$code" in
    401|200) ok "backend route reachable (HTTP $code)" ;;
    000)     fail "backend route unreachable" ;;
    *)       warn "backend route returned HTTP $code" ;;
  esac

  # The login page must be served by this server (it renders the HTML), and
  # every chunk it asks for must exist on disk.
  html="$(curl -fsS "http://127.0.0.1:$PORT/login" 2>/dev/null || true)"
  if [ -z "$html" ]; then
    fail "/login did not render"
  else
    lmiss=0
    for ref in $(printf '%s' "$html" | grep -ao 'assets/[^"]*\.\(js\|css\)' | sort -u); do
      if [ ! -f "$ref" ]; then printf '   MISS /%s\n' "$ref"; lmiss=1; fi
    done
    if [ "$lmiss" = "0" ]; then ok "/login renders and all its assets exist"
    else fail "/login references assets that are not in this folder — rebuild and rsync -a --delete"; fi
  fi
fi

if curl -fsS -o /dev/null http://127.0.0.1:3002/__health 2>/dev/null; then
  ok "SAP middleware healthy on port 3002"
else
  warn "SAP middleware not answering on port 3002 (login will fail until it is up)"
fi

gw="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/auth/v1/health 2>/dev/null)"
case "$gw" in
  200|401) ok "database/auth gateway healthy on port 8000" ;;
  000)     warn "gateway not answering on port 8000 — run: cd ../../backend && docker compose --env-file .env -p resl_quality up -d --force-recreate kong" ;;
  *)       warn "gateway returned HTTP $gw on port 8000" ;;
esac


# ---------------------------------------------------------------------------
if [ "$FAILED" = "0" ] && [ "$up" = "1" ]; then
  printf '\nRESULT: PASS — the app server is running. Log in at http://<this-host>:8081/login\n\n'
  exit 0
fi

printf '\nRESULT: FAIL — last 20 log lines:\n\n'
command -v pm2 >/dev/null 2>&1 && pm2 logs "$PM2_NAME" --lines 20 --nostream 2>/dev/null
printf '\n'
exit 1

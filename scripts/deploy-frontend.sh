#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Bring up the app server (port 8080) from a deployed dist/ folder.
#
# Usage (from inside the deployed dist/ folder):
#   bash deploy-frontend.sh [--reinstall] [--no-restart] [--port 8080]
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
for f in index.html server/index.mjs start.mjs; do
  [ -e "$f" ] || die "$f is missing — this dist/ folder is incomplete. Rebuild with 'npm run build' and copy the whole dist/ folder."
  ok "$f"
done

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
MIDDLEWARE_SHARED_SECRET=
EOF
  chmod 600 .env.runtime
  die "no ../.env found, so .env.runtime was created as a template. Fill in SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY and MIDDLEWARE_SHARED_SECRET, then run this script again."
fi

chmod 600 .env.runtime


# ---------------------------------------------------------------------------
step "4/7 Runtime dependencies (.runtime/)"
if [ ! -f .runtime/package.json ]; then
  die ".runtime/package.json is missing — rebuild with 'npm run build' so the launcher and its runtime manifest are emitted."
fi
if [ "$REINSTALL" = "1" ] || [ ! -d .runtime/node_modules ]; then
  echo "   installing (this can take a minute)…"
  if npm install --omit=dev --prefix .runtime --no-audit --no-fund; then
    ok "runtime dependencies installed"
  else
    die "npm install in .runtime failed — check network access to the npm registry or copy a prepared .runtime/node_modules onto this machine."
  fi
else
  ok "already installed (use --reinstall to force)"
fi

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
step "7/7 Connectivity checks"
echo "   waiting for port $PORT…"
up=0
i=0
while [ "$i" -lt 40 ]; do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then up=1; break; fi
  i=$((i + 1)); sleep 2
done

if [ "$up" = "1" ]; then
  ok "app server answers on http://127.0.0.1:$PORT/"
else
  fail "nothing answering on port $PORT"
fi

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/public/middleware/config" \
  -H 'content-type: application/json' -d '{"name":"Login_API"}' 2>/dev/null)"
case "$code" in
  401|200) ok "backend route reachable (HTTP $code)" ;;
  000)     fail "backend route unreachable" ;;
  *)       warn "backend route returned HTTP $code" ;;
esac

if curl -fsS -o /dev/null http://127.0.0.1:3002/__health 2>/dev/null; then
  ok "SAP middleware healthy on port 3002"
else
  warn "SAP middleware not answering on port 3002 (login will fail until it is up)"
fi

# ---------------------------------------------------------------------------
if [ "$FAILED" = "0" ] && [ "$up" = "1" ]; then
  printf '\nRESULT: PASS — the app server is running. Log in at http://<this-host>:8081/login\n\n'
  exit 0
fi

printf '\nRESULT: FAIL — last 20 log lines:\n\n'
command -v pm2 >/dev/null 2>&1 && pm2 logs "$PM2_NAME" --lines 20 --nostream 2>/dev/null
printf '\n'
exit 1

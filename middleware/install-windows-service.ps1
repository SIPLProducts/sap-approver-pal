# Install the SAP Middleware as a Windows Service using node-windows.
#
# Usage (Run PowerShell as Administrator from this folder):
#   .\install-windows-service.ps1            # install + start
#   .\install-windows-service.ps1 -Uninstall # stop + remove
#
# Requires:
#   - Node.js 20+ on PATH
#   - .env file already populated (copy from .env.example)

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "==> SAP Middleware — Windows Service installer" -ForegroundColor Cyan
Write-Host "    Working dir: $ScriptDir"

# 1. Sanity checks
try {
    $nodeVersion = & node --version
    Write-Host "    Node.js: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed or not on PATH. Install Node.js 20+ and retry."
    exit 1
}

if (-not (Test-Path "$ScriptDir\.env")) {
    Write-Warning ".env not found. Copy .env.example to .env and fill in SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY before starting the service."
}

# 2. Install dependencies (incl. node-windows)
if (-not (Test-Path "$ScriptDir\node_modules\node-windows")) {
    Write-Host "==> Installing npm dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
}

# 3. Build a tiny installer script that uses node-windows
$installerJs = @'
import { Service } from "node-windows";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const action = process.argv[2] || "install";

const svc = new Service({
  name: "SAPMiddleware",
  description: "Node.js middleware bridging the Lovable frontend to on-prem SAP.",
  script: join(__dirname, "server.js"),
  nodeOptions: [],
  workingDirectory: __dirname,
  allowServiceLogon: true,
});

svc.on("install", () => {
  console.log("Service installed. Starting...");
  svc.start();
});
svc.on("alreadyinstalled", () => {
  console.log("Service already installed.");
});
svc.on("start", () => console.log("Service started: SAPMiddleware"));
svc.on("stop", () => console.log("Service stopped: SAPMiddleware"));
svc.on("uninstall", () => console.log("Service uninstalled: SAPMiddleware"));
svc.on("error", (e) => console.error("Service error:", e));

if (action === "uninstall") {
  svc.uninstall();
} else {
  svc.install();
}
'@

$installerPath = Join-Path $ScriptDir "_svc-installer.mjs"
Set-Content -Path $installerPath -Value $installerJs -Encoding UTF8

try {
    if ($Uninstall) {
        Write-Host "==> Uninstalling service..." -ForegroundColor Yellow
        node $installerPath uninstall
    } else {
        Write-Host "==> Installing service (SAPMiddleware)..." -ForegroundColor Cyan
        node $installerPath install
        Write-Host ""
        Write-Host "Done. Manage the service via services.msc or:" -ForegroundColor Green
        Write-Host "  net start SAPMiddleware"
        Write-Host "  net stop  SAPMiddleware"
        Write-Host "  .\install-windows-service.ps1 -Uninstall"
    }
} finally {
    Remove-Item $installerPath -ErrorAction SilentlyContinue
}

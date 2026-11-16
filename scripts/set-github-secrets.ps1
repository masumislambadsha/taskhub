<#
.SYNOPSIS
  Upload the deployment secrets and variables to GitHub with the gh CLI (PowerShell version
  of scripts/set-github-secrets.sh).

.DESCRIPTION
  Reads deploy/github-secrets.input.env and the two files deploy/env/web.env and
  deploy/env/realtime.env. Secret values are piped to gh on stdin and never printed.
  DEPLOY_ENABLED is NOT set here: turn it on by hand after the first good manual deploy.

.EXAMPLE
  gh auth login
  ./scripts/set-github-secrets.ps1 -Repo "masumislambadsha/taskhub"
  ./scripts/set-github-secrets.ps1 -DryRun
#>
param(
    [string]$Repo = "",
    [string]$InputPath = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
if (-not $InputPath) { $InputPath = Join-Path $RootDir "deploy/github-secrets.input.env" }
$WebEnv = Join-Path $RootDir "deploy/env/web.env"
$RealtimeEnv = Join-Path $RootDir "deploy/env/realtime.env"

function Read-EnvFile {
    param([string]$Path)
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
        $i = $trimmed.IndexOf("=")
        if ($i -lt 1) { continue }
        $key = $trimmed.Substring(0, $i).Trim()
        $value = $trimmed.Substring($i + 1).Trim()
        if ($value.Length -ge 2 -and (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$key] = $value
    }
    return $values
}

function Get-Value {
    param([hashtable]$Table, [string]$Key)
    if ($Table.ContainsKey($Key)) { return [string]$Table[$Key] }
    return ""
}

foreach ($p in @($InputPath, $WebEnv, $RealtimeEnv)) {
    if (-not (Test-Path -LiteralPath $p)) { throw "File not found: $p (copy the matching .example file and fill it in)" }
}
if (-not $DryRun -and -not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is required. Install it and run 'gh auth login'."
}

$inputValues = Read-EnvFile -Path $InputPath
$web = Read-EnvFile -Path $WebEnv
$realtime = Read-EnvFile -Path $RealtimeEnv

if (-not $Repo) { $Repo = Get-Value $inputValues "GITHUB_REPO" }
$repoArgs = @()
if ($Repo) { $repoArgs = @("--repo", $Repo) }

foreach ($k in "DOCKERHUB_USERNAME", "DOCKERHUB_TOKEN", "VPS_HOST", "VPS_USER", "VPS_SSH_KEY_FILE",
                "VPS_APP_DIR", "NEXT_PUBLIC_SOCKET_URL", "NEXT_PUBLIC_APP_URL") {
    if (-not (Get-Value $inputValues $k)) { throw "$k is empty in $InputPath" }
}

# Sanity checks on the runtime env files (names only, never values).
$webJwt = Get-Value $web "SOCKET_JWT_SECRET"
$rtJwt = Get-Value $realtime "SOCKET_JWT_SECRET"
if ($webJwt.Length -lt 32) { throw "SOCKET_JWT_SECRET in web.env must be at least 32 characters" }
if ($webJwt -ne $rtJwt) { throw "SOCKET_JWT_SECRET differs between web.env and realtime.env" }
if (-not (Get-Value $web "NEXTAUTH_SECRET")) { throw "NEXTAUTH_SECRET is empty in web.env" }
foreach ($f in @($WebEnv, $RealtimeEnv)) {
    if (Select-String -LiteralPath $f -SimpleMatch "USER:PASSWORD@" -Quiet) {
        throw "$(Split-Path -Leaf $f) still has the placeholder MONGODB_URI"
    }
}

$keyFile = Get-Value $inputValues "VPS_SSH_KEY_FILE"
if ($keyFile.StartsWith("~")) { $keyFile = Join-Path $HOME $keyFile.Substring(1).TrimStart("/", "\") }
if (-not (Test-Path -LiteralPath $keyFile)) { throw "SSH key file not found: $keyFile" }
$keyText = Get-Content -LiteralPath $keyFile -Raw
if ($keyText -notmatch "PRIVATE KEY") { throw "$keyFile does not look like a private key" }

function Set-GhSecret {
    param([string]$Name, [string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { Write-Host "Skipped secret   $Name (empty)"; return }
    if ($DryRun) { Write-Host "[dry-run] would set secret   $Name"; return }
    # The value goes to gh on stdin, not on the command line.
    $Value | & gh secret set $Name @repoArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh secret set $Name failed" }
    Write-Host "Set secret   $Name"
}

function Set-GhVariable {
    param([string]$Name)
    $value = Get-Value $inputValues $Name
    if ([string]::IsNullOrWhiteSpace($value)) { Write-Host "Skipped variable $Name (empty)"; return }
    if ($DryRun) { Write-Host "[dry-run] would set variable $Name"; return }
    $value | & gh variable set $Name @repoArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh variable set $Name failed" }
    Write-Host "Set variable $Name"
}

if ($Repo) { Write-Host "Target repository: $Repo" } else { Write-Host "Target repository: current git folder" }

# Secrets (the env files and the key are sent whole, as multi-line text)
Set-GhSecret "DOCKERHUB_TOKEN" (Get-Value $inputValues "DOCKERHUB_TOKEN")
Set-GhSecret "VPS_HOST" (Get-Value $inputValues "VPS_HOST")
Set-GhSecret "VPS_USER" (Get-Value $inputValues "VPS_USER")
Set-GhSecret "VPS_PORT" (Get-Value $inputValues "VPS_PORT")
Set-GhSecret "VPS_SSH_KEY" ($keyText -replace "`r`n", "`n")
Set-GhSecret "WEB_ENV_PRODUCTION" ((Get-Content -LiteralPath $WebEnv -Raw) -replace "`r`n", "`n")
Set-GhSecret "REALTIME_ENV_PRODUCTION" ((Get-Content -LiteralPath $RealtimeEnv -Raw) -replace "`r`n", "`n")

# Variables
foreach ($v in "DOCKERHUB_USERNAME", "VPS_APP_DIR", "NEXT_PUBLIC_SOCKET_URL", "NEXT_PUBLIC_APP_URL",
               "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_IMGBB_API_KEY", "SENTRY_ENVIRONMENT") {
    Set-GhVariable $v
}

Write-Host ""
Write-Host "Done. Not set on purpose: the variable DEPLOY_ENABLED."
Write-Host "After the first successful manual deploy on the VPS, turn automatic deploys on with:"
Write-Host "  gh variable set DEPLOY_ENABLED --body true"

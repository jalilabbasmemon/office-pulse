# Puts SUPABASE_SECRET_KEY onto office-pulse-qa from .env.qa.local (never prints the value).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.qa.local"
$config = Join-Path $root "wrangler.qa.jsonc"

if (-not (Test-Path $envFile)) {
  Write-Error "Missing .env.qa.local — copy env.qa.example and set SUPABASE_SECRET_KEY for officepulse-qa only."
}

$line = Get-Content $envFile | Where-Object { $_ -match '^\s*SUPABASE_SECRET_KEY\s*=' } | Select-Object -First 1
if (-not $line) {
  Write-Error "SUPABASE_SECRET_KEY not found in .env.qa.local"
}

$value = ($line -replace '^\s*SUPABASE_SECRET_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")
if ($value.Length -lt 20 -or $value -match 'qa-placeholder|ChangeMe|<.*>') {
  Write-Error "SUPABASE_SECRET_KEY in .env.qa.local does not look like a real QA secret."
}
if ($value -match 'jniyfhpwrjofdljqsdwd') {
  Write-Error "Refusing: secret payload looks tied to production project ref."
}

Write-Host "Uploading SUPABASE_SECRET_KEY to Worker office-pulse-qa (value not displayed)..."
$value | npx --yes wrangler secret put SUPABASE_SECRET_KEY --config $config
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Verify with: npx wrangler secret list --config wrangler.qa.jsonc"

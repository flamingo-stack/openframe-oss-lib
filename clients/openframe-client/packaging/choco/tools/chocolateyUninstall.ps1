$ErrorActionPreference = 'Stop'

$exe = Join-Path $env:ProgramFiles 'OpenFrame\bin\openframe-client.exe'

if (Test-Path $exe) {
  $ErrorActionPreference = 'Continue'
  & $exe uninstall 2>&1 | ForEach-Object { "$_" }
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($exitCode -ne 0) {
    Write-Warning "openframe-client uninstall exited with code $exitCode"
  }
}
else {
  Write-Warning "OpenFrame Client binary not found at $exe; nothing to uninstall."
}

$ErrorActionPreference = 'Stop'

$exe = Join-Path $env:ProgramFiles 'OpenFrame\bin\openframe-client.exe'

if (Test-Path $exe) {
  & $exe uninstall
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "openframe-client uninstall exited with code $LASTEXITCODE"
  }
}
else {
  Write-Warning "OpenFrame Client binary not found at $exe; nothing to uninstall."
}

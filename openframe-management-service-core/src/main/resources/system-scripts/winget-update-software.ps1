$ErrorActionPreference = 'Stop'

if ($args.Count -eq 0) {
    Write-Output 'no package specified'
    exit 64
}

winget upgrade @args --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
exit $LASTEXITCODE

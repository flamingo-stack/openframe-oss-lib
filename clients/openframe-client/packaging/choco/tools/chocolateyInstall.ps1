$ErrorActionPreference = 'Stop'

$serviceName = 'com.openframe.client'

if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
  Write-Host "OpenFrame Client service '$serviceName' is already installed. Skipping install; updates are delivered by the OpenFrame platform."
  return
}

$temp = Join-Path $env:TEMP ('openframe-install-' + [guid]::NewGuid().ToString())

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  unzipLocation  = $temp
  url64bit       = 'https://openframe.ai/v0/api/assets/download?agent=client&platform=windows&version=1.5.10'
  checksum64     = 'd9e7abf5a5606a3fc8e40b580491474ac531222ee585e09c59d5c434945580fd'
  checksumType64 = 'sha256'
}

try {
  Install-ChocolateyZipPackage @packageArgs

  $exe = Join-Path $temp 'openframe-client.exe'
  $ErrorActionPreference = 'Continue'
  & $exe install 2>&1 | ForEach-Object { "$_" }
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($exitCode -ne 0) {
    throw "openframe-client install failed with exit code $exitCode"
  }
}
finally {
  Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
}

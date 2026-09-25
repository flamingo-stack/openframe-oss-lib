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
  url64bit       = 'https://openframe.ai/v0/api/assets/download?agent=client&platform=windows&version=1.3.62'
  checksum64     = '5b6e5a9960b6b6125d7751650eaa176be3898efb696a555f0ec086f282884e0e'
  checksumType64 = 'sha256'
}

try {
  Install-ChocolateyZipPackage @packageArgs

  $exe = Join-Path $temp 'openframe-client.exe'
  & $exe install
  if ($LASTEXITCODE -ne 0) {
    throw "openframe-client install failed with exit code $LASTEXITCODE"
  }
}
finally {
  Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
}

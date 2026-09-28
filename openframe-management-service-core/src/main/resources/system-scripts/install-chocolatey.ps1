$ErrorActionPreference = 'Stop'

$ChocoExe = "$env:ProgramData\chocolatey\bin\choco.exe"

if (Test-Path $ChocoExe) {
    Write-Output "choco already installed: $(& $ChocoExe --version)"
    exit 0
}

# TLS 1.2 needed for the download; the official script is idempotent
try {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
} catch {
    Write-Output "choco install failed: $_"
    exit 1
}

# official script never checks rights and fails quietly - verify
if (Test-Path $ChocoExe) {
    Write-Output "choco installed: $(& $ChocoExe --version)"
    exit 0
}
Write-Output "install completed but choco.exe not found"
exit 2

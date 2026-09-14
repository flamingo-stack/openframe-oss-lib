$ErrorActionPreference = 'Stop'

$FamilyName = 'Microsoft.DesktopAppInstaller_8wekyb3d8bbwe'

function Get-WingetExe {
    $p = (Get-AppxPackage -Name Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue).InstallLocation
    if ($p -and (Test-Path "$p\winget.exe")) { return "$p\winget.exe" }
    return $null
}

$exe = Get-WingetExe

if (-not $exe) {
    $staged = Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Appx\AppxAllUserStore\Applications' -ErrorAction SilentlyContinue |
              Where-Object { $_.PSChildName -like 'Microsoft.DesktopAppInstaller*' }
    if ($staged) {
        try { Add-AppxPackage -RegisterByFamilyName -MainPackage $FamilyName }
        catch { Write-Output "registration failed: $_"; exit 1 }
        $exe = Get-WingetExe
        if (-not $exe) { Write-Output "registered but winget still unavailable"; exit 2 }
    }
}

if (-not $exe) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
        Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null

        $moduleRoot = Join-Path $env:TEMP 'openframe-winget-module'
        New-Item -ItemType Directory -Force -Path $moduleRoot | Out-Null
        Save-Module -Name Microsoft.WinGet.Client -Path $moduleRoot -Repository PSGallery -Force

        $psd1 = Get-ChildItem $moduleRoot -Recurse -Filter 'Microsoft.WinGet.Client.psd1' |
                Select-Object -First 1 -ExpandProperty FullName
        if (-not $psd1) { Write-Output 'module download produced no manifest'; exit 1 }
        Import-Module $psd1 -Force

        Repair-WinGetPackageManager -Force -Latest
    } catch { Write-Output "bootstrap failed: $_"; exit 1 }

    $exe = Get-WingetExe
    if (-not $exe) { Write-Output "bootstrapped but winget still unavailable"; exit 3 }
}

& $exe list --accept-source-agreements --disable-interactivity | Out-Null

Write-Output "winget ready: $(& $exe --version)"
exit 0

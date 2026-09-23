$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$FamilyName = 'Microsoft.DesktopAppInstaller_8wekyb3d8bbwe'
$BundleUrl = 'https://aka.ms/getwinget'

$OsArch = $env:PROCESSOR_ARCHITEW6432
if (-not $OsArch) { $OsArch = $env:PROCESSOR_ARCHITECTURE }
$VCLibsArch = switch ($OsArch) {
    'AMD64' { 'x64' }
    'ARM64' { 'arm64' }
    'ARM'   { 'arm' }
    default { 'x86' }
}
$VCLibsUrl = "https://aka.ms/Microsoft.VCLibs.$VCLibsArch.14.00.Desktop.appx"

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
        catch { Write-Output "staged registration failed: $_" }
        $exe = Get-WingetExe
        if ($exe) { Write-Output 'recovered by registering the staged package' }
        else { Write-Output 'staged registration did not produce winget' }
    }
}

if (-not $exe) {
    $tmp = Join-Path $env:TEMP "openframe-winget-$([guid]::NewGuid().ToString('N'))"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        $bundle = Join-Path $tmp 'AppInstaller.msixbundle'

        try { Invoke-WebRequest -Uri $BundleUrl -OutFile $bundle -UseBasicParsing }
        catch { throw "bundle download failed: $_" }

        try { Add-AppxPackage -Path $bundle -ForceUpdateFromAnyVersion }
        catch {
            Write-Output "bundle needs dependencies, fetching VCLibs for $VCLibsArch : $_"
            try {
                $vclibs = Join-Path $tmp 'VCLibs.appx'
                Invoke-WebRequest -Uri $VCLibsUrl -OutFile $vclibs -UseBasicParsing
                Add-AppxPackage -Path $vclibs
                Add-AppxPackage -Path $bundle -ForceUpdateFromAnyVersion
            } catch { Write-Output "bundle install failed after VCLibs: $_" }
        }
    } catch {
        Write-Output "direct download stage failed: $_"
    } finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }

    $exe = Get-WingetExe
    if ($exe) { Write-Output 'recovered by direct download' }
}

if (-not $exe) {
    try {
        Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null

        $moduleRoot = Join-Path $env:TEMP 'openframe-winget-module'
        New-Item -ItemType Directory -Force -Path $moduleRoot | Out-Null
        Save-Module -Name Microsoft.WinGet.Client -Path $moduleRoot -Repository PSGallery -Force

        $psd1 = Get-ChildItem $moduleRoot -Recurse -Filter 'Microsoft.WinGet.Client.psd1' |
                Select-Object -First 1 -ExpandProperty FullName
        if (-not $psd1) { Write-Output 'module download produced no manifest'; exit 30 }
        Import-Module $psd1 -Force
    } catch { Write-Output "module bootstrap failed: $_"; exit 30 }

    try { Repair-WinGetPackageManager -Force -Latest }
    catch { Write-Output "repair failed: $_"; exit 31 }

    $exe = Get-WingetExe
    if ($exe) { Write-Output 'recovered by Repair-WinGetPackageManager' }
}

if (-not $exe) {
    Write-Output 'every path completed but winget is still unavailable'
    exit 32
}

try {
    & $exe list --accept-source-agreements --disable-interactivity | Out-Null
    $version = (& $exe --version).Trim()
} catch {
    Write-Output "winget is installed but will not run: $_"
    exit 40
}

Write-Output "winget ready: $version"
exit 0

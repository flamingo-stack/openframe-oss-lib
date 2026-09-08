$ErrorActionPreference = 'Stop'

$FamilyName  = 'Microsoft.DesktopAppInstaller_8wekyb3d8bbwe'
$AliasFolder = "$env:LOCALAPPDATA\Microsoft\WindowsApps"

function Get-WingetExe {
    $p = (Get-AppxPackage -Name Microsoft.DesktopAppInstaller -EA SilentlyContinue).InstallLocation
    if ($p -and (Test-Path "$p\winget.exe")) { return "$p\winget.exe" }
    return $null
}

function Ensure-AliasFolderOnPath {
    $key = 'HKCU:\Environment'
    # raw read: key is REG_EXPAND_SZ and may hold %USERPROFILE%
    $raw = (Get-Item $key).GetValue(
        'Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if (($raw -split ';') -contains $AliasFolder) { return $false }
    $new = if ($raw) { "$raw;$AliasFolder" } else { $AliasFolder }
    Set-ItemProperty -Path $key -Name 'Path' -Value $new -Type ExpandString
    return $true
}

# winget alias folder must be on PATH
if (Ensure-AliasFolderOnPath) { Write-Output "added to user PATH: $AliasFolder" }
if (($env:PATH -split ';') -notcontains $AliasFolder) { $env:PATH = "$env:PATH;$AliasFolder" }

$exe = Get-WingetExe

# staged machine-wide but not registered for this user -> register, no download
if (-not $exe) {
    $staged = Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Appx\AppxAllUserStore\Applications' -EA SilentlyContinue |
              Where-Object { $_.PSChildName -like 'Microsoft.DesktopAppInstaller*' }
    if ($staged) {
        try { Add-AppxPackage -RegisterByFamilyName -MainPackage $FamilyName }
        catch { Write-Output "registration failed: $_"; exit 1 }
        $exe = Get-WingetExe
        if (-not $exe) { Write-Output "registered but winget still unavailable"; exit 2 }
    }
}

# not on the machine at all -> official bootstrap, pulls deps and latest itself
if (-not $exe) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
        Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null
        Install-Module -Name Microsoft.WinGet.Client -Force -Scope CurrentUser -Repository PSGallery | Out-Null
        Repair-WinGetPackageManager -Force -Latest
    } catch { Write-Output "bootstrap failed: $_"; exit 1 }

    $exe = Get-WingetExe
    if (-not $exe) { Write-Output "bootstrapped but winget still unavailable"; exit 3 }
}

# accept source agreements once per user - runs on every path
& $exe list --accept-source-agreements --disable-interactivity | Out-Null

Write-Output "winget ready: $(& $exe --version)"
exit 0

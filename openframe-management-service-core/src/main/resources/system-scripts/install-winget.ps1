$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$FamilyName = 'Microsoft.DesktopAppInstaller_8wekyb3d8bbwe'
$LatestUrl = 'https://github.com/microsoft/winget-cli/releases/latest'
$CacheRoot = Join-Path $env:LOCALAPPDATA 'OpenFrame\winget-bootstrap'
$CacheTtlDays = 7
$DiskMarginMb = 200

$OsArch = $env:PROCESSOR_ARCHITEW6432
if (-not $OsArch) { $OsArch = $env:PROCESSOR_ARCHITECTURE }
$Arch = switch ($OsArch) {
    'AMD64' { 'x64' }
    'ARM64' { 'arm64' }
    default { 'x86' }
}

function Get-WingetExe {
    $p = (Get-AppxPackage -Name Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue).InstallLocation
    if ($p -and (Test-Path "$p\winget.exe")) { return "$p\winget.exe" }
    return $null
}

function Resolve-LatestTag {
    $request = [System.Net.HttpWebRequest]::Create($LatestUrl)
    $request.AllowAutoRedirect = $false
    $request.Method = 'HEAD'
    $request.Timeout = 30000
    $response = $request.GetResponse()
    try { $location = $response.Headers['Location'] } finally { $response.Close() }
    if (-not $location) { throw 'no Location header on releases/latest' }
    return $location.Split('/')[-1]
}

function Get-RemoteSize {
    param([string]$Url)

    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = 'HEAD'
    $request.Timeout = 30000
    $response = $request.GetResponse()
    try { return [long]$response.ContentLength } finally { $response.Close() }
}

function Assert-FreeSpace {
    param([long]$RequiredBytes)

    $drive = (Get-Item $CacheRoot).PSDrive.Name
    $free = (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$drive`:'").FreeSpace
    $needMb = [math]::Round($RequiredBytes / 1MB) + $DiskMarginMb
    $freeMb = [math]::Round($free / 1MB)
    if ($freeMb -lt $needMb) {
        Write-Output "not enough disk space: need ${needMb}MB, free ${freeMb}MB on ${drive}:"
        exit 12
    }
}

function Get-CachedAsset {
    param([string]$Url, [string]$Name, [string]$Directory)

    $final = Join-Path $Directory $Name
    if (Test-Path $final) { return $final }

    New-Item -ItemType Directory -Force -Path $Directory | Out-Null
    $partial = "$final.$PID.partial"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing
        if (Test-Path $final) { Remove-Item $partial -Force -ErrorAction SilentlyContinue }
        else { Move-Item -Path $partial -Destination $final -Force }
    } catch {
        Remove-Item $partial -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $final)) { throw }
    }
    return $final
}

function Test-DependencySatisfied {
    param([string]$Name, [string]$MinVersion)

    $installed = Get-AppxPackage -Name $Name -ErrorAction SilentlyContinue
    if (-not $installed) { return $false }
    $best = $installed | ForEach-Object { [version]$_.Version } | Sort-Object -Descending | Select-Object -First 1
    return $best -ge [version]$MinVersion
}

function Expand-Dependencies {
    param([string]$ZipPath, [object[]]$Missing, [string]$Directory)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Force -Path $Directory | Out-Null

    $paths = @()
    $archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($dependency in $Missing) {
            $entry = $archive.Entries |
                Where-Object { $_.FullName -like "$Arch/$($dependency.Name)_*" } |
                Select-Object -First 1
            if (-not $entry) { return $null }

            $target = Join-Path $Directory $entry.Name
            if (-not (Test-Path $target)) {
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
            }
            $paths += $target
        }
    } finally {
        $archive.Dispose()
    }
    return $paths
}

function Remove-StaleCache {
    if (-not (Test-Path $CacheRoot)) { return }
    $cutoff = (Get-Date).AddDays(-$CacheTtlDays)
    Get-ChildItem $CacheRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

try {
    $exe = Get-WingetExe
} catch {
    Write-Output "AppX subsystem is not usable: $($_.Exception.Message)"
    exit 10
}

if ($exe) {
    Write-Output "winget ready: $((& $exe --version).Trim())"
    exit 0
}

try {
    Add-AppxPackage -RegisterByFamilyName -MainPackage $FamilyName
    $exe = Get-WingetExe
    if ($exe) { Write-Output 'recovered by registering the package already on disk' }
} catch {
    Write-Output "register-in-place not applicable: $($_.Exception.Message)"
}

if (-not $exe) {
    New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null
    Remove-StaleCache

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072

        $tag = Resolve-LatestTag
        $assetBase = "https://github.com/microsoft/winget-cli/releases/download/$tag"
        $versionDir = Join-Path $CacheRoot $tag
        $bundleUrl = "$assetBase/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
        $zipUrl = "$assetBase/DesktopAppInstaller_Dependencies.zip"
        Write-Output "latest release: $tag, architecture: $Arch"

        $manifest = Get-CachedAsset -Url "$assetBase/DesktopAppInstaller_Dependencies.json" -Name 'Dependencies.json' -Directory $versionDir
        $required = (Get-Content $manifest -Raw | ConvertFrom-Json).Dependencies
        $missing = @($required | Where-Object { -not (Test-DependencySatisfied -Name $_.Name -MinVersion $_.Version) })
        Write-Output "dependencies: $($required.Count) required, $($missing.Count) missing"

        $needed = Get-RemoteSize -Url $bundleUrl
        if ($missing.Count -gt 0) { $needed += (Get-RemoteSize -Url $zipUrl) * 2 }
        Assert-FreeSpace -RequiredBytes $needed

        $dependencyPaths = @()
        if ($missing.Count -gt 0) {
            $zip = Get-CachedAsset -Url $zipUrl -Name 'Dependencies.zip' -Directory $versionDir
            $dependencyPaths = Expand-Dependencies -ZipPath $zip -Missing $missing -Directory (Join-Path $versionDir $Arch)
            if ($null -eq $dependencyPaths) {
                Write-Output "release has no dependency payload for architecture $Arch"
                exit 21
            }
        }

        $bundle = Get-CachedAsset -Url $bundleUrl -Name 'AppInstaller.msixbundle' -Directory $versionDir

        if ($dependencyPaths.Count -gt 0) {
            Add-AppxPackage -Path $bundle -DependencyPath $dependencyPaths -ForceUpdateFromAnyVersion
        } else {
            Add-AppxPackage -Path $bundle -ForceUpdateFromAnyVersion
        }

        $exe = Get-WingetExe
        if ($exe) { Write-Output 'recovered by direct install' }
    } catch {
        Write-Output "direct install failed: $($_.Exception.Message)"
    }
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
    } catch { Write-Output "module bootstrap failed: $($_.Exception.Message)"; exit 30 }

    try { Repair-WinGetPackageManager -Force -Latest }
    catch { Write-Output "repair failed: $($_.Exception.Message)"; exit 31 }

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
    Write-Output "winget is installed but will not run: $($_.Exception.Message)"
    exit 40
}

Remove-Item $CacheRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "winget ready: $version"
exit 0

//! Windows PowerShell self-update script: the Rust side extracts the binary, the script only stops, swaps, starts and verifies.

pub const UPDATE_SCRIPT_WINDOWS: &str = r#"
# Requires Windows PowerShell 3.0+ (ConvertFrom-Json, Get-Content -Raw); never use 5.0-only cmdlets such as New-Guid or Expand-Archive.
param(
    [string]$NewExePath,
    [string]$ServiceName,
    [string]$TargetExe,
    [string]$UpdateStatePath,
    [string]$TargetVersion,
    [string]$BootMarkerPath,
    [string]$LkgPath,
    [string]$TranscriptPath,
    [int]$BootMarkerWaitSecs = 90,
    [switch]$RollbackOnly
)

$ErrorActionPreference = 'Stop'

if ($TranscriptPath) {
    try { Start-Transcript -Path $TranscriptPath -Force | Out-Null } catch { }
}

$PrevPath = "$TargetExe.prev"
$SwapReached = $false

function Set-UpdatePhase {
    param([string]$Phase, [string]$Reason)
    if ($UpdateStatePath -and (Test-Path $UpdateStatePath)) {
        try {
            $stateContent = Get-Content -Path $UpdateStatePath -Raw | ConvertFrom-Json
            $stateContent.phase = $Phase
            if ($Reason) {
                # ASCII only: Set-Content writes the ANSI code page, which the Rust reader rejects as invalid UTF-8
                $safeReason = ($Reason -replace '[^\x20-\x7E]', '?')
                if ($safeReason.Length -gt 1000) { $safeReason = $safeReason.Substring(0, 1000) }
                $stateContent | Add-Member -NotePropertyName last_error -NotePropertyValue "PowerShell $($PSVersionTable.PSVersion): $safeReason" -Force
            }
            $stateTmp = "$UpdateStatePath.tmp"
            $stateContent | ConvertTo-Json -Depth 10 | Set-Content -Path $stateTmp -Force
            Move-Item -Path $stateTmp -Destination $UpdateStatePath -Force
            Write-Output "Update state phase set to '$Phase'"
        }
        catch {
            Write-Output "Failed to stamp update phase '$Phase': $_"
        }
    }
}

function Remove-NewExe {
    if ($NewExePath -and (Test-Path $NewExePath)) {
        Remove-Item -Path $NewExePath -Force -ErrorAction SilentlyContinue
    }
}

function Restore-Reserve {
    if ($LkgPath -and (Test-Path $LkgPath)) {
        $restoreSource = $LkgPath
        Write-Output "Restoring from last-known-good reserve: $LkgPath"
    }
    elseif (Test-Path $PrevPath) {
        $restoreSource = $PrevPath
        Write-Output "Restoring from pre-swap copy: $PrevPath"
    }
    else {
        throw "No reserve available for rollback (checked '$LkgPath' and '$PrevPath')"
    }
    if (Test-Path $TargetExe) {
        try { Move-Item -Path $TargetExe -Destination "$TargetExe.bad" -Force -ErrorAction Stop } catch { }
    }
    Copy-Item -Path $restoreSource -Destination $TargetExe -Force -ErrorAction Stop
    Remove-Item -Path "$TargetExe.bad" -Force -ErrorAction SilentlyContinue
}

function Test-AgentUninstalled {
    return (-not $RollbackOnly) -and $UpdateStatePath -and (-not (Test-Path $UpdateStatePath))
}

try {
    Write-Output "Updater starting: target version '$TargetVersion', target exe '$TargetExe', PowerShell $($PSVersionTable.PSVersion)"

    if ($RollbackOnly) {
        $SwapReached = $true
        throw "Rollback-only mode requested"
    }

    # Validate inputs
    if (-not (Test-Path $NewExePath)) {
        throw "New executable not found: $NewExePath"
    }
    if (-not (Test-Path $TargetExe)) {
        throw "Target executable not found: $TargetExe"
    }

    $newExeSize = (Get-Item $NewExePath).Length
    if ($newExeSize -lt 100KB) {
        throw "New executable too small ($newExeSize bytes), likely corrupted"
    }

    # Stop the service
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        throw "Service not found: $ServiceName"
    }

    if ($service.Status -ne 'Stopped') {
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
    }

    # Wait for service to fully stop
    $timeout = 30
    $elapsed = 0
    while ((Get-Service -Name $ServiceName).Status -ne 'Stopped' -and $elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
    }

    if ($elapsed -ge $timeout) {
        throw "Service did not stop within $timeout seconds"
    }

    Start-Sleep -Seconds 2

    # Replace binary
    Move-Item -Path $TargetExe -Destination $PrevPath -Force -ErrorAction Stop
    $SwapReached = $true

    Copy-Item -Path $NewExePath -Destination $TargetExe -Force -ErrorAction Stop

    if ($BootMarkerPath -and (Test-Path $BootMarkerPath)) {
        Remove-Item -Path $BootMarkerPath -Force -ErrorAction Stop
    }

    # Start service
    Start-Service -Name $ServiceName -ErrorAction Stop

    # Verify service started
    Start-Sleep -Seconds 3
    $service = Get-Service -Name $ServiceName -ErrorAction Stop

    if ($service.Status -ne 'Running') {
        throw "Service failed to start"
    }

    $markerOk = $false
    if ($BootMarkerPath -and $TargetVersion) {
        $elapsed = 0
        while ($elapsed -lt $BootMarkerWaitSecs) {
            if (Test-Path $BootMarkerPath) {
                $markerVersion = Get-Content -Path $BootMarkerPath -Raw -ErrorAction SilentlyContinue
                if ($markerVersion) { $markerVersion = $markerVersion.Trim() }
                if ($markerVersion -eq $TargetVersion) {
                    $markerOk = $true
                    break
                }
                if ($markerVersion) {
                    Write-Output "Boot marker reports '$markerVersion', expected '$TargetVersion' - wrong binary booted"
                    break
                }
            }
            Start-Sleep -Seconds 2
            $elapsed += 2
        }
    }
    else {
        Write-Output "No boot marker path/target version provided, skipping boot check"
        $markerOk = $true
    }

    if (-not $markerOk) {
        throw "New binary did not report target version '$TargetVersion' within $BootMarkerWaitSecs seconds"
    }

    Write-Output "Boot marker matched target version '$TargetVersion'"

    Set-UpdatePhase -Phase "verifying"

    Remove-NewExe

    exit 0
}
catch {
    $failure = "$_"
    Write-Output "Updater failed: $failure"

    if (Test-AgentUninstalled) {
        Write-Output "Update state file is gone (agent uninstalled mid-update) - standing down without touching the service"
        Remove-NewExe
        exit 1
    }

    if ($SwapReached) {
        try {
            $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
            if ($service -and $service.Status -ne 'Stopped') {
                Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
                $rbStop = 0
                while ((Get-Service -Name $ServiceName).Status -ne 'Stopped' -and $rbStop -lt 30) {
                    Start-Sleep -Seconds 1
                    $rbStop++
                }
                Start-Sleep -Seconds 2
            }

            $restored = $false
            for ($restoreAttempt = 1; $restoreAttempt -le 3; $restoreAttempt++) {
                try {
                    Restore-Reserve
                    $restored = $true
                    break
                }
                catch {
                    Write-Output "Restore attempt $restoreAttempt failed: $_"
                    Start-Sleep -Seconds 2
                }
            }
            if (-not $restored) {
                throw "All restore attempts failed"
            }

            Start-Service -Name $ServiceName -ErrorAction Stop
            $rbElapsed = 0
            while ((Get-Service -Name $ServiceName).Status -ne 'Running' -and $rbElapsed -lt 30) {
                Start-Sleep -Seconds 1
                $rbElapsed++
            }
            if ((Get-Service -Name $ServiceName).Status -ne 'Running') {
                throw "Service did not reach Running state after rollback"
            }

            Set-UpdatePhase -Phase "rolled_back"
            Write-Output "Rollback complete, service restarted"
        }
        catch {
            Write-Output "Rollback failed: $_"
            Set-UpdatePhase -Phase "failed" -Reason "$failure; rollback failed: $_"
            try {
                if ((Get-Service -Name $ServiceName -ErrorAction Stop).Status -ne 'Running') {
                    Start-Service -Name $ServiceName -ErrorAction Stop
                    Write-Output "Service restarted with the binary currently in place"
                }
            }
            catch {
                Write-Output "Failed to restart service after failed rollback: $_"
            }
        }
    }
    else {
        Write-Output "Failure happened before the binary swap, no rollback needed"
        Set-UpdatePhase -Phase "failed" -Reason $failure
        try {
            $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
            if ($service -and $service.Status -ne 'Running') {
                Start-Service -Name $ServiceName -ErrorAction Stop
                Write-Output "Service restarted with the untouched binary"
            }
        }
        catch {
            Write-Output "Failed to restart service after pre-swap failure: $_"
        }
    }

    Remove-NewExe

    exit 1
}
finally {
    if ($TranscriptPath) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}
"#;

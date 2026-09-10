package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Getter;

// Seeded once per tenant. Changing a body/metadata here does NOT re-seed existing
// tenants — add a new migration to update them.
@Getter
@AllArgsConstructor
public enum SystemScriptDefinition {

    INSTALL_BREW(
            SystemScriptCode.INSTALL_BREW,
            "system-scripts/install-brew.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            PrivilegeLevel.ADMIN,
            // 900 is the max the run UI accepts; a CLT download on a slow link can still exceed it
            900,
            "Installs Homebrew for the console user. Managed by OpenFrame."),

    INSTALL_CHOCOLATEY(
            SystemScriptCode.INSTALL_CHOCOLATEY,
            "system-scripts/install-chocolatey.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            PrivilegeLevel.ADMIN,
            1800,
            "Installs Chocolatey. Managed by OpenFrame."),

    INSTALL_WINGET(
            SystemScriptCode.INSTALL_WINGET,
            "system-scripts/install-winget.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            PrivilegeLevel.USER,
            1800,
            "Installs or repairs the WinGet package manager for the logged-in user. Managed by OpenFrame.");

    private final SystemScriptCode code;
    private final String resourcePath;
    private final ScriptShell shell;
    private final OsType osType;
    private final PrivilegeLevel privilegeLevel;
    private final Integer defaultTimeoutSeconds;
    private final String description;
}

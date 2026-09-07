package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * The seeded package-manager bootstrap scripts. Bodies live as classpath
 * resources. Privilege levels are dictated by the managers themselves:
 * brew runs as ADMIN but drops to the console user (Homebrew refuses root),
 * choco installs machine-wide under SYSTEM/ADMIN, and winget MUST run as the
 * logged-in USER — the Appx registration and PATH fix are per-user.
 */
@Getter
@AllArgsConstructor
public enum SystemScriptDefinition {

    INSTALL_BREW(
            SystemScriptCode.INSTALL_BREW,
            "system-scripts/install-brew.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            PrivilegeLevel.ADMIN,
            "Installs Homebrew for the console user. Managed by OpenFrame."),

    INSTALL_CHOCOLATEY(
            SystemScriptCode.INSTALL_CHOCOLATEY,
            "system-scripts/install-chocolatey.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            PrivilegeLevel.ADMIN,
            "Installs Chocolatey. Managed by OpenFrame."),

    INSTALL_WINGET(
            SystemScriptCode.INSTALL_WINGET,
            "system-scripts/install-winget.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            PrivilegeLevel.USER,
            "Installs or repairs the WinGet package manager for the logged-in user. Managed by OpenFrame.");

    private final SystemScriptCode code;
    private final String resourcePath;
    private final ScriptShell shell;
    private final OsType osType;
    private final PrivilegeLevel privilegeLevel;
    private final String description;
}

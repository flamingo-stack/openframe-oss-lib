package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * The seeded package-manager bootstrap scripts. Bodies live as classpath
 * resources; every script runs as ADMIN — the brew one drops to the console
 * user itself, because Homebrew refuses to run under root.
 */
@Getter
@AllArgsConstructor
public enum SystemScriptDefinition {

    INSTALL_BREW(
            SystemScriptCode.INSTALL_BREW,
            "system-scripts/install-brew.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            "Installs Homebrew for the console user. Managed by OpenFrame."),

    INSTALL_CHOCOLATEY(
            SystemScriptCode.INSTALL_CHOCOLATEY,
            "system-scripts/install-chocolatey.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            "Installs Chocolatey. Managed by OpenFrame."),

    INSTALL_WINGET(
            SystemScriptCode.INSTALL_WINGET,
            "system-scripts/install-winget.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            "Repairs or installs the WinGet package manager for all users. Managed by OpenFrame.");

    private final SystemScriptCode code;
    private final String resourcePath;
    private final ScriptShell shell;
    private final OsType osType;
    private final String description;
}

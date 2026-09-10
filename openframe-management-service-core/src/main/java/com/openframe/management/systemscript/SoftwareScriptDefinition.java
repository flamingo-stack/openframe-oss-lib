package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum SoftwareScriptDefinition implements ManagedScriptDefinition {

    BREW_INSTALL(
            SoftwareScriptCode.BREW_INSTALL,
            "system-scripts/brew-install-software.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            PrivilegeLevel.USER,
            90,
            "Installs a Homebrew package (passed as a script argument). Managed by OpenFrame."),

    BREW_UPDATE(
            SoftwareScriptCode.BREW_UPDATE,
            "system-scripts/brew-update-software.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            PrivilegeLevel.USER,
            90,
            "Updates a Homebrew package (passed as a script argument). Managed by OpenFrame."),

    WINGET_INSTALL(
            SoftwareScriptCode.WINGET_INSTALL,
            "system-scripts/winget-install-software.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            PrivilegeLevel.USER,
            90,
            "Installs a winget package (passed as a script argument). Managed by OpenFrame."),

    WINGET_UPDATE(
            SoftwareScriptCode.WINGET_UPDATE,
            "system-scripts/winget-update-software.ps1",
            ScriptShell.POWERSHELL,
            OsType.WINDOWS,
            PrivilegeLevel.USER,
            90,
            "Updates a winget package (passed as a script argument). Managed by OpenFrame.");

    private final SoftwareScriptCode code;
    private final String resourcePath;
    private final ScriptShell shell;
    private final OsType osType;
    private final PrivilegeLevel privilegeLevel;
    private final Integer defaultTimeoutSeconds;
    private final String description;

    @Override
    public String getCanonicalName() {
        return code.canonicalName();
    }

    @Override
    public ScriptType getScriptType() {
        return ScriptType.SOFTWARE;
    }
}

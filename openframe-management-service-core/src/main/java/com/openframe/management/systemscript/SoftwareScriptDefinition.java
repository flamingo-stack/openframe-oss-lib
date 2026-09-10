package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * The seeded software-management scripts: install/update a package with an already-provisioned
 * manager. The chosen package is passed as a script argument (e.g. {@code --cask slack}); the body
 * only supplies the verb. Run as the logged-in user (USER) — Homebrew refuses root — and bootstrap
 * of the manager itself is out of scope here (see {@link SystemScriptDefinition}).
 *
 * <p>Seeded with {@link ScriptType#SOFTWARE}.
 */
@Getter
@AllArgsConstructor
public enum SoftwareScriptDefinition implements ManagedScriptDefinition {

    BREW_INSTALL(
            SoftwareScriptCode.BREW_INSTALL,
            "system-scripts/brew-install.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            PrivilegeLevel.USER,
            1800,
            "Installs a Homebrew package (passed as a script argument). Managed by OpenFrame."),

    BREW_UPGRADE(
            SoftwareScriptCode.BREW_UPGRADE,
            "system-scripts/brew-upgrade.sh",
            ScriptShell.BASH,
            OsType.MAC_OS,
            PrivilegeLevel.USER,
            1800,
            "Updates a Homebrew package (passed as a script argument). Managed by OpenFrame.");

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

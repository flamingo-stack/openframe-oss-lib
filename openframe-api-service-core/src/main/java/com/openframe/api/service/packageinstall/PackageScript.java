package com.openframe.api.service.packageinstall;

import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;

/** A ready-to-dispatch package-manager script with its execution parameters. */
public record PackageScript(String code, ScriptShell shell, PrivilegeLevel privilegeLevel) {
}

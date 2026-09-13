package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;

public interface ManagedScriptDefinition {

    String getCanonicalName();

    String getResourcePath();

    ScriptShell getShell();

    OsType getOsType();

    PrivilegeLevel getPrivilegeLevel();

    Integer getDefaultTimeoutSeconds();

    String getDescription();

    ScriptType getScriptType();
}

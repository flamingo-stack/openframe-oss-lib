package com.openframe.management.systemscript;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;

/**
 * An OpenFrame-provisioned (managed, immutable) script definition whose body ships as a classpath
 * resource. Implemented by the per-category enums ({@link SystemScriptDefinition} bootstrap scripts,
 * {@link SoftwareScriptDefinition} install/update scripts) so a single seeder reconciles them all,
 * stamping each with its {@link #getScriptType()}.
 */
public interface ManagedScriptDefinition {

    /** Stable, tenant-independent script name (the code's canonical name). */
    String getCanonicalName();

    /** Classpath location of the script body. */
    String getResourcePath();

    ScriptShell getShell();

    OsType getOsType();

    PrivilegeLevel getPrivilegeLevel();

    Integer getDefaultTimeoutSeconds();

    String getDescription();

    /** Category stamped on the seeded {@code Script} — SYSTEM (bootstrap) or SOFTWARE (install/update). */
    ScriptType getScriptType();
}

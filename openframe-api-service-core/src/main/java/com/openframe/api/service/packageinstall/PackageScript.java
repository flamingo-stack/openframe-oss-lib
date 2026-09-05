package com.openframe.api.service.packageinstall;

import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PackageScript {

    private final String code;
    private final ScriptShell shell;
    private final PrivilegeLevel privilegeLevel;
}

package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;

public record ExecutionOwnerScope(Type type,
                                  String id,
                                  PackageManagerType packageManager,
                                  String packageName,
                                  SoftwareAction softwareAction) {

    public enum Type {
        SCRIPT, SCHEDULE, SOFTWARE
    }

    public static ExecutionOwnerScope forScript(String scriptId) {
        return new ExecutionOwnerScope(Type.SCRIPT, scriptId, null, null, null);
    }

    public static ExecutionOwnerScope forSchedule(String scheduleId) {
        return new ExecutionOwnerScope(Type.SCHEDULE, scheduleId, null, null, null);
    }

    public static ExecutionOwnerScope forSoftware(PackageManagerType packageManager, String packageName,
                                                  SoftwareAction softwareAction) {
        return new ExecutionOwnerScope(Type.SOFTWARE, null, packageManager, packageName, softwareAction);
    }
}

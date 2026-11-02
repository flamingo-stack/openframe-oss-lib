package com.openframe.data.document.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class SoftwareExecutionId {

    private SoftwareExecutionId() {
    }

    public static String forBundle(String bundleId, PackageManagerType packageManager, String packageName) {
        return derive("swbundle", bundleId, packageManager, packageName);
    }

    public static String forSchedule(String scheduleId, PackageManagerType packageManager, String packageName) {
        return derive("swschedule", scheduleId, packageManager, packageName);
    }

    // one auto-update job per package and version, so devices that reach it later join the same row
    public static String forAutoUpdate(String tenantId, PackageManagerType packageManager, String packageName, String version) {
        return derive("swauto", tenantId + '@' + version, packageManager, packageName);
    }

    private static String derive(String kind, String id, PackageManagerType packageManager, String packageName) {
        String seed = kind + ':' + id + ':' + packageManager + ':' + packageName;
        return UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8)).toString();
    }
}

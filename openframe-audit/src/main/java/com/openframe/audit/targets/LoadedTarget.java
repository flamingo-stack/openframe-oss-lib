package com.openframe.audit.targets;

public record LoadedTarget(AuditTarget<?> target, Object document) {

    public String name() {
        return target.nameOf(document);
    }

    public String organizationId() {
        return target.organizationIdOf(document);
    }

    public String deviceId() {
        return target.deviceIdOf(document);
    }
}

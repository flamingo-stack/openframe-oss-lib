package com.openframe.data.document.device.filter;

public enum DeviceFacetDimension {
    STATUS("status"),
    DEVICE_TYPE("type"),
    OS_TYPE("osType"),
    ORGANIZATION_ID("organizationId");

    private final String fieldName;

    DeviceFacetDimension(String fieldName) {
        this.fieldName = fieldName;
    }

    public String fieldName() {
        return fieldName;
    }
}

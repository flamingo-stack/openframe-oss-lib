package com.openframe.data.model.enums;

public enum IntegratedToolType {

    RMM("rmm"),
    MESHCENTRAL ("meshcentral"),
    FLEET ("fleet-mdm"),
    MICROSOFT_365("microsoft-365"),
    GOOGLE_WORKSPACE("google-workspace");

    private final String dbName;

    IntegratedToolType(String name) {
        this.dbName = name;
    }

    public String getDbName() {
        return dbName;
    }
}

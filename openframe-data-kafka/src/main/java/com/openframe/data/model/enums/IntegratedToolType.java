package com.openframe.data.model.enums;

public enum IntegratedToolType {

    RMM("rmm"),
    MESHCENTRAL ("meshcentral"),
    FLEET ("fleet-mdm");

    private final String dbName;

    IntegratedToolType(String name) {
        this.dbName = name;
    }

    public String getDbName() {
        return dbName;
    }
}

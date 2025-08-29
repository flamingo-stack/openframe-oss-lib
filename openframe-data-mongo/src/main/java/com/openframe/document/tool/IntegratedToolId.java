package com.openframe.document.tool;

import lombok.Getter;

@Getter
public enum IntegratedToolId {

    FLEET_SERVER_ID("fleetmdm-server");
    private final String value;

    IntegratedToolId(String value) {
        this.value = value;
    }

}

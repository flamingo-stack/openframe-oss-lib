package com.openframe.data.document.tool;

import lombok.Getter;

@Getter
public enum IntegratedToolId {

    FLEET_SERVER_ID("fleetmdm-server"),
    TACTICAL_SERVER_ID("tactical-rmm");
    private final String value;

    IntegratedToolId(String value) {
        this.value = value;
    }

}

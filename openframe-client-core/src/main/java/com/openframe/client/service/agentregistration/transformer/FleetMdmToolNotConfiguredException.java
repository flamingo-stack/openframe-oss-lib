package com.openframe.client.service.agentregistration.transformer;

public class FleetMdmToolNotConfiguredException extends RuntimeException {

    public FleetMdmToolNotConfiguredException(String message) {
        super(message);
    }

    public FleetMdmToolNotConfiguredException(String message, Throwable cause) {
        super(message, cause);
    }
}

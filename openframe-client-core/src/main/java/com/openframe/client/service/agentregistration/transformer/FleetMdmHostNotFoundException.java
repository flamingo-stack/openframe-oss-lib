package com.openframe.client.service.agentregistration.transformer;

public class FleetMdmHostNotFoundException extends RuntimeException {

    public FleetMdmHostNotFoundException(String message) {
        super(message);
    }

    public FleetMdmHostNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}

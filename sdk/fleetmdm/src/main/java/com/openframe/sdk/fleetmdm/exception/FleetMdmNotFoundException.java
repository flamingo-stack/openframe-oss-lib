package com.openframe.sdk.fleetmdm.exception;

public class FleetMdmNotFoundException extends FleetMdmApiException {

    private static final int NOT_FOUND = 404;

    public FleetMdmNotFoundException(String message, String responseBody) {
        super(message, NOT_FOUND, responseBody);
    }
}

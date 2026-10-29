package com.openframe.sdk.fleetmdm.exception;

// An IllegalArgumentException so every surface that already answers 400 for one keeps doing so;
// the type exists only so a caller can tell a rejected argument from a Fleet failure.
public class FleetMdmArgumentException extends IllegalArgumentException {

    public FleetMdmArgumentException(String message) {
        super(message);
    }
}

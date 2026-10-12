package com.openframe.graphql.relay;

public class InvalidRelayIdException extends RuntimeException {

    public static final String CODE = "INVALID_ID";

    public InvalidRelayIdException(String message) {
        super(message);
    }

    public String getCode() {
        return CODE;
    }
}

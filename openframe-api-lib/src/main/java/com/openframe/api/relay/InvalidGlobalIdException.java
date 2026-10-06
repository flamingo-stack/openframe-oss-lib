package com.openframe.api.relay;

public class InvalidGlobalIdException extends RuntimeException {

    public static final String CODE = "INVALID_ID";

    public InvalidGlobalIdException(String message) {
        super(message);
    }

    public String getCode() {
        return CODE;
    }
}

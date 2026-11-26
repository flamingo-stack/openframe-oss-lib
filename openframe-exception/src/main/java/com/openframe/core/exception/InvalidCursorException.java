package com.openframe.core.exception;

public class InvalidCursorException extends BadRequestException {

    private static final String MESSAGE = "Invalid cursor";

    public InvalidCursorException() {
        super(ErrorCode.INVALID_CURSOR, MESSAGE);
    }

    public InvalidCursorException(Throwable cause) {
        super(ErrorCode.INVALID_CURSOR, MESSAGE, cause);
    }
}

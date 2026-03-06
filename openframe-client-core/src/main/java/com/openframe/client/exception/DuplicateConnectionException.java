package com.openframe.client.exception;

import com.openframe.core.exception.ConflictException;

public class DuplicateConnectionException extends ConflictException {
    public DuplicateConnectionException(String message) {
        super(message);
    }
}

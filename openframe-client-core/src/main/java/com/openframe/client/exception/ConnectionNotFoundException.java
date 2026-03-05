package com.openframe.client.exception;

import com.openframe.core.exception.NotFoundException;

public class ConnectionNotFoundException extends NotFoundException {
    public ConnectionNotFoundException(String message) {
        super(message);
    }
}

package com.openframe.client.exception;

import com.openframe.core.exception.NotFoundException;

public class MachineNotFoundException extends NotFoundException {
    public MachineNotFoundException(String message) {
        super(message);
    }
}

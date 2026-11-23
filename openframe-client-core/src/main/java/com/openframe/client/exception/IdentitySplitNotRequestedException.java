package com.openframe.client.exception;

import com.openframe.core.exception.ConflictException;

public class IdentitySplitNotRequestedException extends ConflictException {
    public IdentitySplitNotRequestedException(String message) {
        super(message);
    }
}

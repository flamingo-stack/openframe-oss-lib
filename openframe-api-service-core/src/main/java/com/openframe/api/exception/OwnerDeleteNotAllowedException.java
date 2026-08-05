package com.openframe.api.exception;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;

/**
 * Thrown when deleting an account that currently holds the OWNER role. 409 rather than 403:
 * the block is about the resource's current state, not the caller's permissions — transferring
 * ownership first resolves it.
 */
public class OwnerDeleteNotAllowedException extends ConflictException {

    public OwnerDeleteNotAllowedException(String message) {
        super(ErrorCode.OWNER_DELETE_NOT_ALLOWED, message);
    }
}

package com.openframe.data.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

/**
 * Exception thrown when an API key is not found
 */
public class ApiKeyNotFoundException extends NotFoundException {

    public ApiKeyNotFoundException(String keyId) {
        super(ErrorCode.API_KEY_NOT_FOUND, "API key not found: " + keyId);
    }

    public ApiKeyNotFoundException(String keyId, String userId) {
        super(ErrorCode.API_KEY_NOT_FOUND, "API key '" + keyId + "' not found for user: " + userId);
    }

    public ApiKeyNotFoundException(String message, Throwable cause) {
        super(ErrorCode.API_KEY_NOT_FOUND, message, cause);
    }
}

package com.openframe.core.exception;

public class EncryptionException extends InternalException {

    public EncryptionException(ApiErrorCode errorCode, String message) {
        super(errorCode, message);
    }

    public EncryptionException(ApiErrorCode errorCode, String message, Throwable cause) {
        super(errorCode, message, cause);
    }
}

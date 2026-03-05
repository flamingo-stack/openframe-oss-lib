package com.openframe.core.exception;

public class EncryptionException extends InternalException {

    public EncryptionException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }

    public EncryptionException(ErrorCode errorCode, String message, Throwable cause) {
        super(errorCode, message, cause);
    }
}

package com.openframe.client.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.UnauthorizedException;

public class InvalidClientSecretException extends UnauthorizedException {

    public InvalidClientSecretException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }
}

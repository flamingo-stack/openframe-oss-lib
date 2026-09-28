package com.openframe.api.exception;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

// package-search services throw this instead of letting RestClient exceptions escape:
// host applications may map raw RestClient exceptions to unrelated error messages
public class PackageSourceUnavailableException extends BaseException {

    public PackageSourceUnavailableException(String message) {
        super(ErrorCode.INTERNAL_ERROR, HttpStatus.SERVICE_UNAVAILABLE, message);
    }

    public PackageSourceUnavailableException(String message, Throwable cause) {
        super(ErrorCode.INTERNAL_ERROR, HttpStatus.SERVICE_UNAVAILABLE, message, cause);
    }
}

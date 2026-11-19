package com.openframe.external.exception;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public class ToolProxyException extends BaseException {

    private ToolProxyException(ErrorCode errorCode, HttpStatus httpStatus, String message, Throwable cause) {
        super(errorCode, httpStatus, message, cause);
    }

    public static ToolProxyException unreachable(String toolId, Throwable cause) {
        throw new UnsupportedOperationException("not implemented");
    }

    public static ToolProxyException timeout(String toolId, Throwable cause) {
        throw new UnsupportedOperationException("not implemented");
    }
}

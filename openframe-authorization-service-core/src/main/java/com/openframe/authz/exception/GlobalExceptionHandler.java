package com.openframe.authz.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler extends BaseGlobalExceptionHandler {

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex, WebRequest request) {
        log.warn("Bad request: missing parameter '{}'", ex.getParameterName());
        return buildResponse(ErrorCode.BAD_REQUEST, "Missing required parameter: " + ex.getParameterName(),
                HttpStatus.BAD_REQUEST, request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(NoResourceFoundException ex, WebRequest request) {
        log.debug("Resource not found: {}", ex.getMessage());
        return buildResponse(ErrorCode.NOT_FOUND, ex.getMessage(), HttpStatus.NOT_FOUND, request);
    }
}

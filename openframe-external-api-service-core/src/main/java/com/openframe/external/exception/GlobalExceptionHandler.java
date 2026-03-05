package com.openframe.external.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler extends BaseGlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex, WebRequest request) {
        log.warn("Type mismatch error: {}", ex.getMessage());
        String message = String.format("Invalid value '%s' for parameter '%s'", ex.getValue(), ex.getName());
        return buildResponse(ErrorCode.TYPE_MISMATCH, message, HttpStatus.BAD_REQUEST, request);
    }

    @ExceptionHandler(PinotQueryException.class)
    public ResponseEntity<ErrorResponse> handlePinotQueryException(PinotQueryException ex, WebRequest request) {
        log.error("Pinot query error: ", ex);
        return buildResponse(ErrorCode.PINOT_QUERY_ERROR, "Query service temporarily unavailable. Please try again later.",
                HttpStatus.SERVICE_UNAVAILABLE, request);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorResponse> handleDataAccessException(DataAccessException ex, WebRequest request) {
        log.error("Database access error: ", ex);
        return buildResponse(ErrorCode.DATABASE_ERROR, "Database operation failed. Please try again later.",
                HttpStatus.SERVICE_UNAVAILABLE, request);
    }
}

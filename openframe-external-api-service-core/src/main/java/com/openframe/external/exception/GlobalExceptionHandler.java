package com.openframe.external.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("Type mismatch error: {}", ex.getMessage());
        String message = String.format("Invalid value '%s' for parameter '%s'", ex.getValue(), ex.getName());
        return ErrorResponse.of(ErrorCode.TYPE_MISMATCH, message);
    }

    @ExceptionHandler(PinotQueryException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ErrorResponse handlePinotQueryException(PinotQueryException ex) {
        log.error("Pinot query error: ", ex);
        return ErrorResponse.of(ErrorCode.PINOT_QUERY_ERROR, "Query service temporarily unavailable. Please try again later.");
    }

    @ExceptionHandler(DataAccessException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ErrorResponse handleDataAccessException(DataAccessException ex) {
        log.error("Database access error: ", ex);
        return ErrorResponse.of(ErrorCode.DATABASE_ERROR, "Database operation failed. Please try again later.");
    }
}

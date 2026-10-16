package com.openframe.api.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EncryptionException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleEncryptionException(EncryptionException ex) {
        log.error("Encryption/decryption error: ", ex);
        return ErrorResponse.of(ex.getErrorCode(), "Configuration security error");
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleOptimisticLockingFailure(OptimisticLockingFailureException ex) {
        log.warn("Conflict: {}", ex.getMessage());
        return ErrorResponse.of(ErrorCode.CONFLICT, "This item was changed by someone else. Reload it and try again.");
    }
}

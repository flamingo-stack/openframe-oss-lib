package com.openframe.api.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.EncryptionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

@RestControllerAdvice
public class GlobalExceptionHandler extends BaseGlobalExceptionHandler {

    @ExceptionHandler(EncryptionException.class)
    public ResponseEntity<ErrorResponse> handleEncryptionException(EncryptionException ex, WebRequest request) {
        log.error("Encryption/decryption error: ", ex);
        return buildResponse(ex.getErrorCode(), "Configuration security error",
                HttpStatus.INTERNAL_SERVER_ERROR, request);
    }
}

package com.openframe.core.exception;

import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.List;

public class ValidationException extends BaseException {

    private final List<FieldError> fieldErrors;

    public ValidationException(String message) {
        super(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, message);
        this.fieldErrors = Collections.emptyList();
    }

    public ValidationException(String message, List<FieldError> fieldErrors) {
        super(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, message);
        this.fieldErrors = fieldErrors != null ? fieldErrors : Collections.emptyList();
    }

    public List<FieldError> getFieldErrors() {
        return fieldErrors;
    }

    public record FieldError(String field, String message) {}
}

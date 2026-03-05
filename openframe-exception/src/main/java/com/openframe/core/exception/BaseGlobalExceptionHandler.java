package com.openframe.core.exception;

import com.openframe.core.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

public abstract class BaseGlobalExceptionHandler {

    protected static final Logger log = LoggerFactory.getLogger(BaseGlobalExceptionHandler.class);

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ErrorResponse> handleBaseException(BaseException ex, WebRequest request) {
        log.error("{}: {}", ex.getErrorCode().getCode(), ex.getMessage(), ex);

        ErrorResponse.ErrorResponseBuilder builder = ErrorResponse.builder()
                .code(ex.getErrorCode().getCode())
                .message(ex.getMessage())
                .status(ex.getHttpStatus().value())
                .timestamp(Instant.now().toString())
                .path(getPath(request));

        if (ex instanceof ValidationException validationEx && !validationEx.getFieldErrors().isEmpty()) {
            builder.fieldErrors(validationEx.getFieldErrors().stream()
                    .map(fe -> ErrorResponse.FieldError.builder()
                            .field(fe.field())
                            .message(fe.message())
                            .build())
                    .toList());
        }

        return ResponseEntity.status(ex.getHttpStatus()).body(builder.build());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, WebRequest request) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> ErrorResponse.FieldError.builder()
                        .field(error.getField())
                        .message(error.getDefaultMessage())
                        .build())
                .toList();

        String errorMessage = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));

        log.warn("Validation error: {}", errorMessage);

        ErrorResponse response = ErrorResponse.builder()
                .code(ErrorCode.VALIDATION_ERROR.getCode())
                .message(errorMessage)
                .status(HttpStatus.BAD_REQUEST.value())
                .timestamp(Instant.now().toString())
                .path(getPath(request))
                .fieldErrors(fieldErrors)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex, WebRequest request) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getConstraintViolations().stream()
                .map(violation -> ErrorResponse.FieldError.builder()
                        .field(violation.getPropertyPath().toString())
                        .message(violation.getMessage())
                        .build())
                .toList();

        String errorMessage = ex.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .collect(Collectors.joining(", "));

        log.warn("Constraint violation: {}", errorMessage);

        ErrorResponse response = ErrorResponse.builder()
                .code(ErrorCode.VALIDATION_ERROR.getCode())
                .message(errorMessage)
                .status(HttpStatus.BAD_REQUEST.value())
                .timestamp(Instant.now().toString())
                .path(getPath(request))
                .fieldErrors(fieldErrors)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        log.error("Access denied: ", ex);
        return buildResponse(ErrorCode.UNAUTHORIZED, ex.getMessage(), HttpStatus.UNAUTHORIZED, request);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex, WebRequest request) {
        log.error("Authentication failed: ", ex);
        return buildResponse(ErrorCode.UNAUTHORIZED, ex.getMessage(), HttpStatus.UNAUTHORIZED, request);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponse> handleMissingRequestHeader(MissingRequestHeaderException ex, WebRequest request) {
        log.error("Missing required header: ", ex);
        return buildResponse(ErrorCode.BAD_REQUEST, "Required header '" + ex.getHeaderName() + "' is missing",
                HttpStatus.BAD_REQUEST, request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex, WebRequest request) {
        log.error("Invalid request: ", ex);
        return buildResponse(ErrorCode.BAD_REQUEST, ex.getMessage(), HttpStatus.BAD_REQUEST, request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex, WebRequest request) {
        log.warn("Conflict: {}", ex.getMessage());
        return buildResponse(ErrorCode.CONFLICT, ex.getMessage(), HttpStatus.CONFLICT, request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, WebRequest request) {
        log.error("Method not supported: ", ex);
        return buildResponse(ErrorCode.METHOD_NOT_ALLOWED, ex.getMessage(), HttpStatus.METHOD_NOT_ALLOWED, request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex, WebRequest request) {
        log.error("Media type not supported: ", ex);
        return buildResponse(ErrorCode.UNSUPPORTED_MEDIA_TYPE, ex.getMessage(), HttpStatus.UNSUPPORTED_MEDIA_TYPE, request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatusException(ResponseStatusException ex, WebRequest request) {
        log.warn("Response status exception: {} - {}", ex.getStatusCode(), ex.getReason());
        ErrorResponse response = ErrorResponse.builder()
                .code("error")
                .message(ex.getReason())
                .status(ex.getStatusCode().value())
                .timestamp(Instant.now().toString())
                .path(getPath(request))
                .build();
        return ResponseEntity.status(ex.getStatusCode()).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception ex, WebRequest request) {
        log.error("Unexpected error: ", ex);
        return buildResponse(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred",
                HttpStatus.INTERNAL_SERVER_ERROR, request);
    }

    protected ResponseEntity<ErrorResponse> buildResponse(ErrorCode errorCode, String message,
                                                           HttpStatus status, WebRequest request) {
        ErrorResponse response = ErrorResponse.builder()
                .code(errorCode.getCode())
                .message(message)
                .status(status.value())
                .timestamp(Instant.now().toString())
                .path(getPath(request))
                .build();
        return ResponseEntity.status(status).body(response);
    }

    protected String getPath(WebRequest request) {
        if (request instanceof ServletWebRequest servletRequest) {
            return servletRequest.getRequest().getRequestURI();
        }
        return null;
    }
}

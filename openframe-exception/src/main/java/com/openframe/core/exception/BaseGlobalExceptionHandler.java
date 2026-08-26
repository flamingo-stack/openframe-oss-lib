package com.openframe.core.exception;

import com.openframe.core.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@RestControllerAdvice
public class BaseGlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(BaseGlobalExceptionHandler.class);

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ErrorResponse> handleBaseException(BaseException ex) {
        log.error("{}: {}", ex.getErrorCode().getCode(), ex.getMessage(), ex);

        ErrorResponse response = ErrorResponse.of(ex.getErrorCode(), ex.getMessage());

        if (ex instanceof ValidationException validationEx && !validationEx.getFieldErrors().isEmpty()) {
            response.setFieldErrors(validationEx.getFieldErrors().stream()
                    .map(fe -> ErrorResponse.FieldError.builder()
                            .field(fe.field())
                            .message(fe.message())
                            .build())
                    .toList());
        }

        return ResponseEntity.status(ex.getHttpStatus()).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> ErrorResponse.FieldError.builder()
                        .field(error.getField())
                        .message(error.getDefaultMessage())
                        .build())
                .toList();

        String errorMessage = toMessage(fieldErrors);

        log.warn("Validation error: {}", errorMessage);
        return buildValidationResponse(errorMessage, fieldErrors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleConstraintViolation(ConstraintViolationException ex) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getConstraintViolations().stream()
                .map(violation -> ErrorResponse.FieldError.builder()
                        .field(violation.getPropertyPath().toString())
                        .message(violation.getMessage())
                        .build())
                .toList();

        String errorMessage = toMessage(fieldErrors);

        log.warn("Constraint violation: {}", errorMessage);
        return buildValidationResponse(errorMessage, fieldErrors);
    }

    /**
     * Constraint failures on {@code @RequestParam} / {@code @PathVariable} arguments. Spring 6.1
     * reports these as {@link HandlerMethodValidationException}; without this they fall through to
     * the generic {@link ResponseStatusException} handler and get mislabeled as INTERNAL_ERROR.
     * <p>
     * The message is built from {@link HandlerMethodValidationException#getAllErrors()} rather than
     * from the field errors, because {@code getAllValidationResults()} omits cross-parameter
     * violations — relying on it alone would yield an empty message for a cross-parameter-only
     * failure.
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleHandlerMethodValidation(HandlerMethodValidationException ex) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getAllValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream()
                        .map(error -> ErrorResponse.FieldError.builder()
                                .field(resolveFieldName(result.getMethodParameter()))
                                .message(error.getDefaultMessage())
                                .build()))
                .toList();

        String errorMessage = ex.getAllErrors().stream()
                .map(MessageSourceResolvable::getDefaultMessage)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));

        log.warn("Validation error: {}", errorMessage);
        return buildValidationResponse(errorMessage, fieldErrors);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMissingRequestHeader(MissingRequestHeaderException ex) {
        log.error("Missing required header: ", ex);
        return ErrorResponse.of(ErrorCode.BAD_REQUEST, "Required header '" + ex.getHeaderName() + "' is missing");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMissingServletRequestParameter(MissingServletRequestParameterException ex) {
        log.warn("Missing required parameter: {}", ex.getParameterName());
        return ErrorResponse.of(ErrorCode.BAD_REQUEST, "Required parameter '" + ex.getParameterName() + "' is missing");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleIllegalArgument(IllegalArgumentException ex) {
        log.error("Invalid request: ", ex);
        return ErrorResponse.of(ErrorCode.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleIllegalState(IllegalStateException ex) {
        log.debug("Conflict: {}", ex.getMessage());
        return ErrorResponse.of(ErrorCode.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public ErrorResponse handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        log.error("Method not supported: ", ex);
        return ErrorResponse.of(ErrorCode.METHOD_NOT_ALLOWED, ex.getMessage());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    @ResponseStatus(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    public ErrorResponse handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex) {
        log.error("Media type not supported: ", ex);
        return ErrorResponse.of(ErrorCode.UNSUPPORTED_MEDIA_TYPE, ex.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatusException(ResponseStatusException ex) {
        log.warn("Response status exception: {} - {}", ex.getStatusCode(), ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR, ex.getReason()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleMessageNotReadable(HttpMessageNotReadableException ex) {
        log.warn("Malformed request body: {}", ex.getMostSpecificCause().getMessage());
        return ErrorResponse.of(ErrorCode.BAD_REQUEST, "Malformed request body");
    }

    /**
     * Anything Spring MVC itself classifies (unknown endpoint → {@code NoHandlerFoundException} /
     * {@code NoResourceFoundException}, missing path variable, unsupported media type, …) carries
     * its status as an {@link org.springframework.web.ErrorResponse}; honour it instead of
     * reporting a 500. Everything else is genuinely unexpected.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception ex) {
        if (ex instanceof org.springframework.web.ErrorResponse springError) {
            HttpStatusCode status = springError.getStatusCode();
            ErrorCode code = errorCodeFor(status);
            String message = status.value() == HttpStatus.NOT_FOUND.value()
                    ? "Endpoint not found"
                    : springError.getBody().getDetail();
            log.warn("{} {}: {}", status.value(), code.getCode(), ex.getMessage());
            return ResponseEntity.status(status).body(ErrorResponse.of(code, message));
        }
        log.error("Unexpected error: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred"));
    }

    private static ErrorCode errorCodeFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> ErrorCode.BAD_REQUEST;
            case 401 -> ErrorCode.UNAUTHORIZED;
            case 403 -> ErrorCode.FORBIDDEN;
            case 404 -> ErrorCode.NOT_FOUND;
            case 405 -> ErrorCode.METHOD_NOT_ALLOWED;
            case 409 -> ErrorCode.CONFLICT;
            case 415 -> ErrorCode.UNSUPPORTED_MEDIA_TYPE;
            default -> ErrorCode.INTERNAL_ERROR;
        };
    }

    /**
     * Field name for a method-argument validation error. The reflective parameter name is null when
     * the code was not compiled with {@code -parameters}, so fall back to the positional index.
     */
    private static String resolveFieldName(MethodParameter parameter) {
        String parameterName = parameter.getParameterName();
        return parameterName != null ? parameterName : "arg" + parameter.getParameterIndex();
    }

    private ErrorResponse buildValidationResponse(String message, List<ErrorResponse.FieldError> fieldErrors) {
        ErrorResponse response = ErrorResponse.of(ErrorCode.VALIDATION_ERROR, message);
        response.setFieldErrors(fieldErrors);
        return response;
    }

    private String toMessage(List<ErrorResponse.FieldError> fieldErrors) {
        return fieldErrors.stream()
                .map(fe -> fe.getField() + ": " + fe.getMessage())
                .collect(Collectors.joining(", "));
    }
}

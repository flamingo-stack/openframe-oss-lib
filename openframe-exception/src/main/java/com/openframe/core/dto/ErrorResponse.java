package com.openframe.core.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.core.exception.ErrorCode;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private String code;
    private String message;
    private Integer status;
    private String timestamp;
    private String path;
    private List<FieldError> fieldErrors;

    public ErrorResponse() {}

    public ErrorResponse(String message) {
        this.message = message;
    }

    public ErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public ErrorResponse(String code, String message, Integer status, String timestamp, String path, List<FieldError> fieldErrors) {
        this.code = code;
        this.message = message;
        this.status = status;
        this.timestamp = timestamp;
        this.path = path;
        this.fieldErrors = fieldErrors;
    }

    public static ErrorResponse of(ErrorCode errorCode, String message) {
        return new ErrorResponse(errorCode.getCode(), message, null, Instant.now().toString(), null, null);
    }

    public static ErrorResponseBuilder builder() {
        return new ErrorResponseBuilder();
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public List<FieldError> getFieldErrors() { return fieldErrors; }
    public void setFieldErrors(List<FieldError> fieldErrors) { this.fieldErrors = fieldErrors; }

    public static class ErrorResponseBuilder {
        private String code;
        private String message;
        private Integer status;
        private String timestamp;
        private String path;
        private List<FieldError> fieldErrors;

        public ErrorResponseBuilder code(String code) { this.code = code; return this; }
        public ErrorResponseBuilder message(String message) { this.message = message; return this; }
        public ErrorResponseBuilder status(Integer status) { this.status = status; return this; }
        public ErrorResponseBuilder timestamp(String timestamp) { this.timestamp = timestamp; return this; }
        public ErrorResponseBuilder path(String path) { this.path = path; return this; }
        public ErrorResponseBuilder fieldErrors(List<FieldError> fieldErrors) { this.fieldErrors = fieldErrors; return this; }

        public ErrorResponse build() {
            return new ErrorResponse(code, message, status, timestamp, path, fieldErrors);
        }
    }

    public static class FieldError {
        private String field;
        private String message;

        public FieldError() {}

        public FieldError(String field, String message) {
            this.field = field;
            this.message = message;
        }

        public static FieldErrorBuilder builder() {
            return new FieldErrorBuilder();
        }

        public String getField() { return field; }
        public void setField(String field) { this.field = field; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public static class FieldErrorBuilder {
            private String field;
            private String message;

            public FieldErrorBuilder field(String field) { this.field = field; return this; }
            public FieldErrorBuilder message(String message) { this.message = message; return this; }

            public FieldError build() {
                return new FieldError(field, message);
            }
        }
    }
}

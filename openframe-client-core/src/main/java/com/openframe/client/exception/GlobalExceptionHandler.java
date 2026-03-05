package com.openframe.client.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

@ControllerAdvice
public class GlobalExceptionHandler extends BaseGlobalExceptionHandler {

    @ExceptionHandler(AgentRegistrationSecretValidationErrorException.class)
    public ResponseEntity<ErrorResponse> handleAgentRegistrationSecretValidationErrorException(
            AgentRegistrationSecretValidationErrorException ex, WebRequest request) {
        log.error("Invalid agent initial key: ", ex);
        return buildResponse(ErrorCode.UNAUTHORIZED, "Internal server error",
                HttpStatus.UNAUTHORIZED, request);
    }
}

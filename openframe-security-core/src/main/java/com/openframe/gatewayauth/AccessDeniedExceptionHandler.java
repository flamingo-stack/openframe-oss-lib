package com.openframe.gatewayauth;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.ErrorCode;
import com.openframe.security.authentication.AccessDeniedErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class AccessDeniedExceptionHandler {

    private final ObjectProvider<AccessDeniedObserver> observers;

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        ErrorCode code = AccessDeniedErrorCode.forCurrentCaller();
        log.warn("Access denied ({}): {}", code.getCode(), ex.getMessage());
        observers.forEach(observer -> observer.onAccessDenied(code, ex));
        return ResponseEntity.status(code.getHttpStatus())
                .body(ErrorResponse.of(code, AccessDeniedErrorCode.MESSAGE));
    }
}

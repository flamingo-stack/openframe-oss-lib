package com.openframe.audit;

import com.openframe.core.dto.HasUserErrors;
import com.openframe.core.exception.BaseException;
import com.openframe.data.document.audit.AuditOutcome;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.web.ErrorResponse;

import java.util.Objects;

import static com.openframe.data.document.audit.AuditOutcome.FAILURE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;

@Component
public class AuditOutcomeResolver {

    public ActionOutcome ofResult(Object result) {
        if (result instanceof HasUserErrors payload && !CollectionUtils.isEmpty(payload.userErrorMessages())) {
            AuditOutcome outcome = payload.isPlatformFailure() ? FAILURE : REFUSED;
            return new ActionOutcome(outcome, String.join("; ", payload.userErrorMessages()));
        }
        if (result instanceof ResponseEntity<?> response && response.getStatusCode().isError()) {
            return new ActionOutcome(outcomeOf(response.getStatusCode()), null);
        }
        return new ActionOutcome(SUCCESS, null);
    }

    public ActionOutcome ofFailure(Throwable failure) {
        AuditOutcome outcome = outcomeOf(statusOf(failure));
        String type = failure.getClass().getSimpleName();
        String reason = outcome == REFUSED ? Objects.requireNonNullElse(failure.getMessage(), type) : type;
        return new ActionOutcome(outcome, reason);
    }

    private static AuditOutcome outcomeOf(HttpStatusCode status) {
        return status != null && status.is4xxClientError() ? REFUSED : FAILURE;
    }

    private static HttpStatusCode statusOf(Throwable failure) {
        return switch (failure) {
            case BaseException e -> e.getHttpStatus();
            case ErrorResponse e -> e.getStatusCode();
            case AccessDeniedException _ -> HttpStatus.FORBIDDEN;
            case AuthenticationException _ -> HttpStatus.UNAUTHORIZED;
            case IllegalArgumentException _ -> HttpStatus.BAD_REQUEST;
            case IllegalStateException _ -> HttpStatus.CONFLICT;
            default -> null;
        };
    }
}

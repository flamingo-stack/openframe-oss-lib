package com.openframe.audit;

import com.openframe.core.dto.HasUserErrors;
import com.openframe.core.exception.BaseException;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.graphql.relay.InvalidRelayIdException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.stereotype.Component;
import org.springframework.util.ClassUtils;
import org.springframework.web.ErrorResponse;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.audit.AuditOutcome.FAILURE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;

@Component
@RequiredArgsConstructor
public class AuditOutcomeResolver {

    private static final Set<String> OAUTH_SERVER_FAULTS = Set.of(OAuth2ErrorCodes.SERVER_ERROR,
            OAuth2ErrorCodes.TEMPORARILY_UNAVAILABLE, "invalid_token_response", "invalid_user_info_response");

    private final List<AuditFailureStatus> failureStatuses;
    private final ExceptionHandlerStatuses exceptionHandlerStatuses;

    public ActionOutcome ofResult(Object result) {
        if (result instanceof HasUserErrors payload) {
            List<String> messages = Objects.requireNonNullElse(payload.userErrorMessages(), List.of());
            if (payload.isPlatformFailure() || !messages.isEmpty()) {
                AuditOutcome outcome = payload.isPlatformFailure() ? FAILURE : REFUSED;
                return new ActionOutcome(outcome, messages.isEmpty() ? null : String.join("; ", messages));
            }
        }
        if (result instanceof ResponseEntity<?> response) {
            return new ActionOutcome(AuditOutcome.ofStatus(response.getStatusCode().value()), null);
        }
        return new ActionOutcome(SUCCESS, null);
    }

    public ActionOutcome ofFailure(Throwable failure) {
        Throwable handled = exceptionHandlerStatuses.handledExceptionOf(failure);
        HttpStatusCode status = statusOf(handled);
        AuditOutcome outcome = AuditOutcome.ofStatus(status == null ? null : status.value());
        String type = ClassUtils.getShortName(handled.getClass());
        String reason = outcome == FAILURE ? type : Objects.requireNonNullElse(refusalReasonOf(handled), type);
        return new ActionOutcome(outcome, reason);
    }

    private static String refusalReasonOf(Throwable failure) {
        return switch (failure) {
            case DataAccessException _ -> null;
            case ErrorResponse e -> e.getBody().getDetail();
            case OAuth2AuthenticationException e ->
                    Objects.requireNonNullElse(e.getMessage(), e.getError().getErrorCode());
            default -> failure.getMessage();
        };
    }

    private HttpStatusCode statusOf(Throwable failure) {
        return failureStatuses.stream()
                .map(failureStatus -> failureStatus.statusOf(failure))
                .flatMap(Optional::stream)
                .findFirst()
                .or(() -> Optional.ofNullable(statusOfSecurityException(failure)))
                .or(() -> exceptionHandlerStatuses.statusOf(failure))
                .orElseGet(() -> fallbackStatusOf(failure));
    }

    private static HttpStatusCode statusOfSecurityException(Throwable failure) {
        return switch (failure) {
            case AccessDeniedException _ -> HttpStatus.FORBIDDEN;
            case AuthenticationServiceException _ -> HttpStatus.INTERNAL_SERVER_ERROR;
            case OAuth2AuthenticationException e when OAUTH_SERVER_FAULTS.contains(e.getError().getErrorCode()) ->
                    HttpStatus.INTERNAL_SERVER_ERROR;
            case AuthenticationException _ -> HttpStatus.UNAUTHORIZED;
            default -> null;
        };
    }

    private static HttpStatusCode fallbackStatusOf(Throwable failure) {
        return switch (failure) {
            case BaseException e -> e.getHttpStatus();
            case ErrorResponse e -> e.getStatusCode();
            case IllegalArgumentException _, InvalidRelayIdException _ -> HttpStatus.BAD_REQUEST;
            case IllegalStateException _ -> HttpStatus.CONFLICT;
            default -> null;
        };
    }
}

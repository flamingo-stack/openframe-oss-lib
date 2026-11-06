package com.openframe.audit;

import com.openframe.core.dto.HasUserErrors;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.audit.AuditOutcome;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class AuditOutcomeResolverTest {

    private final AuditOutcomeResolver resolver = new AuditOutcomeResolver(List.of(), exceptionHandlerStatuses());

    @Test
    void plainResultIsSuccess() {
        assertThat(resolver.ofResult("done")).isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, null));
        assertThat(resolver.ofResult(null)).isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, null));
    }

    @Test
    void payloadWithUserErrorsIsRefused() {
        HasUserErrors payload = () -> List.of("Tag not found", "Ticket is archived");

        assertThat(resolver.ofResult(payload))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Tag not found; Ticket is archived"));
    }

    @Test
    void payloadWithoutUserErrorsIsSuccess() {
        HasUserErrors payload = List::of;

        assertThat(resolver.ofResult(payload).outcome()).isEqualTo(AuditOutcome.SUCCESS);
    }

    @Test
    void payloadReportingAPlatformFailureIsFailure() {
        HasUserErrors payload = new HasUserErrors() {
            @Override
            public List<String> userErrorMessages() {
                return List.of("Device unreachable");
            }

            @Override
            public boolean isPlatformFailure() {
                return true;
            }
        };

        assertThat(resolver.ofResult(payload).outcome()).isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void responseStatusDecidesTheOutcome() {
        assertThat(resolver.ofResult(ResponseEntity.ok().build()).outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(resolver.ofResult(ResponseEntity.status(HttpStatus.FOUND).build()).outcome())
                .isEqualTo(AuditOutcome.SUCCESS);
        assertThat(resolver.ofResult(ResponseEntity.notFound().build()).outcome()).isEqualTo(AuditOutcome.REFUSED);
        assertThat(resolver.ofResult(ResponseEntity.internalServerError().build()).outcome())
                .isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void clientErrorExceptionsAreRefusals() {
        assertThat(resolver.ofFailure(new ForbiddenException("Not allowed")))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Not allowed"));
        assertThat(resolver.ofFailure(new NotFoundException("No such ticket")).outcome())
                .isEqualTo(AuditOutcome.REFUSED);
        assertThat(resolver.ofFailure(new ConflictException("Device has active sessions")).outcome())
                .isEqualTo(AuditOutcome.REFUSED);
        assertThat(resolver.ofFailure(new AccessDeniedException("Access Denied")).outcome())
                .isEqualTo(AuditOutcome.REFUSED);
        assertThat(resolver.ofFailure(new BadCredentialsException("Bad credentials")).outcome())
                .isEqualTo(AuditOutcome.REFUSED);
        assertThat(resolver.ofFailure(new ResponseStatusException(HttpStatus.CONFLICT)).outcome())
                .isEqualTo(AuditOutcome.REFUSED);
    }

    @Test
    void otherExceptionsAreFailures() {
        assertThat(resolver.ofFailure(new RuntimeException("Stripe is down")))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));
        assertThat(resolver.ofFailure(new ResponseStatusException(HttpStatus.BAD_GATEWAY)).outcome())
                .isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void jdkExceptionsTheRestAdviceMapsToClientErrorsAreRefusals() {
        assertThat(resolver.ofFailure(new IllegalArgumentException("Blocked domain")))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Blocked domain"));
        assertThat(resolver.ofFailure(new IllegalStateException("User already exists")))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "User already exists"));
    }

    @Test
    void failureWithoutMessageIsNamedByItsType() {
        assertThat(resolver.ofFailure(new NullPointerException()).reason()).isEqualTo("NullPointerException");
    }

    @Test
    void failureTheServiceExceptionHandlerAnswersWithAClientErrorIsRefused() {
        assertThat(resolver.ofFailure(new RegistrationBlockedException("This domain is already in use")))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "This domain is already in use"));
    }

    @Test
    void failureThatDeclaresItsOwnClientErrorStatusIsRefused() {
        assertThat(resolver.ofFailure(new GoneException("Link expired")))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Link expired"));
    }

    @Test
    void failureTheServiceExceptionHandlerAnswersWithAServerErrorIsFailure() {
        assertThat(resolver.ofFailure(new UpstreamException("Stripe is down")))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "UpstreamException"));
    }

    @Test
    void serviceFailureStatusWinsOverTheExceptionHandler() {
        AuditFailureStatus platformFailure = failure -> failure instanceof RegistrationBlockedException
                ? Optional.of(HttpStatusCode.valueOf(500)) : Optional.empty();
        AuditOutcomeResolver withServiceStatus = new AuditOutcomeResolver(List.of(platformFailure),
                exceptionHandlerStatuses());

        assertThat(withServiceStatus.ofFailure(new RegistrationBlockedException("Closed")).outcome())
                .isEqualTo(AuditOutcome.FAILURE);
    }

    private static ExceptionHandlerStatuses exceptionHandlerStatuses() {
        StaticApplicationContext context = new StaticApplicationContext();
        context.registerSingleton("serviceExceptionHandler", ServiceExceptionHandler.class);
        context.refresh();
        ExceptionHandlerStatuses statuses = new ExceptionHandlerStatuses(context);
        statuses.afterSingletonsInstantiated();
        return statuses;
    }

    @RestControllerAdvice
    static class ServiceExceptionHandler {

        @ExceptionHandler(RegistrationBlockedException.class)
        @ResponseStatus(HttpStatus.CONFLICT)
        public String blocked(RegistrationBlockedException e) {
            return e.getMessage();
        }

        @ExceptionHandler(UpstreamException.class)
        @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
        public String upstream(UpstreamException e) {
            return e.getMessage();
        }
    }

    static class RegistrationBlockedException extends RuntimeException {
        RegistrationBlockedException(String message) {
            super(message);
        }
    }

    static class UpstreamException extends RuntimeException {
        UpstreamException(String message) {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.GONE)
    static class GoneException extends RuntimeException {
        GoneException(String message) {
            super(message);
        }
    }
}

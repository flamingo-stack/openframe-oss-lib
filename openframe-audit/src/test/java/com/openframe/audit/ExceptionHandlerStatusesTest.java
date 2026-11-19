package com.openframe.audit;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.concurrent.CompletionException;

import static org.assertj.core.api.Assertions.assertThat;

class ExceptionHandlerStatusesTest {

    @Test
    void statusOf_noAdviceHandlesTheFailure_returnsFailureClassStatus() {
        ExceptionHandlerStatuses statuses = statusesWith(ServiceExceptionHandler.class);

        assertThat(statuses.statusOf(new LinkExpiredException("Link expired"))).contains(HttpStatus.GONE);
    }

    @Test
    void statusOf_adviceHandlerDeclaresStatus_returnsThatStatus() {
        ExceptionHandlerStatuses statuses = statusesWith(ServiceExceptionHandler.class);

        assertThat(statuses.statusOf(new RegistrationBlockedException("This domain is already in use")))
                .contains(HttpStatus.CONFLICT);
    }

    @Test
    void statusOf_noAdviceHandlerMatches_returnsEmpty() {
        ExceptionHandlerStatuses statuses = statusesWith(ServiceExceptionHandler.class);

        assertThat(statuses.statusOf(new RuntimeException("Stripe is down"))).isEmpty();
    }

    @Test
    void statusOf_matchingHandlerDeclaresNoStatus_ignoresFailureClassStatus() {
        ExceptionHandlerStatuses statuses = statusesWith(CatchAllExceptionHandler.class);

        assertThat(statuses.statusOf(new LinkExpiredException("Link expired"))).isEmpty();
    }

    @Test
    void statusOf_earlierAdviceHandlerDeclaresNoStatus_ignoresLaterAdviceStatus() {
        ExceptionHandlerStatuses statuses = statusesWith(ServiceExceptionHandler.class, CatchAllExceptionHandler.class);

        assertThat(statuses.statusOf(new RegistrationBlockedException("This domain is already in use"))).isEmpty();
    }

    @Test
    void handledExceptionOf_noAdviceHandlesTheFailureOrItsCauses_returnsTheFailure() {
        ExceptionHandlerStatuses statuses = statusesWith(ServiceExceptionHandler.class);
        RuntimeException failure = new RuntimeException(new IllegalArgumentException("Bad id"));

        assertThat(statuses.handledExceptionOf(failure)).isSameAs(failure);
    }

    @Test
    void handledExceptionOf_adviceHandlesOnlyACause_returnsThatCause() {
        ExceptionHandlerStatuses statuses = statusesWith(ServiceExceptionHandler.class);
        RegistrationBlockedException cause = new RegistrationBlockedException("This domain is already in use");

        assertThat(statuses.handledExceptionOf(new CompletionException(cause))).isSameAs(cause);
    }

    @Test
    void handledExceptionOf_adviceHandlesTheFailureItself_returnsTheFailureNotItsCause() {
        ExceptionHandlerStatuses statuses = statusesWith(CatchAllExceptionHandler.class);
        CompletionException failure = new CompletionException(new RegistrationBlockedException("In use"));

        assertThat(statuses.handledExceptionOf(failure)).isSameAs(failure);
    }

    @Test
    void handledExceptionOf_earlierAdviceHandlesACauseAndALaterOneTheFailure_returnsTheCause() {
        ExceptionHandlerStatuses statuses = statusesWith(LastCatchAllExceptionHandler.class, DeniedExceptionHandler.class);
        AccessDeniedException cause = new AccessDeniedException("Access Denied");

        assertThat(statuses.handledExceptionOf(new CompletionException(cause))).isSameAs(cause);
    }

    private static ExceptionHandlerStatuses statusesWith(Class<?>... adviceTypes) {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(adviceTypes);
            context.register(ExceptionHandlerStatuses.class);
            context.refresh();
            return context.getBean(ExceptionHandlerStatuses.class);
        }
    }

    @RestControllerAdvice
    static class ServiceExceptionHandler {

        @ExceptionHandler(RegistrationBlockedException.class)
        @ResponseStatus(HttpStatus.CONFLICT)
        String blocked(RegistrationBlockedException e) {
            return e.getMessage();
        }
    }

    @RestControllerAdvice
    @Order(Ordered.HIGHEST_PRECEDENCE)
    static class CatchAllExceptionHandler {

        @ExceptionHandler(Exception.class)
        ResponseEntity<String> unexpected(Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @RestControllerAdvice
    @Order(Ordered.HIGHEST_PRECEDENCE)
    static class DeniedExceptionHandler {

        @ExceptionHandler(AccessDeniedException.class)
        ResponseEntity<String> denied(AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    @RestControllerAdvice
    static class LastCatchAllExceptionHandler {

        @ExceptionHandler(Exception.class)
        ResponseEntity<String> unexpected(Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    static class RegistrationBlockedException extends RuntimeException {
        RegistrationBlockedException(String message) {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.GONE)
    static class LinkExpiredException extends RuntimeException {
        LinkExpiredException(String message) {
            super(message);
        }
    }
}

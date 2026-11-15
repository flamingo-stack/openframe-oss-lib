package com.openframe.audit;

import com.openframe.core.dto.HasUserErrors;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.audit.AuditOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditOutcomeResolverTest {

    private static final String REFUSAL = "Not allowed";

    @Mock
    private ExceptionHandlerStatuses exceptionHandlerStatuses;
    @Mock
    private AuditFailureStatus failureStatus;

    private AuditOutcomeResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new AuditOutcomeResolver(List.of(), exceptionHandlerStatuses);
    }

    @Test
    void ofResult_plainResult_isSuccess() {
        assertThat(resolver.ofResult("done")).isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, null));
    }

    @Test
    void ofResult_payloadWithUserErrors_isRefusedWithTheMessages() {
        HasUserErrors payload = () -> List.of("Tag not found", "Ticket is archived");

        assertThat(resolver.ofResult(payload))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Tag not found; Ticket is archived"));
    }

    @Test
    void ofResult_payloadWithoutUserErrors_isSuccess() {
        HasUserErrors payload = List::of;

        assertThat(resolver.ofResult(payload).outcome()).isEqualTo(AuditOutcome.SUCCESS);
    }

    @Test
    void ofResult_payloadReportingAPlatformFailure_isFailure() {
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
    void ofResult_responseWithRedirectStatus_isSuccess() {
        assertThat(resolver.ofResult(ResponseEntity.status(HttpStatus.FOUND).build()))
                .isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, null));
    }

    @Test
    void ofResult_responseWithErrorStatus_takesTheOutcomeOfThatStatus() {
        assertThat(resolver.ofResult(ResponseEntity.notFound().build()))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, null));
    }

    @Test
    void ofFailure_springExceptionCarryingAClientErrorStatus_isRefused() {
        assertThat(resolver.ofFailure(new ResponseStatusException(HttpStatus.CONFLICT)).outcome())
                .isEqualTo(AuditOutcome.REFUSED);
    }

    @ParameterizedTest
    @MethodSource("exceptionsTheServicesAnswerWithAClientError")
    void ofFailure_exceptionTheServicesAnswerWithAClientError_isRefusedWithItsMessage(RuntimeException failure) {
        assertThat(resolver.ofFailure(failure)).isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, REFUSAL));
    }

    @Test
    void ofFailure_refusalWithoutMessage_isNamedByItsType() {
        assertThat(resolver.ofFailure(new IllegalStateException()))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "IllegalStateException"));
    }

    @Test
    void ofFailure_exceptionCarryingAServerErrorStatus_isFailureNamedByItsType() {
        assertThat(resolver.ofFailure(new InternalException("Mongo timed out")))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "InternalException"));
    }

    @Test
    void ofFailure_statusUnknown_isFailureNamedByItsType() {
        RuntimeException failure = new RuntimeException("Stripe is down");
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.empty());

        assertThat(resolver.ofFailure(failure)).isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));
    }

    @Test
    void ofFailure_exceptionHandlerAnswersAClientError_isRefusedWithItsMessage() {
        RuntimeException failure = new RuntimeException("This domain is already in use");
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.of(HttpStatus.CONFLICT));

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "This domain is already in use"));
    }

    @Test
    void ofFailure_serviceFailureStatusAnswers_winsOverTheExceptionHandler() {
        RuntimeException failure = new RuntimeException("Directory sync pending");
        when(failureStatus.statusOf(failure)).thenReturn(Optional.of(HttpStatus.ACCEPTED));

        assertThat(new AuditOutcomeResolver(List.of(failureStatus), exceptionHandlerStatuses).ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, "Directory sync pending"));
        verifyNoInteractions(exceptionHandlerStatuses);
    }

    @Test
    void ofFailure_serviceFailureStatusDoesNotKnowTheFailure_asksTheExceptionHandler() {
        RuntimeException failure = new RuntimeException("This domain is already in use");
        when(failureStatus.statusOf(failure)).thenReturn(Optional.empty());
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.of(HttpStatus.CONFLICT));

        assertThat(new AuditOutcomeResolver(List.of(failureStatus), exceptionHandlerStatuses).ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "This domain is already in use"));
    }

    private static Stream<RuntimeException> exceptionsTheServicesAnswerWithAClientError() {
        return Stream.of(new ForbiddenException(REFUSAL), new AccessDeniedException(REFUSAL),
                new BadCredentialsException(REFUSAL), new IllegalArgumentException(REFUSAL),
                new IllegalStateException(REFUSAL));
    }
}

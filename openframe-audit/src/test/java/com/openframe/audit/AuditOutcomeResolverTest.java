package com.openframe.audit;

import com.openframe.core.dto.HasUserErrors;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.graphql.relay.InvalidRelayIdException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletionException;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

        assertThat(resolver.ofResult(payload))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "Device unreachable"));
    }

    @Test
    void ofResult_payloadAnsweringNoUserErrorList_isSuccess() {
        HasUserErrors payload = () -> null;

        assertThat(resolver.ofResult(payload)).isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, null));
    }

    @Test
    void ofResult_payloadReportingAPlatformFailureWithoutMessages_isFailureWithoutAReason() {
        HasUserErrors payload = new HasUserErrors() {
            @Override
            public List<String> userErrorMessages() {
                return List.of();
            }

            @Override
            public boolean isPlatformFailure() {
                return true;
            }
        };

        assertThat(resolver.ofResult(payload)).isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, null));
    }

    @Test
    void ofResult_responseWithErrorStatus_takesTheOutcomeOfThatStatus() {
        assertThat(resolver.ofResult(ResponseEntity.notFound().build()))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, null));
    }

    @Test
    void ofFailure_springStatusExceptionWithoutAReason_isRefusedNamedByItsType() {
        ResponseStatusException failure = new ResponseStatusException(HttpStatus.CONFLICT);
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "ResponseStatusException"));
    }

    @Test
    void ofFailure_handlerAnswersAServerErrorForAnExceptionWithItsOwnStatus_isFailureNamedByItsType() {
        ResponseStatusException failure = new ResponseStatusException(HttpStatus.CONFLICT, REFUSAL);
        handledAsThrown(failure);
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.of(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "ResponseStatusException"));
    }

    @ParameterizedTest
    @MethodSource("exceptionsOfTheSecurityLayer")
    void ofFailure_securityException_isJudgedByItsTypeWithoutAskingTheHandlers(RuntimeException failure) {
        handledAsThrown(failure);

        assertThat(resolver.ofFailure(failure)).isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, REFUSAL));
        verify(exceptionHandlerStatuses, never()).statusOf(any());
    }

    @Test
    void ofFailure_serviceFailureStatusAnswersForASecurityException_winsOverItsType() {
        AccessDeniedException denied = new AccessDeniedException(REFUSAL);
        handledAsThrown(denied);
        when(failureStatus.statusOf(denied)).thenReturn(Optional.of(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThat(new AuditOutcomeResolver(List.of(failureStatus), exceptionHandlerStatuses).ofFailure(denied))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "AccessDeniedException"));
    }

    @Test
    void ofFailure_springStatusExceptionWithAReason_isRefusedWithThatReasonAlone() {
        ResponseStatusException failure =
                new ResponseStatusException(HttpStatus.CONFLICT, "Ticket is already closed");
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Ticket is already closed"));
    }

    @Test
    void ofFailure_nestedExceptionClass_isNamedWithItsOuterClass() {
        HttpClientErrorException failure =
                HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", HttpHeaders.EMPTY, new byte[0], null);
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "HttpClientErrorException.NotFound"));
    }

    @Test
    void ofFailure_invalidRelayId_isRefusedWithItsMessage() {
        InvalidRelayIdException failure = new InvalidRelayIdException("Not a ticket id: abc");
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Not a ticket id: abc"));
    }

    @Test
    void ofFailure_oauthErrorWithoutADescription_isRefusedWithItsErrorCode() {
        OAuth2AuthenticationException failure = new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_GRANT);
        handledAsThrown(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "invalid_grant"));
    }

    @Test
    void ofFailure_dataStoreExceptionAnsweredWithAClientError_isRefusedNamedByItsType() {
        OptimisticLockingFailureException failure =
                new OptimisticLockingFailureException("Cannot save entity 665f with version 3 to collection tickets");
        handledAsThrown(failure);
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.of(HttpStatus.CONFLICT));

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "OptimisticLockingFailureException"));
    }

    @Test
    void ofFailure_tokenGrantRefusedForItsRequest_isRefusedWithTheErrorDescription() {
        OAuth2AuthenticationException failure = new OAuth2AuthenticationException(
                new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT, "Unknown or expired signup ticket.", null));
        handledAsThrown(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "Unknown or expired signup ticket."));
    }

    @ParameterizedTest
    @ValueSource(strings = {OAuth2ErrorCodes.SERVER_ERROR, OAuth2ErrorCodes.TEMPORARILY_UNAVAILABLE,
            "invalid_token_response", "invalid_user_info_response"})
    void ofFailure_oauthErrorOfAServerThatDidNotAnswer_isFailureNamedByItsType(String errorCode) {
        OAuth2AuthenticationException failure = new OAuth2AuthenticationException(
                new OAuth2Error(errorCode, "Failed to generate access token.", null));
        handledAsThrown(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "OAuth2AuthenticationException"));
    }

    @ParameterizedTest
    @MethodSource("exceptionsWithAClientErrorStatusOfTheirOwn")
    void ofFailure_noHandlerAnswersAnExceptionWithAClientErrorStatusOfItsOwn_isRefusedWithItsMessage(
            RuntimeException failure) {
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure)).isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, REFUSAL));
    }

    @Test
    void ofFailure_errorHandlerTakesACauseOfTheFailure_isJudgedByThatCause() {
        AccessDeniedException denied = new AccessDeniedException(REFUSAL);
        CompletionException failure = new CompletionException(denied);
        when(exceptionHandlerStatuses.handledExceptionOf(failure)).thenReturn(denied);

        assertThat(resolver.ofFailure(failure)).isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, REFUSAL));
    }

    @Test
    void ofFailure_signInThatCouldNotBeChecked_isFailureNamedByItsType() {
        InternalAuthenticationServiceException failure = new InternalAuthenticationServiceException("Mongo timed out");
        handledAsThrown(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "InternalAuthenticationServiceException"));
    }

    @Test
    void ofFailure_refusalWithoutMessage_isNamedByItsType() {
        IllegalStateException failure = new IllegalStateException();
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "IllegalStateException"));
    }

    @Test
    void ofFailure_exceptionCarryingAServerErrorStatus_isFailureNamedByItsType() {
        InternalException failure = new InternalException("Mongo timed out");
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "InternalException"));
    }

    @Test
    void ofFailure_statusUnknown_isFailureNamedByItsType() {
        RuntimeException failure = new RuntimeException("Stripe is down");
        noHandlerAnswers(failure);

        assertThat(resolver.ofFailure(failure)).isEqualTo(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));
    }

    @Test
    void ofFailure_exceptionHandlerAnswersAClientError_isRefusedWithItsMessage() {
        RuntimeException failure = new RuntimeException("This domain is already in use");
        handledAsThrown(failure);
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.of(HttpStatus.CONFLICT));

        assertThat(resolver.ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "This domain is already in use"));
    }

    @Test
    void ofFailure_serviceFailureStatusAnswers_winsOverTheExceptionHandler() {
        RuntimeException failure = new RuntimeException("Directory sync pending");
        handledAsThrown(failure);
        when(failureStatus.statusOf(failure)).thenReturn(Optional.of(HttpStatus.ACCEPTED));

        assertThat(new AuditOutcomeResolver(List.of(failureStatus), exceptionHandlerStatuses).ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.SUCCESS, "Directory sync pending"));
        verify(exceptionHandlerStatuses, never()).statusOf(any());
    }

    @Test
    void ofFailure_serviceFailureStatusDoesNotKnowTheFailure_asksTheExceptionHandler() {
        RuntimeException failure = new RuntimeException("This domain is already in use");
        handledAsThrown(failure);
        when(failureStatus.statusOf(failure)).thenReturn(Optional.empty());
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.of(HttpStatus.CONFLICT));

        assertThat(new AuditOutcomeResolver(List.of(failureStatus), exceptionHandlerStatuses).ofFailure(failure))
                .isEqualTo(new ActionOutcome(AuditOutcome.REFUSED, "This domain is already in use"));
    }

    private static Stream<RuntimeException> exceptionsOfTheSecurityLayer() {
        return Stream.of(new AccessDeniedException(REFUSAL), new BadCredentialsException(REFUSAL));
    }

    private static Stream<RuntimeException> exceptionsWithAClientErrorStatusOfTheirOwn() {
        return Stream.of(new ForbiddenException(REFUSAL), new IllegalArgumentException(REFUSAL),
                new IllegalStateException(REFUSAL));
    }

    private void handledAsThrown(RuntimeException failure) {
        when(exceptionHandlerStatuses.handledExceptionOf(failure)).thenReturn(failure);
    }

    private void noHandlerAnswers(RuntimeException failure) {
        handledAsThrown(failure);
        when(exceptionHandlerStatuses.statusOf(failure)).thenReturn(Optional.empty());
    }
}

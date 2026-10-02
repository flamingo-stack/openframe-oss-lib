package com.openframe.api.exception;

import com.openframe.api.datafetcher.LogDataFetcher;
import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.dto.device.DeviceLogFilterInput;
import com.openframe.api.mapper.GraphQLLogMapper;
import com.openframe.api.service.LogService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.client.LokiQueryRejectedException;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import com.openframe.data.service.TenantIdProvider;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.InstanceOfAssertFactories.MAP;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

@ExtendWith(OutputCaptureExtension.class)
class GraphQLExceptionHandlerTest {

    private static final String UNEXPECTED = "An unexpected error occurred. Please try again later.";

    private final GraphQLExceptionHandler handler = new GraphQLExceptionHandler();

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void handleException_signedInCallerRefused_reportsForbiddenWithAFixedMessage() {
        signIn();

        List<GraphQLError> errors = handle(refused());

        assertThat(errors)
                .singleElement()
                .returns("Access denied", GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsOnlyKeys("code", "httpStatus", "timestamp")
                .containsEntry("code", "FORBIDDEN")
                .containsEntry("httpStatus", 403);
    }

    @Test
    void handleException_anonymousCallerRefused_reportsUnauthorizedWithAFixedMessage() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken("key", "anonymousUser",
                AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));

        List<GraphQLError> errors = handle(refused());

        assertThat(errors)
                .singleElement()
                .returns("Access denied", GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsEntry("code", "UNAUTHORIZED")
                .containsEntry("httpStatus", 401);
    }

    @Test
    void handleException_signedInCallerRefused_logsTheReasonAsAWarningOnly(CapturedOutput output) {
        signIn();

        handle(refused());

        assertThat(output.getOut())
                .containsPattern("WARN .*GraphQL access denied \\(FORBIDDEN\\): Denied by hasAuthority\\('ADMIN'\\)")
                .doesNotContain("GraphQL error occurred")
                .doesNotContain("AuthorizationDeniedException");
    }

    @Test
    void handleException_internalFailure_logsItAsAnErrorWithItsStackTrace(CapturedOutput output) {
        handle(new RuntimeException("boom"));

        assertThat(output.getOut())
                .containsPattern("ERROR .*GraphQL error occurred")
                .contains("java.lang.RuntimeException: boom");
    }

    @Test
    void handleException_constraintViolation_reportsValidationErrorWithTheViolationMessage() {
        DeviceLogFilterInput tooManyTerms = DeviceLogFilterInput.builder()
                .contains(List.of("a", "b", "c", "d", "e", "f"))
                .build();

        List<GraphQLError> errors = handle(violationsOf(tooManyTerms));

        assertThat(errors)
                .singleElement()
                .returns("contains: cannot hold more than 5 terms", GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsEntry("code", "VALIDATION_ERROR")
                .containsEntry("httpStatus", 400);
    }

    @Test
    void handleException_severalConstraintViolations_joinsThemSortedByField() {
        DeviceLogFilterInput tooManyTerms = DeviceLogFilterInput.builder()
                .excludes(List.of("a", "b", "c", "d", "e", "f"))
                .contains(List.of("a", "b", "c", "d", "e", "f"))
                .build();

        List<GraphQLError> errors = handle(violationsOf(tooManyTerms));

        assertThat(errors)
                .extracting(GraphQLError::getMessage)
                .containsExactly("contains: cannot hold more than 5 terms; excludes: cannot hold more than 5 terms");
    }

    @Test
    void handleException_savedLogDetailsUnreadable_reportsLokiQueryErrorAndLogsTheCause(CapturedOutput output) {
        LokiClient lokiClient = mock(LokiClient.class);
        when(lokiClient.queryRange(
                "{job=\"tool-events\", tenant_id=\"tenant-a\", tool_type=\"FLEET\"}"
                        + " | tool_event_id=\"evt-1\" | event_type=\"LOGIN\"",
                1_790_848_800_123_000_000L, 1_790_848_800_124_000_000L, 1, LokiDirection.BACKWARD, "tenant-a"))
                .thenReturn(List.of(new LokiLogEntry(1_790_848_800_123_000_000L, "not json", Map.of())));

        List<GraphQLError> errors = handle(catchThrowable(() -> openLogDetails(lokiClient)));

        assertThat(errors)
                .singleElement()
                .returns("Logs are temporarily unavailable. Please try again later.", GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsEntry("code", "LOKI_QUERY_ERROR")
                .containsEntry("httpStatus", 503);
        assertThat(output.getOut())
                .containsPattern("ERROR .*GraphQL error occurred")
                .contains("LokiQueryException: Tool event log line in Loki is not readable")
                .contains("Caused by: com.fasterxml.jackson.core.JsonParseException");
    }

    @ParameterizedTest
    @CsvSource({"429, too many outstanding requests", "404, no route to the log store"})
    void handleException_logDetailsLookupTurnedAway_reportsLokiQueryErrorAndLogsTheAnswer(
            int status, String answer, CapturedOutput output) {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://loki.test");
        MockRestServiceServer loki = MockRestServiceServer.bindTo(builder).build();
        loki.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andRespond(withStatus(HttpStatusCode.valueOf(status)).body(answer));
        LokiClient lokiClient = new LokiClient(builder.build());

        List<GraphQLError> errors = handle(catchThrowable(() -> openLogDetails(lokiClient)));

        assertThat(errors)
                .singleElement()
                .returns("Logs are temporarily unavailable. Please try again later.", GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsEntry("code", "LOKI_QUERY_ERROR")
                .containsEntry("httpStatus", 503);
        assertThat(output.getOut())
                .containsPattern("ERROR .*GraphQL error occurred")
                .contains("LokiQueryException: Loki query failed with HTTP " + status + ": " + answer)
                .contains("Caused by: com.openframe.data.loki.client.LokiQueryRejectedException");
    }

    @ParameterizedTest
    @MethodSource("failuresReportedWithTheirOwnMessage")
    void handleException_expectedFailure_reportsItsMessageAndCode(Throwable exception, String code, int httpStatus) {
        List<GraphQLError> errors = handle(exception);

        assertThat(errors)
                .singleElement()
                .returns(exception.getMessage(), GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsEntry("code", code)
                .containsEntry("httpStatus", httpStatus);
    }

    @ParameterizedTest
    @MethodSource("failuresReportedWithAGenericMessage")
    void handleException_internalFailure_hidesItsMessage(Throwable exception, String message, String code,
                                                          int httpStatus) {
        List<GraphQLError> errors = handle(exception);

        assertThat(errors)
                .singleElement()
                .returns(message, GraphQLError::getMessage)
                .extracting(GraphQLError::getExtensions, as(MAP))
                .containsEntry("code", code)
                .containsEntry("httpStatus", httpStatus);
    }

    private static Stream<Arguments> failuresReportedWithTheirOwnMessage() {
        return Stream.of(
                arguments(new NotFoundException(ErrorCode.DEVICE_NOT_FOUND, "Device not found: d-1"),
                        "DEVICE_NOT_FOUND", 404),
                arguments(new ConflictException(ErrorCode.TAG_ALREADY_EXISTS, "Tag already exists: prod"),
                        "TAG_ALREADY_EXISTS", 409),
                arguments(new BadRequestException("Unsupported image type"), "BAD_REQUEST", 400),
                arguments(new IllegalArgumentException("page size too large"), "VALIDATION_ERROR", 400),
                arguments(new IllegalStateException("range too wide"), "VALIDATION_ERROR", 400));
    }

    private static Stream<Arguments> failuresReportedWithAGenericMessage() {
        return Stream.of(
                arguments(new PinotQueryException("broker down"),
                        "Query failed. Please try again later.", "PINOT_QUERY_ERROR", 503),
                arguments(new LokiQueryRejectedException("max bytes exceeded", new IllegalStateException("400")),
                        "This log search covers too much data. Narrow the time range, or filter by device or level.",
                        "LOKI_QUERY_REJECTED", 400),
                arguments(new LokiQueryException("loki down"),
                        "Logs are temporarily unavailable. Please try again later.", "LOKI_QUERY_ERROR", 503),
                arguments(new DataAccessResourceFailureException("mongo down"),
                        "Database operation failed. Please try again later.", "DATABASE_ERROR", 503),
                arguments(new RuntimeException("boom"), UNEXPECTED, "INTERNAL_ERROR", 500),
                arguments(new IOException("disk full"), UNEXPECTED, "INTERNAL_ERROR", 500));
    }

    private static LogDetails openLogDetails(LokiClient lokiClient) {
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-a");
        LogDataFetcher fetcher = new LogDataFetcher(new LogService(mock(PinotLogRepository.class),
                new ToolEventLogRepository(lokiClient), tenantIdProvider), new GraphQLLogMapper());
        return fetcher.logDetails("2026-10-01", "FLEET", "LOGIN", Instant.parse("2026-10-01T10:00:00.123Z"), "evt-1");
    }

    private static AuthorizationDeniedException refused() {
        return new AuthorizationDeniedException("Denied by hasAuthority('ADMIN')", new AuthorizationDecision(false));
    }

    private static void signIn() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", "user-1")
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("AGENT")));
    }

    private List<GraphQLError> handle(Throwable exception) {
        DataFetcherExceptionHandlerParameters parameters = DataFetcherExceptionHandlerParameters
                .newExceptionParameters()
                .exception(exception)
                .build();
        return handler.handleException(parameters).join().getErrors();
    }

    private static ConstraintViolationException violationsOf(DeviceLogFilterInput input) {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            return new ConstraintViolationException(validator.validate(input));
        }
    }
}

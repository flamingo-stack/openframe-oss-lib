package com.openframe.security.oauth.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.exception.InvalidRefreshTokenException;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class OAuthBffServiceRefreshTest {

    @Mock
    private ForwardedHeadersContributor headersContributor;

    private final ServerHttpRequest request = MockServerHttpRequest.post("/oauth/refresh").build();

    private final ListAppender<ILoggingEvent> logAppender = new ListAppender<>();
    private final Logger serviceLogger = (Logger) LoggerFactory.getLogger(OAuthBffService.class);

    @BeforeEach
    void attachAppender() {
        logAppender.start();
        serviceLogger.addAppender(logAppender);
    }

    @AfterEach
    void detachAppender() {
        serviceLogger.detachAppender(logAppender);
    }

    private void assertNothingLoggedContains(String fragment) {
        assertThat(logAppender.list)
                .noneMatch(event -> event.getFormattedMessage().contains(fragment));
    }

    private OAuthBffService serviceRespondingWith(HttpStatus status, String body) {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(req -> Mono.just(
                ClientResponse.create(status)
                        .header("Content-Type", "application/json")
                        .body(body)
                        .build()));
        OAuthBffService service = new OAuthBffService(builder, null, headersContributor, null, null);
        ReflectionTestUtils.setField(service, "authServerUrl", "http://auth-server");
        ReflectionTestUtils.setField(service, "clientId", "client");
        ReflectionTestUtils.setField(service, "clientSecret", "secret");
        lenient().doNothing().when(headersContributor).contribute(any(), any());
        return service;
    }

    @Test
    void shouldFailWithInvalidRefreshTokenExceptionWhenAuthServerReturns400() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.BAD_REQUEST, "{\"error\":\"invalid_grant\"}");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "dead-token", request))
                .expectError(InvalidRefreshTokenException.class)
                .verify();
        assertNothingLoggedContains("{\"error\"");
    }

    @Test
    void shouldTreatInvalidClientAsServerFaultWithoutClearingSession() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.UNAUTHORIZED, "{\"error\":\"invalid_client\"}");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .expectErrorSatisfies(e -> {
                    assertThat(e).isInstanceOf(IllegalStateException.class);
                    assertThat(e).isNotInstanceOf(InvalidRefreshTokenException.class);
                    assertThat(e.getMessage()).isEqualTo("token_refresh_failed");
                })
                .verify();
    }

    @Test
    void shouldTreatUnparseable4xxBodyAsServerFault() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.BAD_REQUEST, "not-json");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .expectErrorSatisfies(e -> {
                    assertThat(e).isInstanceOf(IllegalStateException.class);
                    assertThat(e).isNotInstanceOf(InvalidRefreshTokenException.class);
                    assertThat(e.getMessage()).isEqualTo("token_refresh_failed");
                })
                .verify();
        assertNothingLoggedContains("not-json");
    }

    @Test
    void shouldNotLeakUpstreamBodyWhenAuthServerReturns500() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.INTERNAL_SERVER_ERROR, "{\"secret\":\"internal detail\"}");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .expectErrorSatisfies(e -> {
                    assertThat(e).isInstanceOf(IllegalStateException.class);
                    assertThat(e).isNotInstanceOf(InvalidRefreshTokenException.class);
                    assertThat(e.getMessage()).isEqualTo("token_refresh_failed");
                })
                .verify();
        assertNothingLoggedContains("internal detail");
    }

    @Test
    void shouldReturnTokensWhenAuthServerReturns200() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.OK,
                "{\"access_token\":\"at\",\"refresh_token\":\"rt\",\"token_type\":\"Bearer\",\"expires_in\":300,\"scope\":\"openid\"}");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .assertNext(tokens -> {
                    assertThat(tokens.access_token()).isEqualTo("at");
                    assertThat(tokens.refresh_token()).isEqualTo("rt");
                })
                .verifyComplete();
    }
}

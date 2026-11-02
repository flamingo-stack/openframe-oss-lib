package com.openframe.security.oauth.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.exception.InvalidRefreshTokenException;
import com.openframe.security.oauth.exception.RefreshUpstreamException;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import io.netty.handler.timeout.ReadTimeoutException;
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
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.net.ConnectException;

import static com.openframe.security.oauth.exception.RefreshUpstreamReason.CLIENT_REJECTED;
import static com.openframe.security.oauth.exception.RefreshUpstreamReason.UPSTREAM_ERROR;
import static com.openframe.security.oauth.exception.RefreshUpstreamReason.UPSTREAM_UNAVAILABLE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
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
        return serviceWith(builder);
    }

    private OAuthBffService serviceFailingWith(Throwable transportFailure) {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(req -> Mono.error(
                new WebClientRequestException(transportFailure, req.method(), req.url(), req.headers())));
        return serviceWith(builder);
    }

    private OAuthBffService serviceWith(WebClient.Builder builder) {
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
    void refreshTokens_invalidClient_upstreamExceptionWithClientRejected() {
        // setup
        OAuthBffService service = serviceRespondingWith(HttpStatus.UNAUTHORIZED, "{\"error\":\"invalid_client\"}");

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectErrorSatisfies(e -> assertThat(e)
                        .isInstanceOf(RefreshUpstreamException.class)
                        .extracting(RefreshUpstreamException.class::cast)
                        .extracting(RefreshUpstreamException::getReason, RefreshUpstreamException::getHttpStatus)
                        .containsExactly(CLIENT_REJECTED, HttpStatus.BAD_GATEWAY))
                .verify();
        assertThat(logAppender.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage)
                .containsExactly(tuple(Level.ERROR,
                        "Auth server rejected the gateway client credentials on refresh for tenant tenant-1 (401 UNAUTHORIZED): error=invalid_client"));
    }

    @Test
    void refreshTokens_unparseable4xxBody_invalidRefreshTokenExceptionWithoutLeakingBody() {
        // setup
        OAuthBffService service = serviceRespondingWith(HttpStatus.BAD_REQUEST, "not-json");

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectError(InvalidRefreshTokenException.class)
                .verify();
        assertNothingLoggedContains("not-json");
    }

    @Test
    void refreshTokens_bare401_warnsWithStatusAndNoErrorCode() {
        // setup
        OAuthBffService service = serviceRespondingWith(HttpStatus.UNAUTHORIZED, "");

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "stale-token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectError(InvalidRefreshTokenException.class)
                .verify();
        assertThat(logAppender.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage)
                .containsExactly(tuple(Level.WARN,
                        "Auth server refused refresh for tenant tenant-1 (401 UNAUTHORIZED): error=none"));
    }

    @Test
    void refreshTokens_unauthorizedClientCode_invalidRefreshTokenException() {
        // setup
        OAuthBffService service = serviceRespondingWith(HttpStatus.BAD_REQUEST, "{\"error\":\"unauthorized_client\"}");

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectError(InvalidRefreshTokenException.class)
                .verify();
    }

    @Test
    void refreshTokens_authServer500_upstreamExceptionWithoutLeakingBody() {
        // setup
        OAuthBffService service = serviceRespondingWith(HttpStatus.INTERNAL_SERVER_ERROR, "{\"secret\":\"internal detail\"}");

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectErrorSatisfies(e -> assertThat(e)
                        .isInstanceOf(RefreshUpstreamException.class)
                        .extracting(RefreshUpstreamException.class::cast)
                        .extracting(RefreshUpstreamException::getReason, RefreshUpstreamException::getHttpStatus)
                        .containsExactly(UPSTREAM_ERROR, HttpStatus.BAD_GATEWAY))
                .verify();
        assertNothingLoggedContains("internal detail");
    }

    @Test
    void refreshTokens_connectionRefused_upstreamExceptionWithUnavailable() {
        // setup
        OAuthBffService service = serviceFailingWith(new ConnectException("Connection refused"));

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectErrorSatisfies(e -> assertThat(e)
                        .isInstanceOf(RefreshUpstreamException.class)
                        .extracting(RefreshUpstreamException.class::cast)
                        .extracting(RefreshUpstreamException::getReason, RefreshUpstreamException::getHttpStatus)
                        .containsExactly(UPSTREAM_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE))
                .verify();
    }

    @Test
    void refreshTokens_readTimeout_upstreamExceptionWithUnavailable() {
        // setup
        OAuthBffService service = serviceFailingWith(ReadTimeoutException.INSTANCE);

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectErrorSatisfies(e -> assertThat(e)
                        .isInstanceOf(RefreshUpstreamException.class)
                        .extracting(RefreshUpstreamException.class::cast)
                        .extracting(RefreshUpstreamException::getReason)
                        .isEqualTo(UPSTREAM_UNAVAILABLE))
                .verify();
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

    @Test
    void reproducesBug_CU17tkuw61qkg_refreshTokens_bare401WithoutOAuthErrorCode_invalidRefreshTokenException() {
        // setup
        OAuthBffService service = serviceRespondingWith(HttpStatus.UNAUTHORIZED, "");

        // execution
        Mono<TokenResponse> refresh = service.refreshTokensPublic("tenant-1", "stale-token", request);

        // verifications
        StepVerifier.create(refresh)
                .expectError(InvalidRefreshTokenException.class)
                .verify();
    }
}

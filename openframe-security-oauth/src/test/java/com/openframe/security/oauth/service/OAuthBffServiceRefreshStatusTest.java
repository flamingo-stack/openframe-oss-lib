package com.openframe.security.oauth.service;

import com.openframe.security.oauth.exception.InvalidRefreshTokenException;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import org.junit.jupiter.api.Test;
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
class OAuthBffServiceRefreshStatusTest {

    @Mock
    private ForwardedHeadersContributor headersContributor;

    private final ServerHttpRequest request = MockServerHttpRequest.post("/oauth/refresh").build();

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
    void shouldTreatBare403AsServerFault() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.FORBIDDEN, "");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .expectErrorSatisfies(e -> {
                    assertThat(e).isNotInstanceOf(InvalidRefreshTokenException.class);
                    assertThat(e.getMessage()).isEqualTo("token_refresh_failed");
                })
                .verify();
    }

    @Test
    void shouldTreat400WithoutErrorCodeAsServerFault() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.BAD_REQUEST, "");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .expectErrorSatisfies(e -> assertThat(e).isNotInstanceOf(InvalidRefreshTokenException.class))
                .verify();
    }

    @Test
    void shouldTreat401WithInvalidGrantAsInvalidRefreshToken() {
        OAuthBffService service = serviceRespondingWith(HttpStatus.UNAUTHORIZED, "{\"error\":\"invalid_grant\"}");

        StepVerifier.create(service.refreshTokensPublic("tenant-1", "token", request))
                .expectError(InvalidRefreshTokenException.class)
                .verify();
    }
}

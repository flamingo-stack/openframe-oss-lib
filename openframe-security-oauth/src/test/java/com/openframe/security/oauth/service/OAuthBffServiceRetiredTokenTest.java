package com.openframe.security.oauth.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthBffServiceRetiredTokenTest {

    private static final String TOKEN = "secret-refresh-token-value";

    @Mock
    private MongoOAuth2AuthorizationRepository repository;
    @Mock
    private ForwardedHeadersContributor headersContributor;

    private final ServerHttpRequest request = MockServerHttpRequest.post("/oauth/refresh").build();
    private final List<ClientRequest> upstream = new ArrayList<>();
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger(OAuthBffService.class);

    @BeforeEach
    void attachAppender() {
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void detachAppender() {
        logger.detachAppender(logs);
    }

    private OAuthBffService service() {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(call -> {
            upstream.add(call);
            return Mono.just(ClientResponse.create(HttpStatus.OK).build());
        });
        OAuthBffService service = new OAuthBffService(builder, null, headersContributor, null, null);
        ReflectionTestUtils.setField(service, "authServerUrl", "http://auth-server");
        ReflectionTestUtils.setField(service, "clientId", "client");
        ReflectionTestUtils.setField(service, "clientSecret", "secret");
        ReflectionTestUtils.setField(service, "authorizationRepository", repository);
        return service;
    }

    private static MongoOAuth2Authorization authorization() {
        MongoOAuth2Authorization authorization = new MongoOAuth2Authorization();
        authorization.setArAuthorizationUri("https://shared.example.com/sas/tenant-1/oauth2/authorize");
        return authorization;
    }

    @Test
    void logsAnUnknownRefreshTokenWithoutItsValue() {
        when(repository.findByRefreshTokenValue(TOKEN)).thenReturn(Optional.empty());
        when(repository.findByRetiredRefreshTokensValue(TOKEN)).thenReturn(Optional.empty());

        StepVerifier.create(service().refreshTokensByLookup(TOKEN, request)).verifyComplete();

        assertThat(logs.list)
                .anyMatch(e -> e.getLevel() == Level.WARN && e.getFormattedMessage().contains("unknown refresh token"))
                .noneMatch(e -> e.getFormattedMessage().contains(TOKEN));
        assertThat(upstream).isEmpty();
    }

    @Test
    void doesNotCheckRetiredTokensWhenTheCurrentTokenMatches() {
        when(repository.findByRefreshTokenValue(TOKEN)).thenReturn(Optional.of(authorization()));

        service().revokeRefreshTokenByLookup(TOKEN).block();

        verify(repository, never()).findByRetiredRefreshTokensValue(anyString());
        assertThat(upstream).hasSize(1);
    }

    @Test
    void logoutWithARetiredTokenStillReachesTheAuthServer() {
        when(repository.findByRefreshTokenValue(TOKEN)).thenReturn(Optional.empty());
        when(repository.findByRetiredRefreshTokensValue(TOKEN)).thenReturn(Optional.of(authorization()));

        service().revokeRefreshTokenByLookup(TOKEN).block();

        assertThat(upstream).singleElement()
                .satisfies(call -> assertThat(call.url().toString())
                        .isEqualTo("http://auth-server/tenant-1/oauth2/revoke"));
    }

    @Test
    void logoutWithAnUnknownTokenCallsNothing() {
        when(repository.findByRefreshTokenValue(TOKEN)).thenReturn(Optional.empty());
        when(repository.findByRetiredRefreshTokensValue(TOKEN)).thenReturn(Optional.empty());

        service().revokeRefreshTokenByLookup(TOKEN).block();

        assertThat(upstream).isEmpty();
    }
}

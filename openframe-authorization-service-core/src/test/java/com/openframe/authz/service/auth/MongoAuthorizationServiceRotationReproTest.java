package com.openframe.authz.service.auth;

import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.document.oauth.RetiredRefreshToken;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/** The rotation lost to a cancelled refresh, through the service over an in-memory document store. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MongoAuthorizationServiceRotationReproTest {

    private static final String AUTHORIZATION_ID = "authorization-1";
    private static final String OLD_TOKEN = "old-refresh-token";
    private static final String NEW_TOKEN = "new-refresh-token";

    @Mock
    private MongoOAuth2AuthorizationRepository repository;
    @Mock
    private RegisteredClientRepository clients;

    private final Map<String, MongoOAuth2Authorization> store = new HashMap<>();
    private MongoAuthorizationService service;

    @BeforeEach
    void setUp() {
        RegisteredClient client = RegisteredClient.withId("client-1")
                .clientId("client")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .build();
        when(clients.findById(anyString())).thenReturn(client);
        when(repository.save(any())).thenAnswer(call -> {
            MongoOAuth2Authorization entity = call.getArgument(0);
            store.put(entity.getId(), entity);
            return entity;
        });
        when(repository.findById(anyString()))
                .thenAnswer(call -> Optional.ofNullable(store.get(call.<String>getArgument(0))));
        when(repository.findByRefreshTokenValue(anyString())).thenAnswer(call -> store.values().stream()
                .filter(e -> call.<String>getArgument(0).equals(e.getRefreshTokenValue()))
                .findFirst());
        when(repository.findByRetiredRefreshTokensValue(anyString())).thenAnswer(call -> store.values().stream()
                .filter(e -> retiredValues(e).contains(call.<String>getArgument(0)))
                .findFirst());

        service = new MongoAuthorizationService(repository, clients);
        ReflectionTestUtils.setField(service, "refreshTokenGraceSeconds", 60L);

        Instant now = Instant.now();
        store.put(AUTHORIZATION_ID, MongoOAuth2Authorization.builder()
                .id(AUTHORIZATION_ID)
                .registeredClientId("client-1")
                .principalName("user@example.com")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE.getValue())
                .refreshTokenValue(OLD_TOKEN)
                .refreshTokenIssuedAt(now)
                .refreshTokenExpiresAt(now.plus(7, ChronoUnit.DAYS))
                .refreshTokenMetadata(new HashMap<>())
                .build());
    }

    private static List<String> retiredValues(MongoOAuth2Authorization entity) {
        return entity.getRetiredRefreshTokens() == null
                ? List.of()
                : entity.getRetiredRefreshTokens().stream().map(RetiredRefreshToken::value).toList();
    }

    private OAuth2Authorization find(String token) {
        return service.findByToken(token, OAuth2TokenType.REFRESH_TOKEN);
    }

    private void rotate(String presented, String replacement) {
        Instant now = Instant.now();
        service.save(OAuth2Authorization.from(find(presented))
                .token(new OAuth2RefreshToken(replacement, now, now.plus(7, ChronoUnit.DAYS)))
                .build());
    }

    @Test
    void reproducesBug_CU_17tkuw62gnb_refreshTokenSurvivesItsRotationInsideTheGraceWindow() {
        rotate(OLD_TOKEN, NEW_TOKEN);

        OAuth2Authorization retried = find(OLD_TOKEN);

        assertThat(retried).as("the client lost the response, so it can only retry with the old token").isNotNull();
        assertThat(retried.getRefreshToken().isActive()).isTrue();
    }
}

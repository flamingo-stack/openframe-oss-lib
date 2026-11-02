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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MongoAuthorizationServiceRefreshGraceTest {

    private static final String ID = "authorization-1";
    private static final String PRINCIPAL = "user@example.com";
    private static final long GRACE_SECONDS = 60;

    @Mock
    private MongoOAuth2AuthorizationRepository repository;
    @Mock
    private RegisteredClientRepository clients;

    private final Map<String, MongoOAuth2Authorization> store = new HashMap<>();
    private MongoAuthorizationService service;

    @BeforeEach
    void setUp() {
        when(clients.findById(anyString())).thenReturn(RegisteredClient.withId("client-1")
                .clientId("client")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .build());
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
                .filter(e -> retiredValues().contains(call.<String>getArgument(0)))
                .findFirst());
        when(repository.findByAccessTokenValue(anyString())).thenReturn(Optional.empty());
        when(repository.findByAuthorizationCodeValue(anyString())).thenReturn(Optional.empty());
        when(repository.findByState(anyString())).thenReturn(Optional.empty());
        when(repository.findAllByPrincipalNameIgnoreCaseAndRefreshTokenValueNotNull(PRINCIPAL))
                .thenAnswer(call -> new ArrayList<>(store.values()));

        service = new MongoAuthorizationService(repository, clients);
        ReflectionTestUtils.setField(service, "refreshTokenGraceSeconds", GRACE_SECONDS);
        store.put(ID, authorizationWithRefreshToken("token-0"));
    }

    private static MongoOAuth2Authorization authorizationWithRefreshToken(String token) {
        Instant now = Instant.now();
        return MongoOAuth2Authorization.builder()
                .id(ID)
                .registeredClientId("client-1")
                .principalName(PRINCIPAL)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE.getValue())
                .refreshTokenValue(token)
                .refreshTokenIssuedAt(now)
                .refreshTokenExpiresAt(now.plus(7, ChronoUnit.DAYS))
                .refreshTokenMetadata(new HashMap<>())
                .build();
    }

    private MongoOAuth2Authorization stored() {
        return store.get(ID);
    }

    private List<String> retiredValues() {
        List<RetiredRefreshToken> retired = stored().getRetiredRefreshTokens();
        return retired == null ? List.of() : retired.stream().map(RetiredRefreshToken::value).toList();
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

    private void retire(String value, long secondsAgo) {
        stored().setRetiredRefreshTokens(new ArrayList<>(List.of(
                new RetiredRefreshToken(value, Instant.now().minusSeconds(secondsAgo)))));
    }

    @Test
    void rejectsARetiredTokenOnceTheGraceWindowHasPassed() {
        retire("expired", GRACE_SECONDS + 1);

        assertThat(find("expired")).isNull();
    }

    @Test
    void acceptsARetiredTokenJustInsideTheGraceWindow() {
        retire("recent", GRACE_SECONDS - 5);

        assertThat(find("recent")).isNotNull();
    }

    @Test
    void rejectsATokenThatWasNeverIssued() {
        assertThat(find("never-issued")).isNull();
    }

    @Test
    void aRetryThatRotatesAgainKeepsEveryRetiredTokenUsable() {
        rotate("token-0", "token-1");
        rotate("token-0", "token-2");

        assertThat(stored().getRefreshTokenValue()).isEqualTo("token-2");
        assertThat(retiredValues()).containsExactlyInAnyOrder("token-0", "token-1");
        assertThat(find("token-0").getRefreshToken().isActive()).isTrue();
        assertThat(find("token-1").getRefreshToken().isActive()).isTrue();
    }

    @Test
    void aRetiredTokenCarriesItsOwnValueSoSpringRevocationCanLookItUp() {
        rotate("token-0", "token-1");

        assertThat(find("token-0").getToken("token-0")).isNotNull();
    }

    @Test
    void aRetiredTokenKeepsTheCurrentExpiry() {
        rotate("token-0", "token-1");

        assertThat(find("token-0").getRefreshToken().getToken().getExpiresAt())
                .isEqualTo(stored().getRefreshTokenExpiresAt());
    }

    @Test
    void revokingTheSessionAlsoEndsItsRetiredTokens() {
        rotate("token-0", "token-1");

        service.revokeAllForPrincipal(PRINCIPAL);

        assertThat(find("token-0").getRefreshToken().isActive()).isFalse();
    }

    @Test
    void revokingThroughARetiredTokenLeavesNoActiveTokenBehind() {
        rotate("token-0", "token-1");
        OAuth2Authorization byRetired = find("token-0");

        service.save(OAuth2Authorization.from(byRetired)
                .token(byRetired.getToken("token-0").getToken(),
                        metadata -> metadata.put(OAuth2Authorization.Token.INVALIDATED_METADATA_NAME, true))
                .build());

        assertThat(find("token-0").getRefreshToken().isActive()).isFalse();
        assertThat(find("token-1").getRefreshToken().isActive()).isFalse();
        assertThat(retiredValues()).containsExactly("token-1");
    }

    @Test
    void savingWithoutRotatingRetiresNothingAndKeepsWhatIsRetired() {
        retire("recent", 1);

        service.save(find("token-0"));

        assertThat(retiredValues()).containsExactly("recent");
    }

    @Test
    void savingDropsRetiredTokensPastTheirWindow() {
        retire("expired", GRACE_SECONDS + 1);

        rotate("token-0", "token-1");

        assertThat(retiredValues()).containsExactly("token-0");
    }

    @Test
    void savingWithNothingRetiredStoresNoList() {
        service.save(find("token-0"));

        assertThat(stored().getRetiredRefreshTokens()).isNull();
    }

    @Test
    void savingANewAuthorizationStoresNoList() {
        OAuth2Authorization existing = find("token-0");
        store.clear();

        service.save(existing);

        assertThat(stored().getRetiredRefreshTokens()).isNull();
    }

    @Test
    void anUntypedLookupAlsoResolvesARetiredToken() {
        rotate("token-0", "token-1");

        assertThat(service.findByToken("token-0", null)).isNotNull();
    }
}

package com.openframe.authz.service.auth;

import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

import java.time.Instant;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.data.model.audit.AuditConstants.SESSION_ATTRIBUTE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.springframework.security.oauth2.core.OAuth2AccessToken.TokenType.BEARER;

@ExtendWith(MockitoExtension.class)
class MongoAuthorizationServiceLoginSessionTest {

    private static final String BROWSER_SESSION_ID = "browser-session-1";
    private static final Instant ISSUED_AT = Instant.parse("2026-11-11T10:00:00Z");
    private static final RegisteredClient CLIENT = RegisteredClient.withId("client-1")
            .clientId("client")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("https://app.example.com/callback")
            .build();

    @Mock
    private MongoOAuth2AuthorizationRepository repository;
    @Mock
    private RegisteredClientRepository clients;
    @InjectMocks
    private MongoAuthorizationService service;

    @AfterEach
    void unbindRequest() {
        unbind();
    }

    @Test
    void save_firstSaveInABrowserSession_storesTheHashOfTheSessionId() {
        bindBrowserSession();

        service.save(authorization().build());

        assertThat(savedSessionId())
                .isEqualTo("ef003991504917232e858519f5d90e2b814b2c54d6d4d7c62256ac937b83f99e");
    }

    @Test
    void save_noRequestInProgress_storesNoSessionId() {
        service.save(authorization().build());

        assertThat(savedSessionId()).isNull();
    }

    @Test
    void save_requestWithoutASession_storesNoSessionId() {
        bind(new MockHttpServletRequest());

        service.save(authorization().build());

        assertThat(savedSessionId()).isNull();
    }

    @Test
    void save_authorizationAlreadyHoldsAnAccessToken_storesNoSessionId() {
        bindBrowserSession();

        service.save(authorization()
                .token(new OAuth2AccessToken(BEARER, "access-token-1", ISSUED_AT, ISSUED_AT.plusSeconds(300)))
                .build());

        assertThat(savedSessionId()).isNull();
    }

    @Test
    void save_sessionIdAlreadyStored_keepsTheStoredOne() {
        bindBrowserSession();

        service.save(authorization().attribute(SESSION_ATTRIBUTE, "stored-session-hash").build());

        assertThat(savedSessionId()).isEqualTo("stored-session-hash");
    }

    private static void bindBrowserSession() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession(null, BROWSER_SESSION_ID));
        bind(request);
    }

    private static OAuth2Authorization.Builder authorization() {
        return OAuth2Authorization.withRegisteredClient(CLIENT)
                .principalName("anna@acme.com")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE);
    }

    private String savedSessionId() {
        ArgumentCaptor<MongoOAuth2Authorization> saved = ArgumentCaptor.forClass(MongoOAuth2Authorization.class);
        verify(repository).save(saved.capture());
        return saved.getValue().getSessionId();
    }
}

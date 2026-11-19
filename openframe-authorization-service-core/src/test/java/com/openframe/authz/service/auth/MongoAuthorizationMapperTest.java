package com.openframe.authz.service.auth;

import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

import static com.openframe.data.model.audit.AuditConstants.SESSION_ATTRIBUTE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MongoAuthorizationMapperTest {

    private static final RegisteredClient CLIENT = RegisteredClient.withId("client-1")
            .clientId("client")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("https://app.example.com/callback")
            .build();

    @Mock private RegisteredClientRepository clients;

    @Test
    void toEntity_authorizationOfALoginSession_storesTheSessionId() {
        OAuth2Authorization authorization = OAuth2Authorization.withRegisteredClient(CLIENT)
                .principalName("anna@acme.com")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .attribute(SESSION_ATTRIBUTE, "session-hash")
                .build();

        assertThat(MongoAuthorizationMapper.toEntity(authorization).getSessionId()).isEqualTo("session-hash");
    }

    @Test
    void toDomain_storedSessionId_restoresItAsAnAttribute() {
        when(clients.findById("client-1")).thenReturn(CLIENT);
        MongoOAuth2Authorization entity = MongoOAuth2Authorization.builder()
                .id("authorization-1")
                .registeredClientId("client-1")
                .principalName("anna@acme.com")
                .authorizationGrantType("authorization_code")
                .sessionId("session-hash")
                .build();

        OAuth2Authorization authorization = MongoAuthorizationMapper.toDomain(entity, clients);

        assertThat(authorization.<String>getAttribute(SESSION_ATTRIBUTE)).isEqualTo("session-hash");
    }
}

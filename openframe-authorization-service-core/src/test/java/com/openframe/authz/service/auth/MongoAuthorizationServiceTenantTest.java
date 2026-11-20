package com.openframe.authz.service.auth;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MongoAuthorizationServiceTenantTest {

    private static final String AUTHORIZATION_ID = "authorization-1";
    private static final AuthorizationGrantType SIGNUP_TICKET =
            new AuthorizationGrantType("urn:openframe:params:oauth:grant-type:signup-ticket");
    private static final RegisteredClient CLIENT = RegisteredClient.withId("client-1")
            .clientId("client")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(SIGNUP_TICKET)
            .build();

    @Mock
    private MongoOAuth2AuthorizationRepository repository;
    @Mock
    private RegisteredClientRepository clients;
    @InjectMocks
    private MongoAuthorizationService service;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void save_insideATenantRequest_storesThatTenant() {
        TenantContext.setTenantId("tenant-1");

        service.save(authorization());

        assertThat(saved().getTenantId()).isEqualTo("tenant-1");
    }

    @Test
    void save_outsideATenantRequest_keepsTheStoredTenant() {
        MongoOAuth2Authorization stored = new MongoOAuth2Authorization();
        stored.setId(AUTHORIZATION_ID);
        stored.setTenantId("tenant-1");
        when(repository.findById(AUTHORIZATION_ID)).thenReturn(Optional.of(stored));

        service.save(authorization());

        assertThat(saved().getTenantId()).isEqualTo("tenant-1");
    }

    private static OAuth2Authorization authorization() {
        return OAuth2Authorization.withRegisteredClient(CLIENT)
                .id(AUTHORIZATION_ID)
                .principalName("anna@acme.com")
                .authorizationGrantType(SIGNUP_TICKET)
                .build();
    }

    private MongoOAuth2Authorization saved() {
        ArgumentCaptor<MongoOAuth2Authorization> saved = ArgumentCaptor.forClass(MongoOAuth2Authorization.class);
        verify(repository).save(saved.capture());
        return saved.getValue();
    }
}

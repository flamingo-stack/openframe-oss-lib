package com.openframe.authz.service.auth;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MongoAuthorizationMapperTenantTest {

    private static final RegisteredClient CLIENT = RegisteredClient.withId("rc-1").clientId("bff").clientSecret("secret")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
            .build();

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    private static OAuth2Authorization refreshAuthorization() {
        Instant now = Instant.now();
        return OAuth2Authorization.withRegisteredClient(CLIENT)
                .id("auth-1")
                .principalName("owner@acme.com")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .refreshToken(new OAuth2RefreshToken("rt", now, now.plusSeconds(3600)))
                .build();
    }

    @Test
    void shouldKeepLoadedTenantWhenResavedFromAnotherTenantRequest() {
        TenantContext.setTenantId("tenant-a");
        MongoOAuth2Authorization stored = MongoAuthorizationMapper.toEntity(refreshAuthorization());
        RegisteredClientRepository clients = mock(RegisteredClientRepository.class);
        when(clients.findById("rc-1")).thenReturn(CLIENT);
        TenantContext.setTenantId("tenant-b");

        MongoOAuth2Authorization resaved = MongoAuthorizationMapper.toEntity(
                MongoAuthorizationMapper.toDomain(stored, clients));

        assertThat(resaved.getTenantId()).isEqualTo("tenant-a");
    }

    @Test
    void shouldLeaveTenantEmptyWithoutAttributeOrRequestTenant() {
        assertThat(MongoAuthorizationMapper.toEntity(refreshAuthorization()).getTenantId()).isNull();
    }

    @Test
    void shouldNotExposeTenantAttributeForLegacyRecordWithoutTenant() {
        MongoOAuth2Authorization legacy = MongoAuthorizationMapper.toEntity(refreshAuthorization());
        RegisteredClientRepository clients = mock(RegisteredClientRepository.class);
        when(clients.findById("rc-1")).thenReturn(CLIENT);

        OAuth2Authorization loaded = MongoAuthorizationMapper.toDomain(legacy, clients);

        assertThat(loaded.<String>getAttribute(MongoAuthorizationMapper.TENANT_ID_ATTRIBUTE)).isNull();
    }
}

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

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MongoAuthorizationMapperTest {

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    private static OAuth2Authorization refreshAuthorization() {
        RegisteredClient client = RegisteredClient.withId("rc-1").clientId("bff").clientSecret("secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .build();
        Instant now = Instant.now();
        return OAuth2Authorization.withRegisteredClient(client)
                .id("auth-1")
                .principalName("owner@acme.com")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .refreshToken(new OAuth2RefreshToken("rt", now, now.plusSeconds(3600)))
                .build();
    }

    @Test
    void reproducesBug_oauthRefresh500_toEntityStoresRequestTenant() {
        TenantContext.setTenantId("tenant-1");

        MongoOAuth2Authorization entity = MongoAuthorizationMapper.toEntity(refreshAuthorization());

        assertThat(entity.getTenantId()).isEqualTo("tenant-1");
    }
}

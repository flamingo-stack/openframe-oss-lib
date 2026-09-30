package com.openframe.authz.service.sso.apple;

import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.service.auth.strategy.AppleClientSecretFactory;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.TestTokens.idToken;
import static com.openframe.authz.support.TestTokens.rsaKeyPair;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AppleAuthorizationCodeClientTest {

    private static final String TOKEN_URL = "https://appleid.apple.com/auth/token";

    private final SSOConfigService ssoConfigService = mock(SSOConfigService.class);
    private final AppleClientSecretFactory secretFactory = mock(AppleClientSecretFactory.class);
    private MockRestServiceServer apple;
    private AppleAuthorizationCodeClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        apple = MockRestServiceServer.bindTo(builder).build();
        client = new AppleAuthorizationCodeClient(new AppleSSOProperties(), ssoConfigService, secretFactory, builder);
        SSOConfig cfg = new SSOConfig();
        cfg.setTeamId("TEAM");
        cfg.setKeyId("KEY");
        when(ssoConfigService.getEffectiveSSOConfig("tenant-1", "apple")).thenReturn(Optional.of(cfg));
        when(ssoConfigService.getDecryptedClientSecret(cfg)).thenReturn("pem");
        when(secretFactory.mint(eq("TEAM"), eq("KEY"), eq("pem"), anyString())).thenReturn("client-secret-jwt");
    }

    private static String tokenResponse(String subject) {
        String idToken = idToken(rsaKeyPair(), "https://appleid.apple.com", "com.openframe.app", subject, Map.of());
        return "{\"id_token\":\"" + idToken + "\",\"refresh_token\":\"apple-refresh\"}";
    }

    @Test
    void shouldRedeemCodeForTheBundleAndReturnRefreshToken() {
        apple.expect(requestTo(TOKEN_URL)).andExpect(method(HttpMethod.POST))
                .andExpect(content().formDataContains(Map.of(
                        "grant_type", "authorization_code", "code", "code-1",
                        "client_id", "com.openframe.app", "client_secret", "client-secret-jwt")))
                .andRespond(withSuccess(tokenResponse("apple-sub"), MediaType.APPLICATION_JSON));

        assertThat(client.redeemAndVerify("com.openframe.app", "code-1", "apple-sub", "tenant-1")).isEqualTo("apple-refresh");
        apple.verify();
    }

    @Test
    void shouldRejectCodeThatBelongsToAnotherAppleUser() {
        apple.expect(requestTo(TOKEN_URL)).andRespond(withSuccess(tokenResponse("someone-else"), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.redeemAndVerify("com.openframe.app", "stolen-code", "apple-sub", "tenant-1"))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("does not belong to the presented identity token");
    }

    @Test
    void shouldRejectWhenAppleRefusesTheCode() {
        apple.expect(requestTo(TOKEN_URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST).body("{\"error\":\"invalid_grant\"}")
                .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.redeemAndVerify("com.openframe.app", "code", "apple-sub", "tenant-1"))
                .hasMessageContaining("Apple rejected the authorization code");
    }

    @Test
    void shouldRejectResponseWithoutOrWithBrokenIdToken() {
        apple.expect(requestTo(TOKEN_URL)).andRespond(withSuccess("{\"refresh_token\":\"r\"}", MediaType.APPLICATION_JSON));
        apple.expect(requestTo(TOKEN_URL)).andRespond(withSuccess("{\"id_token\":\"not-a-jwt\"}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.redeemAndVerify("com.openframe.app", "c", "apple-sub", "tenant-1"))
                .hasMessageContaining("returned no id_token");
        assertThatThrownBy(() -> client.redeemAndVerify("com.openframe.app", "c", "apple-sub", "tenant-1"))
                .hasMessageContaining("unparseable id_token");
    }

    @Test
    void shouldRefuseTenantWithoutAppleConfig() {
        when(ssoConfigService.getEffectiveSSOConfig("tenant-2", "apple")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> client.redeemAndVerify("com.openframe.app", "c", "apple-sub", "tenant-2"))
                .hasMessageContaining("not configured for this tenant");
    }
}

package com.openframe.authz.service.sso.apple;

import com.nimbusds.jwt.SignedJWT;
import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.service.auth.strategy.AppleClientSecretFactory;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.Map;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;
import static com.openframe.authz.service.auth.strategy.AppleClientSecretFactory.APPLE_ISSUER;

/**
 * Exchanges the native flow's single-use authorization code with Apple. This is the replay
 * protection of the native exchange: the identity token alone is a bearer JWT valid for ~10
 * minutes, but the code can be redeemed exactly once — a replayed request dies here.
 * <p>
 * The exchange authenticates with a client secret minted for the app's <b>bundle id</b> (the same
 * team key as the web flow; only {@code sub} differs) and cross-checks that the returned
 * {@code id_token} belongs to the same Apple user as the identity token being exchanged.
 */
@Slf4j
@Component
public class AppleAuthorizationCodeClient {

    private final AppleSSOProperties appleProps;
    private final SSOConfigService ssoConfigService;
    private final AppleClientSecretFactory clientSecretFactory;
    private final RestClient restClient;

    public AppleAuthorizationCodeClient(AppleSSOProperties appleProps,
                                        SSOConfigService ssoConfigService,
                                        AppleClientSecretFactory clientSecretFactory,
                                        RestClient.Builder restClientBuilder) {
        this.appleProps = appleProps;
        this.ssoConfigService = ssoConfigService;
        this.clientSecretFactory = clientSecretFactory;
        this.restClient = restClientBuilder.build();
    }

    /**
     * Redeems the code for the given bundle id and asserts it belongs to {@code expectedSubject}.
     * Returns Apple's refresh token — kept per user so the account-deletion flow can revoke it
     * (App Store guideline 5.1.1(v)); may be {@code null} if Apple returned none.
     *
     * @throws OAuth2AuthenticationException with {@code invalid_grant} when Apple rejects the code
     *                                       (wrong, expired, or already used) or the subjects differ
     */
    public String redeemAndVerify(String bundleId, String authorizationCode, String expectedSubject, String tenantId) {
        SSOConfig cfg = ssoConfigService.getEffectiveSSOConfig(tenantId, APPLE)
                .orElseThrow(() -> invalidGrant("Apple SSO is not configured for this tenant."));
        String privateKeyPem = ssoConfigService.getDecryptedClientSecret(cfg);
        String clientSecret = clientSecretFactory.mint(cfg.getTeamId(), cfg.getKeyId(), privateKeyPem, bundleId);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", authorizationCode);
        form.add("client_id", bundleId);
        form.add("client_secret", clientSecret);

        Map<String, Object> response;
        try {
            response = restClient.post()
                    .uri(tokenUrl())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.warn("Apple authorization-code exchange failed for client '{}': {}", bundleId, e.getMessage());
            throw invalidGrant("Apple rejected the authorization code.");
        }

        String idToken = response != null ? (String) response.get("id_token") : null;
        if (idToken == null) {
            throw invalidGrant("Apple code exchange returned no id_token.");
        }
        // Fetched directly from Apple over TLS in this same call — parsing the subject is enough;
        // full signature verification already happened on the identity token this is compared to.
        String subject;
        try {
            subject = SignedJWT.parse(idToken).getJWTClaimsSet().getSubject();
        } catch (Exception e) {
            throw invalidGrant("Apple code exchange returned an unparseable id_token.");
        }
        if (expectedSubject == null || !expectedSubject.equals(subject)) {
            log.warn("Apple code-exchange subject mismatch: identityToken sub != code sub");
            throw invalidGrant("Authorization code does not belong to the presented identity token.");
        }
        return (String) response.get("refresh_token");
    }

    private String tokenUrl() {
        String configured = appleProps.getTokenUrl();
        return configured != null && !configured.isBlank() ? configured : APPLE_ISSUER + "/auth/token";
    }

    private static OAuth2AuthenticationException invalidGrant(String description) {
        return new OAuth2AuthenticationException(
                new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT, description, null));
    }
}

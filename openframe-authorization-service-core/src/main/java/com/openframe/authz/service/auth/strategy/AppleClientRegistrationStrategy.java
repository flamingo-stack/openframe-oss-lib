package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;
import static com.openframe.authz.service.auth.strategy.AppleClientSecretFactory.APPLE_ISSUER;
import static org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_POST;

/**
 * Sign in with Apple. Differs from a plain OIDC provider in exactly the ways the base class
 * exposes as hooks:
 * <ul>
 *   <li>The {@code client_secret} is an ES256 JWT minted per request from the tenant's .p8 key
 *       (stored in the config's {@code clientSecret} field), not a static string — see
 *       {@link AppleClientSecretFactory}. Building the registration per request via
 *       {@code DynamicClientRegistrationRepository} makes Apple's 6-month secret-expiry a non-issue.</li>
 *   <li>Apple's token endpoint only accepts {@code client_secret_post}.</li>
 * </ul>
 * Apple also requires {@code response_mode=form_post} whenever the email or name scope is
 * requested — see {@link #additionalAuthorizationParams()}; the resulting cross-site POST callback
 * is why the SSO cookies need {@code SameSite=None} for this provider.
 */
@Slf4j
@Component
public class AppleClientRegistrationStrategy extends BaseOidcClientRegistrationStrategy {

    private final AppleSSOProperties appleProps;
    private final AppleClientSecretFactory clientSecretFactory;

    public AppleClientRegistrationStrategy(SSOConfigService ssoConfigService,
                                           AppleSSOProperties appleProps,
                                           AppleClientSecretFactory clientSecretFactory) {
        super(ssoConfigService);
        this.appleProps = appleProps;
        this.clientSecretFactory = clientSecretFactory;
    }

    @Override
    public String providerId() {
        return APPLE;
    }

    @Override
    protected AbstractOidcProviderProperties props() {
        return appleProps;
    }

    @Override
    public Map<String, String> additionalAuthorizationParams() {
        return Map.of("response_mode", "form_post");
    }

    @Override
    protected String clientSecret(SSOConfig cfg) {
        return clientSecretFactory.mint(cfg.getTeamId(), cfg.getKeyId(), super.clientSecret(cfg), cfg.getClientId());
    }

    @Override
    protected ClientAuthenticationMethod clientAuthenticationMethod() {
        return CLIENT_SECRET_POST;
    }

    @Override
    protected void customize(ClientRegistration.Builder builder, SSOConfig cfg) {
        builder.issuerUri(APPLE_ISSUER);
    }

    @Override
    public Optional<OAuth2TokenValidator<Jwt>> idTokenValidator(ClientRegistration registration) {
        return Optional.of(token -> {
            String issuer = token.getIssuer() != null ? token.getIssuer().toString() : null;
            if (APPLE_ISSUER.equals(issuer)) {
                return OAuth2TokenValidatorResult.success();
            }
            log.error("Apple issuer validation failed: issuer='{}'", issuer);
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_id_token", "Invalid issuer for Apple. Received: " + issuer, null));
        });
    }
}

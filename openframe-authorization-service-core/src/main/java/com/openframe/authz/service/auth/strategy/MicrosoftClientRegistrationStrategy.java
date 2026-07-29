package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.oidc.AbstractOidcProviderProperties;
import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@Component
public class MicrosoftClientRegistrationStrategy extends BaseOidcClientRegistrationStrategy {

    /**
     * A multi-tenant Microsoft app receives ID tokens issued by the signing-in directory, so the
     * issuer varies per tenant and cannot be compared literally.
     */
    private static final Pattern MS_ISSUER_PATTERN =
            Pattern.compile("^https://login\\.microsoftonline\\.com/[^/]+/v2\\.0/?$");

    private final MicrosoftSSOProperties microsoftProps;

    public MicrosoftClientRegistrationStrategy(SSOConfigService ssoConfigService, MicrosoftSSOProperties microsoftProps) {
        super(ssoConfigService);
        this.microsoftProps = microsoftProps;
    }

    @Override
    public String providerId() {
        return MicrosoftSSOProperties.MICROSOFT;
    }

    @Override
    protected AbstractOidcProviderProperties props() {
        return microsoftProps;
    }

    @Override
    public Optional<OAuth2TokenValidator<Jwt>> idTokenValidator(ClientRegistration registration) {
        return Optional.of(token -> {
            String issuer = token.getIssuer() != null ? token.getIssuer().toString() : null;
            if (issuer != null && MS_ISSUER_PATTERN.matcher(issuer).matches()) {
                return OAuth2TokenValidatorResult.success();
            }
            log.error("Microsoft issuer validation failed: issuer='{}' does not match pattern='{}'",
                    issuer, MS_ISSUER_PATTERN.pattern());
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_id_token",
                            "Invalid issuer for Microsoft multi-tenant. Received: " + issuer, null));
        });
    }
}




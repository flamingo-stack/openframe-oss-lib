package com.openframe.authz.config.oidc;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Sign in with Apple. Single fixed issuer — no per-tenant endpoint templating.
 * <p>
 * Apple has no static client secret: the inherited {@code defaultClientSecret} slot holds the
 * {@code .p8} "Sign in with Apple" private key (PEM), and the actual {@code client_secret} is an
 * ES256 JWT minted from it per request ({@code iss} = team ID, {@code kid} = key ID).
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Component
@ConfigurationProperties(prefix = "openframe.sso.apple")
public class AppleSSOProperties extends AbstractOidcProviderProperties {

    public static final String APPLE = "apple";

    /** Apple Developer Team ID — the issuer of the client-secret JWT. */
    private String defaultTeamId;

    /** Key ID of the .p8 key — the {@code kid} header of the client-secret JWT. */
    private String defaultKeyId;

    /**
     * iOS app bundle ids accepted as {@code aud} by the native identity-token exchange
     * (e.g. {@code ai.openframe.mobile.dev}). The native Sign in with Apple sheet issues tokens
     * whose audience is the app's bundle id, NOT the web flow's Services ID. Empty list disables
     * the native exchange.
     */
    private java.util.List<String> nativeClientIds = java.util.List.of();
}

package com.openframe.authz.service.sso;

import com.openframe.authz.dto.SsoLoginInitRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.validation.SsoProviderValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.openframe.authz.security.SsoRegistrationConstants.FLOW_COOKIE_TTL_SECONDS;
import static com.openframe.authz.security.SsoRegistrationConstants.providerAuthorizationPath;
import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static java.time.Instant.now;
import static java.util.UUID.randomUUID;

/**
 * Starts the email-less SSO login. The OAuth dance runs under the onboarding pseudo-tenant with
 * the generic (default) provider app — exactly like SSO registration — and the callback is owned
 * by {@link com.openframe.authz.security.flow.LoginSsoHandler}, which resolves the user by the
 * provider-asserted email and routes to their tenant.
 */
@Service
@RequiredArgsConstructor
public class SsoLoginService {

    private final SsoProviderValidator ssoProviderValidator;
    private final SsoCookieCodec ssoCookieCodec;

    public SsoAuthorizeData startLogin(SsoLoginInitRequest request) {
        String provider = ssoProviderValidator.normalizeProvider(request.getProvider());
        // Only providers with generic (default) credentials can log in without a tenant.
        ssoProviderValidator.ensureProviderConfiguredForOnboarding(provider);

        String state = randomUUID().toString();
        long issuedAt = now().getEpochSecond();
        SsoLoginCookiePayload payload = new SsoLoginCookiePayload(
                state,
                provider,
                request.getRedirectTo(),
                request.isAuthMobile(),
                issuedAt,
                issuedAt + FLOW_COOKIE_TTL_SECONDS
        );
        String token = ssoCookieCodec.encodeLogin(payload);
        String redirectPath = providerAuthorizationPath(provider, ONBOARDING_TENANT_ID);
        return new SsoAuthorizeData(token, FLOW_COOKIE_TTL_SECONDS, provider, state, redirectPath);
    }
}

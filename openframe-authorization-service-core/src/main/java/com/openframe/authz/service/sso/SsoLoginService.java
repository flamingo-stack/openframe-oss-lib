package com.openframe.authz.service.sso;

import com.openframe.authz.dto.SsoLoginInitRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.validation.SsoProviderValidator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.openframe.authz.security.SsoRegistrationConstants.FLOW_COOKIE_TTL_SECONDS;
import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static com.openframe.authz.security.SsoRegistrationConstants.PROVIDER_AUTHORIZATION_PATH_PREFIX;
import static com.openframe.authz.security.SsoRegistrationConstants.providerAuthorizationPath;
import static java.time.Instant.now;
import static java.util.UUID.randomUUID;

/**
 * Starts sign-in through a shared provider or the provider selected for a company. Shared login
 * resolves the workspace after identity verification. Company login keeps that choice in the server session.
 */
@Service
@RequiredArgsConstructor
public class SsoLoginService {

    private final SsoProviderValidator ssoProviderValidator;
    private final SsoCookieCodec ssoCookieCodec;
    private final CompanySsoLoginService companySsoLoginService;

    public SsoAuthorizeData startLogin(SsoLoginInitRequest request) {
        String provider = ssoProviderValidator.normalizeProvider(request.getProvider());
        // Only providers with generic (default) credentials can log in without a tenant.
        ssoProviderValidator.ensureProviderConfiguredForOnboarding(provider);

        return authorize(request, provider, randomUUID().toString(), false);
    }

    public SsoAuthorizeData startCompanyLogin(SsoLoginInitRequest request, String handle, HttpServletRequest httpRequest) {
        String provider = ssoProviderValidator.normalizeProvider(request.getProvider());
        String state = randomUUID().toString();
        companySsoLoginService.start(handle, provider, state, httpRequest);
        return authorize(request, provider, state, true);
    }

    private SsoAuthorizeData authorize(SsoLoginInitRequest request, String provider, String state, boolean companySso) {
        long issuedAt = now().getEpochSecond();
        SsoLoginCookiePayload payload = new SsoLoginCookiePayload(
                state,
                provider,
                request.getRedirectTo(),
                request.isAuthMobile(),
                issuedAt,
                issuedAt + FLOW_COOKIE_TTL_SECONDS,
                companySso ? Boolean.TRUE : null
        );
        String token = ssoCookieCodec.encodeLogin(payload);
        String redirectPath = companySso
                ? PROVIDER_AUTHORIZATION_PATH_PREFIX + provider
                : providerAuthorizationPath(provider, ONBOARDING_TENANT_ID);
        return new SsoAuthorizeData(token, FLOW_COOKIE_TTL_SECONDS, provider, state, redirectPath);
    }
}

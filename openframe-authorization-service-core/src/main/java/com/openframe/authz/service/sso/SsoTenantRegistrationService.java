package com.openframe.authz.service.sso;

import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.authz.service.validation.SsoProviderValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static java.time.Instant.now;
import static java.util.UUID.randomUUID;

@Service
@RequiredArgsConstructor
public class SsoTenantRegistrationService {

    private static final int COOKIE_TTL_SECONDS = 600;

    private final SsoCookieCodec ssoCookieCodec;
    private final RegistrationValidationService validationService;
    private final SsoProviderValidator ssoProviderValidator;
    private final SSOConfigService ssoConfigService;

    public SsoAuthorizeData startRegistration(SsoTenantRegistrationInitRequest request) {
        String provider = ssoProviderValidator.normalizeProvider(request.getProvider());
        ssoProviderValidator.ensureProviderConfiguredForOnboarding(provider);

        validationService.ensureTenantDomainAvailable(request.getTenantDomain());

        String state = randomUUID().toString();
        long now = now().getEpochSecond();
        SsoTenantRegCookiePayload payload = new SsoTenantRegCookiePayload(
                state,
                request.getTenantName(),
                request.getTenantDomain(),
                provider,
                request.getRedirectTo(),
                now,
                now + COOKIE_TTL_SECONDS
        );
        String jwtCookieValue = ssoCookieCodec.encodeTenant(payload);

        String redirectPath = "/oauth2/authorization/" + provider + "?tenant=" + ONBOARDING_TENANT_ID;
        return new SsoAuthorizeData(jwtCookieValue, COOKIE_TTL_SECONDS, provider, state, redirectPath);
    }

    public record SsoAuthorizeData(String cookieValue, int cookieTtlSeconds, String provider, String state,
                                   String redirectPath) {
    }
}


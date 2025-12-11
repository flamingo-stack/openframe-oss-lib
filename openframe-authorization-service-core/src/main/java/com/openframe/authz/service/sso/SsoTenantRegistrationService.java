package com.openframe.authz.service.sso;

import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.processor.RegistrationProcessor;
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
    private final RegistrationProcessor registrationProcessor;

    public SsoAuthorizeData startRegistration(SsoTenantRegistrationInitRequest request) {
        String provider = normalizeAndEnsureOnboarding(request);

        ensureDomainAvailable(request.getTenantDomain());

        // Pre-process registration early to fail before redirecting to provider login page
        preProcessRegistration(request);

        String state = randomUUID().toString();
        long issuedAt = now().getEpochSecond();
        SsoTenantRegCookiePayload payload = buildCookiePayload(request, provider, state, issuedAt);
        String jwtCookieValue = ssoCookieCodec.encodeTenant(payload);

        String redirectPath = buildRedirectPath(provider);
        return new SsoAuthorizeData(jwtCookieValue, COOKIE_TTL_SECONDS, provider, state, redirectPath);
    }

    private String normalizeAndEnsureOnboarding(SsoTenantRegistrationInitRequest request) {
        String provider = ssoProviderValidator.normalizeProvider(request.getProvider());
        ssoProviderValidator.ensureProviderConfiguredForOnboarding(provider);
        return provider;
    }

    private void ensureDomainAvailable(String tenantDomain) {
        validationService.ensureTenantDomainAvailable(tenantDomain);
    }

    private void preProcessRegistration(SsoTenantRegistrationInitRequest request) {
        TenantRegistrationRequest preReq = TenantRegistrationRequest.builder()
                .email(request.getEmail())
                .accessCode(request.getAccessCode())
                .tenantDomain(request.getTenantDomain())
                .build();
        registrationProcessor.preProcessTenantRegistration(preReq);
    }

    private SsoTenantRegCookiePayload buildCookiePayload(SsoTenantRegistrationInitRequest request,
                                                         String provider,
                                                         String state,
                                                         long issuedAt) {
        return new SsoTenantRegCookiePayload(
                state,
                request.getTenantName(),
                request.getTenantDomain(),
                provider,
                request.getRedirectTo(),
                request.getAccessCode(),
                issuedAt,
                issuedAt + COOKIE_TTL_SECONDS
        );
    }

    private String buildRedirectPath(String provider) {
        return "/oauth2/authorization/" + provider + "?tenant=" + ONBOARDING_TENANT_ID;
    }

    public record SsoAuthorizeData(String cookieValue, int cookieTtlSeconds, String provider, String state,
                                   String redirectPath) {
    }
}


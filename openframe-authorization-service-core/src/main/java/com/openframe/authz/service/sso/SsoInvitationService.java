package com.openframe.authz.service.sso;

import com.openframe.authz.dto.SsoInvitationAcceptRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.service.sso.SsoTenantRegistrationService.SsoAuthorizeData;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.authz.service.validation.SsoProviderValidator;
import com.openframe.data.document.auth.AuthInvitation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static java.time.Instant.now;
import static java.util.UUID.randomUUID;

@Service
@RequiredArgsConstructor
public class SsoInvitationService {

    private static final int COOKIE_TTL_SECONDS = 600;

    private final InvitationValidator invitationValidator;
    private final SsoProviderValidator ssoProviderValidator;
    private final SsoCookieCodec ssoCookieCodec;

    public SsoAuthorizeData startAccept(SsoInvitationAcceptRequest request) {
        String invitationId = request.getInvitationId();
        AuthInvitation inv = invitationValidator.loadAndEnsureAcceptable(invitationId);
        String provider = ssoProviderValidator.normalizeProvider(request.getProvider());
        ssoProviderValidator.ensureProviderConfiguredForTenant(inv.getTenantId(), provider);

        String state = randomUUID().toString();
        long now = now().getEpochSecond();
        SsoInviteCookiePayload payload = new SsoInviteCookiePayload(
                state,
                invitationId,
                request.getSwitchTenant(),
                provider,
                request.getRedirectTo(),
                now,
                now + COOKIE_TTL_SECONDS
        );
        String token = ssoCookieCodec.encodeInvite(payload);
        String redirectPath = "/oauth2/authorization/" + provider + "?tenant=" + inv.getTenantId();
        return new SsoAuthorizeData(token, COOKIE_TTL_SECONDS, provider, state, redirectPath);
    }
}


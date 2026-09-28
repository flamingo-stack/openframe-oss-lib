package com.openframe.authz.service.sso;

import com.openframe.authz.dto.SsoInvitationAcceptRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.authz.service.validation.SsoProviderValidator;
import com.openframe.data.document.auth.AuthInvitation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.openframe.authz.security.SsoRegistrationConstants.FLOW_COOKIE_TTL_SECONDS;
import static com.openframe.authz.security.SsoRegistrationConstants.providerAuthorizationPath;
import static java.time.Instant.now;
import static java.util.UUID.randomUUID;

@Service
@RequiredArgsConstructor
public class SsoInvitationService {

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
                request.isAuthMobile(),
                now,
                now + FLOW_COOKIE_TTL_SECONDS
        );
        String token = ssoCookieCodec.encodeInvite(payload);
        String redirectPath = providerAuthorizationPath(provider, inv.getTenantId());
        return new SsoAuthorizeData(token, FLOW_COOKIE_TTL_SECONDS, provider, state, redirectPath);
    }
}


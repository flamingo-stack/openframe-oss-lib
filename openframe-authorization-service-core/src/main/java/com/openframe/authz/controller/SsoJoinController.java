package com.openframe.authz.controller;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.InvitationRegistrationService;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.authz.util.OidcUserUtils;
import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.WebUtils;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static com.openframe.authz.util.OidcUserUtils.resolvePictureUrl;
import static com.openframe.authz.web.AuthStateUtils.clearCookie;
import static com.openframe.authz.web.Redirects.foundAtRoot;
import static com.openframe.core.constants.SsoFlowCookieNames.OF_SSO_INVITE;
import static com.openframe.core.constants.SsoFlowCookieNames.OF_SSO_LOGIN;
import static java.util.Locale.ROOT;
import static org.springframework.util.StringUtils.hasText;

/**
 * The "one last step" consent gate: when an SSO flow is about to CREATE a new user (invitation
 * acceptance, or a shared-domain first login), the flow parks the user here to confirm the
 * account they're joining and accept Terms before the user is created. Identity comes only from
 * the authenticated SAS session; the pending flow cookie ({@code of_sso_invite} /
 * {@code of_sso_login}, kept by the handler) says which flow and carries redirect/mobile context.
 */
@Slf4j
@RestController
@RequestMapping(path = "/oauth/join", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SsoJoinController {

    private final SsoCookieCodec ssoCookieCodec;
    private final InvitationValidator invitationValidator;
    private final InvitationRegistrationService invitationRegistrationService;
    private final SsoOidcUserService ssoOidcUserService;
    private final TenantService tenantService;

    public record JoinPendingResponse(String email,
                                      String firstName,
                                      String lastName,
                                      String provider,
                                      String tenantName,
                                      List<String> roles) {}

    @GetMapping("/pending")
    public JoinPendingResponse pending(Authentication authentication, HttpServletRequest request) {
        OidcUser user = requireSessionOidcUser(authentication);
        String[] names = OidcUserUtils.resolveNames(user);
        String email = OidcUserUtils.resolveEmail(user);

        Cookie invite = WebUtils.getCookie(request, OF_SSO_INVITE);
        if (invite != null) {
            SsoInviteCookiePayload payload = ssoCookieCodec.decodeInvite(invite.getValue())
                    .orElseThrow(this::expired);
            AuthInvitation inv = invitationValidator.loadAndEnsureAcceptable(payload.invitationId());
            return new JoinPendingResponse(email, names[0], names[1], payload.provider(),
                    tenantName(inv.getTenantId()), roleNames(inv.getRoles()));
        }

        Cookie login = WebUtils.getCookie(request, OF_SSO_LOGIN);
        if (login != null) {
            SsoLoginCookiePayload payload = ssoCookieCodec.decodeLogin(login.getValue())
                    .orElseThrow(this::expired);
            String tenantId = ssoOidcUserService.autoProvisionTenantForDomain(email)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "no_auto_provision_tenant"));
            return new JoinPendingResponse(email, names[0], names[1], payload.provider(),
                    tenantName(tenantId), List.of("ADMIN"));
        }
        throw expired();
    }

    /**
     * Creates the user after consent and continues into the tenant. {@code agreeTerms} must be
     * true — the create cannot proceed without it. Top-level navigation (302 into /oauth/continue),
     * so the frontend uses a real navigation, not fetch.
     */
    @GetMapping("/complete")
    public void complete(@RequestParam(value = "agreeTerms", defaultValue = "false") boolean agreeTerms,
                         Authentication authentication,
                         HttpServletRequest request,
                         HttpServletResponse response) throws IOException {
        OidcUser user = requireSessionOidcUser(authentication);
        if (!agreeTerms) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "terms_not_accepted");
        }
        String[] names = OidcUserUtils.resolveNames(user);
        String provider = authentication instanceof OAuth2AuthenticationToken token
                ? token.getAuthorizedClientRegistrationId() : null;

        Cookie invite = WebUtils.getCookie(request, OF_SSO_INVITE);
        if (invite != null) {
            SsoInviteCookiePayload payload = ssoCookieCodec.decodeInvite(invite.getValue())
                    .orElseThrow(this::expired);
            InvitationRegistrationRequest req = InvitationRegistrationRequest.builder()
                    .invitationId(payload.invitationId())
                    .firstName(names[0] != null ? names[0] : "")
                    .lastName(names[1] != null ? names[1] : "")
                    .password(UUID.randomUUID().toString())
                    .pictureUrl(resolvePictureUrl(user))
                    .switchTenant(Boolean.TRUE.equals(payload.switchTenant()))
                    .build();
            AuthUser created = invitationRegistrationService.registerByInvitation(req);
            clearCookie(response, OF_SSO_INVITE);
            continueInto(response, created.getTenantId(), payload.redirectTo(), payload.authMobile());
            return;
        }

        Cookie login = WebUtils.getCookie(request, OF_SSO_LOGIN);
        if (login != null) {
            SsoLoginCookiePayload payload = ssoCookieCodec.decodeLogin(login.getValue())
                    .orElseThrow(this::expired);
            AuthUser provisioned = ssoOidcUserService.autoProvisionByGlobalDomain(provider, user)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "no_auto_provision_tenant"));
            clearCookie(response, OF_SSO_LOGIN);
            continueInto(response, provisioned.getTenantId(), payload.redirectTo(), payload.authMobile());
            return;
        }
        throw expired();
    }

    private void continueInto(HttpServletResponse response, String tenantId, String redirectTo, boolean authMobile) {
        foundAtRoot(response, com.openframe.authz.web.Redirects.oauthContinuePath(tenantId, redirectTo, authMobile));
    }

    private String tenantName(String tenantId) {
        return tenantService.findById(tenantId).map(Tenant::getName).orElse("");
    }

    private static List<String> roleNames(List<? extends Enum<?>> roles) {
        return roles == null ? List.of() : roles.stream().map(Enum::name).toList();
    }

    private OidcUser requireSessionOidcUser(Authentication authentication) {
        if (authentication instanceof OAuth2AuthenticationToken token
                && token.getPrincipal() instanceof OidcUser user) {
            return user;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Your sign-in session expired. Please sign in again.");
    }

    private ResponseStatusException expired() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Your sign-in session expired. Please sign in again.");
    }
}

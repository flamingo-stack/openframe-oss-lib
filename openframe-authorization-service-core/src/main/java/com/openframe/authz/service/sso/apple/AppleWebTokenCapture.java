package com.openframe.authz.service.sso.apple;

import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.OidcUserUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;
import static java.util.Locale.ROOT;
import static org.springframework.util.StringUtils.hasText;

/**
 * Captures Apple's refresh token after a successful web SSO callback — Apple issues a fresh one
 * on every code exchange, and App Store guideline 5.1.1(v) obliges us to revoke it when the
 * account is deleted. One hook in the success handler covers plain login, registration,
 * invitation acceptance, and the email-less login alike; by the time it runs, every flow that
 * creates a user has created it, so a lookup by the authenticated email finds the owner.
 * Best-effort by contract: a capture failure must never affect the sign-in.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppleWebTokenCapture {

    private final OAuth2AuthorizedClientRepository authorizedClientRepository;
    private final UserService userService;
    private final AppleTokenService appleTokenService;

    public void captureIfApple(HttpServletRequest request, Authentication authentication) {
        try {
            if (!(authentication instanceof OAuth2AuthenticationToken token)
                    || !APPLE.equals(token.getAuthorizedClientRegistrationId())
                    || !(token.getPrincipal() instanceof OidcUser oidcUser)) {
                return;
            }
            OAuth2AuthorizedClient client = authorizedClientRepository
                    .loadAuthorizedClient(APPLE, authentication, request);
            if (client == null || client.getRefreshToken() == null) {
                return;
            }
            String email = OidcUserUtils.resolveEmail(oidcUser);
            if (!hasText(email)) {
                return;
            }
            userService.findActiveByEmail(email.toLowerCase(ROOT)).ifPresent(user ->
                    appleTokenService.store(
                            user.getTenantId(),
                            user.getId(),
                            client.getClientRegistration().getClientId(),
                            client.getRefreshToken().getTokenValue()));
        } catch (Exception e) {
            log.warn("Apple web token capture failed: {}", e.getMessage());
        }
    }
}

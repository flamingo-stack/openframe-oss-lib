package com.openframe.authz.security;

import com.openframe.data.document.auth.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Makes the session's principal the account an SSO flow resolved, not whatever email the IdP
 * asserted. The authorization server issues tokens for the principal NAME (the token customizer
 * looks the user up by it), so when the two differ — an invitation for {@code a@x} accepted with
 * the IdP account {@code b@x}, an Apple Hide-My-Email relay, a link-first login after an email
 * change — the session would otherwise sign in as a different (or non-existent) account than the
 * one the flow settled on.
 */
@Component
public class SessionPrincipalBinder {

    static final String ACCOUNT_EMAIL_CLAIM = "of_account_email";

    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    public void bind(Authentication authentication,
                     AuthUser account,
                     HttpServletRequest request,
                     HttpServletResponse response) {
        if (!(authentication instanceof OAuth2AuthenticationToken token)
                || !(token.getPrincipal() instanceof OidcUser oidcUser)
                || account.getEmail().equalsIgnoreCase(token.getName())) {
            return;
        }

        Map<String, Object> claims = new HashMap<>(
                oidcUser.getUserInfo() != null ? oidcUser.getUserInfo().getClaims() : Map.of());
        claims.put(ACCOUNT_EMAIL_CLAIM, account.getEmail());
        OidcUser bound = new DefaultOidcUser(
                oidcUser.getAuthorities(), oidcUser.getIdToken(), new OidcUserInfo(claims), ACCOUNT_EMAIL_CLAIM);

        OAuth2AuthenticationToken rebound = new OAuth2AuthenticationToken(
                bound, token.getAuthorities(), token.getAuthorizedClientRegistrationId());
        rebound.setDetails(token.getDetails());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(rebound);
        SecurityContextHolder.setContext(context);
        // The login filter already saved the original context before the success handler ran.
        securityContextRepository.saveContext(context, request, response);
    }
}

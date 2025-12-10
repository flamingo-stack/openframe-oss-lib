package com.openframe.authz.security;

import com.openframe.authz.controller.TenantSsoRegistrationController;
import com.openframe.security.jwt.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;

/**
 * Custom resolver that reads our pre-generated state from a signed cookie
 * and injects it into the outgoing authorization request to Google/Microsoft.
 */
@Slf4j
@RequiredArgsConstructor
public class SsoAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;
    private final JwtService jwtService;

    public SsoAuthorizationRequestResolver(ClientRegistrationRepository repo,
                                           JwtService jwtService) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(repo, "/oauth2/authorization");
        this.jwtService = jwtService;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        OAuth2AuthorizationRequest req = delegate.resolve(request);
        return maybeInjectStateFromCookie(request, req);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest req = delegate.resolve(request, clientRegistrationId);
        return maybeInjectStateFromCookie(request, req);
    }

    private OAuth2AuthorizationRequest maybeInjectStateFromCookie(HttpServletRequest request,
                                                                  OAuth2AuthorizationRequest req) {
        if (req == null) return null;
        try {
            Cookie c = findCookie(request, TenantSsoRegistrationController.COOKIE_SSO_REG);
            if (c == null || !StringUtils.hasText(c.getValue())) {
                return req;
            }
            Jwt jwt = jwtService.decodeToken(c.getValue());
            Object s = jwt.getClaims().get("s");
            String state = s instanceof String str ? str : null;
            if (!StringUtils.hasText(state)) {
                return req;
            }
            return OAuth2AuthorizationRequest.from(req).state(state).build();
        } catch (Exception e) {
            log.warn("Failed to inject state from cookie: {}", e.getMessage());
            return req;
        }
    }

    private static Cookie findCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c;
        }
        return null;
    }
}


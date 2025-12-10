package com.openframe.authz.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.Optional;

import static com.openframe.authz.security.SsoRegistrationConstants.COOKIE_SSO_REG;

/**
 * Custom resolver that reads our pre-generated state from a signed cookie
 * and injects it into the outgoing authorization request to Google/Microsoft.
 */
@Slf4j
@RequiredArgsConstructor
public class SsoAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;
    private final SsoCookieCodec ssoCookieCodec;

    public SsoAuthorizationRequestResolver(ClientRegistrationRepository repo,
                                           SsoCookieCodec ssoCookieCodec) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(repo, "/oauth2/authorization");
        this.ssoCookieCodec = ssoCookieCodec;
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
        Optional<String> state = extractStateFromCookie(request);
        return state.map(s -> OAuth2AuthorizationRequest.from(req).state(s).build()).orElse(req);
    }

    private Optional<String> extractStateFromCookie(HttpServletRequest request) {
        try {
            Cookie[] cookies = request.getCookies();
            if (cookies == null) return Optional.empty();
            for (Cookie c : cookies) {
                if (COOKIE_SSO_REG.equals(c.getName())) {
                    String token = c.getValue();
                    if (token == null || token.isBlank()) return Optional.empty();
                    return ssoCookieCodec.decode(token).map(SsoCookiePayload::s).filter(sv -> !sv.isBlank());
                }
            }
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Failed to inject state from cookie: {}", e.getMessage());
            return Optional.empty();
        }
    }
}


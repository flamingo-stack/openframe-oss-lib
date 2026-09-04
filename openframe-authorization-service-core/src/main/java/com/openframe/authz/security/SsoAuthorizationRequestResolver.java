package com.openframe.authz.security;

import com.openframe.core.constants.SsoFlowCookieNames;

import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

import java.util.Map;
import java.util.Optional;

/**
 * Custom resolver that adjusts the outgoing authorization request: injects our pre-generated state
 * from the signed flow cookie (signup, invite and email-less login flows), and adds any
 * provider-required extra parameters, e.g. Apple's {@code response_mode=form_post}.
 * <p>
 * The state injection is what lets {@code SsoFlowSuccessHandler} dispatch the callback to the
 * right flow handler: each flow's cookie carries the state it generated, and the provider must
 * echo that exact value. Flow cookies are decoded payload-agnostically via
 * {@code SsoCookieCodec#decodeState}, so a new flow only needs its cookie name added to
 * {@code SsoRegistrationConstants#SsoFlowCookieNames.ALL}.
 */
@Slf4j
public class SsoAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;
    private final SsoCookieCodec ssoCookieCodec;
    private final SsoProviderRegistry ssoProviderRegistry;

    public SsoAuthorizationRequestResolver(ClientRegistrationRepository repo,
                                           SsoCookieCodec ssoCookieCodec,
                                           SsoProviderRegistry ssoProviderRegistry) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(repo, "/oauth2/authorization");
        this.ssoCookieCodec = ssoCookieCodec;
        this.ssoProviderRegistry = ssoProviderRegistry;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(request, delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return customize(request, delegate.resolve(request, clientRegistrationId));
    }

    private OAuth2AuthorizationRequest customize(HttpServletRequest request, OAuth2AuthorizationRequest req) {
        if (req == null) return null;

        Map<String, String> extraParams = providerParams(req);
        Optional<String> state = extractStateFromCookie(request);
        if (extraParams.isEmpty() && state.isEmpty()) {
            return req;
        }

        OAuth2AuthorizationRequest.Builder builder = OAuth2AuthorizationRequest.from(req);
        if (!extraParams.isEmpty()) {
            builder.additionalParameters(params -> params.putAll(extraParams));
        }
        state.ifPresent(builder::state);
        return builder.build();
    }

    private Map<String, String> providerParams(OAuth2AuthorizationRequest req) {
        Object registrationId = req.getAttribute(OAuth2ParameterNames.REGISTRATION_ID);
        return registrationId instanceof String id
                ? ssoProviderRegistry.additionalAuthorizationParams(id)
                : Map.of();
    }

    private Optional<String> extractStateFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        for (Cookie c : cookies) {
            if (!SsoFlowCookieNames.ALL.contains(c.getName())) {
                continue;
            }
            String token = c.getValue();
            if (token == null || token.isBlank()) continue;
            Optional<String> state = ssoCookieCodec.decodeState(token);
            if (state.isPresent()) {
                return state;
            }
        }
        return Optional.empty();
    }
}

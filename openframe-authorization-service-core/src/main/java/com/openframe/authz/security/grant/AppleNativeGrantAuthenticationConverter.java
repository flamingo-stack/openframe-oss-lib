package com.openframe.authz.security.grant;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.web.authentication.AuthenticationConverter;

import static org.springframework.util.StringUtils.hasText;

/**
 * Reads the native Apple exchange from the token endpoint:
 * {@code grant_type=urn:openframe:params:oauth:grant-type:apple-native} with
 * {@code identity_token}, {@code authorization_code}, and optional {@code nonce} /
 * {@code first_name} / {@code last_name} (Apple sends the name to the app exactly once,
 * on first authorization — the app forwards it here).
 */
public class AppleNativeGrantAuthenticationConverter implements AuthenticationConverter {

    @Override
    public Authentication convert(HttpServletRequest request) {
        String grantType = request.getParameter(OAuth2ParameterNames.GRANT_TYPE);
        if (!AppleNativeGrantAuthenticationToken.GRANT_TYPE.getValue().equals(grantType)) {
            return null;
        }

        Authentication clientPrincipal = SecurityContextHolder.getContext().getAuthentication();

        String identityToken = request.getParameter("identity_token");
        String authorizationCode = request.getParameter("authorization_code");
        if (!hasText(identityToken) || !hasText(authorizationCode)) {
            throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_REQUEST,
                    "identity_token and authorization_code are required.", null));
        }

        return new AppleNativeGrantAuthenticationToken(
                clientPrincipal,
                identityToken,
                authorizationCode,
                request.getParameter("nonce"),
                request.getParameter("first_name"),
                request.getParameter("last_name"));
    }
}

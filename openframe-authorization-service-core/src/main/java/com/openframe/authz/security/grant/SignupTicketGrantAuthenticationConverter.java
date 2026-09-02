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
 * Reads {@code grant_type=urn:openframe:params:oauth:grant-type:signup-ticket} with a single
 * {@code ticket} parameter from the token endpoint.
 */
public class SignupTicketGrantAuthenticationConverter implements AuthenticationConverter {

    @Override
    public Authentication convert(HttpServletRequest request) {
        String grantType = request.getParameter(OAuth2ParameterNames.GRANT_TYPE);
        if (!SignupTicketGrantAuthenticationToken.GRANT_TYPE.getValue().equals(grantType)) {
            return null;
        }

        Authentication clientPrincipal = SecurityContextHolder.getContext().getAuthentication();

        String ticket = request.getParameter("ticket");
        if (!hasText(ticket)) {
            throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_REQUEST,
                    "ticket is required.", null));
        }
        return new SignupTicketGrantAuthenticationToken(clientPrincipal, ticket);
    }
}

package com.openframe.authz.security.grant;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

import java.util.Collections;

/**
 * Token-endpoint request that redeems a bound signup ticket for the freshly registered user's
 * tokens — the mobile SSO signup's session-less mint, presented by the authenticated BFF client.
 */
public class SignupTicketGrantAuthenticationToken extends AbstractAuthenticationToken {

    public static final AuthorizationGrantType GRANT_TYPE =
            new AuthorizationGrantType("urn:openframe:params:oauth:grant-type:signup-ticket");

    private final Authentication clientPrincipal;
    private final String ticket;

    public SignupTicketGrantAuthenticationToken(Authentication clientPrincipal, String ticket) {
        super(Collections.emptyList());
        this.clientPrincipal = clientPrincipal;
        this.ticket = ticket;
    }

    @Override
    public Object getPrincipal() {
        return clientPrincipal;
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    public String getTicket() {
        return ticket;
    }
}

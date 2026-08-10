package com.openframe.authz.security.grant;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;

import java.util.Collections;

/**
 * Token-endpoint request for the native Sign in with Apple exchange: the iOS app's Apple identity
 * token + single-use authorization code, presented by an authenticated OAuth2 client (the BFF).
 */
public class AppleNativeGrantAuthenticationToken extends AbstractAuthenticationToken {

    public static final AuthorizationGrantType GRANT_TYPE =
            new AuthorizationGrantType("urn:openframe:params:oauth:grant-type:apple-native");

    private final Authentication clientPrincipal;
    private final String identityToken;
    private final String authorizationCode;
    private final String nonce;
    private final String firstName;
    private final String lastName;

    public AppleNativeGrantAuthenticationToken(Authentication clientPrincipal,
                                               String identityToken,
                                               String authorizationCode,
                                               String nonce,
                                               String firstName,
                                               String lastName) {
        super(Collections.emptyList());
        this.clientPrincipal = clientPrincipal;
        this.identityToken = identityToken;
        this.authorizationCode = authorizationCode;
        this.nonce = nonce;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    @Override
    public Object getPrincipal() {
        return clientPrincipal;
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    public String getIdentityToken() {
        return identityToken;
    }

    public String getAuthorizationCode() {
        return authorizationCode;
    }

    public String getNonce() {
        return nonce;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }
}

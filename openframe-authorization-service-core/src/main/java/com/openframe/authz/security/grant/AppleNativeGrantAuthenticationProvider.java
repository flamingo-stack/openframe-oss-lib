package com.openframe.authz.security.grant;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.sso.apple.AppleAuthorizationCodeClient;
import com.openframe.authz.service.sso.apple.AppleNativeTokenVerifier;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.OidcUserUtils;
import com.openframe.data.document.auth.AuthUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;

/**
 * Handles the {@code apple-native} grant at the standard token endpoint. Verification order:
 * client authentication (done by the filter before us) → identity-token signature/issuer/audience/
 * nonce → single-use code redemption with Apple (replay protection) → user resolution in the
 * current tenant under the same rules as the web SSO flow. Token minting, claims, and persistence
 * then go through the exact machinery every other grant uses, so refresh works unchanged.
 */
@Slf4j
public class AppleNativeGrantAuthenticationProvider implements AuthenticationProvider {

    private final AppleNativeTokenVerifier tokenVerifier;
    private final AppleAuthorizationCodeClient codeClient;
    private final SsoOidcUserService ssoOidcUserService;
    private final UserService userService;
    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;

    public AppleNativeGrantAuthenticationProvider(AppleNativeTokenVerifier tokenVerifier,
                                                  AppleAuthorizationCodeClient codeClient,
                                                  SsoOidcUserService ssoOidcUserService,
                                                  UserService userService,
                                                  OAuth2AuthorizationService authorizationService,
                                                  OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        this.tokenVerifier = tokenVerifier;
        this.codeClient = codeClient;
        this.ssoOidcUserService = ssoOidcUserService;
        this.userService = userService;
        this.authorizationService = authorizationService;
        this.tokenGenerator = tokenGenerator;
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        AppleNativeGrantAuthenticationToken request = (AppleNativeGrantAuthenticationToken) authentication;

        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(request);
        RegisteredClient registeredClient = clientPrincipal.getRegisteredClient();
        if (registeredClient == null
                || !registeredClient.getAuthorizationGrantTypes().contains(AppleNativeGrantAuthenticationToken.GRANT_TYPE)) {
            throw error(OAuth2ErrorCodes.UNAUTHORIZED_CLIENT, "Client is not authorized for the apple-native grant.");
        }

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, "Tenant could not be resolved from the token endpoint path.");
        }

        Jwt identityToken = tokenVerifier.verify(request.getIdentityToken(), request.getNonce());
        String bundleId = identityToken.getAudience().get(0);
        codeClient.redeemAndVerify(bundleId, request.getAuthorizationCode(), identityToken.getSubject(), tenantId);

        String email = identityToken.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Apple identity token carries no email.");
        }

        AuthUser user = ssoOidcUserService
                .resolveOrProvision(tenantId, APPLE, email, request.getFirstName(), request.getLastName())
                .orElseThrow(() -> error(OAuth2ErrorCodes.INVALID_GRANT,
                        "No user for this Apple account in the tenant, and auto-provisioning is not enabled."));

        if (OidcUserUtils.emailVerifiedClaimAllows(identityToken.getClaims())) {
            userService.markEmailVerified(user.getId());
        }
        userService.touchLastLogin(user.getEmail(), tenantId);

        Authentication userPrincipal = new UsernamePasswordAuthenticationToken(
                user.getEmail(), null,
                user.getRoles().stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.name())).toList());

        OAuth2Authorization.Builder authorizationBuilder = OAuth2Authorization.withRegisteredClient(registeredClient)
                .principalName(user.getEmail())
                .authorizationGrantType(AppleNativeGrantAuthenticationToken.GRANT_TYPE)
                .authorizedScopes(registeredClient.getScopes())
                .attribute(Principal.class.getName(), userPrincipal);

        OAuth2AccessToken accessToken = generateAccessToken(registeredClient, userPrincipal, request, authorizationBuilder);
        OAuth2RefreshToken refreshToken = maybeGenerateRefreshToken(registeredClient, userPrincipal, request, authorizationBuilder);

        authorizationService.save(authorizationBuilder.build());
        log.info("Native Apple exchange succeeded: tenantId={}, userId={}", tenantId, user.getId());

        return new OAuth2AccessTokenAuthenticationToken(registeredClient, clientPrincipal, accessToken, refreshToken, Map.of());
    }

    private OAuth2AccessToken generateAccessToken(RegisteredClient registeredClient,
                                                  Authentication userPrincipal,
                                                  AppleNativeGrantAuthenticationToken request,
                                                  OAuth2Authorization.Builder authorizationBuilder) {
        OAuth2Token generated = tokenGenerator.generate(tokenContext(
                registeredClient, userPrincipal, request, OAuth2TokenType.ACCESS_TOKEN));
        if (generated == null) {
            throw error(OAuth2ErrorCodes.SERVER_ERROR, "Failed to generate access token.");
        }
        OAuth2AccessToken accessToken = new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER,
                generated.getTokenValue(), generated.getIssuedAt(), generated.getExpiresAt(),
                registeredClient.getScopes());
        if (generated instanceof Jwt jwt) {
            authorizationBuilder.token(accessToken, metadata ->
                    metadata.put(OAuth2Authorization.Token.CLAIMS_METADATA_NAME, jwt.getClaims()));
        } else {
            authorizationBuilder.accessToken(accessToken);
        }
        return accessToken;
    }

    private OAuth2RefreshToken maybeGenerateRefreshToken(RegisteredClient registeredClient,
                                                         Authentication userPrincipal,
                                                         AppleNativeGrantAuthenticationToken request,
                                                         OAuth2Authorization.Builder authorizationBuilder) {
        if (!registeredClient.getAuthorizationGrantTypes().contains(AuthorizationGrantType.REFRESH_TOKEN)) {
            return null;
        }
        OAuth2Token generated = tokenGenerator.generate(tokenContext(
                registeredClient, userPrincipal, request, OAuth2TokenType.REFRESH_TOKEN));
        if (!(generated instanceof OAuth2RefreshToken refreshToken)) {
            return null;
        }
        authorizationBuilder.refreshToken(refreshToken);
        return refreshToken;
    }

    private OAuth2TokenContext tokenContext(RegisteredClient registeredClient,
                                            Authentication userPrincipal,
                                            AppleNativeGrantAuthenticationToken request,
                                            OAuth2TokenType tokenType) {
        return DefaultOAuth2TokenContext.builder()
                .registeredClient(registeredClient)
                .principal(userPrincipal)
                .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                .authorizedScopes(registeredClient.getScopes())
                .tokenType(tokenType)
                .authorizationGrantType(AppleNativeGrantAuthenticationToken.GRANT_TYPE)
                .authorizationGrant(request)
                .build();
    }

    private static OAuth2ClientAuthenticationToken authenticatedClient(Authentication authentication) {
        if (authentication.getPrincipal() instanceof OAuth2ClientAuthenticationToken client
                && client.isAuthenticated()) {
            return client;
        }
        throw error(OAuth2ErrorCodes.INVALID_CLIENT, "Client authentication required.");
    }

    private static OAuth2AuthenticationException error(String code, String description) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, description, null));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return AppleNativeGrantAuthenticationToken.class.isAssignableFrom(authentication);
    }
}

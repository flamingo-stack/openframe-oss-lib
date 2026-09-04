package com.openframe.authz.security.grant;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.sso.apple.AppleAuthorizationCodeClient;
import com.openframe.authz.service.sso.apple.AppleTokenService;
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
public class AppleNativeGrantAuthenticationProvider extends AbstractTokenMintingGrantProvider {

    private final AppleNativeTokenVerifier tokenVerifier;
    private final AppleAuthorizationCodeClient codeClient;
    private final AppleTokenService appleTokenService;
    private final SsoIdentityService ssoIdentityService;
    private final SsoOidcUserService ssoOidcUserService;
    private final UserService userService;

    public AppleNativeGrantAuthenticationProvider(AppleNativeTokenVerifier tokenVerifier,
                                                  AppleAuthorizationCodeClient codeClient,
                                                  AppleTokenService appleTokenService,
                                                  SsoIdentityService ssoIdentityService,
                                                  SsoOidcUserService ssoOidcUserService,
                                                  UserService userService,
                                                  OAuth2AuthorizationService authorizationService,
                                                  OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        super(authorizationService, tokenGenerator);
        this.tokenVerifier = tokenVerifier;
        this.codeClient = codeClient;
        this.appleTokenService = appleTokenService;
        this.ssoIdentityService = ssoIdentityService;
        this.ssoOidcUserService = ssoOidcUserService;
        this.userService = userService;
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
        String appleRefreshToken = codeClient.redeemAndVerify(bundleId, request.getAuthorizationCode(), identityToken.getSubject(), tenantId);

        String email = identityToken.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Apple identity token carries no email.");
        }

        AuthUser user = ssoOidcUserService
                .resolveOrProvision(tenantId, APPLE, email, request.getFirstName(), request.getLastName())
                .orElseThrow(() -> error(OAuth2ErrorCodes.INVALID_GRANT,
                        "No user for this Apple account in the tenant, and auto-provisioning is not enabled."));

        appleTokenService.store(tenantId, user.getId(), bundleId, appleRefreshToken);
        ssoIdentityService.link("apple", identityToken.getClaims(), user);

        if (OidcUserUtils.emailVerifiedClaimAllows(identityToken.getClaims())) {
            userService.markEmailVerified(user.getId());
        }
        userService.touchLastLogin(user.getEmail(), tenantId);

        Authentication userPrincipal = new UsernamePasswordAuthenticationToken(
                user.getEmail(), null,
                user.getRoles().stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.name())).toList());

        OAuth2AccessTokenAuthenticationToken result = mintTokens(
                registeredClient, clientPrincipal, userPrincipal,
                AppleNativeGrantAuthenticationToken.GRANT_TYPE, request);
        log.info("Native Apple exchange succeeded: tenantId={}, userId={}", tenantId, user.getId());
        return result;
    }


    @Override
    public boolean supports(Class<?> authentication) {
        return AppleNativeGrantAuthenticationToken.class.isAssignableFrom(authentication);
    }
}

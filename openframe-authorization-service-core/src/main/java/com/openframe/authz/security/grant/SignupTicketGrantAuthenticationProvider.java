package com.openframe.authz.security.grant;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SignupTicketService;
import com.openframe.authz.service.sso.SignupTicketService.SignupTicketPayload;
import com.openframe.authz.service.user.UserService;
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
import java.util.Map;

/**
 * Session-less mint for the mobile SSO signup: the BFF redeems a signup ticket that the
 * completion step bound to a freshly registered user. Trust comes from three things — the ticket
 * is unguessable and single-use (atomic consume), the identity it names lives server-side only,
 * and the tenant in the token-endpoint path must match the tenant the ticket was bound to.
 * Never a Spring bean — see the apple-native provider's inline-construction note.
 */
@Slf4j
public class SignupTicketGrantAuthenticationProvider implements AuthenticationProvider {

    private final SignupTicketService signupTicketService;
    private final UserService userService;
    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;

    public SignupTicketGrantAuthenticationProvider(SignupTicketService signupTicketService,
                                                   UserService userService,
                                                   OAuth2AuthorizationService authorizationService,
                                                   OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        this.signupTicketService = signupTicketService;
        this.userService = userService;
        this.authorizationService = authorizationService;
        this.tokenGenerator = tokenGenerator;
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        SignupTicketGrantAuthenticationToken request = (SignupTicketGrantAuthenticationToken) authentication;

        OAuth2ClientAuthenticationToken clientPrincipal = authenticatedClient(request);
        RegisteredClient registeredClient = clientPrincipal.getRegisteredClient();
        if (registeredClient == null
                || !registeredClient.getAuthorizationGrantTypes().contains(SignupTicketGrantAuthenticationToken.GRANT_TYPE)) {
            throw error(OAuth2ErrorCodes.UNAUTHORIZED_CLIENT, "Client is not authorized for the signup-ticket grant.");
        }

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw error(OAuth2ErrorCodes.INVALID_REQUEST, "Tenant could not be resolved from the token endpoint path.");
        }

        SignupTicketPayload ticket = signupTicketService.consume(request.getTicket())
                .orElseThrow(() -> error(OAuth2ErrorCodes.INVALID_GRANT, "Unknown or expired signup ticket."));
        if (!ticket.bound()) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Signup ticket has not completed registration.");
        }
        if (!tenantId.equals(ticket.tenantId())) {
            log.warn("event=signup-ticket-tenant-mismatch pathTenant={} boundTenant={}", tenantId, ticket.tenantId());
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Signup ticket does not belong to this tenant.");
        }

        AuthUser user = userService.findActiveById(ticket.userId())
                .orElseThrow(() -> error(OAuth2ErrorCodes.INVALID_GRANT, "User is not active."));

        userService.touchLastLogin(user.getEmail(), tenantId);

        Authentication userPrincipal = new UsernamePasswordAuthenticationToken(
                user.getEmail(), null,
                user.getRoles().stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.name())).toList());

        OAuth2Authorization.Builder authorizationBuilder = OAuth2Authorization.withRegisteredClient(registeredClient)
                .principalName(user.getEmail())
                .authorizationGrantType(SignupTicketGrantAuthenticationToken.GRANT_TYPE)
                .authorizedScopes(registeredClient.getScopes())
                .attribute(Principal.class.getName(), userPrincipal);

        OAuth2AccessToken accessToken = generateAccessToken(registeredClient, userPrincipal, request, authorizationBuilder);
        OAuth2RefreshToken refreshToken = maybeGenerateRefreshToken(registeredClient, userPrincipal, request, authorizationBuilder);

        authorizationService.save(authorizationBuilder.build());
        log.info("Signup ticket redeemed: tenantId={}, userId={}", tenantId, user.getId());

        return new OAuth2AccessTokenAuthenticationToken(registeredClient, clientPrincipal, accessToken, refreshToken, Map.of());
    }

    private OAuth2AccessToken generateAccessToken(RegisteredClient registeredClient,
                                                  Authentication userPrincipal,
                                                  SignupTicketGrantAuthenticationToken request,
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
                                                         SignupTicketGrantAuthenticationToken request,
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
                                            SignupTicketGrantAuthenticationToken request,
                                            OAuth2TokenType tokenType) {
        return DefaultOAuth2TokenContext.builder()
                .registeredClient(registeredClient)
                .principal(userPrincipal)
                .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                .authorizedScopes(registeredClient.getScopes())
                .tokenType(tokenType)
                .authorizationGrantType(SignupTicketGrantAuthenticationToken.GRANT_TYPE)
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
        return SignupTicketGrantAuthenticationToken.class.isAssignableFrom(authentication);
    }
}

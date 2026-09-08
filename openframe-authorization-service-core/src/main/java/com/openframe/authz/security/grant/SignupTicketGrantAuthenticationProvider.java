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
public class SignupTicketGrantAuthenticationProvider extends AbstractTokenMintingGrantProvider {

    private final SignupTicketService signupTicketService;
    private final UserService userService;

    public SignupTicketGrantAuthenticationProvider(SignupTicketService signupTicketService,
                                                   UserService userService,
                                                   OAuth2AuthorizationService authorizationService,
                                                   OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        super(authorizationService, tokenGenerator);
        this.signupTicketService = signupTicketService;
        this.userService = userService;
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

        OAuth2AccessTokenAuthenticationToken result = mintTokens(
                registeredClient, clientPrincipal, userPrincipal,
                SignupTicketGrantAuthenticationToken.GRANT_TYPE, request);
        log.info("Signup ticket redeemed: tenantId={}, userId={}", tenantId, user.getId());
        return result;
    }


    @Override
    public boolean supports(Class<?> authentication) {
        return SignupTicketGrantAuthenticationToken.class.isAssignableFrom(authentication);
    }
}

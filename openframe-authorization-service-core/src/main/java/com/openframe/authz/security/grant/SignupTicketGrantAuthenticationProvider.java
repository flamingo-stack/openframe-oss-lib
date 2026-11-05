package com.openframe.authz.security.grant;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.security.AuthAuditor;
import com.openframe.authz.service.sso.SignupTicketService.PendingSignup;
import com.openframe.authz.service.sso.SignupTicketService;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.util.AuthUserPrincipals;
import com.openframe.data.document.auth.AuthUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

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

    private static final String SIGNUP_TICKET_PROVIDER = "signup-ticket";

    private final SignupTicketService signupTicketService;
    private final UserService userService;
    private final AuthAuditor authAuditor;

    public SignupTicketGrantAuthenticationProvider(SignupTicketService signupTicketService,
                                                   UserService userService,
                                                   AuthAuditor authAuditor,
                                                   OAuth2AuthorizationService authorizationService,
                                                   OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        super(authorizationService, tokenGenerator);
        this.signupTicketService = signupTicketService;
        this.userService = userService;
        this.authAuditor = authAuditor;
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

        try {
            return redeem(request, clientPrincipal, registeredClient, tenantId);
        } catch (AuthenticationException e) {
            authAuditor.recordLoginFailure(null, tenantId, e.getMessage(), Map.of("provider", SIGNUP_TICKET_PROVIDER));
            throw e;
        }
    }

    private OAuth2AccessTokenAuthenticationToken redeem(SignupTicketGrantAuthenticationToken request,
                                                        OAuth2ClientAuthenticationToken clientPrincipal,
                                                        RegisteredClient registeredClient,
                                                        String tenantId) {
        PendingSignup pendingSignup = signupTicketService.consume(request.getTicket())
                .orElseThrow(() -> error(OAuth2ErrorCodes.INVALID_GRANT, "Unknown or expired signup ticket."));
        if (!pendingSignup.bound()) {
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Signup ticket has not completed registration.");
        }
        if (!tenantId.equals(pendingSignup.tenantId())) {
            log.warn("event=signup-ticket-tenant-mismatch pathTenant={} boundTenant={}", tenantId, pendingSignup.tenantId());
            throw error(OAuth2ErrorCodes.INVALID_GRANT, "Signup ticket does not belong to this tenant.");
        }

        AuthUser user = userService.findActiveById(pendingSignup.userId())
                .orElseThrow(() -> error(OAuth2ErrorCodes.INVALID_GRANT, "User is not active."));

        userService.touchLastLogin(user.getEmail(), tenantId);

        Authentication userPrincipal = new UsernamePasswordAuthenticationToken(
                user.getEmail(), null, AuthUserPrincipals.authorities(user));

        OAuth2AccessTokenAuthenticationToken result = mintTokens(
                registeredClient, clientPrincipal, userPrincipal,
                SignupTicketGrantAuthenticationToken.GRANT_TYPE, request);
        log.info("Signup ticket redeemed: tenantId={}, userId={}", tenantId, user.getId());
        authAuditor.recordLogin(user, SIGNUP_TICKET_PROVIDER);
        return result;
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return SignupTicketGrantAuthenticationToken.class.isAssignableFrom(authentication);
    }
}

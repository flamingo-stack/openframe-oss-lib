package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContextFilter;
import com.openframe.data.document.auth.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Signs the owner of a just-registered tenant into the auth-server session, so the client can go
 * straight through {@code /oauth/continue} into the new tenant instead of logging in again — the
 * same landing an SSO signup gets.
 * <p>
 * Any previous session is dropped first: it may belong to another user or tenant, and starting a
 * fresh one is also the session-fixation protection a form login would apply. The session is pinned
 * to the new tenant, otherwise the following {@code /{tenantId}/oauth2/authorize} sees a tenant
 * change and invalidates it. The principal mirrors what the password-login {@code UserDetailsService}
 * builds, so the authorize endpoint cannot tell the two apart.
 */
@Component
public class RegistrationSessionLogin {

    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    public void signIn(AuthUser owner, HttpServletRequest request, HttpServletResponse response) {
        HttpSession previous = request.getSession(false);
        if (previous != null) {
            previous.invalidate();
        }
        request.getSession(true).setAttribute(TenantContextFilter.TENANT_ID, owner.getTenantId());

        List<SimpleGrantedAuthority> authorities = owner.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
        User principal = new User(owner.getEmail(), owner.getPasswordHash(), authorities);
        var authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null, authorities);
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}

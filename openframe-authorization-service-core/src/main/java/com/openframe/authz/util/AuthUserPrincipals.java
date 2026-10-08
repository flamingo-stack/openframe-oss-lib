package com.openframe.authz.util;

import com.openframe.data.document.auth.AuthUser;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

/**
 * How an {@link AuthUser} appears to Spring Security: its roles as {@code ROLE_*} authorities, and
 * the {@link UserDetails} password login authenticates. One place, so every path that signs a user
 * in — password login, registration, the native grants — produces the same principal.
 */
public final class AuthUserPrincipals {

    private AuthUserPrincipals() {
    }

    public static List<SimpleGrantedAuthority> authorities(AuthUser user) {
        return user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
    }

    /** Requires a password hash — callers must have already refused users without one. */
    public static UserDetails userDetails(AuthUser user) {
        return User.builder()
                .username(user.getEmail())
                .password(user.getPasswordHash())
                .authorities(authorities(user))
                .build();
    }
}

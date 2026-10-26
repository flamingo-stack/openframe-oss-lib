package com.openframe.authz.config;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;

import java.util.List;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthorizationServerBeansTest {

    private static final String TENANT = "tenant-1";

    private final AuthorizationServerConfig config = new AuthorizationServerConfig();
    private final UserService userService = mock(UserService.class);
    private AuthUser owner;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT);
        owner = activeUser("user-1", TENANT, "owner@acme.com");
        owner.setRoles(List.of(UserRole.OWNER));
        owner.setPasswordHash(new BCryptPasswordEncoder(4).encode("Str0ng-password!"));
    }

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    private JwtEncodingContext.Builder context(OAuth2TokenType type, AuthorizationGrantType grant, String principal) {
        return JwtEncodingContext.with(JwsHeader.with(SignatureAlgorithm.RS256), JwtClaimsSet.builder().subject(principal))
                .principal(new UsernamePasswordAuthenticationToken(principal, null))
                .tokenType(type)
                .authorizationGrantType(grant);
    }

    @Test
    void shouldAddTenantUserAndEffectiveRolesToAccessToken() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.of(owner));
        OAuth2TokenCustomizer<JwtEncodingContext> customizer = config.tokenCustomizer(userService);
        JwtEncodingContext ctx = context(OAuth2TokenType.ACCESS_TOKEN, AuthorizationGrantType.AUTHORIZATION_CODE, "Owner@Acme.com").build();

        customizer.customize(ctx);

        JwtClaimsSet claims = ctx.getClaims().build();
        assertThat(claims.<String>getClaim("tenant_id")).isEqualTo(TENANT);
        assertThat(claims.<String>getClaim("userId")).isEqualTo("user-1");
        assertThat(claims.<List<String>>getClaim("roles")).containsExactlyInAnyOrder("OWNER", "ADMIN");
        verify(userService, never()).touchLastLogin("owner@acme.com", TENANT);
    }

    @Test
    void shouldTouchLastLoginOnRefreshGrant() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.of(owner));

        config.tokenCustomizer(userService).customize(
                context(OAuth2TokenType.ACCESS_TOKEN, AuthorizationGrantType.REFRESH_TOKEN, "owner@acme.com").build());

        verify(userService).touchLastLogin("owner@acme.com", TENANT);
    }

    @Test
    void shouldRefuseToMintForPrincipalWithoutActiveUserInRequestTenant() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> config.tokenCustomizer(userService).customize(
                context(OAuth2TokenType.ACCESS_TOKEN, AuthorizationGrantType.AUTHORIZATION_CODE, "owner@acme.com").build()))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    void shouldNotAddClaimsToIdToken() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.of(owner));
        JwtEncodingContext ctx = context(new OAuth2TokenType("id_token"), AuthorizationGrantType.AUTHORIZATION_CODE,
                "owner@acme.com").build();

        config.tokenCustomizer(userService).customize(ctx);

        assertThat(ctx.getClaims().build().getClaims()).doesNotContainKeys("tenant_id", "roles");
    }

    @Test
    void shouldLoadPasswordUserScopedToRequestTenant() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.of(owner));
        UserDetailsService details = config.userDetailsService(userService);

        UserDetails loaded = details.loadUserByUsername("OWNER@acme.com");

        assertThat(loaded.getUsername()).isEqualTo("owner@acme.com");
        assertThat(loaded.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_OWNER");
    }

    @Test
    void shouldRefusePasswordLoginWithoutUserInTenantOrWithoutHash() {
        UserDetailsService details = config.userDetailsService(userService);
        AuthUser ssoOnly = activeUser("u2", TENANT, "sso@acme.com");
        ssoOnly.setPasswordHash(" ");
        when(userService.findActiveByEmailAndTenant("ghost@acme.com", TENANT)).thenReturn(Optional.empty());
        when(userService.findActiveByEmailAndTenant("sso@acme.com", TENANT)).thenReturn(Optional.of(ssoOnly));

        assertThatThrownBy(() -> details.loadUserByUsername("ghost@acme.com")).isInstanceOf(UsernameNotFoundException.class);
        assertThatThrownBy(() -> details.loadUserByUsername("sso@acme.com"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("Password login not available");
    }

    @Test
    void shouldAuthenticatePasswordsWithBcryptOnly() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.of(owner));
        var manager = config.authenticationManager(config.userDetailsService(userService), config.passwordEncoder());

        assertThat(config.passwordEncoder()).isInstanceOf(BCryptPasswordEncoder.class);
        assertThat(manager.authenticate(new UsernamePasswordAuthenticationToken("owner@acme.com", "Str0ng-password!"))
                .isAuthenticated()).isTrue();
        assertThatThrownBy(() -> manager.authenticate(new UsernamePasswordAuthenticationToken("owner@acme.com", "wrong")))
                .isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
    }

    @Test
    void shouldGiveSameErrorForUnknownUserAndWrongPassword() {
        when(userService.findActiveByEmailAndTenant("owner@acme.com", TENANT)).thenReturn(Optional.of(owner));
        when(userService.findActiveByEmailAndTenant("ghost@acme.com", TENANT)).thenReturn(Optional.empty());
        var manager = config.authenticationManager(config.userDetailsService(userService), config.passwordEncoder());

        assertThatThrownBy(() -> manager.authenticate(new UsernamePasswordAuthenticationToken("ghost@acme.com", "x")))
                .isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);
    }
}

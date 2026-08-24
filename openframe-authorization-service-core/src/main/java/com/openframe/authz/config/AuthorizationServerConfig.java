package com.openframe.authz.config;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.openframe.authz.config.tenant.TenantForwardedPrefixFilter;
import com.openframe.authz.keys.TenantKeyService;
import com.openframe.authz.security.ProviderAwareAuthenticationEntryPoint;
import com.openframe.authz.security.grant.AppleNativeGrantAuthenticationConverter;
import com.openframe.authz.security.grant.AppleNativeGrantAuthenticationProvider;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.sso.apple.AppleAuthorizationCodeClient;
import com.openframe.authz.service.sso.apple.AppleNativeTokenVerifier;
import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserRole;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2AccessTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2RefreshTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.util.Locale;

import static com.openframe.authz.config.tenant.TenantContext.getTenantId;

/**
 * OAuth2 Authorization Server Configuration
 */
@Configuration
@EnableWebSecurity
@Slf4j
public class AuthorizationServerConfig {

    @Bean
    @Order(1)
    public SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            SsoProviderRegistry ssoProviderRegistry,
            AppleNativeTokenVerifier appleNativeTokenVerifier,
            AppleAuthorizationCodeClient appleAuthorizationCodeClient,
            SsoOidcUserService ssoOidcUserService,
            UserService userService,
            OAuth2AuthorizationService authorizationService,
            OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) throws Exception {

        // Constructed inline ON PURPOSE — never expose an AuthenticationProvider as a bean: Spring
        // Boot then makes it the global AuthenticationManager's ONLY provider and skips wiring the
        // UserDetailsService DaoAuthenticationProvider, which silently breaks every password login
        // with an instant ProviderNotFoundException.
        var appleNativeGrantAuthenticationProvider = new AppleNativeGrantAuthenticationProvider(
                appleNativeTokenVerifier, appleAuthorizationCodeClient, ssoOidcUserService,
                userService, authorizationService, tokenGenerator);

        var as = new OAuth2AuthorizationServerConfigurer();
        AuthorizationServerSettings settings = AuthorizationServerSettings
                .builder()
                .multipleIssuersAllowed(true)
                .build();

        http.with(as, config -> {
            config.oidc(Customizer.withDefaults());
            config.authorizationServerSettings(settings);
            // Native Sign in with Apple: the iOS app's identity token + single-use code are
            // exchanged for OpenFrame tokens at this same token endpoint, so minting, claims,
            // persistence and refresh reuse the standard machinery.
            config.tokenEndpoint(token -> token
                    .accessTokenRequestConverter(new AppleNativeGrantAuthenticationConverter())
                    .authenticationProvider(appleNativeGrantAuthenticationProvider));
        });
        var endpoints = as.getEndpointsMatcher();

        return http
                .securityMatcher(endpoints)
                .authorizeHttpRequests(a -> a.anyRequest().authenticated())
                .csrf(csrf -> csrf.ignoringRequestMatchers(endpoints))
                .cors(AbstractHttpConfigurer::disable)
                .exceptionHandling(ex -> ex.defaultAuthenticationEntryPointFor(
                        new ProviderAwareAuthenticationEntryPoint(ssoProviderRegistry),
                        new MediaTypeRequestMatcher(MediaType.TEXT_HTML)))
                .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
                .build();
    }

    @Bean
    public FilterRegistrationBean<ForwardedHeaderFilter> forwardedHeaderFilter() {
        var reg = new FilterRegistrationBean<>(new ForwardedHeaderFilter());
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return reg;
    }

    @Bean
    public FilterRegistrationBean<TenantForwardedPrefixFilter> tenantForwardedPrefixFilter() {
        var reg = new FilterRegistrationBean<>(new TenantForwardedPrefixFilter());
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 15);
        return reg;
    }

    @Bean
    public JWKSource<SecurityContext> jwkSource(TenantKeyService tenantKeyService) {
        return (jwkSelector, securityContext) -> {
            String tenantId = getTenantId();
            if (tenantId == null || tenantId.isBlank()) {
                log.error("JWKS request without resolved tenant id");
                throw new IllegalStateException("Tenant id not resolved for JWK request");
            }
            RSAKey tenantKey = tenantKeyService.getOrCreateActiveKey(tenantId);
            String kid = tenantKey.getKeyID();
            log.debug("Serving JWKS for tenantId='{}' with kid='{}'", tenantId, kid);
            return jwkSelector.select(new JWKSet(tenantKey));
        };
    }

    /**
     * Mirrors Spring Authorization Server's default generator composition (JWT access tokens via
     * the tenant-keyed encoder + customizer, opaque refresh tokens) as an explicit bean so custom
     * grants — the native Apple exchange — mint through the exact same path as the built-in ones.
     */
    @Bean
    public OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator(JwtEncoder jwtEncoder,
                                                                      OAuth2TokenCustomizer<JwtEncodingContext> tokenCustomizer) {
        JwtGenerator jwtGenerator = new JwtGenerator(jwtEncoder);
        jwtGenerator.setJwtCustomizer(tokenCustomizer);
        OAuth2AccessTokenGenerator accessTokenGenerator = new OAuth2AccessTokenGenerator();
        OAuth2RefreshTokenGenerator refreshTokenGenerator = new OAuth2RefreshTokenGenerator();
        return new DelegatingOAuth2TokenGenerator(
                jwtGenerator, accessTokenGenerator, refreshTokenGenerator);
    }

    @Bean
    public JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource) {
        return OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource);
    }

    @Bean
    public JwtEncoder jwtEncoder(JWKSource<SecurityContext> jwkSource) {
        return new NimbusJwtEncoder(jwkSource);
    }

    /**
     * JWT token customizer to add custom claims
     */
    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> tokenCustomizer(UserService userService) {
        return context -> {
            Authentication authentication = context.getPrincipal();
            String tenantId = getTenantId();

            String username = authentication != null ? authentication.getName().toLowerCase(Locale.ROOT) : null;

            AuthUser user = userService
                    .findActiveByEmailAndTenant(username, tenantId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

            if ("access_token".equals(context.getTokenType().getValue())) {
                try {
                    if (context.getAuthorizationGrantType() != null
                            && "refresh_token".equals(context.getAuthorizationGrantType().getValue())) {
                        userService.touchLastLogin(user.getEmail(), tenantId);
                    }
                } catch (Exception e) {
                    log.warn("Failed to update lastLogin on refresh token: {}", e.getMessage());
                }

                context.getClaims().claims(claims -> {
                    claims.put("tenant_id", tenantId);
                    claims.put("userId", user.getId());

                    claims.put("roles", UserRole.effective(user.getRoles()).stream()
                            .map(UserRole::name).toList());
                });
            }
        };
    }


    /**
     * UserDetailsService for Spring Security authentication
     */
    @Bean
    public UserDetailsService userDetailsService(UserService userService) {
        return username -> {
            String tenantId = getTenantId();
            AuthUser user = userService.findActiveByEmailAndTenant(username.toLowerCase(Locale.ROOT), tenantId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

            // SSO-provisioned users may have no usable password hash; {noop} here would make the
            // EMPTY password valid for them. Absent hash = password login unavailable, full stop.
            if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
                throw new UsernameNotFoundException("Password login not available for: " + username);
            }

            return User.builder()
                    .username(user.getEmail())
                    .password(user.getPasswordHash())
                    .authorities(user.getRoles().stream()
                            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                            .toList())
                    .accountExpired(false)
                    .accountLocked(false)
                    .credentialsExpired(false)
                    .disabled(false)
                    .build();
        };
    }

    /**
     * Password encoder for secure password hashing
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * AuthenticationManager for programmatic authentication (e.g., in RegistrationController).
     * Uses our UserDetailsService and PasswordEncoder.
     */
    @Bean
    public AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
                                                       PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }
}

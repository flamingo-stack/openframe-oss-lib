package com.openframe.api.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider;
import org.springframework.security.oauth2.server.resource.authentication.JwtIssuerAuthenticationManagerResolver;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security configuration for OpenFrame API service.
 * <p>
 * Minimal configuration since Gateway already handles authentication/authorization.
 * This config only enables OAuth2 Resource Server for @AuthenticationPrincipal support.
 * <p>
 * Gateway is responsible for:
 * - JWT validation and filtering
 * - PermitAll path handling
 * - Adding Authorization headers from cookies
 */
@Configuration
@EnableWebSecurity
@Slf4j
public class SecurityConfig {

    @Value("${openframe.security.jwt.cache.expire-after}")
    private java.time.Duration expireAfter;

    @Value("${openframe.security.jwt.cache.refresh-after}")
    private java.time.Duration refreshAfter;

    @Value("${openframe.security.jwt.cache.maximum-size}")
    private long maximumSize;

    @Bean
    public LoadingCache<String, JwtAuthenticationProvider> jwtProviderCache() {
        return Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(expireAfter)
                .refreshAfterWrite(refreshAfter)
                .build(issuer -> {
                    log.info("Creating JwtDecoder for issuer: {}", issuer);
                    var decoder = JwtDecoders.fromIssuerLocation(issuer);
                    return new JwtAuthenticationProvider(decoder);
                });
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, LoadingCache<String, JwtAuthenticationProvider> jwtProviderCache) throws Exception {
        JwtIssuerAuthenticationManagerResolver issuerResolver = new JwtIssuerAuthenticationManagerResolver(
                issuer -> jwtProviderCache.get(issuer)::authenticate
        );
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.authenticationManagerResolver(issuerResolver))
                .build();
    }
} 
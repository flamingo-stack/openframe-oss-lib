package com.openframe.authz.config;

import com.openframe.authz.security.AuthSuccessHandler;
import com.openframe.authz.security.SsoAuthorizationRequestResolver;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import com.openframe.authz.web.AuthErrorResponder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.ObjectPostProcessor;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.client.oidc.authentication.OidcAuthorizationCodeAuthenticationProvider;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenValidator;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Security configuration for all non-Authorization-Server requests: the login page, form login,
 * and OAuth2/OIDC login against the external SSO providers.
 * <p>
 * User loading and auto-provisioning live in
 * {@link com.openframe.authz.service.sso.SsoOidcUserService}; this class only wires the chain.
 */
@Configuration
@EnableWebSecurity
@Slf4j
public class SecurityConfig {

    @Bean
    @Order(2)
    public SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http,
                                                          OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService,
                                                          AuthSuccessHandler authSuccessHandler,
                                                          ClientRegistrationRepository clientRegistrationRepository,
                                                          SsoCookieCodec ssoCookieCodec,
                                                          AuthenticationFailureHandler oauth2LoginFailureHandler,
                                                          JwtDecoderFactory<ClientRegistration> ssoJwtDecoderFactory,
                                                          SsoProviderRegistry ssoProviderRegistry) throws Exception {
        return http
                // Scoped to the one cookie-authenticated form POST on this chain. Everything else is
                // either OAuth (client-authenticated or GET) or JSON-only, which a cross-site form
                // cannot reach: it can't set application/json, and fetch preflights against disabled CORS.
                .csrf(csrf -> csrf.requireCsrfProtectionMatcher(new AntPathRequestMatcher("/login", "POST")))
                .cors(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/oauth/**",
                                "/invitations/**",
                                "/password-reset/**",
                                "/email/verify/**",
                                "/oauth2/**",
                                "/login",
                                "/favicon.ico",
                                "/tenant/**",
                                "/management/**",
                                "/.well-known/**",
                                "/error",
                                "/sso/providers/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .successHandler(authSuccessHandler)
                        .permitAll())
                .oauth2Login(o -> o
                        .loginPage("/login")
                        .failureHandler(oauth2LoginFailureHandler)
                        .authorizationEndpoint(a -> a.authorizationRequestResolver(
                                new SsoAuthorizationRequestResolver(clientRegistrationRepository, ssoCookieCodec, ssoProviderRegistry)
                        ))
                        .userInfoEndpoint(u -> u.oidcUserService(oidcUserService))
                        .successHandler(authSuccessHandler)
                        .withObjectPostProcessor(new ObjectPostProcessor<OidcAuthorizationCodeAuthenticationProvider>() {
                            @Override
                            public <O extends OidcAuthorizationCodeAuthenticationProvider> O postProcess(O provider) {
                                provider.setJwtDecoderFactory(ssoJwtDecoderFactory);
                                return provider;
                            }
                        })
                )
                .build();
    }

    @Bean
    public AuthenticationFailureHandler oauth2LoginFailureHandler(AuthErrorResponder authErrorResponder) {
        return (HttpServletRequest request, HttpServletResponse response, AuthenticationException exception) ->
                authErrorResponder.send(response, request, "oauth2-login", exception,
                        "SSO login failed. Please try again.");
    }

    /** One entry per distinct SSO config (its cache key), NOT per login — bounded by active configs. */
    private final Map<String, JwtDecoder> ssoDecoderCache = new ConcurrentHashMap<>();

    /**
     * Builds the ID-token decoder for whichever provider the registration belongs to, supplying the
     * full OIDC validator set (providers needing more add it from their own strategy — see
     * {@link com.openframe.authz.service.auth.strategy.ClientRegistrationStrategy#idTokenValidator}).
     * <p>
     * Decoders are cached on a key capturing everything that distinguishes two registrations —
     * {@code clientId} (the {@code aud} check), {@code jwkSetUri} and {@code issuerUri}. Spring's own
     * {@code OidcIdTokenDecoderFactory} keys only on {@code registrationId}, a per-provider constant
     * here (registrations are built per TENANT under "google"/"microsoft"/"apple"), so it would pin
     * the first tenant's client onto the pod for everyone. This key reuses a decoder — keeping the
     * JWKS keys cached process-wide — while rebuilding whenever a tenant's clientId, JWKS URI or
     * issuer differs or is rotated; a rotated config's stale entry is harmless and rare.
     */
    @Bean
    public JwtDecoderFactory<ClientRegistration> ssoJwtDecoderFactory(SsoProviderRegistry ssoProviderRegistry) {
        return clientRegistration -> {
            String jwkSetUri = clientRegistration.getProviderDetails().getJwkSetUri();
            String issuer = clientRegistration.getProviderDetails().getIssuerUri();
            String cacheKey = clientRegistration.getRegistrationId()
                    + "|" + clientRegistration.getClientId()
                    + "|" + jwkSetUri
                    + "|" + issuer;
            return ssoDecoderCache.computeIfAbsent(cacheKey, k -> {
                // EVERY provider gets the full OIDC validator set — the audience check is what
                // stops an ID token minted for any other application. Registrations that pin an
                // issuer (Google, Apple) get it enforced; Microsoft's varies per directory and is
                // validated by its registry pattern instead.
                List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
                validators.add(issuer != null && !issuer.isBlank()
                        ? JwtValidators.createDefaultWithIssuer(issuer)
                        : JwtValidators.createDefault());
                validators.add(new OidcIdTokenValidator(clientRegistration));
                ssoProviderRegistry.idTokenValidator(clientRegistration).ifPresent(validators::add);

                NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
                decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
                return decoder;
            });
        };
    }
}

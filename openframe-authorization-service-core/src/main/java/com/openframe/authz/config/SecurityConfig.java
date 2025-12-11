package com.openframe.authz.config;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.security.SsoAuthorizationRequestResolver;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoTenantRegistrationSuccessHandler;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.ObjectPostProcessor;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.client.oidc.authentication.OidcAuthorizationCodeAuthenticationProvider;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenValidator;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.authz.util.OidcUserUtils.stringClaim;
import static com.openframe.data.document.user.UserRole.ADMIN;
import static java.util.Locale.ROOT;

/**
 * Security Configuration for Default Requests
 * This handles all non-Authorization Server requests
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    public static final String EMAIL = "email";
    public static final String SUB = "sub";
    private static final Pattern MS_ISSUER_PATTERN =
            Pattern.compile("^https://login\\.microsoftonline\\.com/[^/]+/v2\\.0/?$");

    @Bean
    @Order(2)
    public SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http,
                                                          OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService,
                                                          SsoTenantRegistrationSuccessHandler ssoSuccessHandler,
                                                          ClientRegistrationRepository clientRegistrationRepository,
                                                          SsoCookieCodec ssoCookieCodec) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/oauth/**",
                                "/invitations/**",
                                "/password-reset/**",
                                "/oauth2/**",
                                "/login",
                                "/favicon.ico",
                                "/tenant/**",
                                "/management/v1/**",
                                "/.well-known/**",
                                "/error",
                                "/sso/providers/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form.loginPage("/login").permitAll())
                .oauth2Login(o -> o
                        .loginPage("/login")
                        .authorizationEndpoint(a -> a.authorizationRequestResolver(
                                new SsoAuthorizationRequestResolver(clientRegistrationRepository, ssoCookieCodec)
                        ))
                        .userInfoEndpoint(u -> u.oidcUserService(oidcUserService))
                        .successHandler(ssoSuccessHandler)
                        .withObjectPostProcessor(new ObjectPostProcessor<OidcAuthorizationCodeAuthenticationProvider>() {
                            @Override
                            public <O extends OidcAuthorizationCodeAuthenticationProvider> O postProcess(O provider) {
                                provider.setJwtDecoderFactory(microsoftAwareJwtDecoderFactory());
                                return provider;
                            }
                        })
                )
                .build();
    }

    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService(SSOConfigService ssoConfigService,
                                                                        UserService userService,
                                                                        GlobalDomainPolicyLookup globalDomainPolicyLookup,
                                                                        RegistrationProcessor registrationProcessor) {
        OidcUserService delegate = new OidcUserService();
        return userRequest -> {
            OidcUser user = delegate.loadUser(userRequest);

            autoProvisionIfNeeded(userRequest, user, ssoConfigService, userService, globalDomainPolicyLookup, registrationProcessor);

            Set<GrantedAuthority> authorities = new HashSet<>(user.getAuthorities());

            String nameKey = resolvePreferredPrincipalClaim(user);

            OidcUserInfo userInfo = user.getUserInfo() != null
                    ? user.getUserInfo()
                    : new OidcUserInfo(user.getClaims());

            return new DefaultOidcUser(authorities, userRequest.getIdToken(), userInfo, nameKey);
        };
    }

    @Bean
    public JwtDecoderFactory<ClientRegistration> microsoftAwareJwtDecoderFactory() {
        return clientRegistration -> {
            String registrationId = clientRegistration.getRegistrationId();
            String issuer = clientRegistration.getProviderDetails().getIssuerUri();
            String jwkSetUri = clientRegistration.getProviderDetails().getJwkSetUri();

            if (!"microsoft".equals(registrationId)) {
                if (issuer != null && !issuer.isBlank()) {
                    return JwtDecoders.fromIssuerLocation(issuer);
                }
                return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
            }

            NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
            OAuth2TokenValidator<Jwt> timestamps = JwtValidators.createDefault();
            OAuth2TokenValidator<Jwt> oidcStandard = new OidcIdTokenValidator(clientRegistration);
            OAuth2TokenValidator<Jwt> microsoftIssuerPatternValidator = token -> {
                String iss = token.getIssuer() != null ? token.getIssuer().toString() : null;
                if (iss != null && MS_ISSUER_PATTERN.matcher(iss).matches()) {
                    return OAuth2TokenValidatorResult.success();
                }
                return OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_id_token", "Invalid issuer for Microsoft multi-tenant", null));
            };
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamps, oidcStandard, microsoftIssuerPatternValidator));
            return decoder;
        };
    }

    private void autoProvisionIfNeeded(OidcUserRequest userRequest,
                                       OidcUser user,
                                       SSOConfigService ssoConfigService,
                                       UserService userService,
                                       GlobalDomainPolicyLookup globalDomainPolicyLookup,
                                       RegistrationProcessor registrationProcessor) {
        try {
            String tenantId = TenantContext.getTenantId();
            String provider = userRequest.getClientRegistration().getRegistrationId();
            if (tenantId == null || provider == null) {
                return;
            }
            String email = resolveEmail(user);
            if (email == null || email.isBlank()) {
                return;
            }

            String normalizedEmail = email.toLowerCase(ROOT);

            ssoConfigService
                    .getSSOConfig(tenantId, provider)
                    .filter(SSOPerTenantConfig::isEnabled)
                    .ifPresentOrElse(cfg -> {
                        if (!cfg.isAutoProvisionUsers()) {
                            return;
                        }
                        if (isEmailAllowedByDomains(cfg.getAllowedDomains(), email)) {
                            if (userService.findActiveByEmailAndTenant(normalizedEmail, tenantId).isEmpty()) {
                                AuthUser created = registerUser(userService, tenantId, email, user);
                                registrationProcessor.postProcessAutoProvision(created);
                            }
                        }
                    }, () -> {
                        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(ROOT);
                        if (userService
                                .findActiveByEmailAndTenant(normalizedEmail, tenantId)
                                .isEmpty()) {
                            globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed(domain)
                                    .ifPresent(mappedTenantId -> {
                                        if (tenantId.equals(mappedTenantId)) {
                                            AuthUser created = registerUser(userService, tenantId, email, user);
                                            registrationProcessor.postProcessAutoProvision(created);
                                        }
                                    });
                        }
                    });
        } catch (Exception ignored) {
            // Do not block login flow if provisioning has a non-critical issue
        }
    }

    private AuthUser registerUser(UserService userService, String tenantId, String email, OidcUser user) {
        String givenName = stringClaim(user.getClaims().get("given_name"));
        String familyName = stringClaim(user.getClaims().get("family_name"));
        String password = UUID.randomUUID().toString();
        return userService.registerUser(tenantId, email, givenName, familyName, password, List.of(ADMIN));
    }

    /**
     * Select the preferred claim to use as principal name:
     * email -> preferred_username -> upn -> unique_name -> sub
     */
    private String resolvePreferredPrincipalClaim(OidcUser user) {
        var claims = user.getClaims();
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return EMAIL;
        }
        Object preferred = claims.get("preferred_username");
        if (preferred instanceof String s && !s.isBlank()) {
            return "preferred_username";
        }
        Object upn = claims.get("upn");
        if (upn instanceof String s2 && !s2.isBlank()) {
            return "upn";
        }
        Object uniq = claims.get("unique_name");
        if (uniq instanceof String s3 && !s3.isBlank()) {
            return "unique_name";
        }
        return SUB;
    }


    private boolean isEmailAllowedByDomains(List<String> allowedDomains, String email) {
        if (allowedDomains == null || allowedDomains.isEmpty()) {
            return false;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1)
                .toLowerCase(ROOT);
        return allowedDomains.stream()
                .map(d -> d.toLowerCase(ROOT))
                .anyMatch(domain::equals);
    }
}
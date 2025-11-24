package com.openframe.authz.config;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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

    @Bean
    @Order(2)
    public SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http,
                                                          OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService) throws Exception {
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
                                "/error"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form.loginPage("/login").permitAll())
                .oauth2Login(o -> o
                        .loginPage("/login")
                        .userInfoEndpoint(u -> u.oidcUserService(oidcUserService))
                )
                .build();
    }

    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService(SSOConfigService ssoConfigService,
                                                                         UserService userService) {
        OidcUserService delegate = new OidcUserService();
        return userRequest -> {
            OidcUser user = delegate.loadUser(userRequest);

            autoProvisionIfNeeded(userRequest, user, ssoConfigService, userService);

            Set<GrantedAuthority> authorities = new HashSet<>(user.getAuthorities());

            String nameKey = (user.getEmail() != null && !user.getEmail().isBlank()) ? EMAIL : SUB;

            OidcUserInfo userInfo = user.getUserInfo() != null
                    ? user.getUserInfo()
                    : new OidcUserInfo(user.getClaims());

            return new DefaultOidcUser(authorities, userRequest.getIdToken(), userInfo, nameKey);
        };
    }

    private void autoProvisionIfNeeded(OidcUserRequest userRequest,
                                       OidcUser user,
                                       SSOConfigService ssoConfigService,
                                       UserService userService) {
        // Auto-provision user if provider is configured with autoProvisionUsers=true
        try {
            String tenantId = TenantContext.getTenantId();
            String provider = userRequest.getClientRegistration().getRegistrationId();
            if (tenantId != null && provider != null) {
                ssoConfigService.getSSOConfig(tenantId, provider)
                        .filter(SSOPerTenantConfig::isEnabled)
                        .ifPresent(cfg -> {
                            if (!cfg.isAutoProvisionUsers()) {
                                return;
                            }
                            String email = user.getEmail();
                            if (email != null && !email.isBlank()) {
                                if (!isEmailAllowedByDomains(cfg.getAllowedDomains(), email)) {
                                    return;
                                }
                                boolean exists = userService.findActiveByEmailAndTenant(email.toLowerCase(ROOT), tenantId).isPresent();
                                if (!exists) {
                                    String givenName = valueOrNull(user.getClaims().get("given_name"));
                                    String familyName = valueOrNull(user.getClaims().get("family_name"));
                                    String password = UUID.randomUUID().toString();
                                    userService.registerUser(
                                            tenantId,
                                            email,
                                            givenName,
                                            familyName,
                                            password,
                                            List.of(ADMIN)
                                    );
                                }
                            }
                        });
            }
        } catch (Exception ignored) {
            // Do not block login flow if provisioning has a non-critical issue
        }
    }

    private static String valueOrNull(Object claim) {
        return claim instanceof String s && !s.isBlank() ? s : null;
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
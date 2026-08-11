package com.openframe.security.config;

import com.openframe.security.authentication.AuthPrincipal;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Optional;

@Configuration
public class AuditorAwareConfig {

    private static final String SYSTEM_AUDITOR = "system";

    @Bean
    @ConditionalOnMissingBean(AuditorAware.class)
    public AuditorAware<String> auditorAware() {
        return () -> Optional.of(currentUserId());
    }

    private String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String userId = AuthPrincipal.fromJwt(jwtAuth.getToken()).getId();
            if (userId != null) {
                return userId;
            }
        }
        return SYSTEM_AUDITOR;
    }
}

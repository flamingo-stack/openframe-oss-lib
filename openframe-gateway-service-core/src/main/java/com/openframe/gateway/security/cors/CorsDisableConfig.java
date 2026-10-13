package com.openframe.gateway.security.cors;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

// SaaS-only: permissive CORS is safe because frontend and backend share a domain; never enable for OSS multi-origin deployments.
@Slf4j
@Configuration
@ConditionalOnProperty(
        name = "openframe.gateway.disable-cors",
        havingValue = "true"
)
public class CorsDisableConfig {

  @Bean
  @Primary
  public CorsWebFilter disabledCorsWebFilter() {
    log.info("CORS restrictions disabled - allowing all origins with credentials");
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

    CorsConfiguration config = new CorsConfiguration();
    config.setAllowCredentials(true);
    config.addAllowedOriginPattern("*");
    config.addAllowedMethod("*");
    config.addAllowedHeader("*");
    config.setMaxAge(3600L);

    source.registerCorsConfiguration("/**", config);

    return new CorsWebFilter(source);
  }
}

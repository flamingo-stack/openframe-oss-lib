package com.openframe.api.config;

import com.openframe.gatewayauth.GatewayAuthSecurityConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import(GatewayAuthSecurityConfig.class)
public class SecurityConfig {
}

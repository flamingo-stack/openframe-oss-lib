package com.openframe.data.config;

import io.lettuce.core.MaintNotificationsConfig;
import org.springframework.boot.data.redis.autoconfigure.LettuceClientOptionsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Lettuce 7 sends CLIENT MAINT_NOTIFICATIONS ON on every new connection by default. Valkey has no such
 * subcommand and answers ERR, which Lettuce ignores but Memorystore counts as a command error, so every
 * rollout trips the Valkey command-errors alert. Not gated on spring.redis.enabled: Boot builds the
 * Lettuce connection whenever a service has a Redis host.
 */
@Configuration
public class LettuceClientConfig {

    @Bean
    public LettuceClientOptionsBuilderCustomizer disableMaintNotifications() {
        return builder -> builder.maintNotificationsConfig(MaintNotificationsConfig.disabled());
    }
}

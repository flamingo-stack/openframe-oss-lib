package com.openframe.client.config;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ShedLock + {@code @Scheduled} wiring for cron jobs that live in client-service — the RMM
 * schedule sweep and the {@code ScriptExecution} watchdog. Redis-backed so multiple client
 * replicas can compete for the lock and each fire runs on exactly one pod.
 */
@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(
            RedisConnectionFactory connectionFactory,
            OpenframeRedisKeyBuilder keyBuilder,
            @Value("${openframe.shedlock.environment:default}") String environment
    ) {
        // Tenant-scoped key: of:{tenantId}:job-lock:<environment>:<lockName>
        String keyPrefix = keyBuilder.tenantKey("job-lock");
        return new RedisLockProvider(connectionFactory, environment, keyPrefix);
    }
}

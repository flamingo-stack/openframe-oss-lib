package com.openframe.management.config;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.scheduling.annotation.EnableScheduling;

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
        // Make ShedLock keys tenant-scoped:
        // of:{tenantId}:job-lock:<environment>:<lockName>
        String keyPrefix = keyBuilder.tenantKey("job-lock");
        return new RedisLockProvider(connectionFactory, environment, keyPrefix);
    }
} 
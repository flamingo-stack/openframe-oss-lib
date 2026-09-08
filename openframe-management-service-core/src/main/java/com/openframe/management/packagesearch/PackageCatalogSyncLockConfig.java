package com.openframe.management.packagesearch;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;

@Configuration
@ConditionalOnProperty(name = "openframe.package-search.sync.enabled", havingValue = "true")
public class PackageCatalogSyncLockConfig {

    @Bean
    public LockingTaskExecutor packageCatalogSyncLockExecutor(
            RedisConnectionFactory connectionFactory,
            OpenframeRedisKeyBuilder keyBuilder,
            @Value("${openframe.shedlock.environment:default}") String environment) {
        String keyPrefix = keyBuilder.globalKey("job-lock");
        RedisLockProvider lockProvider = new RedisLockProvider(connectionFactory, environment, keyPrefix);
        return new DefaultLockingTaskExecutor(lockProvider);
    }
}

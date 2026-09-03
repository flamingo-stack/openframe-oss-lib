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
class PackageCatalogSyncLockConfig {

    // the catalog is one shared copy per environment, so this lock must span tenants —
    // deliberately NOT the tenant-scoped key ShedLockConfig builds for @SchedulerLock jobs
    @Bean
    LockingTaskExecutor packageCatalogSyncLockExecutor(
            RedisConnectionFactory connectionFactory,
            OpenframeRedisKeyBuilder keyBuilder,
            @Value("${openframe.shedlock.environment:default}") String environment) {
        String keyPrefix = keyBuilder.tenantKey("job-lock", "global");
        RedisLockProvider lockProvider = new RedisLockProvider(connectionFactory, environment, keyPrefix);
        return new DefaultLockingTaskExecutor(lockProvider);
    }
}

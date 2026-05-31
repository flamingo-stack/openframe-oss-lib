package com.openframe.data.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@Configuration
@ConditionalOnExpression("${spring.data.mongodb.enabled:false} and ${openframe.tenant-isolation.enabled:false}")
@EnableMongoRepositories(basePackages = "com.openframe.data.repository")
public class TenantAwareSyncConfig {
}

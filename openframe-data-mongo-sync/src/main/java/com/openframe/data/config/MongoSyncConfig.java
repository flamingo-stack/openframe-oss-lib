package com.openframe.data.config;

import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@Configuration
@ConditionalOnExpression("${spring.data.mongodb.enabled:false} and not ${openframe.tenant-isolation.enabled:false}")
@EnableMongoRepositories(
    basePackages = "com.openframe.data.repository",
    excludeFilters = @ComponentScan.Filter(type = FilterType.ANNOTATION, classes = TenantAwareRepository.class)
)
public class MongoSyncConfig {
}

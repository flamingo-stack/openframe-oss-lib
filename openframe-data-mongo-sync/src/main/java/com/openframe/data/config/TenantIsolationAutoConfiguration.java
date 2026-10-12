package com.openframe.data.config;

import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.service.TenantIdProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.convert.MongoConverter;

// Provides the tenant-aware mongoTemplate bean here so tenant-isolation mode is self-contained outside openframe-saas-lib.
@Configuration
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class TenantIsolationAutoConfiguration {

    // @Lazy keeps construction order independent of the TenantIdProvider impl:
    // the proxy is injected here; the real bean resolves on first getTenantId()
    // call (during a query), after the context is ready.
    @Lazy
    @Autowired
    private TenantIdProvider tenantIdProvider;

    @Bean
    @Primary
    public TenantAwareMongoTemplate mongoTemplate(MongoDatabaseFactory mongoDbFactory,
                                                   MongoConverter mongoConverter) {
        return new TenantAwareMongoTemplate(mongoDbFactory, mongoConverter, tenantIdProvider);
    }
}

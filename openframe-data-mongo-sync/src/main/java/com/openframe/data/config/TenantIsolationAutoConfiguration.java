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

@Configuration
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class TenantIsolationAutoConfiguration {

    // @Lazy breaks the cycle:
    // mongoTemplate → TenantIdProvider → TenantClusterRegistrationRepository → mongoTemplate
    // The TenantIdProvider proxy is injected at construction time; the real bean
    // is resolved on first getTenantId() call (during a query), after context is ready.
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

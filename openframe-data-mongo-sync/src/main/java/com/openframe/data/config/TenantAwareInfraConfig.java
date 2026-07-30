package com.openframe.data.config;

import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.service.TenantIdProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;

/**
 * Provides the {@link TenantAwareMongoTemplate} infrastructure bean for
 * tenant-isolation mode. The tenant-aware repository fragments
 * ({@code TenantAwareRepositorySupport} subclasses, gated by the SAME
 * {@code @ConditionalOnProperty}) constructor-require this bean, but nothing in
 * the library defined it — any deployment outside the SaaS wiring failed with
 * "required a bean of type 'com.openframe.data.mongo.TenantAwareMongoTemplate'".
 *
 * <p>The condition deliberately mirrors the fragments' own
 * {@code @ConditionalOnProperty} (NOT a {@code @ConditionalOnExpression}
 * placeholder): both use the Binder's relaxed resolution, so this config is
 * active exactly when the fragments that need it are.
 */
@Configuration
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class TenantAwareInfraConfig {

    /**
     * Named {@code mongoTemplate} (with a type-alias) on purpose: this bean is a
     * {@code MongoOperations}, so Boot's default {@code mongoTemplate}
     * auto-configuration backs off — and the repositories enabled by
     * {@code TenantAwareSyncConfig} resolve {@code mongoOperations} by the
     * default bean NAME {@code mongoTemplate}. In tenant-isolation mode the
     * tenant-aware template IS the mongo template.
     */
    @Bean({"mongoTemplate", "tenantAwareMongoTemplate"})
    @ConditionalOnMissingBean(TenantAwareMongoTemplate.class)
    public TenantAwareMongoTemplate tenantAwareMongoTemplate(MongoDatabaseFactory mongoDbFactory,
                                                             MappingMongoConverter mappingMongoConverter,
                                                             TenantIdProvider tenantIdProvider) {
        return new TenantAwareMongoTemplate(mongoDbFactory, mappingMongoConverter, tenantIdProvider);
    }
}

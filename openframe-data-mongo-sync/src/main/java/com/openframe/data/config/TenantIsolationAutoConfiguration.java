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

/**
 * Provides the {@link TenantAwareMongoTemplate} infrastructure bean for
 * tenant-isolation mode. The tenant-aware repository fragments
 * ({@code TenantAwareRepositorySupport} subclasses, enabled by
 * {@code TenantAwareSyncConfig} under the same flag) constructor-require this
 * bean. Moved here from openframe-saas-lib so tenant-isolation mode is
 * self-contained: any deployment (OSS or SaaS) that flips
 * {@code openframe.tenant-isolation.enabled} gets the template with the
 * {@link TenantIdProvider} on the classpath — {@code DefaultTenantIdProvider}
 * in OSS, {@code SaasTenantIdProvider} in SaaS.
 *
 * <p>Registered via component scan of {@code com.openframe.data.config} only —
 * deliberately NOT listed in AutoConfiguration.imports, which would register
 * the bean twice (see MongoConversionsContributor's note on this duality).
 *
 * <p>Named {@code mongoTemplate} on purpose: this bean is a
 * {@code MongoOperations}, so Boot's default {@code mongoTemplate}
 * auto-configuration backs off, and repositories resolve {@code mongoOperations}
 * by that default bean name. In tenant-isolation mode the tenant-aware template
 * IS the mongo template.
 */
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

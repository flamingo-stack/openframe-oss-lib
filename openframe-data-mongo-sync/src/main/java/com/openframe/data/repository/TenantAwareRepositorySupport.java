package com.openframe.data.repository;

import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;

/**
 * Base class for all custom repository implementations in tenant-side services.
 *
 * Enforces that every custom repository uses TenantAwareMongoTemplate rather than
 * raw MongoTemplate. Provides tenantCriteria() and tenantId() as convenience methods
 * so subclasses never need to inject TenantIdProvider separately.
 *
 * Rules (enforced by ArchUnit in TenantRepositoryArchitectureTest):
 * - All *RepositoryImpl classes in com.openframe.data.repository must extend this class.
 * - No *RepositoryImpl class may declare a field of raw type MongoTemplate.
 */
public abstract class TenantAwareRepositorySupport {

    protected final TenantAwareMongoTemplate mongoTemplate;

    protected TenantAwareRepositorySupport(TenantAwareMongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Criteria scoping queries to the current tenant. Use as first $match in aggregations. */
    protected Criteria tenantCriteria() {
        return mongoTemplate.tenantCriteria();
    }

    /** Current pod's tenantId. Use for composite keys and explicit filters. */
    protected String tenantId() {
        return mongoTemplate.tenantId();
    }
}

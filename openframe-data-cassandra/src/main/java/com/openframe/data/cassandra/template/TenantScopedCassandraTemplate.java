package com.openframe.data.cassandra.template;

import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.cassandra.core.CassandraOperations;
import org.springframework.stereotype.Component;

import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * Cassandra equivalent of {@code PinotQueryBuilder}'s tenant guard.
 * <p>
 * Every read and write through this template is scoped to the current tenant resolved
 * by {@link TenantIdProvider}. Callers that cannot supply a tenant_id are rejected
 * with {@link CassandraTenantException} — there is no escape hatch.
 * <p>
 * Use this for entity-shaped reads/writes against shared-keyspace tables that carry
 * {@code tenant_id} in their primary key. For aggregate / multi-row CQL queries that
 * cannot be expressed through this API, services should still pull tenant_id via
 * {@link #requireTenantId()} and pass it explicitly to a repository {@code @Query}
 * method that includes {@code AND tenant_id = ?N} in its CQL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "spring.data.cassandra.enabled", havingValue = "true")
public class TenantScopedCassandraTemplate {

    private final CassandraOperations delegate;
    private final TenantIdProvider tenantIdProvider;

    /**
     * Resolves the current tenant_id or throws. The single guard point for every
     * Cassandra operation in the codebase.
     */
    public String requireTenantId() {
        String tenantId = tenantIdProvider.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new CassandraTenantException(
                    "tenant_id is required for all Cassandra operations — refusing to operate without a tenant scope");
        }
        return tenantId;
    }

    /**
     * Inserts the entity after stamping it with the current tenant_id.
     * The setter receives the resolved tenant_id and is expected to write it into
     * the entity (typically onto a field of the embedded primary-key class).
     */
    public <T> T insert(T entity, BiConsumer<T, String> tenantIdSetter) {
        String tenantId = requireTenantId();
        tenantIdSetter.accept(entity, tenantId);
        return delegate.insert(entity);
    }

    /**
     * Checks whether an entity with the given primary key exists. The keyBuilder
     * receives the resolved tenant_id and returns the fully-populated key; this keeps
     * callers from constructing keys without tenant_id.
     */
    public <T, K> boolean existsById(Function<String, K> keyBuilder, Class<T> entityType) {
        String tenantId = requireTenantId();
        K key = keyBuilder.apply(tenantId);
        return delegate.selectOneById(key, entityType) != null;
    }

    /**
     * Point lookup by primary key. The keyBuilder receives the resolved tenant_id and
     * returns the fully-populated key; this keeps callers from constructing keys
     * without tenant_id.
     *
     * @throws CassandraEntityNotFoundException if no entity exists for the resolved key
     */
    public <T, K> T getById(Function<String, K> keyBuilder, Class<T> entityType) {
        String tenantId = requireTenantId();
        K key = keyBuilder.apply(tenantId);
        T entity = delegate.selectOneById(key, entityType);
        if (entity == null) {
            throw new CassandraEntityNotFoundException(
                    "No " + entityType.getSimpleName() + " found for the resolved key");
        }
        return entity;
    }
}

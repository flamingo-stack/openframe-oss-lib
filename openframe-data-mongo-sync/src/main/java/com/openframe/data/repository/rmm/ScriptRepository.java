package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for {@link Script} documents.
 *
 * <p>All read/write operations are explicitly tenant-scoped. List/pagination
 * lives on {@link CustomScriptRepository}, which uses MongoTemplate for
 * cursor-style paging.
 */
@Repository
public interface ScriptRepository extends MongoRepository<Script, String>, CustomScriptRepository {

    /**
     * Find a single script by id within the given tenant.
     */
    Optional<Script> findByTenantIdAndId(String tenantId, String id);

    /**
     * Find a single script by name within the given tenant. The compound index
     * {@code (tenantId, name)} guarantees uniqueness.
     */
    Optional<Script> findByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndNameAndIdNot(String tenantId, String name, String excludeId);

    /**
     * Hard-delete a script by id within the given tenant. Returns the number of
     * documents actually removed (0 or 1).
     */
    long deleteByTenantIdAndId(String tenantId, String id);
}

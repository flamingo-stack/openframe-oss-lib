package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

/**
 * Repository for {@link Script} documents.
 *
 * <p>All read/write operations are explicitly tenant-scoped — the default
 *
 */
@Repository
public interface ScriptRepository extends MongoRepository<Script, String> {

    /**
     * Find a single script by id within the given tenant.
     */
    Optional<Script> findByTenantIdAndId(String tenantId, String id);

    /**
     * Find a single script by name within the given tenant. The compound index
     * {@code (tenantId, name)} guarantees uniqueness.
     */
    Optional<Script> findByTenantIdAndName(String tenantId, String name);

    /**
     * Paginated list of all scripts in a tenant.
     */
    Page<Script> findAllByTenantId(String tenantId, Pageable pageable);

    boolean existsByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndNameAndIdNot(String tenantId, String name, String excludeId);

    /**
     * Hard-delete a script by id within the given tenant. Returns the number of
     * documents actually removed (0 if the script did not exist or belonged to
     * a different tenant, 1 otherwise). The non-void return lets the service
     * layer distinguish "not found" from "successfully deleted" without an
     * extra existence check.
     *
     */
    long deleteByTenantIdAndId(String tenantId, String id);
}

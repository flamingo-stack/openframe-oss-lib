package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
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
     * Batch-find scripts by id within the given tenant. Used to resolve the
     * display name of executed scripts in the History list — soft-deleted
     * scripts are deliberately NOT filtered out here, so a History row whose
     * source script was later deleted still resolves its name. Missing ids are
     * simply absent from the result.
     */
    List<Script> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    /**
     * Find a single script by name within the given tenant. Uniqueness under
     * {@code (tenantId, name)} is only enforced for non-{@code DELETED} rows,
     * so this may return a soft-deleted document; callers filter as needed.
     */
    Optional<Script> findByTenantIdAndName(String tenantId, String name);

    /**
     * Duplicate-name check for {@code create}. Ignores {@code DELETED} rows —
     * a soft-deleted script frees its name for reuse. Pass
     * {@code List.of(ACTIVE, ARCHIVED)} to restrict to the visible surface.
     */
    boolean existsByTenantIdAndNameAndStatusIn(String tenantId, String name, Collection<ScriptStatus> statuses);

    /**
     * Rename-collision check for {@code update} — excludes the row being
     * edited from the comparison. Same {@code DELETED}-ignoring semantics as
     * {@link #existsByTenantIdAndNameAndStatusIn}.
     */
    boolean existsByTenantIdAndNameAndIdNotAndStatusIn(String tenantId, String name, String excludeId, Collection<ScriptStatus> statuses);

    /**
     * Hard-delete a script by id within the given tenant. Returns the number of
     * documents actually removed (0 or 1).
     */
    long deleteByTenantIdAndId(String tenantId, String id);
}

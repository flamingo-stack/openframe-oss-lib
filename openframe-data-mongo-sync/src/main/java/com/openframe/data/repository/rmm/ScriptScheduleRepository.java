package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ScriptSchedule} documents.
 *
 * <p>All read/write operations are explicitly tenant-scoped. List/pagination
 * lives on {@link CustomScriptScheduleRepository}, which uses MongoTemplate for
 * cursor-style paging. Mirrors {@link ScriptRepository}.
 */
@Repository
public interface ScriptScheduleRepository
        extends MongoRepository<ScriptSchedule, String>, CustomScriptScheduleRepository {

    /**
     * Find a single schedule by id within the given tenant.
     */
    Optional<ScriptSchedule> findByTenantIdAndId(String tenantId, String id);

    /**
     * Batch-find schedules by id within the given tenant. Missing ids are simply
     * absent from the result.
     */
    List<ScriptSchedule> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    /**
     * Find a single schedule by name within the given tenant. Uniqueness under
     * {@code (tenantId, name)} is only enforced for non-{@code DELETED} rows, so
     * this may return a soft-deleted document; callers filter as needed.
     */
    Optional<ScriptSchedule> findByTenantIdAndName(String tenantId, String name);

    /**
     * Duplicate-name check for {@code create}. Pass {@code List.of(ACTIVE, ARCHIVED)}
     * to ignore soft-deleted rows so a deleted name frees up for reuse.
     */
    boolean existsByTenantIdAndNameAndStatusIn(String tenantId, String name, Collection<ScriptStatus> statuses);

    /**
     * Rename-collision check for {@code update} — excludes the row being edited.
     */
    boolean existsByTenantIdAndNameAndIdNotAndStatusIn(String tenantId, String name, String excludeId, Collection<ScriptStatus> statuses);
}

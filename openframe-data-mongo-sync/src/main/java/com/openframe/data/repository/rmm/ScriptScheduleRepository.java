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

    Optional<ScriptSchedule> findByTenantIdAndId(String tenantId, String id);

    List<ScriptSchedule> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    Optional<ScriptSchedule> findByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndNameAndStatusIn(String tenantId, String name, Collection<ScriptStatus> statuses);

    boolean existsByTenantIdAndNameAndIdNotAndStatusIn(String tenantId, String name, String excludeId, Collection<ScriptStatus> statuses);
}

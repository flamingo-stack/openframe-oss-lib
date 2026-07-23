package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ScriptScheduleMachineAssigned} — the schedule &harr; machine
 * assignment documents. All operations are tenant-scoped.
 */
@Repository
public interface ScriptScheduleMachineAssignedRepository
        extends MongoRepository<ScriptScheduleMachineAssigned, String> {

    Optional<ScriptScheduleMachineAssigned> findByTenantIdAndScriptScheduleId(String tenantId, String scriptScheduleId);

    List<ScriptScheduleMachineAssigned> findByTenantIdAndScriptScheduleIdIn(String tenantId, Collection<String> scriptScheduleIds);

    List<ScriptScheduleMachineAssigned> findByTenantIdAndMachineIdsContaining(String tenantId, String machineId);
}

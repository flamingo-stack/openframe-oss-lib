package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/**
 * Repository for {@link ScriptScheduleMachineAssigned} — the schedule &harr; machine
 * association documents, one per pair. All operations are tenant-scoped.
 */
@Repository
public interface ScriptScheduleMachineAssignedRepository
        extends MongoRepository<ScriptScheduleMachineAssigned, String> {

    List<ScriptScheduleMachineAssigned> findByTenantIdAndScriptScheduleId(String tenantId, String scriptScheduleId);

    List<ScriptScheduleMachineAssigned> findByTenantIdAndScriptScheduleIdIn(String tenantId, Collection<String> scriptScheduleIds);

    List<ScriptScheduleMachineAssigned> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<ScriptScheduleMachineAssigned> findByTenantIdAndMachineIdIn(String tenantId, Collection<String> machineIds);

    long deleteByTenantIdAndScriptScheduleId(String tenantId, String scriptScheduleId);

    long deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(String tenantId, String scriptScheduleId, Collection<String> machineIds);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}

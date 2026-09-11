package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface SoftwareScheduleMachineAssignedRepository
        extends MongoRepository<SoftwareScheduleMachineAssigned, String> {

    List<SoftwareScheduleMachineAssigned> findByTenantIdAndSoftwareScheduleId(String tenantId, String softwareScheduleId);

    List<SoftwareScheduleMachineAssigned> findByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByTenantIdAndSoftwareScheduleId(String tenantId, String softwareScheduleId);

    long deleteByTenantIdAndSoftwareScheduleIdAndMachineIdIn(String tenantId, String softwareScheduleId, Collection<String> machineIds);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}

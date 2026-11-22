package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/** Stores device assignments for software schedules that use a device list. */
@Repository
public interface SoftwareScheduleMachineAssignedRepository
        extends MongoRepository<SoftwareScheduleMachineAssigned, String> {

    List<SoftwareScheduleMachineAssigned> findByTenantIdAndSoftwareScheduleId(String tenantId, String softwareScheduleId);

    List<SoftwareScheduleMachineAssigned> findByTenantIdAndMachineId(String tenantId, String machineId);

    long countByTenantIdAndSoftwareScheduleId(String tenantId, String softwareScheduleId);

    long deleteByTenantIdAndSoftwareScheduleId(String tenantId, String softwareScheduleId);

    long deleteByTenantIdAndSoftwareScheduleIdAndMachineIdIn(String tenantId, String softwareScheduleId, Collection<String> machineIds);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    @ReadPreference("primary")
    boolean existsOnPrimaryByTenantIdAndSoftwareScheduleIdAndMachineId(
            String tenantId, String softwareScheduleId, String machineId);

    @ReadPreference("primary")
    List<SoftwareScheduleMachineAssigned> findOnPrimaryByTenantIdAndSoftwareScheduleId(String tenantId, String softwareScheduleId);
}

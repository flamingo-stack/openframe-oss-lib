package com.openframe.data.service.rmm;

import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Removes what a machine leaves behind in schedules once it is DELETED: its schedule assignments and its
 * first-online dispatch records. Shared by the API status change and the agent's own uninstall.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeletedMachineCleanup {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;

    public void removeFromSchedules(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return;
        }
        long removed = assignedRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        long removedDispatch = onlineDeviceDispatchRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        if (removed > 0) {
            log.info("Removed deleted device {} from {} schedule assignment(s) tenantId={}",
                    machineId, removed, tenantId);
        }
        if (removedDispatch > 0) {
            log.info("Removed first-online dispatch record(s) for deleted machineId={}, count={}", machineId, removedDispatch);
        }
    }
}

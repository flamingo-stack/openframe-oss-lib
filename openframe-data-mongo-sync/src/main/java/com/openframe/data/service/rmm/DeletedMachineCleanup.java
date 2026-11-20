package com.openframe.data.service.rmm;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeletedMachineCleanup {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjectionTrigger projectionTrigger;

    public List<AuditEntry> cleanUpDeletedMachine(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return List.of();
        }
        List<AuditEntry> scheduleRemovals = removeFromSchedules(tenantId, machineId);
        removeFromSoftwareReadModel(tenantId, machineId);
        return scheduleRemovals;
    }

    private List<AuditEntry> removeFromSchedules(String tenantId, String machineId) {
        List<String> scheduleIds = assignedRepository.findByTenantIdAndMachineId(tenantId, machineId).stream()
                .map(ScheduleScriptMachineAssigned::getScriptScheduleId)
                .toList();
        List<AuditEntry> scheduleRemovals = scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds).stream()
                .filter(DeletedMachineCleanup::listsDevices)
                .map(schedule -> scheduleRemovalOf(schedule.getId(), machineId))
                .toList();
        long removed = assignedRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        long removedDispatch = onlineDeviceDispatchRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        if (removed > 0) {
            log.info("Removed deleted device {} from {} schedule assignment(s) tenantId={}",
                    machineId, removed, tenantId);
        }
        if (removedDispatch > 0) {
            log.info("Removed first-online dispatch record(s) for deleted machineId={}, count={}", machineId, removedDispatch);
        }
        return scheduleRemovals;
    }

    private static boolean listsDevices(ScheduleScript schedule) {
        return schedule.getStatus() != ScriptStatus.DELETED
                && schedule.getSelectionMode() == ScheduleDeviceSelectionMode.SPECIFIC;
    }

    private static AuditEntry scheduleRemovalOf(String scheduleId, String machineId) {
        return AuditEntry.builder()
                .action(AuditAction.SCRIPT_SCHEDULE_DEVICES_REMOVE)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(scheduleId)
                .details(Map.of("machineIds", List.of(machineId)))
                .build();
    }

    private void removeFromSoftwareReadModel(String tenantId, String machineId) {
        List<DeviceSoftware> rows = deviceSoftwareRepository.findByTenantIdAndMachineId(tenantId, machineId);
        if (rows.isEmpty()) {
            return;
        }
        Set<Long> affectedTitles = new HashSet<>();
        Set<String> affectedCves = new HashSet<>();
        for (DeviceSoftware row : rows) {
            if (row.getSoftwareTitleId() != null) {
                affectedTitles.add(row.getSoftwareTitleId());
            }
            if (row.getVulnerabilities() != null) {
                affectedCves.addAll(row.getVulnerabilities());
            }
        }

        long removed = deviceSoftwareRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        projectionTrigger.titlesChanged(tenantId, affectedTitles);
        projectionTrigger.cvesChanged(tenantId, affectedCves);

        int titleCount = affectedTitles.size();
        int cveCount = affectedCves.size();
        log.info("Removed {} device_software row(s) for deleted machineId={} tenantId={}; re-projected {} title(s), {} CVE(s)",
                removed, machineId, tenantId, titleCount, cveCount);
    }
}

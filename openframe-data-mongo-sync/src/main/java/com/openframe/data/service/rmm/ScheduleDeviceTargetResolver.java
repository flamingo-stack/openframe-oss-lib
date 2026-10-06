package com.openframe.data.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptMachineAssigned;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleDeviceTargetResolver {

    private final MachineRepository machineRepository;
    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScheduleCriteriaDeviceResolver criteriaResolver;

    public List<String> resolveTargetMachineIds(ScheduleScript schedule) {
        if (schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA) {
            return criteriaResolver.resolveMachineIds(
                    schedule.getTenantId(), schedule.getDeviceCriteria(), schedule.getSupportedPlatforms());
        }
        List<String> assignedIds = assignedRepository
                .findByTenantIdAndScriptScheduleId(schedule.getTenantId(), schedule.getId()).stream()
                .map(ScheduleScriptMachineAssigned::getMachineId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        return keepDispatchable(schedule.getTenantId(), assignedIds);
    }

    private List<String> keepDispatchable(String tenantId, List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return machineIds;
        }
        Set<String> valid = machineRepository.findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .filter(m -> DeviceStatus.DISPATCH_ELIGIBLE.contains(m.getStatus()))
                .map(Machine::getMachineId)
                .collect(Collectors.toSet());
        return machineIds.stream().filter(valid::contains).toList();
    }

    public boolean matchesCriteria(ScheduleScript schedule, Machine machine) {
        if (schedule.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA) {
            return false;
        }
        return criteriaResolver.matches(machine, schedule.getDeviceCriteria(), schedule.getSupportedPlatforms());
    }

    public long countCriteriaMachines(ScheduleScript schedule) {
        return criteriaResolver.count(schedule.getTenantId(), schedule.getDeviceCriteria(), schedule.getSupportedPlatforms());
    }
}

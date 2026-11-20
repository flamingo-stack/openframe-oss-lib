package com.openframe.data.service.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareScheduleTargetResolver {

    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final ScheduleCriteriaDeviceResolver criteriaResolver;
    private final PackageManagerAvailability packageManagerAvailability;
    private final ScheduleDeviceLocalDispatchRepository scheduleDeviceLocalDispatchRepository;

    public List<String> resolveMachineIds(SoftwareSchedule schedule) {
        if (schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA) {
            List<PackageManagerType> enabledManagers = packageManagerAvailability.enabledManagers();
            return criteriaResolver.resolveMachineIds(schedule.getTenantId(), schedule.getDeviceCriteria(), null, enabledManagers);
        }
        return assignedRepository.findByTenantIdAndSoftwareScheduleId(schedule.getTenantId(), schedule.getId()).stream()
                .map(SoftwareScheduleMachineAssigned::getMachineId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    // a device-time schedule keeps no nextRunAt: its one-off run is ahead on a device until that device's run is recorded
    public Map<String, List<String>> resolveMachineIdsAwaitingDeviceTime(List<SoftwareSchedule> schedules) {
        Map<String, Set<String>> ranMachineIds = ranMachineIdsByScheduleId(schedules);
        return schedules.stream()
                .collect(toMap(SoftwareSchedule::getId, schedule -> awaitingMachineIds(schedule, ranMachineIds)));
    }

    private List<String> awaitingMachineIds(SoftwareSchedule schedule, Map<String, Set<String>> ranMachineIds) {
        List<String> machineIds = resolveMachineIds(schedule);
        String scheduleId = schedule.getId();
        Set<String> ran = ranMachineIds.getOrDefault(scheduleId, Set.of());
        return machineIds.stream().filter(machineId -> !ran.contains(machineId)).toList();
    }

    private Map<String, Set<String>> ranMachineIdsByScheduleId(List<SoftwareSchedule> schedules) {
        List<String> oneOffScheduleIds = schedules.stream()
                .filter(schedule -> schedule.getRepeat() == null)
                .map(SoftwareSchedule::getId)
                .toList();
        if (oneOffScheduleIds.isEmpty()) {
            return Map.of();
        }
        return scheduleDeviceLocalDispatchRepository.findByScheduleIdIn(oneOffScheduleIds).stream()
                .filter(run -> run.getLastOccurrenceAt() != null)
                .collect(groupingBy(ScheduleLocalMachineTimeDispatch::getScheduleId,
                        mapping(ScheduleLocalMachineTimeDispatch::getMachineId, toSet())));
    }
}

package com.openframe.data.service.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareScheduleTargetResolver {

    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final ScheduleCriteriaDeviceResolver criteriaResolver;

    public List<String> resolveMachineIds(SoftwareSchedule schedule) {
        if (schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA) {
            return criteriaResolver.resolveMachineIds(schedule.getTenantId(), schedule.getDeviceCriteria(), null);
        }
        return assignedRepository.findByTenantIdAndSoftwareScheduleId(schedule.getTenantId(), schedule.getId()).stream()
                .map(SoftwareScheduleMachineAssigned::getMachineId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }
}

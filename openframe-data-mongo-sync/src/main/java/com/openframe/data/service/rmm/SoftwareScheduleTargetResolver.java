package com.openframe.data.service.rmm;

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

    public List<String> resolveMachineIds(String tenantId, String softwareScheduleId) {
        return assignedRepository.findByTenantIdAndSoftwareScheduleId(tenantId, softwareScheduleId).stream()
                .map(SoftwareScheduleMachineAssigned::getMachineId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }
}

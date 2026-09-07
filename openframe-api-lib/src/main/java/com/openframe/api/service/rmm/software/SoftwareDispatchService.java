package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.software.InstallSoftwareInput;
import com.openframe.api.dto.rmm.software.ScheduleUpdateSoftwareInput;
import com.openframe.api.dto.rmm.software.UninstallSoftwareInput;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.software-management.enabled", havingValue = "true")
public class SoftwareDispatchService {

    public DispatchResponse install(InstallSoftwareInput input, String initiatedBy) {
        log.debug("[software-mgmt stub] install softwareId={} initiatedBy={}", input.getSoftwareId(), initiatedBy);
        return null;
    }

    public DispatchResponse uninstall(UninstallSoftwareInput input, String initiatedBy) {
        log.debug("[software-mgmt stub] uninstall softwareId={} initiatedBy={}", input.getSoftwareId(), initiatedBy);
        return null;
    }

    public DispatchResponse scheduleUpdate(ScheduleUpdateSoftwareInput input, String initiatedBy) {
        log.debug("[software-mgmt stub] scheduleUpdate softwareId={} initiatedBy={} scheduledAt={}",
                input.getSoftwareId(), initiatedBy, input.getScheduledAt());
        return null;
    }

    public DispatchResponse cancelScheduled(String executionId, String actorUserId) {
        log.debug("[software-mgmt stub] cancelScheduled executionId={} actorUserId={}", executionId, actorUserId);
        return null;
    }
}

package com.openframe.management.scheduler;

import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.management.service.FleetMdmSetupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.fleet-mdm.setup.enabled", havingValue = "true")
public class FleetMdmSetupScheduler {

    private static final String FLEETMDM_SERVER = "fleetmdm-server";

    private final IntegratedToolRepository toolRepository;
    private final FleetMdmSetupService fleetMdmSetupService;

    @Scheduled(fixedDelayString = "${openframe.fleet-mdm.setup.scheduler-interval-ms:10000}")
    public void runSetupIfNeeded() {
        try {
            toolRepository.findById(FLEETMDM_SERVER)
                    .ifPresent(fleetMdmSetupService::setupAndSaveApiToken);
        } catch (Exception e) {
            log.error("Fleet MDM setup failed, will retry on next tick: {}", e.getMessage(), e);
        }
    }
}

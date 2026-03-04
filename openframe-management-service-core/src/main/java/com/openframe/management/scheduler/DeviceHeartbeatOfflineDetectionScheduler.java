package com.openframe.management.scheduler;

import com.openframe.management.service.DeviceHeartbeatOfflineDetectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.device.heartbeat.offline-detection.enabled", havingValue = "true")
public class DeviceHeartbeatOfflineDetectionScheduler {

    private final DeviceHeartbeatOfflineDetectionService offlineDetectionService;

    @Scheduled(fixedDelayString = "${openframe.device.heartbeat.offline-detection.interval:60000}")
    public void detectOfflineDevices() {
        log.info("Running heartbeat offline detection sweep");
        try {
            offlineDetectionService.markStaleDevicesOffline();
            log.info("Successfully processed heartbeat offline detection sweep");
        } catch (Exception e) {
            log.error("Heartbeat offline detection sweep failed", e);
        }
    }
}

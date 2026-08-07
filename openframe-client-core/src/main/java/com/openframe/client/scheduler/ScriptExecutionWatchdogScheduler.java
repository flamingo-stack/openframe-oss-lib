package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.watchdog.ScriptExecutionWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.execution.watchdog.enabled", havingValue = "true")
public class ScriptExecutionWatchdogScheduler {

    private final ScriptExecutionWatchdogService watchdogService;

    @Scheduled(fixedDelayString = "${openframe.rmm.execution.watchdog.interval:60000}")
    public void sweep() {
        log.debug("Running Execution watchdog sweep");
        try {
            watchdogService.markStuckExecutionsAsFailed();
        } catch (Exception e) {
            log.error("Execution watchdog sweep failed", e);
        }
    }
}

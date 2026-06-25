package com.openframe.management.scheduler;

import com.openframe.management.service.ScriptExecutionWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic backstop for Execution rows stuck in {@code RUNNING}. Delegates to
 * {@link ScriptExecutionWatchdogService}; this class is the cron wiring only.
 *
 * <p>Disabled by default — explicitly enable per environment via
 * {@code openframe.rmm.execution.watchdog.enabled=true}. The interval is
 * tuneable via {@code openframe.rmm.execution.watchdog.interval} (millis,
 * default 60s). The stuck-threshold lives on the service —
 * {@code openframe.rmm.execution.watchdog.threshold-seconds} (default 600).
 */
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
            watchdogService.markStuckExecutionsAsFailing();
        } catch (Exception e) {
            log.error("Execution watchdog sweep failed", e);
        }
    }
}

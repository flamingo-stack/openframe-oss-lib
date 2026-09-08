package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.watchdog.ScriptExecutionWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.execution.watchdog.enabled", havingValue = "true")
public class ScriptExecutionWatchdogScheduler {

    private final ScriptExecutionWatchdogService watchdogService;

    @Scheduled(fixedDelayString = "${openframe.rmm.execution.watchdog.interval}")
    @SchedulerLock(name = "scriptExecutionWatchdog",
            lockAtMostFor = "${openframe.rmm.execution.watchdog.lock-at-most-for}",
            lockAtLeastFor = "${openframe.rmm.execution.watchdog.lock-at-least-for}")
    public void sweep() {
        try {
            log.debug("Running stale-execution reap sweep");
            watchdogService.markStuckExecutionsAsFailed();
        } catch (Exception e) {
            log.error("Stuck-execution reap sweep failed", e);
        }
    }
}

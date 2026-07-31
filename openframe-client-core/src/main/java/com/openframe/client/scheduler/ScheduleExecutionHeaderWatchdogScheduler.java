package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.ScheduleExecutionHeaderWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic backstop for {@code ScheduleScriptExecution} header rows stuck in {@code RUNNING} — the
 * companion to {@link ScriptExecutionWatchdogScheduler} on the leaf side. Delegates to
 * {@link ScheduleExecutionHeaderWatchdogService}; this class is the cron wiring only.
 *
 * <p>Disabled by default — enable per environment via
 * {@code openframe.rmm.schedule.watchdog.enabled=true}. Interval is tuneable via
 * {@code openframe.rmm.schedule.watchdog.interval} (millis, default 60s); the stuck-threshold via
 * {@code openframe.rmm.schedule.watchdog.threshold-seconds} (default 900).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.schedule.watchdog.enabled", havingValue = "true")
public class ScheduleExecutionHeaderWatchdogScheduler {

    private final ScheduleExecutionHeaderWatchdogService headerWatchdogService;

    @Scheduled(fixedDelayString = "${openframe.rmm.schedule.watchdog.interval:60000}")
    public void sweep() {
        log.debug("Running schedule-header watchdog sweep");
        try {
            headerWatchdogService.markStuckHeadersAsFailed();
        } catch (Exception e) {
            log.error("Schedule-header watchdog sweep failed", e);
        }
    }
}

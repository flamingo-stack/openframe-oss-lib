package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.watchdog.ScheduleJobExecutionWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.schedule.watchdog.enabled", havingValue = "true")
public class ScheduleJobExecutionWatchdogScheduler {

    private final ScheduleJobExecutionWatchdogService watchdogService;

    @Scheduled(fixedDelayString = "${openframe.rmm.schedule.watchdog.interval:60000}")
    public void sweep() {
        log.debug("Running schedule-header watchdog sweep");
        try {
            watchdogService.markStuckScheduleJobsAsFailed();
        } catch (Exception e) {
            log.error("Schedule-header watchdog sweep failed", e);
        }
    }
}

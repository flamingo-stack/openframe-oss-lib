package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.ScheduleExecutionHeaderWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

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
            headerWatchdogService.markStuckSheduleJobsAsFailed();
        } catch (Exception e) {
            log.error("Schedule-header watchdog sweep failed", e);
        }
    }
}

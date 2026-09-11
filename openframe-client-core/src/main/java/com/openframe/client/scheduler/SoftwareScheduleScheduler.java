package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.SoftwareScheduleExecutionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.schedule.runner.enabled", havingValue = "true")
public class SoftwareScheduleScheduler {

    private final SoftwareScheduleExecutionService softwareScheduleExecutionService;

    @Scheduled(cron = "${openframe.rmm.software-schedule.runner.cron:0 0,30 * * * *}", zone = "UTC")
    @SchedulerLock(
            name = "softwareScheduleRunner",
            lockAtMostFor = "${openframe.rmm.software-schedule.runner.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.rmm.software-schedule.runner.lock-at-least-for:10s}"
    )
    public void run() {
        log.debug("Running software schedule sweep");
        try {
            softwareScheduleExecutionService.runDueSchedules();
        } catch (Exception e) {
            log.error("Software schedule sweep failed", e);
        }
    }
}

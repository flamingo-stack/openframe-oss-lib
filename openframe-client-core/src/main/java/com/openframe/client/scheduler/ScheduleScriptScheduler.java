package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.ScheduleScriptExecutionService;
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
public class ScheduleScriptScheduler {

    private final ScheduleScriptExecutionService scheduleExecutionService;

    @Scheduled(cron = "${openframe.rmm.schedule.runner.cron:0 0,30 * * * *}", zone = "UTC")
    @SchedulerLock(
            name = "scriptScheduleRunner",
            lockAtMostFor = "${openframe.rmm.schedule.runner.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.rmm.schedule.runner.lock-at-least-for:10s}"
    )
    public void run() {
        log.debug("Running script schedule sweep");
        try {
            scheduleExecutionService.runDueSchedules();
        } catch (Exception e) {
            log.error("Script schedule sweep failed", e);
        }
    }
}

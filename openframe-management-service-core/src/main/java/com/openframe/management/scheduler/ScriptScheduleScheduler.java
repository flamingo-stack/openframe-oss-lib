package com.openframe.management.scheduler;

import com.openframe.management.service.ScriptScheduleExecutionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cron wiring for the time-driven RMM schedule runner. Delegates to
 * {@link ScriptScheduleExecutionService}; this class holds only the schedule
 * and the ShedLock guard.
 *
 * <p>Disabled by default — enable per environment via
 * {@code openframe.rmm.schedule.runner.enabled=true}. The poll interval is
 * tuneable via {@code openframe.rmm.schedule.runner.interval} (millis, default
 * 60s). The interval only bounds dispatch latency (how late a due schedule can
 * fire); it is independent of the schedules' own {@code repeatIntervalMinutes}
 * (smallest 30 min).
 *
 * <p>{@link SchedulerLock} serialises the sweep across management replicas so a
 * due schedule is dispatched exactly once per fire even when several pods run.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.schedule.runner.enabled", havingValue = "true")
public class ScriptScheduleScheduler {

    private final ScriptScheduleExecutionService scheduleExecutionService;

    @Scheduled(fixedDelayString = "${openframe.rmm.schedule.runner.interval:60000}")
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

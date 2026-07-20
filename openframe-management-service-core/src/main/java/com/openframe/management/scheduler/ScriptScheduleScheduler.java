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
 * {@code openframe.rmm.schedule.runner.enabled=true}. The cron is tuneable via
 * {@code openframe.rmm.schedule.runner.cron}.
 *
 * <p>The sweep runs <b>on the half-hour grid</b> (xx:00 and xx:30) rather than on a
 * fixed delay, because every schedule is constrained to that same grid: {@code startAt}
 * must land on a boundary and {@code repeat} must be a whole number of 30-minute slots.
 * Ticking on the grid makes a due schedule fire at its slot instead of up to a poll
 * interval late, and keeps firing times identical across restarts (a fixed delay drifts
 * with whenever the pod happened to start). Pinned to UTC so the boundaries do not move
 * with the pod's local zone — offsets like +05:45 would otherwise shift them.
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

package com.openframe.management.service;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Time-driven runner for RMM {@link ScriptSchedule}s — the orchestration layer. Sweeps every
 * ACTIVE schedule that has come due and, for each, fires it and advances its cadence.
 *
 * <p>The dispatch mechanics live in {@link ScheduleFireDispatcher} so this class stays a
 * readable loop; it only owns the sweep, per-schedule error isolation, and the schedule-state
 * bookkeeping ({@code lastRunAt} / {@code nextRunAt} / save).
 *
 * <p>Lives in the management service (like {@code ScriptExecutionWatchdog}) — that is where the
 * scheduled/ShedLock machinery runs. The sweep query is tenant-agnostic (mirrors the watchdog);
 * each due schedule carries its own {@code tenantId}, used verbatim downstream so a run stays
 * within its owning tenant.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptScheduleExecutionService {

    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleFireDispatcher fireDispatcher;

    /**
     * Fire every ACTIVE schedule that is due ({@code nextRunAt <= now}). Each schedule is
     * handled independently: a failure on one is logged and its cadence still advanced, so a
     * single broken schedule can neither wedge the sweep nor hot-loop.
     */
    public void runDueSchedules() {
        Instant now = Instant.now();
        List<ScriptSchedule> due = scheduleRepository.findByStatusAndNextRunAtLessThanEqual(ScriptStatus.ACTIVE, now);
        if (due.isEmpty()) {
            log.debug("No due script schedules");
            return;
        }

        log.info("Found {} due script schedule(s) — running", due.size());
        for (ScriptSchedule schedule : due) {
            try {
                fireDispatcher.dispatch(schedule, now);
                schedule.setLastRunAt(now);
            } catch (Exception e) {
                log.error("Script schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway",
                        schedule.getId(), schedule.getTenantId(), e);
            }
            advanceAndSave(schedule, now);
        }
    }

    private void advanceAndSave(ScriptSchedule schedule, Instant now) {
        schedule.setNextRunAt(nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        scheduleRepository.save(schedule);
    }

    /**
     * Next fire strictly after {@code now}: null/non-positive {@code repeatSeconds} clears it
     * (one-shot); otherwise roll forward from {@code currentNextRun} (or {@code now} on first
     * run) in whole {@code repeatSeconds} steps — collapsing several missed intervals into one.
     */
    private static Instant nextRunAfter(Instant currentNextRun, Long repeatSeconds, Instant now) {
        if (repeatSeconds == null || repeatSeconds <= 0) {
            return null;
        }
        Duration step = Duration.ofSeconds(repeatSeconds);
        Instant next = currentNextRun != null ? currentNextRun : now;
        while (!next.isAfter(now)) {
            next = next.plus(step);
        }
        return next;
    }
}

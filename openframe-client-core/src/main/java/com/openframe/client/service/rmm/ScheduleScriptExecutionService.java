package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleScriptExecutionService {

    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleFireDispatcher fireDispatcher;
    private final DeviceLocalScheduleService deviceLocalScheduleService;

    public void runDueSchedules() {
        Instant now = Instant.now();
        runDueServerSchedules(now);
        deviceLocalScheduleService.runDueDeviceLocalSchedules(now);
    }

    private void runDueServerSchedules(Instant now) {
        List<ScheduleScript> due = scheduleRepository.findByStatusAndNextRunAtLessThanEqual(ScriptStatus.ACTIVE, now);
        if (due.isEmpty()) {
            log.debug("No due script schedules");
            return;
        }

        log.info("Found {} due script schedule(s) — running", due.size());
        for (ScheduleScript schedule : due) {
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

    private void advanceAndSave(ScheduleScript schedule, Instant now) {
        schedule.setNextRunAt(nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        scheduleRepository.save(schedule);
    }

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

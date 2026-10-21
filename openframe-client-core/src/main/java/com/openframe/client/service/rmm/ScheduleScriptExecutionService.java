package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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
            boolean dispatched = false;
            try {
                fireDispatcher.dispatch(schedule, now);
                schedule.setLastRunAt(now);
                dispatched = true;
            } catch (Exception e) {
                log.error("Script schedule run failed scheduleId={} tenantId={} — dispatch did not succeed, nextRunAt will still advance to avoid a stuck schedule",
                        schedule.getId(), schedule.getTenantId(), e);
            }
            if (!dispatched) {
                schedule.setLastRunFailed(true);
            } else {
                schedule.setLastRunFailed(false);
            }
            advanceAndSave(schedule, now);
        }
    }

    private void advanceAndSave(ScheduleScript schedule, Instant now) {
        schedule.setNextRunAt(ScheduleRecurrence.nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        scheduleRepository.save(schedule);
    }
}


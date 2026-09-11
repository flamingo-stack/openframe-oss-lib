package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleExecutionService {

    private final SoftwareScheduleRepository softwareScheduleRepository;
    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final SoftwareScheduleFireDispatcher fireDispatcher;

    public void runDueSchedules() {
        Instant now = Instant.now();
        List<SoftwareSchedule> due = softwareScheduleRepository
                .findByStatusAndNextRunAtLessThanEqual(ScriptStatus.ACTIVE, now);
        if (due.isEmpty()) {
            log.debug("No due software schedules");
            return;
        }

        log.info("Found {} due software schedule(s) — running", due.size());
        for (SoftwareSchedule schedule : due) {
            try {
                fireDispatcher.dispatch(schedule, resolveTargets(schedule), now);
                schedule.setLastRunAt(now);
            } catch (Exception e) {
                log.error("Software schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway",
                        schedule.getId(), schedule.getTenantId(), e);
            }
            advanceAndSave(schedule, now);
        }
    }

    private List<String> resolveTargets(SoftwareSchedule schedule) {
        return assignedRepository
                .findByTenantIdAndSoftwareScheduleId(schedule.getTenantId(), schedule.getId())
                .stream()
                .map(SoftwareScheduleMachineAssigned::getMachineId)
                .toList();
    }

    private void advanceAndSave(SoftwareSchedule schedule, Instant now) {
        schedule.setNextRunAt(nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        softwareScheduleRepository.save(schedule);
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

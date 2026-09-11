package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleExecutionService {

    private final SoftwareScheduleRepository softwareScheduleRepository;
    private final SoftwareScheduleTargetResolver targetResolver;
    private final SoftwareScheduleFireDispatcher fireDispatcher;
    private final SoftwareDeviceLocalScheduleService deviceLocalScheduleService;

    public void runDueSchedules() {
        Instant now = Instant.now();
        runDueServerSchedules(now);
        deviceLocalScheduleService.runDueDeviceLocalSchedules(now);
    }

    private void runDueServerSchedules(Instant now) {
        List<SoftwareSchedule> due = softwareScheduleRepository
                .findByStatusAndNextRunAtLessThanEqual(ScriptStatus.ACTIVE, now);
        if (due.isEmpty()) {
            log.debug("No due software schedules");
            return;
        }

        log.info("Found {} due software schedule(s) — running", due.size());
        for (SoftwareSchedule schedule : due) {
            try {
                List<String> targets = targetResolver.resolveMachineIds(schedule.getTenantId(), schedule.getId());
                fireDispatcher.dispatch(schedule, targets, now);
                schedule.setLastRunAt(now);
            } catch (Exception e) {
                log.error("Software schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway",
                        schedule.getId(), schedule.getTenantId(), e);
            }
            advanceAndSave(schedule, now);
        }
    }

    private void advanceAndSave(SoftwareSchedule schedule, Instant now) {
        schedule.setNextRunAt(ScheduleRecurrence.nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        softwareScheduleRepository.save(schedule);
    }
}

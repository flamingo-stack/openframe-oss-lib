package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleExecutionService {

    private final SoftwareScheduleRepository softwareScheduleRepository;
    private final SoftwareScheduleTargetResolver targetResolver;
    private final SoftwareScheduleFireDispatcher fireDispatcher;
    private final SoftwareDeviceLocalScheduleService deviceLocalScheduleService;
    private final MachineRepository machineRepository;
    private final SoftwareScheduleOnlineDispatchRepository onlineDispatchRepository;

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
                fire(schedule, now);
                schedule.setLastRunAt(now);
            } catch (Exception e) {
                log.error("Software schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway",
                        schedule.getId(), schedule.getTenantId(), e);
            }
            advanceAndSave(schedule, now);
        }
    }

    private void fire(SoftwareSchedule schedule, Instant now) {
        List<String> targets = targetResolver.resolveMachineIds(schedule);
        if (targets == null || targets.isEmpty()) {
            return;
        }
        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(schedule.getTenantId(), new HashSet<>(targets)).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        List<String> online = new ArrayList<>();
        List<String> offline = new ArrayList<>();
        for (String machineId : targets) {
            Machine machine = machinesById.get(machineId);
            if (machine != null && machine.getStatus() == DeviceStatus.ONLINE) {
                online.add(machineId);
            } else {
                offline.add(machineId);
            }
        }

        if (!online.isEmpty()) {
            fireDispatcher.dispatch(schedule, online, now);
        }
        if (!offline.isEmpty()) {
            armReconnect(schedule, offline, now);
        }
    }

    private void armReconnect(SoftwareSchedule schedule, List<String> offlineMachineIds, Instant now) {
        Long window = schedule.getReconnectWindowSeconds();
        if (schedule.getOfflineBehavior() != ScheduleOfflineBehavior.RETRY_ON_RECONNECT
                || window == null || window <= 0) {
            log.debug("Software schedule scheduleId={}: {} offline device(s) skipped (offlineBehavior={})",
                    schedule.getId(), offlineMachineIds.size(), schedule.getOfflineBehavior());
            return;
        }
        Instant expiresAt = now.plusSeconds(window);
        for (String machineId : offlineMachineIds) {
            boolean alreadyArmed = onlineDispatchRepository
                    .findByTenantIdAndMachineIdAndScheduleId(schedule.getTenantId(), machineId, schedule.getId())
                    .isPresent();
            if (alreadyArmed) {
                continue;
            }
            try {
                onlineDispatchRepository.save(SoftwareScheduleOnlineDispatch.builder()
                        .tenantId(schedule.getTenantId())
                        .machineId(machineId)
                        .scheduleId(schedule.getId())
                        .firstSeenAt(now)
                        .expiresAt(expiresAt)
                        .status(DeviceOnlineDispatchStatus.NEW)
                        .build());
            } catch (DuplicateKeyException raced) {
                log.debug("Software schedule reconnect sentinel already armed scheduleId={} machineId={}",
                        schedule.getId(), machineId);
            }
        }
        log.info("Software schedule scheduleId={}: armed {} offline device(s) for reconnect-retry until {}",
                schedule.getId(), offlineMachineIds.size(), expiresAt);
    }

    private void advanceAndSave(SoftwareSchedule schedule, Instant now) {
        schedule.setNextRunAt(ScheduleRecurrence.nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        softwareScheduleRepository.save(schedule);
    }
}

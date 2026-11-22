package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Executes due software schedules and defers eligible offline devices until they reconnect. */
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
    private final ScheduleMutationTransaction scheduleTransaction;

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
        due.forEach(schedule -> runSchedule(schedule, now));
    }

    private void runSchedule(SoftwareSchedule schedule, Instant now) {
        try {
            fire(schedule, now);
            schedule.setLastRunAt(now);
        } catch (Exception e) {
            log.error("Software schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway: {}",
                    schedule.getId(), schedule.getTenantId(), e.getMessage(), e);
        }
        advanceAndSave(schedule, now);
    }

    private void fire(SoftwareSchedule schedule, Instant now) {
        List<String> targets = targetResolver.resolveMachineIds(schedule);
        if (targets == null || targets.isEmpty()) {
            return;
        }
        Map<String, Machine> machinesById = machineRepository
                .findOnPrimaryByTenantIdAndMachineIdIn(schedule.getTenantId(), new HashSet<>(targets)).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        // A device can be reenrolled between the membership and lifecycle reads.
        Set<String> currentTargets = schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA
                ? Set.copyOf(targets) : Set.copyOf(targetResolver.resolveMachineIds(schedule));
        Map<Boolean, List<Machine>> connectedDevices = targets.stream().filter(currentTargets::contains).map(machinesById::get)
                .filter(DeviceDispatchEligibility::isManaged)
                .collect(Collectors.partitioningBy(DeviceDispatchEligibility::isDispatchable));
        List<String> online = connectedDevices.get(true).stream().map(Machine::getMachineId).toList();
        List<Machine> offline = connectedDevices.get(false);

        if (!online.isEmpty()) {
            fireDispatcher.dispatch(schedule, online, now);
        }
        if (!offline.isEmpty()) {
            armReconnect(schedule, offline, now);
        }
    }

    private void armReconnect(SoftwareSchedule schedule, List<Machine> offlineMachines, Instant now) {
        Long window = schedule.getReconnectWindowSeconds();
        if (schedule.getOfflineBehavior() != ScheduleOfflineBehavior.RETRY_ON_RECONNECT
                || window == null || window <= 0) {
            log.debug("Software schedule scheduleId={}: {} offline device(s) skipped (offlineBehavior={})",
                    schedule.getId(), offlineMachines.size(), schedule.getOfflineBehavior());
            return;
        }
        Instant expiresAt = now.plusSeconds(window);
        long armed = offlineMachines.stream().filter(machine -> armReconnectForDevice(schedule, machine, now, expiresAt)).count();
        log.info("Software schedule scheduleId={}: armed {} offline device(s) for reconnect-retry until {}",
                schedule.getId(), armed, expiresAt);
    }

    private boolean armReconnectForDevice(SoftwareSchedule schedule, Machine machine, Instant now, Instant expiresAt) {
        try {
            return scheduleTransaction.run(() -> createPendingReconnect(schedule, machine, now, expiresAt));
        } catch (DuplicateKeyException | OptimisticLockingFailureException raced) {
            log.debug("Skipped stale reconnect: scheduleId={} machineId={}", schedule.getId(), machine.getMachineId());
            return false;
        }
    }

    private boolean createPendingReconnect(SoftwareSchedule schedule, Machine machine, Instant now, Instant expiresAt) {
        String tenantId = schedule.getTenantId();
        String machineId = machine.getMachineId();
        String scheduleId = schedule.getId();
        if (onlineDispatchRepository.findByTenantIdAndMachineIdAndScheduleId(tenantId, machineId, scheduleId).isPresent()) {
            return false;
        }
        boolean stillTargeted = softwareScheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(tenantId, scheduleId, ScriptStatus.ACTIVE)
                .filter(current -> targetResolver.isCurrentTarget(current, machine))
                .isPresent();
        if (!stillTargeted || machineRepository.reserveForSoftwareReconnect(tenantId, machineId, machine.getVersion(),
                DeviceStatus.CONNECTED) == 0) {
            return false;
        }
        onlineDispatchRepository.insert(SoftwareScheduleOnlineDispatch.builder()
                .tenantId(tenantId).machineId(machineId).scheduleId(scheduleId)
                .firstSeenAt(now).expiresAt(expiresAt).status(DeviceOnlineDispatchStatus.NEW).build());
        return true;
    }

    private void advanceAndSave(SoftwareSchedule schedule, Instant now) {
        schedule.setNextRunAt(ScheduleRecurrence.nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        softwareScheduleRepository.save(schedule);
    }
}

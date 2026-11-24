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
import com.openframe.publishing.transaction.MongoTransactionRunner.Transaction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.TransientDataAccessException;
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
        boolean completed;
        try {
            completed = fire(schedule, now);
        } catch (Exception e) {
            advanceAfterFailure(schedule, now, e);
            return;
        }
        if (completed) {
            schedule.setLastRunAt(now);
            advanceAndSave(schedule, now);
        }
    }

    private void advanceAfterFailure(SoftwareSchedule schedule, Instant now, Exception failure) {
        log.error("Software schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway: {}",
                schedule.getId(), schedule.getTenantId(), failure.getMessage(), failure);
        advanceAndSave(schedule, now);
    }

    private boolean fire(SoftwareSchedule schedule, Instant now) {
        List<String> targets = targetResolver.resolveMachineIds(schedule);
        if (targets == null || targets.isEmpty()) {
            return true;
        }
        Map<String, Machine> machinesById = machineRepository
                .findOnPrimaryByTenantIdAndMachineIdIn(schedule.getTenantId(), new HashSet<>(targets)).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        Set<String> currentTargets = schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA
                ? Set.copyOf(targets) : Set.copyOf(targetResolver.resolveMachineIds(schedule));
        Map<Boolean, List<Machine>> connectedDevices = targets.stream().filter(currentTargets::contains).map(machinesById::get)
                .filter(DeviceDispatchEligibility::isManaged)
                .collect(Collectors.partitioningBy(DeviceDispatchEligibility::isDispatchable));
        List<String> online = connectedDevices.get(true).stream().map(Machine::getMachineId).toList();
        List<Machine> offline = connectedDevices.get(false);

        if (shouldArmReconnect(schedule)) {
            try {
                armReconnect(schedule, offline, now);
                online = onlineTargetsForOccurrence(schedule, online, !offline.isEmpty());
            } catch (TransientDataAccessException conflict) {
                log.warn("Retrying software schedule {} for tenant {}", schedule.getId(), schedule.getTenantId(), conflict);
                return false;
            }
        }
        if (!online.isEmpty()) {
            fireDispatcher.dispatch(schedule, online, now);
        }
        return true;
    }

    private static boolean shouldArmReconnect(SoftwareSchedule schedule) {
        Long window = schedule.getReconnectWindowSeconds();
        return schedule.getOfflineBehavior() == ScheduleOfflineBehavior.RETRY_ON_RECONNECT
                && window != null && window > 0;
    }

    private List<String> onlineTargetsForOccurrence(SoftwareSchedule schedule, List<String> online,
                                                    boolean refreshTargets) {
        if (online.isEmpty()) {
            return online;
        }
        String tenantId = schedule.getTenantId();
        Set<String> deferred = onlineDispatchRepository.findByTenantIdAndMachineIdInAndScheduleIdAndScheduledFor(
                        tenantId, online, schedule.getId(), schedule.getNextRunAt()).stream()
                .map(SoftwareScheduleOnlineDispatch::getMachineId)
                .collect(Collectors.toSet());
        List<String> direct = online.stream().filter(machineId -> !deferred.contains(machineId)).toList();
        if (!refreshTargets || direct.isEmpty()) {
            return direct;
        }
        Set<String> managed = machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(tenantId, direct).stream()
                .filter(DeviceDispatchEligibility::isManaged).map(Machine::getMachineId).collect(Collectors.toSet());
        if (schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA) {
            return direct.stream().filter(managed::contains).toList();
        }
        Set<String> assigned = Set.copyOf(targetResolver.resolveMachineIds(schedule));
        return direct.stream().filter(managed::contains).filter(assigned::contains).toList();
    }

    private void armReconnect(SoftwareSchedule schedule, List<Machine> offlineMachines, Instant now) {
        if (offlineMachines.isEmpty()) {
            return;
        }
        Instant expiresAt = now.plusSeconds(schedule.getReconnectWindowSeconds());
        long armed = offlineMachines.stream().filter(machine -> armReconnectForDevice(schedule, machine, now, expiresAt)).count();
        log.info("Software schedule scheduleId={}: armed {} offline device(s) for reconnect-retry until {}",
                schedule.getId(), armed, expiresAt);
    }

    private boolean armReconnectForDevice(SoftwareSchedule schedule, Machine machine, Instant now, Instant expiresAt) {
        String machineId = machine.getMachineId();
        try {
            return retryOnceOnTransientFailure(() -> createPendingReconnect(schedule, machineId, now, expiresAt));
        } catch (DuplicateKeyException duplicate) {
            log.debug("Software schedule reconnect already armed: scheduleId={} machineId={}", schedule.getId(), machineId);
            return false;
        }
    }

    private boolean retryOnceOnTransientFailure(Transaction<Boolean> change) {
        try {
            return scheduleTransaction.run(change);
        } catch (TransientDataAccessException conflict) {
            return scheduleTransaction.run(change);
        }
    }

    private boolean createPendingReconnect(SoftwareSchedule schedule, String machineId, Instant now, Instant expiresAt) {
        String tenantId = schedule.getTenantId();
        String scheduleId = schedule.getId();
        if (onlineDispatchRepository.findByTenantIdAndMachineIdAndScheduleId(tenantId, machineId, scheduleId).isPresent()) {
            return false;
        }
        return machineRepository.findOnPrimaryByTenantIdAndMachineId(tenantId, machineId)
                .filter(DeviceDispatchEligibility::isManaged)
                .filter(machine -> stillTargeted(tenantId, scheduleId, machine))
                .filter(machine -> machineRepository.reserveForSoftwareReconnect(
                        tenantId, machineId, machine.getVersion(), DeviceStatus.CONNECTED) == 1)
                .map(machine -> insertPendingReconnect(schedule, machineId, now, expiresAt))
                .isPresent();
    }

    private boolean stillTargeted(String tenantId, String scheduleId, Machine machine) {
        return softwareScheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(tenantId, scheduleId, ScriptStatus.ACTIVE)
                .filter(current -> targetResolver.isCurrentTarget(current, machine))
                .isPresent();
    }

    private SoftwareScheduleOnlineDispatch insertPendingReconnect(SoftwareSchedule schedule, String machineId,
                                                                 Instant now, Instant expiresAt) {
        return onlineDispatchRepository.insert(SoftwareScheduleOnlineDispatch.builder()
                .tenantId(schedule.getTenantId()).machineId(machineId).scheduleId(schedule.getId())
                .scheduledFor(schedule.getNextRunAt()).firstSeenAt(now)
                .expiresAt(expiresAt).status(DeviceOnlineDispatchStatus.NEW).build());
    }

    private void advanceAndSave(SoftwareSchedule schedule, Instant now) {
        schedule.setNextRunAt(ScheduleRecurrence.nextRunAfter(schedule.getNextRunAt(), schedule.getRepeat(), now));
        softwareScheduleRepository.save(schedule);
    }
}

package com.openframe.data.service.rmm;

import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import com.openframe.publishing.transaction.MongoTransactionRunner.Transaction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.query.Criteria;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static com.openframe.data.service.machine.MachineFields.ENROLLMENT_ID;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static java.util.stream.Collectors.toSet;

/** Removes a deleted device's schedule memberships, software inventory and OS update data. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeletedMachineCleanup {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    private final SoftwareScheduleMachineAssignedRepository softwareAssignedRepository;
    private final SoftwareScheduleOnlineDispatchRepository softwareOnlineDispatchRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjectionTrigger projectionTrigger;
    private final MachineWriter machineWriter;
    private final ScheduleMutationTransaction scheduleTransaction;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;

    public void cleanUpDeletedMachine(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return;
        }
        removeScriptSchedules(tenantId, machineId);
        cleanUpInventory(tenantId, machineId);
    }

    private void cleanUpInventory(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return;
        }
        cleanUpSoftwareInventory(tenantId, machineId);
        removeOsUpdates(tenantId, machineId);
    }

    private void removeOsUpdates(String tenantId, String machineId) {
        long removedStates = deviceOsStateRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        long removedPending = deviceOsPendingUpdateRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        long removedHistory = deviceOsUpdateHistoryRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        if (removedStates > 0 || removedPending > 0 || removedHistory > 0) {
            log.info("Removed {} OS state(s), {} pending OS update row(s) and {} OS update history row(s) for deleted machineId={} tenantId={}",
                    removedStates, removedPending, removedHistory, machineId, tenantId);
        }
    }

    public Machine markDeleted(Machine expected) {
        return runLifecycleChange(expected, () -> deleteDevice(expected));
    }

    public Machine reenrollDeleted(Machine expected, MachineUpdate update) {
        update.set(ENROLLMENT_ID, UUID.randomUUID().toString());
        return runLifecycleChange(expected, () -> writeAndClearSchedules(expected, update));
    }

    private Machine deleteDevice(Machine expected) {
        Machine deleted = writeAndClearSchedules(expected, machineUpdate().set(STATUS, DeviceStatus.DELETED));
        cleanUpInventory(deleted.getTenantId(), deleted.getMachineId());
        return deleted;
    }

    private Machine runLifecycleChange(Machine expected, Transaction<Machine> change) {
        try {
            return scheduleTransaction.run(change);
        } catch (OptimisticLockingFailureException conflict) {
            throw statusChanged(expected);
        }
    }

    private Machine writeAndClearSchedules(Machine expected, MachineUpdate update) {
        String tenantId = expected.getTenantId();
        String machineId = expected.getMachineId();
        Criteria lifecycle = Criteria.where("tenantId").is(tenantId)
                .and(STATUS.path()).is(expected.getStatus())
                .and(ENROLLMENT_ID.path()).is(expected.getEnrollmentId());
        Machine updated = machineWriter.update(machineId, lifecycle, update)
                .map(MachineWriteResult::after)
                .orElseThrow(() -> statusChanged(expected));
        if (tenantId != null) {
            removeScriptSchedules(tenantId, machineId);
            removeSoftwareSchedules(tenantId, machineId);
        }
        return updated;
    }

    private static ConflictException statusChanged(Machine expected) {
        return new ConflictException("Device " + expected.getMachineId() + " changed during schedule cleanup. Try again.");
    }

    private void removeScriptSchedules(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return;
        }
        long removed = assignedRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        long removedDispatch = onlineDeviceDispatchRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        if (removed > 0) {
            log.info("Removed deleted device {} from {} schedule assignment(s) tenantId={}",
                    machineId, removed, tenantId);
        }
        if (removedDispatch > 0) {
            log.info("Removed first-online dispatch record(s) for deleted machineId={}, count={}", machineId, removedDispatch);
        }
    }

    private void removeSoftwareSchedules(String tenantId, String machineId) {
        long removedSoftware = softwareAssignedRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        long removedReconnect = softwareOnlineDispatchRepository.deleteByTenantIdAndMachineIdAndStatus(
                tenantId, machineId, DeviceOnlineDispatchStatus.NEW);
        if (removedSoftware > 0 || removedReconnect > 0) {
            log.info("Removed software schedule assignments and pending reconnects for deleted machineId={} tenantId={}: assignments={}, reconnects={}",
                    machineId, tenantId, removedSoftware, removedReconnect);
        }
    }

    private void cleanUpSoftwareInventory(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return;
        }
        List<DeviceSoftware> rows = deviceSoftwareRepository.findByTenantIdAndMachineId(tenantId, machineId);
        if (rows.isEmpty()) {
            return;
        }
        Set<Long> affectedTitles = rows.stream().map(DeviceSoftware::getSoftwareTitleId).filter(Objects::nonNull).collect(toSet());
        Set<String> affectedCves = rows.stream().map(DeviceSoftware::getVulnerabilities).filter(Objects::nonNull)
                .flatMap(List::stream).collect(toSet());

        long removed = deviceSoftwareRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        projectionTrigger.titlesChanged(tenantId, affectedTitles);
        projectionTrigger.cvesChanged(tenantId, affectedCves);

        int titleCount = affectedTitles.size();
        int cveCount = affectedCves.size();
        log.info("Removed {} device_software row(s) for deleted machineId={} tenantId={}; re-projected {} title(s), {} CVE(s)",
                removed, machineId, tenantId, titleCount, cveCount);
    }
}

package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerService {

    private final DeviceOnlineDispatchRepository dispatchRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScheduleDeviceTargetResolver targetResolver;

    public void onDeviceWentOffline(Machine machine) {
        String tenantId = machine.getTenantId();
        String machineId = machine.getMachineId();

        if (!hasDueDeviceOnlineSchedule(machine)) {
            log.debug("No DEVICE_ONLINE schedule targets machineId={} tenantId={} — not arming", machineId, tenantId);
            return;
        }

        Instant now = Instant.now();
        Optional<DeviceFirstOnlineDispatch> existing =
                dispatchRepository.findByTenantIdAndMachineId(tenantId, machineId);

        if (existing.isPresent()) {
            DeviceFirstOnlineDispatch row = existing.get();
            if (row.getStatus() == DeviceOnlineDispatchStatus.ARMED) {
                return; // already armed, nothing to change
            }
            row.setStatus(DeviceOnlineDispatchStatus.ARMED);
            row.setFirstSeenAt(now);
            row.setDispatchedAt(null);
            dispatchRepository.save(row);
            log.info("DEVICE_ONLINE armed (went offline): machineId={} tenantId={}", machineId, tenantId);
            return;
        }

        try {
            dispatchRepository.save(DeviceFirstOnlineDispatch.builder()
                    .tenantId(tenantId)
                    .machineId(machineId)
                    .firstSeenAt(now)
                    .status(DeviceOnlineDispatchStatus.ARMED)
                    .build());
            log.info("DEVICE_ONLINE armed (went offline): machineId={} tenantId={}", machineId, tenantId);
        } catch (DuplicateKeyException e) {
            log.debug("DEVICE_ONLINE arm race (skip): machineId={} tenantId={}", machineId, tenantId);
        }
    }

    public void onDeviceCameOnline(Machine machine) {
        String tenantId = machine.getTenantId();
        String machineId = machine.getMachineId();

        Optional<DeviceFirstOnlineDispatch> existing = dispatchRepository.findByTenantIdAndMachineId(tenantId, machineId);
        if (existing.isEmpty() || existing.get().getStatus() != DeviceOnlineDispatchStatus.ARMED) {
            // First connect (no armed sentinel) — not a reconnect, nothing to fire.
            log.debug("No armed DEVICE_ONLINE sentinel for machineId={} tenantId={} — not queued", machineId, tenantId);
            return;
        }

        DeviceFirstOnlineDispatch row = existing.get();
        row.setStatus(DeviceOnlineDispatchStatus.NEW);
        row.setFirstSeenAt(Instant.now());
        dispatchRepository.save(row);
        log.info("DEVICE_ONLINE queued (reconnect): machineId={} tenantId={} — pending dispatch", machineId, tenantId);
    }

    private boolean hasDueDeviceOnlineSchedule(Machine machine) {
        List<ScriptSchedule> schedules = scheduleRepository.findByTenantIdAndTriggerAndStatus(
                machine.getTenantId(), ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        if (schedules.isEmpty()) {
            return false;
        }
        Set<String> assignedScheduleIds = assignedRepository
                .findByTenantIdAndMachineId(machine.getTenantId(), machine.getMachineId()).stream()
                .map(ScriptScheduleMachineAssigned::getScriptScheduleId)
                .filter(Objects::nonNull)
                .collect(toSet());
        return schedules.stream().anyMatch(s -> s.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA
                ? targetResolver.matchesCriteria(s, machine)
                : assignedScheduleIds.contains(s.getId()));
    }
}

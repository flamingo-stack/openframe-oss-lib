package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.MachineFirstOnlineDispatch;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.device.MachineFirstOnlineDispatchRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineDispatchService {

    private final MachineFirstOnlineDispatchRepository dispatchRepository;
    private final MachineRepository machineRepository;
    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleDeviceTargetResolver targetResolver;
    private final ScheduleFireDispatcher fireDispatcher;

    @Value("${openframe.rmm.device-online.dispatch.batch-size:500}")
    private int batchSize;

    public void processPending() {
        List<MachineFirstOnlineDispatch> pending = dispatchRepository.findByDispatchedAtIsNull();
        if (pending.isEmpty()) {
            return;
        }
        int limit = Math.min(pending.size(), batchSize);
        log.info("DEVICE_ONLINE dispatch tick: {} pending, processing up to {}", pending.size(), limit);

        // Cache the tenant's DEVICE_ONLINE+ACTIVE schedule set once per tick — mass onboarding
        // (many pending machines under the same tenant) collapses N repo hits into 1.
        Map<String, List<ScriptSchedule>> schedulesByTenant = new HashMap<>();
        for (MachineFirstOnlineDispatch row : pending.subList(0, limit)) {
            try {
                List<ScriptSchedule> tenantSchedules = schedulesByTenant.computeIfAbsent(
                        row.getTenantId(),
                        tid -> scheduleRepository.findByTenantIdAndTriggerAndStatus(
                                tid, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE));
                processOne(row, tenantSchedules);
            } catch (Exception e) {
                log.error("DEVICE_ONLINE dispatch failed: tenantId={} machineId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), e);
            }
        }
    }

    private void processOne(MachineFirstOnlineDispatch row, List<ScriptSchedule> tenantSchedules) {
        Machine machine = machineRepository.findByTenantIdAndMachineId(row.getTenantId(), row.getMachineId()).orElse(null);
        if (machine == null) {
            log.warn("DEVICE_ONLINE dispatch: machine gone before first fire, tenantId={} machineId={} — leaving pending",
                    row.getTenantId(), row.getMachineId());
            return;
        }
        if (machine.getStatus() != DeviceStatus.ONLINE) {
            return;
        }

        Instant now = Instant.now();
        List<ScriptSchedule> due = dueSchedulesFor(machine, tenantSchedules);
        List<String> targets = List.of(machine.getMachineId());
        for (ScriptSchedule schedule : due) {
            fireDispatcher.dispatch(schedule, targets, now);
        }
        dispatchRepository.markDispatched(row.getId(), now);
        log.info("DEVICE_ONLINE dispatched: machineId={} tenantId={} schedules={}",
                machine.getMachineId(), machine.getTenantId(), due.size());
    }

    private List<ScriptSchedule> dueSchedulesFor(Machine machine, List<ScriptSchedule> tenantSchedules) {
        if (tenantSchedules.isEmpty()) {
            return List.of();
        }
        Set<String> assignedIds = assignedScheduleIds(machine);
        return tenantSchedules.stream()
                .filter(s -> s.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA
                        ? targetResolver.matchesCriteria(s, machine)
                        : assignedIds.contains(s.getId()))
                .toList();
    }

    private Set<String> assignedScheduleIds(Machine machine) {
        return assignedRepository
                .findByTenantIdAndMachineId(machine.getTenantId(), machine.getMachineId()).stream()
                .map(ScriptScheduleMachineAssigned::getScriptScheduleId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }
}

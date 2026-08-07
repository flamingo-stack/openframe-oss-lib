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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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

        for (MachineFirstOnlineDispatch row : pending.subList(0, limit)) {
            try {
                processOne(row);
            } catch (Exception e) {
                log.error("DEVICE_ONLINE dispatch failed: tenantId={} machineId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), e);
            }
        }
    }

    private void processOne(MachineFirstOnlineDispatch row) {
        Machine machine = machineRepository.findByTenantIdAndMachineId(row.getTenantId(), row.getMachineId()).orElse(null);
        if (machine == null) {
            log.warn("DEVICE_ONLINE dispatch: machine gone before first fire, tenantId={} machineId={} — leaving pending",
                    row.getTenantId(), row.getMachineId());
            return;
        }
        if (machine.getStatus() != DeviceStatus.ONLINE) {
            return;
        }

        Map<String, ScriptSchedule> due = collectDueSchedules(machine);
        Instant now = Instant.now();
        for (ScriptSchedule schedule : due.values()) {
            fireDispatcher.dispatch(schedule, List.of(machine.getMachineId()), now);
        }
        dispatchRepository.markDispatched(row.getId(), Instant.now());
        log.info("DEVICE_ONLINE dispatched: machineId={} tenantId={} schedules={}",
                machine.getMachineId(), machine.getTenantId(), due.size());
    }

    private Map<String, ScriptSchedule> collectDueSchedules(Machine machine) {
        Map<String, ScriptSchedule> due = new LinkedHashMap<>();
        for (ScriptSchedule s : specificDueSchedules(machine.getTenantId(), machine.getMachineId())) {
            due.putIfAbsent(s.getId(), s);
        }
        for (ScriptSchedule s : criteriaDueSchedules(machine.getTenantId(), machine)) {
            due.putIfAbsent(s.getId(), s);
        }
        return due;
    }

    private List<ScriptSchedule> specificDueSchedules(String tenantId, String machineId) {
        List<String> scheduleIds = assignedRepository
                .findByTenantIdAndMachineId(tenantId, machineId).stream()
                .map(ScriptScheduleMachineAssigned::getScriptScheduleId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (scheduleIds.isEmpty()) {
            return List.of();
        }
        return scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds).stream()
                .filter(s -> s.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA)
                .filter(s -> s.getTrigger() == ScriptScheduleTrigger.DEVICE_ONLINE)
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .toList();
    }

    private List<ScriptSchedule> criteriaDueSchedules(String tenantId, Machine machine) {
        return scheduleRepository.findByTenantIdAndSelectionModeAndTriggerAndStatus(
                        tenantId, ScheduleDeviceSelectionMode.CRITERIA,
                        ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE).stream()
                .filter(s -> targetResolver.matchesCriteria(s, machine))
                .toList();
    }
}

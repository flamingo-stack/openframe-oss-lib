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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

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
        List<MachineFirstOnlineDispatch> batch = pending.stream().limit(batchSize).toList();
        log.info("DEVICE_ONLINE dispatch tick: {} pending, processing up to {}", pending.size(), batch.size());

        Map<String, List<MachineFirstOnlineDispatch>> rowsByTenant = batch.stream()
                .collect(groupingBy(MachineFirstOnlineDispatch::getTenantId));

        List<String> dispatchedRowIds = new ArrayList<>();
        for (Map.Entry<String, List<MachineFirstOnlineDispatch>> e : rowsByTenant.entrySet()) {
            try {
                dispatchedRowIds.addAll(processTenant(e.getKey(), e.getValue()));
            } catch (Exception ex) {
                log.error("DEVICE_ONLINE dispatch: tenant sweep failed, tenantId={} — retrying next tick",
                        e.getKey(), ex);
            }
        }

        if (!dispatchedRowIds.isEmpty()) {
            long matched = dispatchRepository.markDispatchedIn(dispatchedRowIds, Instant.now());
            if (matched != dispatchedRowIds.size()) {
                log.error("DEVICE_ONLINE dispatch: bulk-mark mismatch — sent {} ids, matched {} (updateMulti degraded?)",
                        dispatchedRowIds.size(), matched);
            }
        }
    }

    private List<String> processTenant(String tenantId, List<MachineFirstOnlineDispatch> tenantRows) {
        Set<String> machineIds = tenantRows.stream()
                .map(MachineFirstOnlineDispatch::getMachineId).collect(toSet());

        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .collect(toMap(Machine::getMachineId, m -> m));
        Map<String, Set<String>> assignedScheduleIdsByMachine = assignedRepository
                .findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .filter(a -> a.getScriptScheduleId() != null)
                .collect(groupingBy(
                        ScriptScheduleMachineAssigned::getMachineId,
                        mapping(ScriptScheduleMachineAssigned::getScriptScheduleId, toSet())));
        List<ScriptSchedule> tenantSchedules = scheduleRepository
                .findByTenantIdAndTriggerAndStatus(tenantId, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);

        List<String> dispatched = new ArrayList<>(tenantRows.size());
        for (MachineFirstOnlineDispatch row : tenantRows) {
            try {
                processOne(row, machinesById, assignedScheduleIdsByMachine, tenantSchedules)
                        .ifPresent(dispatched::add);
            } catch (Exception ex) {
                log.error("DEVICE_ONLINE dispatch failed: tenantId={} machineId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), ex);
            }
        }
        return dispatched;
    }

    private Optional<String> processOne(MachineFirstOnlineDispatch row,
                                        Map<String, Machine> machinesById,
                                        Map<String, Set<String>> assignedScheduleIdsByMachine,
                                        List<ScriptSchedule> tenantSchedules) {
        Machine machine = machinesById.get(row.getMachineId());
        if (machine == null) {
            log.warn("DEVICE_ONLINE dispatch: machine gone before first fire, tenantId={} machineId={} — leaving pending",
                    row.getTenantId(), row.getMachineId());
            return Optional.empty();
        }
        if (machine.getStatus() != DeviceStatus.ONLINE) {
            return Optional.empty();
        }

        Set<String> assignedIds = assignedScheduleIdsByMachine.getOrDefault(row.getMachineId(), Set.of());
        List<ScriptSchedule> due = dueSchedulesFor(machine, tenantSchedules, assignedIds);

        Instant now = Instant.now();
        List<String> targets = List.of(row.getMachineId());
        for (ScriptSchedule schedule : due) {
            fireDispatcher.dispatch(schedule, targets, now);
        }
        log.info("DEVICE_ONLINE dispatched: machineId={} tenantId={} schedules={}",
                row.getMachineId(), row.getTenantId(), due.size());
        return Optional.of(row.getId());
    }

    private List<ScriptSchedule> dueSchedulesFor(Machine machine,
                                                 List<ScriptSchedule> tenantSchedules,
                                                 Set<String> assignedIds) {
        if (tenantSchedules.isEmpty()) {
            return List.of();
        }
        return tenantSchedules.stream()
                .filter(s -> s.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA
                        ? targetResolver.matchesCriteria(s, machine)
                        : assignedIds.contains(s.getId()))
                .toList();
    }
}

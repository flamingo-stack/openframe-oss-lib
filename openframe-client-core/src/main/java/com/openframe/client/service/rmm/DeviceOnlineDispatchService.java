package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineDispatchService {

    private final DeviceOnlineDispatchRepository dispatchRepository;
    private final MachineRepository machineRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleFireDispatcher fireDispatcher;

    private static final String FIELD_FIRST_SEEN_AT = "firstSeenAt";

    @Value("${openframe.rmm.device-online.dispatch.batch-size:500}")
    private int batchSize;

    public void processDevicesBecameOnline() {
        List<DeviceFirstOnlineDispatch> batch = dispatchRepository.findByStatus(
                DeviceOnlineDispatchStatus.NEW, PageRequest.of(0, batchSize, Sort.by(Sort.Direction.ASC, FIELD_FIRST_SEEN_AT)));
        if (batch.isEmpty()) {
            return;
        }
        log.info("DEVICE_ONLINE dispatch tick: processing up to {} pending row(s) (oldest first)", batch.size());

        Map<String, List<DeviceFirstOnlineDispatch>> rowsByTenant = batch.stream().collect(groupingBy(DeviceFirstOnlineDispatch::getTenantId));

        List<DeviceFirstOnlineDispatch> dispatchedRows = new ArrayList<>();
        for (Map.Entry<String, List<DeviceFirstOnlineDispatch>> e : rowsByTenant.entrySet()) {
            dispatchedRows.addAll(processTenant(e.getKey(), e.getValue()));
        }

        dispatchedRows.forEach(this::markDispatched);
        dispatchRepository.saveAll(dispatchedRows);
    }

    private void markDispatched(DeviceFirstOnlineDispatch row) {
        row.setStatus(DeviceOnlineDispatchStatus.DISPATCHED);
        row.setDispatchedAt(Instant.now());
    }

    private List<DeviceFirstOnlineDispatch> processTenant(String tenantId, List<DeviceFirstOnlineDispatch> tenantRows) {
        Set<String> machineIds = tenantRows.stream()
                .map(DeviceFirstOnlineDispatch::getMachineId).collect(toSet());

        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .collect(toMap(Machine::getMachineId, m -> m));
        Map<String, ScriptSchedule> activeSchedulesById = scheduleRepository
                .findByTenantIdAndTriggerAndStatus(tenantId, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE).stream()
                .collect(toMap(ScriptSchedule::getId, s -> s));

        Instant now = Instant.now();
        List<DeviceFirstOnlineDispatch> dispatched = new ArrayList<>(tenantRows.size());
        for (DeviceFirstOnlineDispatch row : tenantRows) {
            try {
                Machine machine = machinesById.get(row.getMachineId());
                if (machine == null || machine.getStatus() != DeviceStatus.ONLINE) {
                    continue;
                }
                ScriptSchedule schedule = row.getScheduleId() == null ? null : activeSchedulesById.get(row.getScheduleId());
                if (schedule != null) {
                    fireDispatcher.dispatch(schedule, List.of(row.getMachineId()), now);
                    log.info("DEVICE_ONLINE dispatched: machineId={} scheduleId={} tenantId={}", row.getMachineId(), row.getScheduleId(), tenantId);
                } else {
                    log.warn("DEVICE_ONLINE dispatch: schedule missing/inactive scheduleId={} machineId={} tenantId={} — draining", row.getScheduleId(), row.getMachineId(), tenantId);
                }
                // Device is online → consume the sentinel (fired, or drained if the schedule is gone).
                dispatched.add(row);
            } catch (Exception ex) {
                log.error("DEVICE_ONLINE dispatch failed: tenantId={} machineId={} scheduleId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), row.getScheduleId(), ex);
            }
        }
        return dispatched;
    }
}

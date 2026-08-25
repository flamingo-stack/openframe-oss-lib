package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.script.ScriptStatus;
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
import java.util.Objects;
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
        log.info("Device-online dispatch tick: processing up to {} pending row(s) (oldest first)", batch.size());

        Instant now = Instant.now();
        Map<String, List<DeviceFirstOnlineDispatch>> rowsByTenant = batch.stream().collect(groupingBy(DeviceFirstOnlineDispatch::getTenantId));

        List<DeviceFirstOnlineDispatch> changed = new ArrayList<>();
        for (Map.Entry<String, List<DeviceFirstOnlineDispatch>> e : rowsByTenant.entrySet()) {
            changed.addAll(processTenant(e.getKey(), e.getValue(), now));
        }

        if (!changed.isEmpty()) {
            dispatchRepository.saveAll(changed);
        }
    }

    private void markDispatched(DeviceFirstOnlineDispatch row, Instant now) {
        row.setStatus(DeviceOnlineDispatchStatus.DISPATCHED);
        row.setDispatchedAt(now);
    }

    private List<DeviceFirstOnlineDispatch> processTenant(String tenantId, List<DeviceFirstOnlineDispatch> tenantRows, Instant now) {
        Set<String> machineIds = tenantRows.stream()
                .map(DeviceFirstOnlineDispatch::getMachineId).collect(toSet());
        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .collect(toMap(Machine::getMachineId, m -> m));

        Set<String> scheduleIds = tenantRows.stream()
                .map(DeviceFirstOnlineDispatch::getScheduleId).filter(Objects::nonNull).collect(toSet());
        Map<String, ScheduleScript> activeSchedulesById = scheduleIds.isEmpty() ? Map.of()
                : scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds).stream()
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .collect(toMap(ScheduleScript::getId, s -> s));

        List<DeviceFirstOnlineDispatch> changed = new ArrayList<>(tenantRows.size());
        for (DeviceFirstOnlineDispatch row : tenantRows) {
            try {
                if (row.getExpiresAt() != null && row.getExpiresAt().isBefore(now)) {
                    row.setStatus(DeviceOnlineDispatchStatus.EXPIRED);
                    changed.add(row);
                    log.info("Reconnect-retry expired (device never reconnected in window): machineId={} scheduleId={} tenantId={}",
                            row.getMachineId(), row.getScheduleId(), tenantId);
                    continue;
                }

                Machine machine = machinesById.get(row.getMachineId());
                if (machine == null || machine.getStatus() != DeviceStatus.ONLINE) {
                    continue;   // still offline -> leave NEW for a later tick (until it reconnects or expires)
                }

                ScheduleScript schedule = row.getScheduleId() == null ? null : activeSchedulesById.get(row.getScheduleId());
                if (schedule != null) {
                    fireDispatcher.dispatch(schedule, List.of(row.getMachineId()), now);
                    log.info("Device-online dispatched: machineId={} scheduleId={} tenantId={}", row.getMachineId(), row.getScheduleId(), tenantId);
                } else {
                    log.warn("Device-online dispatch: schedule missing/inactive scheduleId={} machineId={} tenantId={} — draining", row.getScheduleId(), row.getMachineId(), tenantId);
                }
                // Device is online → consume the sentinel (fired, or drained if the schedule is gone).
                markDispatched(row, now);
                changed.add(row);
            } catch (Exception ex) {
                log.error("Device-online dispatch failed: tenantId={} machineId={} scheduleId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), row.getScheduleId(), ex);
            }
        }
        return changed;
    }
}

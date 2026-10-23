package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleOnlineDispatchService {

    private static final String FIELD_FIRST_SEEN_AT = "firstSeenAt";

    private final SoftwareScheduleOnlineDispatchRepository dispatchRepository;
    private final MachineRepository machineRepository;
    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleFireDispatcher fireDispatcher;

    @Value("${openframe.rmm.software.schedule.online-dispatch.batch-size:500}")
    private int batchSize;

    public void processReconnectedDevices() {
        List<SoftwareScheduleOnlineDispatch> batch = dispatchRepository.findByStatus(
                DeviceOnlineDispatchStatus.NEW, PageRequest.of(0, batchSize, Sort.by(Sort.Direction.ASC, FIELD_FIRST_SEEN_AT)));
        if (batch.isEmpty()) {
            return;
        }
        log.info("Software schedule reconnect tick: processing up to {} pending row(s) (oldest first)", batch.size());

        Instant now = Instant.now();
        Map<String, List<SoftwareScheduleOnlineDispatch>> rowsByTenant =
                batch.stream().collect(groupingBy(SoftwareScheduleOnlineDispatch::getTenantId));

        List<SoftwareScheduleOnlineDispatch> changed = new ArrayList<>();
        for (Map.Entry<String, List<SoftwareScheduleOnlineDispatch>> e : rowsByTenant.entrySet()) {
            changed.addAll(processTenant(e.getKey(), e.getValue(), now));
        }

        if (!changed.isEmpty()) {
            dispatchRepository.saveAll(changed);
        }
    }

    private List<SoftwareScheduleOnlineDispatch> processTenant(String tenantId,
                                                               List<SoftwareScheduleOnlineDispatch> tenantRows, Instant now) {
        Set<String> machineIds = tenantRows.stream()
                .map(SoftwareScheduleOnlineDispatch::getMachineId).collect(toSet());
        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .collect(toMap(Machine::getMachineId, m -> m));

        Set<String> scheduleIds = tenantRows.stream()
                .map(SoftwareScheduleOnlineDispatch::getScheduleId).filter(Objects::nonNull).collect(toSet());
        Map<String, SoftwareSchedule> activeSchedulesById = scheduleIds.isEmpty() ? Map.of()
                : scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds).stream()
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .collect(toMap(SoftwareSchedule::getId, s -> s));

        List<SoftwareScheduleOnlineDispatch> changed = new ArrayList<>(tenantRows.size());
        for (SoftwareScheduleOnlineDispatch row : tenantRows) {
            try {
                if (row.getExpiresAt() != null && row.getExpiresAt().isBefore(now)) {
                    row.setStatus(DeviceOnlineDispatchStatus.EXPIRED);
                    changed.add(row);
                    log.info("Software schedule reconnect expired (device never reconnected in window): machineId={} scheduleId={} tenantId={}",
                            row.getMachineId(), row.getScheduleId(), tenantId);
                    continue;
                }

                Machine machine = machinesById.get(row.getMachineId());
                if (machine == null || machine.getStatus() != DeviceStatus.ONLINE) {
                    continue;   // still offline -> leave NEW until it reconnects or expires
                }

                SoftwareSchedule schedule = activeSchedulesById.get(row.getScheduleId());
                if (schedule != null) {
                    fireDispatcher.dispatch(schedule, List.of(row.getMachineId()), now);
                    log.info("Software schedule reconnect dispatched: machineId={} scheduleId={} tenantId={}",
                            row.getMachineId(), row.getScheduleId(), tenantId);
                } else {
                    log.warn("Software schedule reconnect: schedule missing/inactive scheduleId={} machineId={} tenantId={} — draining",
                            row.getScheduleId(), row.getMachineId(), tenantId);
                }
                row.setStatus(DeviceOnlineDispatchStatus.DISPATCHED);
                row.setDispatchedAt(now);
                changed.add(row);
            } catch (Exception ex) {
                log.error("Software schedule reconnect dispatch failed: tenantId={} machineId={} scheduleId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), row.getScheduleId(), ex);
            }
        }
        return changed;
    }
}

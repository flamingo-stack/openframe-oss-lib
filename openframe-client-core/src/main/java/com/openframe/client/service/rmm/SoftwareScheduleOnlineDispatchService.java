package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

/** Runs still-eligible deferred software work when a target device reconnects. */
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleOnlineDispatchService {

    private static final String FIELD_FIRST_SEEN_AT = "firstSeenAt";

    private final SoftwareScheduleOnlineDispatchRepository dispatchRepository;
    private final MachineRepository machineRepository;
    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleTargetResolver targetResolver;
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

        rowsByTenant.forEach((tenantId, rows) -> processTenant(tenantId, rows, now));
    }

    private void processTenant(String tenantId, List<SoftwareScheduleOnlineDispatch> tenantRows, Instant now) {
        Set<String> machineIds = tenantRows.stream()
                .map(SoftwareScheduleOnlineDispatch::getMachineId).collect(toSet());
        Map<String, Machine> machinesById = machineRepository
                .findOnPrimaryByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .collect(toMap(Machine::getMachineId, m -> m));

        tenantRows.forEach(row -> processReconnectSafely(row, machinesById.get(row.getMachineId()), now));
    }

    private void processReconnectSafely(SoftwareScheduleOnlineDispatch row, Machine machine, Instant now) {
        try {
            processReconnect(row, machine, now);
        } catch (Exception ex) {
            log.error("Software schedule reconnect dispatch failed: tenantId={} machineId={} scheduleId={} (will retry next tick): {}",
                    row.getTenantId(), row.getMachineId(), row.getScheduleId(), ex.getMessage(), ex);
        }
    }

    private void processReconnect(SoftwareScheduleOnlineDispatch row, Machine machine, Instant now) {
        String tenantId = row.getTenantId();
        String machineId = row.getMachineId();
        String scheduleId = row.getScheduleId();
        if (row.getExpiresAt() != null && row.getExpiresAt().isBefore(now)) {
            dispatchRepository.transitionIfNew(tenantId, row.getId(), DeviceOnlineDispatchStatus.EXPIRED, null);
            log.info("Software schedule reconnect expired: machineId={} scheduleId={} tenantId={}", machineId, scheduleId, tenantId);
            return;
        }
        if (!DeviceDispatchEligibility.isDispatchable(machine)) {
            return;
        }
        Optional<Machine> currentMachine = machineRepository.findOnPrimaryByTenantIdAndMachineId(tenantId, machineId)
                .filter(DeviceDispatchEligibility::isDispatchable);
        if (currentMachine.isEmpty()) {
            return;
        }
        Optional<SoftwareSchedule> activeSchedule = Optional.ofNullable(scheduleId)
                .flatMap(id -> scheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(tenantId, id, ScriptStatus.ACTIVE));
        if (activeSchedule.isEmpty()) {
            dispatchRepository.transitionIfNew(tenantId, row.getId(), DeviceOnlineDispatchStatus.DISPATCHED, now);
            log.warn("Software schedule reconnect: schedule missing/inactive scheduleId={} machineId={} tenantId={} — draining",
                    scheduleId, machineId, tenantId);
            return;
        }
        SoftwareSchedule schedule = activeSchedule.orElseThrow();
        if (!targetResolver.isCurrentTarget(schedule, currentMachine.orElseThrow())) {
            dispatchRepository.transitionIfNew(tenantId, row.getId(), DeviceOnlineDispatchStatus.EXPIRED, null);
            log.info("Software schedule reconnect dropped for removed device: machineId={} scheduleId={} tenantId={}",
                    machineId, scheduleId, tenantId);
            return;
        }
        if (!dispatchRepository.existsOnPrimaryByTenantIdAndIdAndStatus(tenantId, row.getId(), DeviceOnlineDispatchStatus.NEW)) {
            return;
        }
        fireDispatcher.dispatch(schedule, List.of(machineId), now);
        dispatchRepository.transitionIfNew(tenantId, row.getId(), DeviceOnlineDispatchStatus.DISPATCHED, now);
        log.info("Software schedule reconnect dispatched: machineId={} scheduleId={} tenantId={}", machineId, scheduleId, tenantId);
    }

}

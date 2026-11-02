package com.openframe.management.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineFields.TELEMETRY_STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceHeartbeatOfflineDetectionService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;

    @Value("${openframe.device.heartbeat.offline-threshold-seconds:130}")
    private long offlineThresholdSeconds;

    // two reads: status ONLINE covers machines from before telemetryStatus existed; telemetry ONLINE covers machines
    // whose lifecycle status is frozen (PENDING_DELETION) and would otherwise never be reported as unreachable
    public void markStaleDevicesOffline() {
        Instant threshold = Instant.now().minusSeconds(offlineThresholdSeconds);
        Map<String, Machine> stale = new LinkedHashMap<>();
        machineRepository.findByStatusAndLastSeenBefore(DeviceStatus.ONLINE, threshold)
                .forEach(machine -> stale.put(machine.getMachineId(), machine));
        machineRepository.findByTelemetryStatusAndLastSeenBefore(TelemetryStatus.ONLINE, threshold)
                .forEach(machine -> stale.putIfAbsent(machine.getMachineId(), machine));
        if (stale.isEmpty()) {
            log.debug("No stale online devices found");
            return;
        }
        log.info("Found {} stale online device(s) with no heartbeat since {}s ago, marking as OFFLINE", stale.size(), offlineThresholdSeconds);
        long marked = stale.values().stream()
                .filter(machine -> markDeviceAsOffline(machine, threshold))
                .count();
        log.info("Successfully marked {} device(s) as OFFLINE", marked);
    }

    // Field-level, one machine at a time: a whole-document save would overwrite what other writers set since the
    // read. The lastSeen guard lets a heartbeat that arrived meanwhile win, and the status guard lets an uninstall
    // that landed meanwhile (DELETED, PENDING_DELETION) keep its status
    private boolean markDeviceAsOffline(Machine machine, Instant threshold) {
        MachineUpdate update = machineUpdate().set(TELEMETRY_STATUS, TelemetryStatus.OFFLINE);
        Criteria guard = stillSilentSince(threshold);
        if (machine.getStatus() == DeviceStatus.ONLINE) {
            update.set(STATUS, DeviceStatus.OFFLINE);
            guard = guard.and(STATUS.path()).is(DeviceStatus.ONLINE);
        }
        boolean marked = machineWriter.update(machine.getMachineId(), guard, update).isPresent();
        log.info("Marking device {} as OFFLINE (status={}, lastSeen={}, marked={})",
                machine.getMachineId(), machine.getStatus(), machine.getLastSeen(), marked);
        return marked;
    }

    private static Criteria stillSilentSince(Instant threshold) {
        return Criteria.where(LAST_SEEN.path()).lt(threshold);
    }
}

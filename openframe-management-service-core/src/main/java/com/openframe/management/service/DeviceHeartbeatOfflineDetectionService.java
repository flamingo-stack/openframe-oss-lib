package com.openframe.management.service;

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
import java.util.List;

import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
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

    public void markStaleDevicesOffline() {
        Instant threshold = Instant.now().minusSeconds(offlineThresholdSeconds);
        List<Machine> stale = machineRepository.findByTelemetryStatusAndLastSeenBefore(TelemetryStatus.ONLINE, threshold);
        if (stale.isEmpty()) {
            log.debug("No stale online devices found");
            return;
        }
        log.info("Found {} stale online device(s) with no heartbeat since {}s ago, marking as OFFLINE", stale.size(), offlineThresholdSeconds);
        long marked = stale.stream()
                .filter(machine -> markDeviceAsOffline(machine, threshold))
                .count();
        log.info("Successfully marked {} device(s) as OFFLINE", marked);
    }

    // The guard re-checks the read in Mongo, so a heartbeat that lands meanwhile is never overwritten and no write conflicts.
    private boolean markDeviceAsOffline(Machine machine, Instant threshold) {
        MachineUpdate update = machineUpdate().set(TELEMETRY_STATUS, TelemetryStatus.OFFLINE);
        Criteria guard = Criteria.where(LAST_SEEN.path()).lt(threshold)
                .and(TELEMETRY_STATUS.path()).is(TelemetryStatus.ONLINE);
        String machineId = machine.getMachineId();
        log.info("Marking device {} as OFFLINE (status={}, lastSeen={})", machineId, machine.getStatus(), machine.getLastSeen());
        return machineWriter.update(machineId, guard, update).isPresent();
    }
}

package com.openframe.management.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceHeartbeatOfflineDetectionService {

    private final MachineRepository machineRepository;

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
        List<Machine> staleMachines = new ArrayList<>(stale.values());
        staleMachines.forEach(this::markDeviceAsOffline);
        machineRepository.saveAll(staleMachines);
        log.info("Successfully marked {} device(s) as OFFLINE", staleMachines.size());
    }

    private void markDeviceAsOffline(Machine machine) {
        machine.setTelemetryStatus(TelemetryStatus.OFFLINE);
        if (machine.getStatus() == DeviceStatus.ONLINE) {
            machine.setStatus(DeviceStatus.OFFLINE);
        }
        log.info("Marking device {} as OFFLINE (status={}, lastSeen={})", machine.getMachineId(), machine.getStatus(), machine.getLastSeen());
    }
}

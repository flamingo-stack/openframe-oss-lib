package com.openframe.management.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceHeartbeatOfflineDetectionService {

    private final MachineRepository machineRepository;

    @Value("${openframe.device.heartbeat.offline-threshold-seconds:130}")
    private long offlineThresholdSeconds;

    public void markStaleDevicesOffline() {
        Instant threshold = Instant.now().minusSeconds(offlineThresholdSeconds);
        List<Machine> staleMachines = machineRepository.findByStatusAndLastSeenBefore(DeviceStatus.ONLINE, threshold);

        if (staleMachines.isEmpty()) {
            log.debug("No stale online devices found");
            return;
        }

        int staleMachinesCount = staleMachines.size();
        log.info("Found {} stale online device(s) with no heartbeat since {}s ago, marking as OFFLINE", staleMachinesCount, offlineThresholdSeconds);

        staleMachines.forEach(this::markDeviceAsOffline);
        machineRepository.saveAll(staleMachines);

        log.info("Successfully marked {} device(s) as OFFLINE", staleMachines.size());
    }

    private void markDeviceAsOffline(Machine machine) {
        machine.setStatus(DeviceStatus.OFFLINE);

        String machineId = machine.getMachineId();
        Instant lastSeen = machine.getLastSeen();
        log.info("Marking device {} as OFFLINE (lastSeen={})", machineId, lastSeen);
    }
}

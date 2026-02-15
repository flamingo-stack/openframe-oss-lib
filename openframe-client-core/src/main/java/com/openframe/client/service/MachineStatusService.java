package com.openframe.client.service;

import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.client.service.processor.MachineStatusPostProcessor;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class MachineStatusService {

    private final MachineRepository machineRepository;
    private final MachineStatusPostProcessor machineStatusPostProcessor;

    public void updateToOnline(String machineId, Instant eventTimestamp) {
        update(machineId, DeviceStatus.ONLINE, eventTimestamp);
    }

    public void updateToOffline(String machineId, Instant eventTimestamp) {
        update(machineId, DeviceStatus.OFFLINE, eventTimestamp);
    }

    public void processHeartbeat(String machineId, Instant eventTimestamp) {
        update(machineId, DeviceStatus.ONLINE, eventTimestamp);
    }

    private void update(String machineId, DeviceStatus newStatus, Instant eventTimestamp) {
        log.info("Received status update event to {} for machineId={} eventTimestamp={}", newStatus, machineId, eventTimestamp);

        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new MachineNotFoundException(machineId));

        if (isEventNewer(eventTimestamp, machine.getLastSeen())) {
            applyStatusUpdate(machine, newStatus, eventTimestamp);
        } else {
            logStaleEvent(machine, eventTimestamp);
        }
    }

    private boolean isEventNewer(Instant eventTimestamp, Instant lastSeen) {
        return lastSeen == null || eventTimestamp.isAfter(lastSeen);
    }

    private void applyStatusUpdate(Machine machine, DeviceStatus newStatus, Instant eventTimestamp) {
        DeviceStatus previousStatus = machine.getStatus();
        machine.setStatus(newStatus);
        machine.setLastSeen(eventTimestamp);
        machineRepository.save(machine);
        log.info("Updated machineId={} to status={} at {}", machine.getMachineId(), newStatus, eventTimestamp);

        try {
            machineStatusPostProcessor.onStatusUpdated(machine.getMachineId(), previousStatus, newStatus);
        } catch (Exception e) {
            log.error("Post-processor failed for machineId={}: {}", machine.getMachineId(), e.getMessage(), e);
        }
    }

    private void logStaleEvent(Machine machine, Instant eventTimestamp) {
        log.warn("Ignored stale event for machineId={} eventTimestamp={} lastSeen={} currentStatus={}",
                machine.getMachineId(),
                eventTimestamp,
                machine.getLastSeen(),
                machine.getStatus());
    }
}

package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;

import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.OFFLINE;
import static com.openframe.data.document.device.DeviceStatus.ONLINE;
import static com.openframe.data.document.device.DeviceStatus.PENDING;
import static com.openframe.data.document.device.DeviceStatus.PENDING_DELETION;

@Service
@RequiredArgsConstructor
@Slf4j
public class MachineStatusService {

    private final MachineRepository machineRepository;
    private final ApplicationEventPublisher eventPublisher;

    public void updateToOnline(String machineId, Instant eventTimestamp) {
        update(machineId, ONLINE, eventTimestamp);
    }

    public void updateToOffline(String machineId, Instant eventTimestamp) {
        update(machineId, OFFLINE, eventTimestamp);
    }

    public void processHeartbeat(String machineId, Instant eventTimestamp) {
        update(machineId, ONLINE, eventTimestamp);
    }

    private void update(String machineId, DeviceStatus newStatus, Instant eventTimestamp) {
        log.debug("Received status update event to {} for machineId={} eventTimestamp={}", newStatus, machineId, eventTimestamp);

        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new MachineNotFoundException(machineId));

        if (isDeletionInProgress(machine)) {
            log.debug("Ignoring {} event for machineId={} in status {}", newStatus, machineId, machine.getStatus());
            return;
        }

        if (isEventNewer(eventTimestamp, machine.getLastSeen())) {
            applyStatusUpdate(machine, newStatus, eventTimestamp);
        } else {
            logStaleEvent(machine, eventTimestamp);
        }
    }

    private boolean isEventNewer(Instant eventTimestamp, Instant lastSeen) {
        return lastSeen == null || eventTimestamp.isAfter(lastSeen);
    }

    private boolean isDeletionInProgress(Machine machine) {
        DeviceStatus status = machine.getStatus();
        return status == PENDING_DELETION || status == DELETED;
    }

    private void applyStatusUpdate(Machine machine, DeviceStatus newStatus, Instant eventTimestamp) {
        DeviceStatus previousStatus = machine.getStatus();
        machine.setStatus(newStatus);
        machine.setLastSeen(eventTimestamp);
        machineRepository.save(machine);
        log.debug("Updated machineId={} to status={} at {}", machine.getMachineId(), newStatus, eventTimestamp);

        if (previousStatus == PENDING && (newStatus == ONLINE || newStatus == OFFLINE)) {
            log.info("Device first connected: machineId={}, transition {} -> {}", machine.getMachineId(), previousStatus, newStatus);
            eventPublisher.publishEvent(new DeviceFirstConnectedEvent(this, machine));
        }

        if (previousStatus == OFFLINE && newStatus == ONLINE) {
            log.info("Device came online (offline->online): machineId={}", machine.getMachineId());
            eventPublisher.publishEvent(new DeviceCameOnlineEvent(this, machine));
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

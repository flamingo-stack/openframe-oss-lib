package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;

import static com.openframe.data.document.device.DeviceStatus.OFFLINE;
import static com.openframe.data.document.device.DeviceStatus.ONLINE;
import static com.openframe.data.document.device.DeviceStatus.PENDING;

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

        if (!isEventNewer(eventTimestamp, machine.getLastSeen())) {
            logStaleEvent(machine, eventTimestamp);
            return;
        }

        TelemetryStatus telemetry = newStatus == ONLINE ? TelemetryStatus.ONLINE : TelemetryStatus.OFFLINE;
        if (isDeletionInProgress(machine)) {
            // the lifecycle status is frozen until the agent is gone; connectivity keeps following the device
            touchPresence(machine, telemetry, eventTimestamp);
            return;
        }

        applyStatusUpdate(machine, newStatus, telemetry, eventTimestamp);
    }

    private boolean isEventNewer(Instant eventTimestamp, Instant lastSeen) {
        return lastSeen == null || eventTimestamp.isAfter(lastSeen);
    }

    private boolean isDeletionInProgress(Machine machine) {
        return DeviceStatus.DELETING_OR_DELETED.contains(machine.getStatus());
    }

    private void applyStatusUpdate(Machine machine, DeviceStatus newStatus, TelemetryStatus telemetry, Instant eventTimestamp) {
        DeviceStatus previousStatus = machine.getStatus();
        if (previousStatus == newStatus) {
            touchPresence(machine, telemetry, eventTimestamp);
            return;
        }
        machine.setStatus(newStatus);
        machine.setTelemetryStatus(telemetry);
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

    /**
     * A heartbeat that changes nothing but lastSeen stays out of {@code save}: nothing that reaches Pinot has changed,
     * and {@code save} would make the publishing aspect emit a duplicate message for every heartbeat. A connectivity
     * flip is a real change and goes through {@code save}.
     */
    private void touchPresence(Machine machine, TelemetryStatus telemetry, Instant eventTimestamp) {
        if (machine.getTelemetryStatus() != telemetry) {
            machine.setTelemetryStatus(telemetry);
            machine.setLastSeen(eventTimestamp);
            machineRepository.save(machine);
            log.debug("Updated machineId={} to telemetry={} at {} (status unchanged: {})",
                    machine.getMachineId(), telemetry, eventTimestamp, machine.getStatus());
            return;
        }
        machineRepository.updateLastSeen(machine.getMachineId(), eventTimestamp);
        log.debug("Refreshed lastSeen for machineId={} at {} (status unchanged: {})",
                machine.getMachineId(), eventTimestamp, machine.getStatus());
    }

    private void logStaleEvent(Machine machine, Instant eventTimestamp) {
        log.warn("Ignored stale event for machineId={} eventTimestamp={} lastSeen={} currentStatus={}",
                machine.getMachineId(),
                eventTimestamp,
                machine.getLastSeen(),
                machine.getStatus());
    }
}

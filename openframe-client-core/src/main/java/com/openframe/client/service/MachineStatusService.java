package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
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
import java.util.Optional;

import static com.openframe.data.document.device.TelemetryStatus.OFFLINE;
import static com.openframe.data.document.device.TelemetryStatus.ONLINE;

// Connectivity only: the lifecycle status is owned by registration, promotion, deletion and the archive job.
@Service
@RequiredArgsConstructor
@Slf4j
public class MachineStatusService {

    private final MachineRepository machineRepository;
    private final DeviceLifecycleService deviceLifecycleService;
    private final ApplicationEventPublisher eventPublisher;

    public void updateToOnline(String machineId, Instant eventTimestamp) {
        applyTelemetry(machineId, ONLINE, eventTimestamp);
    }

    public void updateToOffline(String machineId, Instant eventTimestamp) {
        applyTelemetry(machineId, OFFLINE, eventTimestamp);
    }

    public void processHeartbeat(String machineId, Instant eventTimestamp) {
        applyTelemetry(machineId, ONLINE, eventTimestamp);
    }

    private void applyTelemetry(String machineId, TelemetryStatus telemetry, Instant eventTimestamp) {
        log.debug("Received connectivity event {} for machineId={} eventTimestamp={}", telemetry, machineId, eventTimestamp);

        Optional<Machine> found = machineRepository.findByMachineId(machineId);
        if (found.isEmpty()) {
            throw new MachineNotFoundException(machineId);
        }
        Machine machine = found.get();

        Instant lastSeen = machine.getLastSeen();
        if (!isEventNewer(eventTimestamp, lastSeen)) {
            logStaleEvent(machine, eventTimestamp);
            return;
        }

        TelemetryStatus previous = machine.getTelemetryStatus();
        if (previous == telemetry) {
            refreshLastSeen(machine, eventTimestamp);
        } else {
            recordFlip(machine, previous, telemetry, eventTimestamp);
        }

        if (machine.getStatus() == DeviceStatus.PENDING) {
            deviceLifecycleService.promoteIfReady(machineId);
        }
    }

    private static boolean isEventNewer(Instant eventTimestamp, Instant lastSeen) {
        return lastSeen == null || eventTimestamp.isAfter(lastSeen);
    }

    // Nothing that reaches Pinot changed, so this stays out of save(): the publishing aspect would emit a message per heartbeat.
    private void refreshLastSeen(Machine machine, Instant eventTimestamp) {
        machineRepository.updateLastSeen(machine.getMachineId(), eventTimestamp);
        log.debug("Refreshed lastSeen for machineId={} at {} (status {})",
                machine.getMachineId(), eventTimestamp, machine.getStatus());
    }

    private void recordFlip(Machine machine, TelemetryStatus previous, TelemetryStatus telemetry, Instant eventTimestamp) {
        machine.setTelemetryStatus(telemetry);
        machine.setLastSeen(eventTimestamp);
        if (machine.getFirstConnectedAt() == null) {
            machine.setFirstConnectedAt(eventTimestamp);
        }
        machineRepository.save(machine);
        log.debug("Updated machineId={} to connectivity={} at {} (status {})",
                machine.getMachineId(), telemetry, eventTimestamp, machine.getStatus());

        if (previous == OFFLINE && telemetry == ONLINE) {
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

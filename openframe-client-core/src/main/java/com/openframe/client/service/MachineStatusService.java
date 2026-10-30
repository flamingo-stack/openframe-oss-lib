package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.data.document.device.DeviceStatus.OFFLINE;
import static com.openframe.data.document.device.DeviceStatus.ONLINE;
import static com.openframe.data.document.device.DeviceStatus.PENDING;
import static com.openframe.data.service.machine.MachineFields.FIRST_CONNECTED_AT;
import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineFields.TELEMETRY_STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

@Service
@RequiredArgsConstructor
@Slf4j
public class MachineStatusService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
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
        boolean firstConnect = previousStatus == PENDING && (newStatus == ONLINE || newStatus == OFFLINE);
        MachineUpdate update = machineUpdate()
                .set(STATUS, newStatus)
                .set(TELEMETRY_STATUS, telemetry)
                .set(LAST_SEEN, eventTimestamp);
        if (firstConnect && machine.getFirstConnectedAt() == null) {
            update.set(FIRST_CONNECTED_AT, eventTimestamp);
        }
        // The transition only lands while the status is still the one it was decided from, so an uninstall or a
        // status change that landed since the read is not overwritten
        Optional<Machine> written = machineWriter
                .update(machine.getMachineId(), Criteria.where(STATUS.path()).is(previousStatus), update)
                .map(MachineWriteResult::after);
        if (written.isEmpty()) {
            log.info("Status of machineId={} changed since it was read, {} -> {} not applied",
                    machine.getMachineId(), previousStatus, newStatus);
            return;
        }
        Machine updated = written.get();
        log.debug("Updated machineId={} to status={} at {}", updated.getMachineId(), newStatus, eventTimestamp);

        if (firstConnect) {
            log.info("Device first connected: machineId={}, transition {} -> {}", updated.getMachineId(), previousStatus, newStatus);
            eventPublisher.publishEvent(new DeviceFirstConnectedEvent(this, updated));
        }

        if (previousStatus == OFFLINE && newStatus == ONLINE) {
            log.info("Device came online (offline->online): machineId={}", updated.getMachineId());
            eventPublisher.publishEvent(new DeviceCameOnlineEvent(this, updated));
        }
    }

    /**
     * A heartbeat that changes nothing but lastSeen stays out of {@code MachineWriter}: nothing that reaches Pinot has
     * changed, and the writer would make the publishing aspect emit a duplicate message for every heartbeat. A
     * connectivity flip is a real change and goes through {@code MachineWriter}.
     */
    private void touchPresence(Machine machine, TelemetryStatus telemetry, Instant eventTimestamp) {
        if (machine.getTelemetryStatus() != telemetry) {
            write(machine.getMachineId(), machineUpdate()
                    .set(TELEMETRY_STATUS, telemetry)
                    .set(LAST_SEEN, eventTimestamp));
            log.debug("Updated machineId={} to telemetry={} at {} (status unchanged: {})",
                    machine.getMachineId(), telemetry, eventTimestamp, machine.getStatus());
            return;
        }
        machineRepository.updateLastSeen(machine.getMachineId(), eventTimestamp);
        log.debug("Refreshed lastSeen for machineId={} at {} (status unchanged: {})",
                machine.getMachineId(), eventTimestamp, machine.getStatus());
    }

    // Field-level: a whole-document save would overwrite what other writers set on the machine since it was read
    private Optional<Machine> write(String machineId, MachineUpdate update) {
        return machineWriter.update(machineId, update).map(MachineWriteResult::after);
    }

    private void logStaleEvent(Machine machine, Instant eventTimestamp) {
        log.warn("Ignored stale event for machineId={} eventTimestamp={} lastSeen={} currentStatus={}",
                machine.getMachineId(),
                eventTimestamp,
                machine.getLastSeen(),
                machine.getStatus());
    }
}

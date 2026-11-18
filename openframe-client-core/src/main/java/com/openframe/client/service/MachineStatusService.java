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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.data.document.device.TelemetryStatus.OFFLINE;
import static com.openframe.data.document.device.TelemetryStatus.ONLINE;
import static com.openframe.data.service.machine.MachineFields.FIRST_CONNECTED_AT;
import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineFields.TELEMETRY_STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

// With the managed-status flag on this writes connectivity only: the lifecycle status is owned by registration,
// promotion, deletion and the archive job. With it off, status keeps the ONLINE/OFFLINE shape a phase-1 release reads.
@Service
@RequiredArgsConstructor
@Slf4j
public class MachineStatusService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
    private final DeviceLifecycleService deviceLifecycleService;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${openframe.features.devices.managed-status.enabled:false}")
    private final boolean managedStatusEnabled;

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

        if (!managedStatusEnabled) {
            applyConnectedStatus(machine, telemetry, eventTimestamp);
            return;
        }

        TelemetryStatus previous = machine.getTelemetryStatus();
        if (previous == telemetry) {
            refreshLastSeen(machine, eventTimestamp);
        } else if (!recordFlip(machine, previous, telemetry, eventTimestamp)) {
            return;
        }

        if (machine.getStatus() == DeviceStatus.PENDING) {
            deviceLifecycleService.promoteIfReady(machineId);
        }
    }

    // Flag off, the phase-1 shape: outside the frozen states status follows connectivity as ONLINE/OFFLINE, nothing is
    // promoted, and the first connect out of PENDING is announced here
    private void applyConnectedStatus(Machine machine, TelemetryStatus telemetry, Instant eventTimestamp) {
        DeviceStatus previousStatus = machine.getStatus();
        DeviceStatus newStatus = telemetry == ONLINE ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
        if (previousStatus == newStatus || DeviceStatus.FROZEN.contains(previousStatus)) {
            recordPresence(machine, telemetry, eventTimestamp);
            return;
        }
        MachineUpdate update = connectivityUpdate(machine, telemetry, eventTimestamp).set(STATUS, newStatus);
        // Lands only while the status is still the one it was decided from, so an uninstall since the read is kept
        Criteria statusUnchanged = Criteria.where(STATUS.path()).is(previousStatus);
        Optional<MachineWriteResult> written = machineWriter.update(machine.getMachineId(), statusUnchanged, update);
        if (written.isEmpty()) {
            log.info("Status of machineId={} changed since it was read, {} -> {} not applied, presence recorded",
                    machine.getMachineId(), previousStatus, newStatus);
            recordPresence(machine, telemetry, eventTimestamp);
            return;
        }
        // MANAGED left behind by the flag having been on only says "offline" through its connectivity
        boolean wasOffline = previousStatus == DeviceStatus.OFFLINE
                || previousStatus == DeviceStatus.MANAGED && machine.getTelemetryStatus() == OFFLINE;
        announceStatusChange(written.get().after(), previousStatus, newStatus, wasOffline);
    }

    private void announceStatusChange(Machine updated, DeviceStatus previousStatus, DeviceStatus newStatus,
                                      boolean wasOffline) {
        String machineId = updated.getMachineId();
        log.debug("Updated machineId={} to status={}", machineId, newStatus);
        if (previousStatus == DeviceStatus.PENDING) {
            log.info("Device first connected: machineId={}, transition {} -> {}", machineId, previousStatus, newStatus);
            eventPublisher.publishEvent(new DeviceFirstConnectedEvent(this, updated));
        }
        if (wasOffline && newStatus == DeviceStatus.ONLINE) {
            log.info("Device came online (offline->online): machineId={}", machineId);
            eventPublisher.publishEvent(new DeviceCameOnlineEvent(this, updated));
        }
    }

    // The status stays as it is; only a connectivity flip goes through MachineWriter
    private void recordPresence(Machine machine, TelemetryStatus telemetry, Instant eventTimestamp) {
        if (machine.getTelemetryStatus() == telemetry) {
            refreshLastSeen(machine, eventTimestamp);
            return;
        }
        machineWriter.update(machine.getMachineId(), connectivityUpdate(machine, telemetry, eventTimestamp));
        log.debug("Updated machineId={} to connectivity={} at {} (status unchanged: {})",
                machine.getMachineId(), telemetry, eventTimestamp, machine.getStatus());
    }

    private static boolean isEventNewer(Instant eventTimestamp, Instant lastSeen) {
        return lastSeen == null || eventTimestamp.isAfter(lastSeen);
    }

    // Nothing that reaches Pinot changed, so this stays out of MachineWriter: the publishing aspect would emit a message per heartbeat.
    private void refreshLastSeen(Machine machine, Instant eventTimestamp) {
        machineRepository.updateLastSeen(machine.getMachineId(), eventTimestamp);
        log.debug("Refreshed lastSeen for machineId={} at {} (status {})",
                machine.getMachineId(), eventTimestamp, machine.getStatus());
    }

    // Field-level: a whole-document save would overwrite what other writers set on the machine since it was read
    private boolean recordFlip(Machine machine, TelemetryStatus previous, TelemetryStatus telemetry, Instant eventTimestamp) {
        String machineId = machine.getMachineId();
        Optional<MachineWriteResult> written = machineWriter.update(machineId, connectivityUpdate(machine, telemetry, eventTimestamp));
        if (written.isEmpty()) {
            log.info("Machine {} disappeared before its connectivity {} could be recorded", machineId, telemetry);
            return false;
        }
        Machine updated = written.get().after();
        log.debug("Updated machineId={} to connectivity={} at {} (status {})",
                machineId, telemetry, eventTimestamp, updated.getStatus());

        if (previous == OFFLINE && telemetry == ONLINE) {
            log.info("Device came online (offline->online): machineId={}", machineId);
            eventPublisher.publishEvent(new DeviceCameOnlineEvent(this, updated));
        }
        return true;
    }

    private static MachineUpdate connectivityUpdate(Machine machine, TelemetryStatus telemetry, Instant eventTimestamp) {
        MachineUpdate update = machineUpdate()
                .set(TELEMETRY_STATUS, telemetry)
                .set(LAST_SEEN, eventTimestamp);
        if (machine.getFirstConnectedAt() == null) {
            update.set(FIRST_CONNECTED_AT, eventTimestamp);
        }
        return update;
    }

    private void logStaleEvent(Machine machine, Instant eventTimestamp) {
        log.warn("Ignored stale event for machineId={} eventTimestamp={} lastSeen={} currentStatus={}",
                machine.getMachineId(),
                eventTimestamp,
                machine.getLastSeen(),
                machine.getStatus());
    }
}

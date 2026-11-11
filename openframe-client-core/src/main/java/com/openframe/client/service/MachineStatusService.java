package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
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
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.data.document.device.TelemetryStatus.OFFLINE;
import static com.openframe.data.document.device.TelemetryStatus.ONLINE;
import static com.openframe.data.service.machine.MachineFields.FIRST_CONNECTED_AT;
import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.TELEMETRY_STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

// Connectivity only: the lifecycle status is owned by registration, promotion, deletion and the archive job.
@Service
@RequiredArgsConstructor
@Slf4j
public class MachineStatusService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
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
        } else if (!recordFlip(machine, previous, telemetry, eventTimestamp)) {
            return;
        }

        if (machine.getStatus() == DeviceStatus.PENDING) {
            deviceLifecycleService.promoteIfReady(machineId);
        }
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
        MachineUpdate update = machineUpdate()
                .set(TELEMETRY_STATUS, telemetry)
                .set(LAST_SEEN, eventTimestamp);
        if (machine.getFirstConnectedAt() == null) {
            update.set(FIRST_CONNECTED_AT, eventTimestamp);
        }
        Optional<MachineWriteResult> written = machineWriter.update(machineId, update);
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

    private void logStaleEvent(Machine machine, Instant eventTimestamp) {
        log.warn("Ignored stale event for machineId={} eventTimestamp={} lastSeen={} currentStatus={}",
                machine.getMachineId(),
                eventTimestamp,
                machine.getLastSeen(),
                machine.getStatus());
    }
}

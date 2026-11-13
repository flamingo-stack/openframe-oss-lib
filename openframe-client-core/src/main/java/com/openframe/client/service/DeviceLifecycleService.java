package com.openframe.client.service;

import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.data.document.device.RequiredTools.REQUIRED_TOOL_TYPES;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceLifecycleService {

    private final MachineRepository machineRepository;
    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineWriter machineWriter;
    private final ApplicationEventPublisher eventPublisher;

    public void promoteIfReady(String machineId) {
        Optional<Machine> found = machineRepository.findByMachineId(machineId);
        if (found.isEmpty()) {
            log.warn("Promotion check for unknown machine {}, ignoring", machineId);
            return;
        }
        Machine machine = found.get();
        if (machine.getStatus() != DeviceStatus.PENDING) {
            return;
        }
        if (!hasReported(machine)) {
            log.debug("Machine {} stays PENDING: no heartbeat since registration", machineId);
            return;
        }
        if (!allRequiredToolsConnected(machineId)) {
            log.debug("Machine {} stays PENDING: required tools not all connected", machineId);
            return;
        }
        promote(machineId);
    }

    private static boolean hasReported(Machine machine) {
        Instant lastSeen = machine.getLastSeen();
        Instant registeredAt = machine.getRegisteredAt();
        return lastSeen != null && (registeredAt == null || lastSeen.isAfter(registeredAt));
    }

    private boolean allRequiredToolsConnected(String machineId) {
        List<ToolConnection> connected = toolConnectionRepository.findByMachineIdAndToolTypeInAndStatus(
                machineId, REQUIRED_TOOL_TYPES, ConnectionStatus.CONNECTED);
        Set<ToolType> connectedTypes = connected.stream()
                .filter(connection -> isNotBlank(connection.getAgentToolId()))
                .map(ToolConnection::getToolType)
                .collect(Collectors.toSet());
        return connectedTypes.containsAll(REQUIRED_TOOL_TYPES);
    }

    // The guard makes the promotion atomic: a heartbeat and a tool connection racing here promote once and publish once.
    private void promote(String machineId) {
        Criteria stillPending = Criteria.where(STATUS.path()).is(DeviceStatus.PENDING);
        MachineUpdate toManaged = machineUpdate().set(STATUS, DeviceStatus.MANAGED);
        Optional<MachineWriteResult> written = machineWriter.update(machineId, stillPending, toManaged);
        if (written.isEmpty()) {
            log.debug("Machine {} was promoted concurrently, nothing to do", machineId);
            return;
        }
        Machine promoted = written.get().after();
        log.info("Device promoted PENDING -> MANAGED: machineId={}", machineId);
        eventPublisher.publishEvent(new DeviceFirstConnectedEvent(this, promoted));
    }
}

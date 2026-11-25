package com.openframe.client.service;

import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
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
    private final ToolOsSupportService toolOsSupportService;

    public void promoteIfReady(String machineId) {
        machineRepository.findByMachineId(machineId).ifPresentOrElse(
                this::promoteIfEligible,
                () -> log.warn("Promotion check for unknown machine {}, ignoring", machineId));
    }

    private void promoteIfEligible(Machine machine) {
        String machineId = machine.getMachineId();
        if (machine.getStatus() != DeviceStatus.PENDING) {
            return;
        }
        if (!hasReported(machine)) {
            log.debug("Machine {} stays PENDING: no heartbeat since registration", machineId);
            return;
        }
        if (!allRequiredToolsConnected(machine)) {
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

    private boolean allRequiredToolsConnected(Machine machine) {
        Set<ToolType> required = EnumSet.copyOf(REQUIRED_TOOL_TYPES);
        required.removeAll(toolOsSupportService.unsupportedToolTypes(machine));
        List<ToolConnection> connected = toolConnectionRepository.findByMachineIdAndToolTypeInAndStatus(
                machine.getMachineId(), required, ConnectionStatus.CONNECTED);
        Set<ToolType> connectedTypes = connected.stream()
                .filter(connection -> isNotBlank(connection.getAgentToolId()))
                .map(ToolConnection::getToolType)
                .collect(Collectors.toSet());
        return connectedTypes.containsAll(required);
    }

    // The guard makes the promotion atomic: a heartbeat and a tool connection racing here promote once and publish once.
    private void promote(String machineId) {
        Criteria stillPending = Criteria.where(STATUS.path()).is(DeviceStatus.PENDING);
        MachineUpdate toManaged = machineUpdate().set(STATUS, DeviceStatus.MANAGED);
        machineWriter.update(machineId, stillPending, toManaged)
                .map(MachineWriteResult::after)
                .ifPresentOrElse(
                        this::announcePromotion,
                        () -> log.debug("Machine {} was promoted concurrently, nothing to do", machineId));
    }

    private void announcePromotion(Machine promoted) {
        log.info("Device promoted PENDING -> MANAGED: machineId={}", promoted.getMachineId());
        eventPublisher.publishEvent(new DeviceFirstConnectedEvent(this, promoted));
    }
}

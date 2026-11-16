package com.openframe.client.service;

import com.openframe.client.exception.InvalidAgentIdException;
import com.openframe.client.exception.InvalidToolTypeException;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.client.service.agentregistration.transformer.ToolAgentIdTransformerService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.apache.commons.lang3.math.NumberUtils.toLong;
import static org.springframework.util.StringUtils.hasText;

/**
 * Records confirmed provider registrations and retains unresolved Fleet reports for a later client retry.
 * Conditional registration writes prevent a delayed provider lookup from overwriting a newer connection state.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ToolConnectionService {

    private static final String INVALID_RESOLVED_IDENTIFIER = "Provider did not return a usable final agent identifier";
    private static final String RESOLUTION_FAILED = "Tool registration resolution failed";
    private static final String MACHINE_NO_LONGER_MANAGED = "Machine is no longer managed: ";
    private static final String UNCONFIRMED_REGISTRATION_LOG =
            "Fleet registration remains unconfirmed: machineId={}, errorType={}; awaiting a later client report";
    private static final String STALE_REGISTRATION_LOG =
            "Skipped stale registration result: machineId={}, toolType={}";
    private static final String REGISTRATION_STORED_LOG =
            "Stored tool registration: tenantId={}, machineId={}, toolType={}, status={}";

    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineRepository machineRepository;
    private final ToolAgentIdTransformerService toolAgentIdTransformerService;

    @Transactional
    public void disconnectAll(String machineId) {
        List<ToolConnection> connections = toolConnectionRepository.findByMachineId(machineId);
        connections.forEach(this::markDisconnected);
        log.info("Marked {} tool connections DISCONNECTED for machine {}", connections.size(), machineId);
    }

    private void markDisconnected(ToolConnection connection) {
        if (connection.getStatus() == ConnectionStatus.DISCONNECTED) {
            return;
        }
        connection.setStatus(ConnectionStatus.DISCONNECTED);
        connection.setDisconnectedAt(Instant.now());
        toolConnectionRepository.save(connection);
    }

    @Transactional
    public void addToolConnection(String openframeAgentId, String toolTypeValue, String agentToolId, boolean lastAttempt) {
        validateAgentId(openframeAgentId);
        validateToolType(toolTypeValue);
        Machine machine = requireManagedMachine(openframeAgentId);
        ToolType toolType = getToolTypeFromString(toolTypeValue);
        ToolConnection observed = toolConnectionRepository.findByMachineIdAndToolType(openframeAgentId, toolType)
                .orElseGet(() -> createConnection(machine.getMachineId(), machine.getTenantId(), toolType));

        resolveRegistration(observed, agentToolId, lastAttempt)
                .ifPresent(registration -> persistRegistration(observed, registration));
    }

    private Optional<ToolConnection> resolveRegistration(ToolConnection observed, String reportedId, boolean lastAttempt) {
        try {
            return Optional.of(resolveConfirmedRegistration(observed, reportedId, lastAttempt));
        } catch (Exception failure) {
            return retainUnconfirmedRegistration(observed, reportedId, lastAttempt, failure);
        }
    }

    private ToolConnection resolveConfirmedRegistration(ToolConnection observed, String reportedId, boolean lastAttempt) {
        String resolvedId = toolAgentIdTransformerService.transform(
                observed.getToolType(), observed.getMachineId(), reportedId, lastAttempt);
        boolean invalidIdentifier = !hasText(resolvedId)
                || (observed.getToolType() == ToolType.FLEET_MDM && toLong(resolvedId, 0L) <= 0);
        if (invalidIdentifier) {
            throw new InvalidAgentIdException(INVALID_RESOLVED_IDENTIFIER);
        }
        return buildRegistration(observed, resolvedId, ConnectionStatus.CONNECTED);
    }

    private Optional<ToolConnection> retainUnconfirmedRegistration(ToolConnection observed, String reportedId,
                                                           boolean lastAttempt, Exception failure) {
        boolean retainForLaterReport = lastAttempt && observed.getToolType() == ToolType.FLEET_MDM;
        if (!retainForLaterReport) {
            throw new IllegalStateException(RESOLUTION_FAILED, failure);
        }
        log.warn(UNCONFIRMED_REGISTRATION_LOG, observed.getMachineId(), failure.getClass().getSimpleName());
        if (hasConfirmedFleetRegistration(observed)) {
            return Optional.empty();
        }
        return Optional.of(buildRegistration(observed, reportedId, ConnectionStatus.ERROR));
    }

    private boolean hasConfirmedFleetRegistration(ToolConnection connection) {
        return connection.getStatus() == ConnectionStatus.CONNECTED && toLong(connection.getAgentToolId(), 0L) > 0;
    }

    private ToolConnection buildRegistration(ToolConnection observed, String agentToolId, ConnectionStatus status) {
        ToolConnection registration = createConnection(observed.getMachineId(), observed.getTenantId(), observed.getToolType());
        registration.setAgentToolId(agentToolId);
        registration.setStatus(status);
        registration.setLastSyncAt(Instant.now());
        registration.setConnectedAt(observed.getConnectedAt());
        registration.setDisconnectedAt(observed.getDisconnectedAt());
        boolean newlyConnected = status == ConnectionStatus.CONNECTED && observed.getStatus() != ConnectionStatus.CONNECTED;
        if (newlyConnected) {
            registration.setConnectedAt(registration.getLastSyncAt());
            registration.setDisconnectedAt(null);
        }
        return registration;
    }

    private void persistRegistration(ToolConnection observed, ToolConnection registration) {
        if (observed.getId() == null) {
            toolConnectionRepository.insert(registration);
            logRegistrationStored(registration);
            return;
        }
        boolean unchangedConnected = observed.getStatus() == ConnectionStatus.CONNECTED
                && registration.getStatus() == ConnectionStatus.CONNECTED
                && Objects.equals(observed.getAgentToolId(), registration.getAgentToolId());
        if (unchangedConnected) {
            return;
        }
        if (toolConnectionRepository.updateRegistrationIfUnchanged(observed, registration) == 0) {
            log.debug(STALE_REGISTRATION_LOG, observed.getMachineId(), observed.getToolType());
            return;
        }
        logRegistrationStored(registration);
    }

    private void logRegistrationStored(ToolConnection registration) {
        log.info(REGISTRATION_STORED_LOG, registration.getTenantId(), registration.getMachineId(),
                registration.getToolType(), registration.getStatus());
    }

    private ToolConnection createConnection(String machineId, String tenantId, ToolType toolType) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId(machineId);
        connection.setTenantId(tenantId);
        connection.setToolType(toolType);
        return connection;
    }

    private Machine requireManagedMachine(String machineId) {
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new MachineNotFoundException("Machine not found: " + machineId));
        DeviceStatus status = machine.getStatus();
        boolean retired = DeviceStatus.DELETING_OR_DELETED.contains(status)
                || status == DeviceStatus.ARCHIVED || status == DeviceStatus.DECOMMISSIONED;
        if (retired) {
            throw new MachineNotFoundException(MACHINE_NO_LONGER_MANAGED + machineId);
        }
        return machine;
    }

    private void validateAgentId(String agentId) {
        if (!hasText(agentId)) {
            throw new InvalidAgentIdException("Agent ID cannot be empty");
        }
    }

    private void validateToolType(String toolType) {
        if (!hasText(toolType)) {
            throw new InvalidToolTypeException("Tool type cannot be empty");
        }
    }

    private ToolType getToolTypeFromString(String agentToolType) {
        try {
            return ToolType.valueOf(agentToolType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidToolTypeException("Invalid tool type: " + agentToolType);
        }
    }
}

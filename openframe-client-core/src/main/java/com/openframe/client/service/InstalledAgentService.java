package com.openframe.client.service;

import com.openframe.audit.AuditCapture;
import com.openframe.client.exception.InvalidAgentIdException;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.data.document.audit.AuditAction.DEVICE_DELIVERY_END;

@Service
@RequiredArgsConstructor
@Slf4j
public class InstalledAgentService {

    private final InstalledAgentRepository installedAgentRepository;
    private final MachineRepository machineRepository;
    private final AuditCapture auditCapture;

    @Transactional
    public void addInstalledAgent(String machineId, String agentType, String version, boolean lastAttempt) {
        validateMachineId(machineId);
        validateAgentType(agentType);
        validateMachineExists(machineId);

        log.info("Installed agent processing: machineId={}, agentType={}, version={}", machineId, agentType, version);

        installedAgentRepository
                .findByMachineIdAndAgentType(machineId, agentType)
                .ifPresentOrElse(
                        installedAgent -> updateExistingInstalledAgent(installedAgent, version, machineId, agentType),
                        () -> addNewInstalledAgent(machineId, agentType, version)
                );
    }

    @Transactional
    public void disconnectAll(String machineId) {
        List<InstalledAgent> agents = installedAgentRepository.findByMachineId(machineId);
        agents.forEach(this::markDisconnected);
        log.info("Marked {} installed agents DISCONNECTED for machine {}", agents.size(), machineId);
    }

    private void markDisconnected(InstalledAgent installedAgent) {
        if (installedAgent.getStatus() == ConnectionStatus.DISCONNECTED) {
            return;
        }
        installedAgent.setStatus(ConnectionStatus.DISCONNECTED);
        installedAgent.setUpdatedAt(Instant.now().toString());
        installedAgentRepository.save(installedAgent);
    }

    private void updateExistingInstalledAgent(
            InstalledAgent installedAgent,
            String version,
            String machineId,
            String agentType
    ) {
        boolean changed = installedAgent.getStatus() != ConnectionStatus.CONNECTED
                || !Objects.equals(installedAgent.getVersion(), version);
        installedAgent.setVersion(version);
        installedAgent.setStatus(ConnectionStatus.CONNECTED);
        installedAgent.setUpdatedAt(Instant.now().toString());
        installedAgentRepository.save(installedAgent);

        log.info("Updated existing installed agent: machineId={} agentType={} version={}",
                machineId, agentType, version);
        if (changed) {
            recordInstalled(machineId, agentType, version);
        }
    }

    private void recordInstalled(String machineId, String agentType, String version) {
        auditCapture.record(AuditEntry.builder()
                .action(DEVICE_DELIVERY_END)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(machineId)
                .details(Map.of("agentType", agentType, "version", version))
                .build());
    }

    private void addNewInstalledAgent(String machineId, String agentType, String version) {
        InstalledAgent installedAgent = new InstalledAgent();
        installedAgent.setMachineId(machineId);
        installedAgent.setAgentType(agentType);
        installedAgent.setVersion(version);
        installedAgent.setStatus(ConnectionStatus.CONNECTED);

        String now = Instant.now().toString();
        installedAgent.setCreatedAt(now);
        installedAgent.setUpdatedAt(now);

        installedAgentRepository.save(installedAgent);

        log.info("Saved new installed agent: machineId={} agentType={} version={}",
                machineId, agentType, version);
        recordInstalled(machineId, agentType, version);
    }

    private void validateMachineExists(String machineId) {
        if (machineRepository.findByMachineId(machineId).isEmpty()) {
            throw new MachineNotFoundException("Machine not found: " + machineId);
        }
    }

    private void validateMachineId(String machineId) {
        if (machineId == null || machineId.trim().isEmpty()) {
            throw new InvalidAgentIdException("Machine ID cannot be empty");
        }
    }

    private void validateAgentType(String agentType) {
        if (agentType == null || agentType.trim().isEmpty()) {
            throw new InvalidAgentIdException("Agent type cannot be empty");
        }
    }
}


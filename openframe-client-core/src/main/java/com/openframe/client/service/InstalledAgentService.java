package com.openframe.client.service;

import com.openframe.client.exception.InvalidAgentIdException;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.ClientVersionKey;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

import static com.openframe.data.service.machine.AgentVersionService.OPENFRAME_CLIENT_AGENT_TYPE;
import static com.openframe.data.service.machine.MachineFields.AGENT_VERSION;
import static com.openframe.data.service.machine.MachineFields.AGENT_VERSION_KEY;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class InstalledAgentService {

    private final InstalledAgentRepository installedAgentRepository;
    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;

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
        followClientVersion(machineId, agentType, version);
    }

    // The client reports its running version here on every start, so the machine follows its self-updates
    private void followClientVersion(String machineId, String agentType, String version) {
        if (!OPENFRAME_CLIENT_AGENT_TYPE.equals(agentType) || isBlank(version)) {
            return;
        }
        Long versionKey = ClientVersionKey.parse(version);
        boolean unchanged = machineRepository.findByMachineId(machineId)
                .filter(machine -> hasClientVersion(machine, version, versionKey))
                .isPresent();
        if (unchanged) {
            return;
        }
        MachineUpdate update = machineUpdate()
                .set(AGENT_VERSION, version)
                .set(AGENT_VERSION_KEY, versionKey);
        machineWriter.update(machineId, update);
        log.info("Machine {} now runs client version {}", machineId, version);
    }

    private static boolean hasClientVersion(Machine machine, String version, Long versionKey) {
        return version.equals(machine.getAgentVersion())
                && Objects.equals(versionKey, machine.getAgentVersionKey());
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
        installedAgent.setVersion(version);
        installedAgent.setStatus(ConnectionStatus.CONNECTED);
        installedAgent.setUpdatedAt(Instant.now().toString());
        installedAgentRepository.save(installedAgent);

        log.info("Updated existing installed agent: machineId={} agentType={} version={}",
                machineId, agentType, version);
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
    }

    private void validateMachineExists(String machineId) {
        if (!machineRepository.existsByMachineId(machineId)) {
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


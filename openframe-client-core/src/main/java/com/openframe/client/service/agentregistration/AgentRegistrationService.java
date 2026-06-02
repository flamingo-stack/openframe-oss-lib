package com.openframe.client.service.agentregistration;

import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.service.agentregistration.processor.AgentRegistrationProcessor;
import com.openframe.client.service.InstalledAgentService;
import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static com.openframe.client.service.AgentAuthService.CLIENT_CREDENTIALS_GRANT_TYPE;
import static java.lang.String.format;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentRegistrationService {

    private static final String AGENT_ROLE = "AGENT";
    private static final String CLIENT_ID_TEMPLATE = "agent_%s";
    private static final String OPENFRAME_CLIENT_AGENT_TYPE = "openframe-client";

    private final OAuthClientRepository oauthClientRepository;
    private final MachineRepository machineRepository;
    private final OrganizationIdResolver organizationIdResolver;
    private final AgentRegistrationSecretValidator secretValidator;
    private final ClientSecretValidator clientSecretValidator;
    private final AgentSecretGenerator agentSecretGenerator;
    private final PasswordEncoder passwordEncoder;
    private final MachineIdGenerator machineIdGenerator;
    private final AgentRegistrationToolInstallationService agentRegistrationToolInstallationService;
    private final AgentRegistrationProcessor agentRegistrationProcessor;
    private final RegistrationTagAssignmentService registrationTagAssignmentService;
    private final InstalledAgentService installedAgentService;

    @Transactional
    public AgentRegistrationResponse register(String initialKey, AgentRegistrationRequest request) {
        secretValidator.validate(initialKey);

        String machineId = machineIdGenerator.generate();
        String clientId = buildClientId(machineId);
        String clientSecret = agentSecretGenerator.generate();

        String resolvedOrganizationId = organizationIdResolver.resolve(request.getOrganizationId());

        saveOAuthClient(machineId, clientId, clientSecret);
        Machine machine = saveMachine(machineId, request, resolvedOrganizationId);

        setupAgent(machine, request);

        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
    }

    private Machine loadMachine(String machineId) {
        return machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new IllegalStateException("Machine not found for registered client: " + machineId));
    }

    private String buildClientId(String machineId) {
        return format(CLIENT_ID_TEMPLATE, machineId);
    }

    private void saveOAuthClient(String machineId, String clientId, String clientSecret) {
        if (oauthClientRepository.existsByMachineId(machineId)) {
            log.error("Generated non unique machine id {}", machineId);
            throw new IllegalStateException("Failed to register client");
        }

        OAuthClient client = new OAuthClient();
        client.setClientId(clientId);
        client.setClientSecret(passwordEncoder.encode(clientSecret));
        client.setMachineId(machineId);
        client.setGrantTypes(new String[]{CLIENT_CREDENTIALS_GRANT_TYPE});
        client.setRoles(new String[]{AGENT_ROLE});

        oauthClientRepository.save(client);
    }

    private Machine saveMachine(String machineId, AgentRegistrationRequest request, String organizationId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        applyReportedFields(machine, request);
        machine.setStatus(DeviceStatus.PENDING);
        machine.setOrganizationId(organizationId);
        machine.setType(DeviceType.DESKTOP);

        Machine savedMachine = machineRepository.save(machine);

        log.info("Saved machine {} with organizationId: {}", machineId, organizationId);

        return savedMachine;
    }

    @Transactional
    public AgentRegistrationResponse reinstall(String initialKey, String machineId, String clientSecret, AgentRegistrationRequest request) {
        secretValidator.validate(initialKey);
        OAuthClient client = clientSecretValidator.validate(machineId, clientSecret);

        Machine machine = loadMachine(machineId);
        updateMachine(machine, request);
        setupAgent(machine, request);

        String clientId = client.getClientId();
        log.info("Reinstall for existing machine {}, machine data overwritten", machineId);
        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
    }

    private void setupAgent(Machine machine, AgentRegistrationRequest request) {
        String machineId = machine.getMachineId();

        saveInstalledAgent(machineId, request);
        registrationTagAssignmentService.assignTags(machineId, request.getTags());
        agentRegistrationToolInstallationService.process(machineId);
        agentRegistrationProcessor.postProcessAgentRegistration(machine, request);
    }

    private void saveInstalledAgent(String machineId, AgentRegistrationRequest request) {
        String agentVersion = request.getAgentVersion();
        installedAgentService.addInstalledAgent(machineId, OPENFRAME_CLIENT_AGENT_TYPE, agentVersion, false);
    }

    private void updateMachine(Machine machine, AgentRegistrationRequest request) {
        applyReportedFields(machine, request);

        String organizationId = organizationIdResolver.resolve(request.getOrganizationId());
        machine.setOrganizationId(organizationId);

        machineRepository.save(machine);

        String machineId = machine.getMachineId();
        log.info("Updated machine {} on reinstall, organizationId {}", machineId, organizationId);
    }

    private void applyReportedFields(Machine machine, AgentRegistrationRequest request) {
        machine.setHostname(request.getHostname());
        machine.setOsType(request.getOsType());
        machine.setAgentVersion(request.getAgentVersion());
        machine.setLastSeen(Instant.now());
    }

}

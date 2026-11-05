package com.openframe.client.service.agentregistration;

import com.openframe.audit.AuditCapture;
import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.exception.AgentRegistrationSecretValidationException;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.client.service.agentregistration.processor.AgentRegistrationProcessor;
import com.openframe.client.service.InstalledAgentService;
import com.openframe.client.service.ToolConnectionService;
import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static com.openframe.client.service.AgentAuthService.CLIENT_CREDENTIALS_GRANT_TYPE;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_ORGANIZATION_CHANGE;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REGISTER;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REGISTER_FAIL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REINSTALL;
import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentRegistrationService {

    private static final String AGENT_ROLE = "AGENT";
    private static final String CLIENT_ID_TEMPLATE = "agent_%s";
    private static final String OPENFRAME_CLIENT_AGENT_TYPE = "openframe-client";
    private static final Set<String> AVAILABLE_ZONES = ZoneId.getAvailableZoneIds();

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
    private final ToolConnectionService toolConnectionService;
    private final AgentRegistrationClientFeatureFlagsService agentRegistrationClientFeatureFlagsService;
    private final AgentRegistrationClientUpdateService agentRegistrationClientUpdateService;
    private final AuditCapture auditCapture;
    private final AuditRecorder auditRecorder;

    public AgentRegistrationResponse register(String initialKey, AgentRegistrationRequest request) {
        String enrollmentKeyId = validateInitialKey(initialKey, null, request);
        String machineId = machineIdGenerator.generate();
        Map<String, Object> details = new HashMap<>();
        details.put("enrollmentKeyId", enrollmentKeyId);
        details.put("claimedUserId", request.getUserId());
        return auditCapture.run(DEVICE_REGISTER, machineId, details, () -> registerMachine(machineId, request));
    }

    private AgentRegistrationResponse registerMachine(String machineId, AgentRegistrationRequest request) {
        String clientId = buildClientId(machineId);
        String clientSecret = agentSecretGenerator.generate();

        String resolvedOrganizationId = organizationIdResolver.resolve(request.getOrganizationId());

        createOAuthClient(machineId, clientId, clientSecret);
        Machine machine = createMachine(machineId, request, resolvedOrganizationId);

        postProcessMachine(machine, request);

        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
    }

    private Machine loadMachine(String machineId) {
        return machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new IllegalStateException("Machine not found for registered client: " + machineId));
    }

    private String buildClientId(String machineId) {
        return format(CLIENT_ID_TEMPLATE, machineId);
    }

    private void createOAuthClient(String machineId, String clientId, String clientSecret) {
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

    private Machine createMachine(String machineId, AgentRegistrationRequest request, String organizationId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        applyRegistrationRequestFields(machine, request);
        machine.setStatus(DeviceStatus.PENDING);
        machine.setOrganizationId(organizationId);
        machine.setType(DeviceType.DESKTOP);

        Machine savedMachine = machineRepository.save(machine);

        log.info("Saved machine {} with organizationId: {}", machineId, organizationId);

        return savedMachine;
    }

    public AgentRegistrationResponse reinstall(String initialKey, String machineId, String clientSecret, AgentRegistrationRequest request) {
        validateInitialKey(initialKey, machineId, request);
        OAuthClient client = loadOAuthClient(machineId, request);
        clientSecretValidator.validate(client, clientSecret);
        AuditContext device = auditRecorder.context(AuditActor.fromAgent(machineId, List.of(AGENT_ROLE), null));
        return auditRecorder.within(device, () -> auditCapture.run(DEVICE_REINSTALL, machineId,
                () -> reinstallMachine(machineId, clientSecret, client, request)));
    }

    private AgentRegistrationResponse reinstallMachine(String machineId, String clientSecret, OAuthClient client,
                                                       AgentRegistrationRequest request) {
        log.info("Reinstall for existing machine {}", machineId);

        Machine machine = loadMachine(machineId);
        updateMachine(machine, request);
        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);
        postProcessMachine(machine, request);

        String clientId = client.getClientId();
        log.info("Reinstall for existing machine {}, machine data overwritten", machineId);
        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
    }

    private OAuthClient loadOAuthClient(String machineId, AgentRegistrationRequest request) {
        return oauthClientRepository.findByMachineId(machineId)
                .orElseThrow(() -> {
                    log.warn("Reinstall requested for unknown machine {}", machineId);
                    recordRefusal(DEVICE_AUTH_FAIL, machineId, "Unknown machine", request);
                    return new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret");
                });
    }

    private String validateInitialKey(String initialKey, String machineId, AgentRegistrationRequest request) {
        try {
            return secretValidator.validate(initialKey);
        } catch (AgentRegistrationSecretValidationException e) {
            recordRefusal(DEVICE_REGISTER_FAIL, machineId, e.getMessage(), request);
            throw e;
        }
    }

    private void recordRefusal(AuditAction action, String machineId, String reason, AgentRegistrationRequest request) {
        Map<String, Object> details = new HashMap<>();
        details.put("claimedHostname", request.getHostname());
        details.put("claimedOrganizationId", request.getOrganizationId());
        auditRecorder.record(AuditEntry.builder()
                .action(action)
                .outcome(AuditOutcome.REFUSED)
                .reason(reason)
                .targetId(machineId)
                .details(details)
                .build());
    }

    private void postProcessMachine(Machine machine, AgentRegistrationRequest request) {
        String machineId = machine.getMachineId();

        saveInstalledAgent(machineId, request);
        registrationTagAssignmentService.assignTags(machineId, request.getTags());
        agentRegistrationToolInstallationService.process(machineId);
        agentRegistrationClientFeatureFlagsService.process(machineId);
        agentRegistrationClientUpdateService.process(machineId);
        agentRegistrationProcessor.postProcessAgentRegistration(machine, request);
    }

    private void saveInstalledAgent(String machineId, AgentRegistrationRequest request) {
        String agentVersion = request.getAgentVersion();
        installedAgentService.addInstalledAgent(machineId, OPENFRAME_CLIENT_AGENT_TYPE, agentVersion, false);
    }

    private void updateMachine(Machine machine, AgentRegistrationRequest request) {
        applyRegistrationRequestFields(machine, request);
        machine.setStatus(DeviceStatus.PENDING);

        String previousOrganizationId = machine.getOrganizationId();
        String organizationId = organizationIdResolver.resolve(request.getOrganizationId());
        machine.setOrganizationId(organizationId);

        machineRepository.save(machine);

        String machineId = machine.getMachineId();
        log.info("Updated machine {} on reinstall, organizationId {}", machineId, organizationId);
        if (!Objects.equals(previousOrganizationId, organizationId)) {
            recordOrganizationChange(machine, previousOrganizationId);
        }
    }

    private void recordOrganizationChange(Machine machine, String previousOrganizationId) {
        String organizationId = machine.getOrganizationId();
        auditRecorder.record(AuditEntry.builder()
                .action(DEVICE_ORGANIZATION_CHANGE)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(machine.getMachineId())
                .targetName(machine.getHostname())
                .organizationId(organizationId)
                .deviceId(machine.getMachineId())
                .changes(Map.of("organizationId", new AuditChange(previousOrganizationId, organizationId)))
                .build());
    }

    private void applyRegistrationRequestFields(Machine machine, AgentRegistrationRequest request) {
        machine.setHostname(request.getHostname());
        machine.setOsType(normalizeOsType(request.getOsType()));
        machine.setAgentVersion(request.getAgentVersion());
        machine.setLastSeen(Instant.now());
        // Optional; keep the existing value on reinstall when the agent doesn't send it
        if (isNotBlank(request.getUserId())) {
            machine.setUserId(request.getUserId());
        }
        if (isNotBlank(request.getTimezone()) && isValidZone(request.getTimezone())) {
            machine.setTimezone(request.getTimezone());
        }
    }

    private static boolean isValidZone(String timezone) {
        return AVAILABLE_ZONES.contains(timezone);
    }

    private static OsType normalizeOsType(String rawOsType) {
        try {
            return OsType.valueOf(rawOsType);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("Unsupported osType reported by agent: " + rawOsType);
        }
    }

}

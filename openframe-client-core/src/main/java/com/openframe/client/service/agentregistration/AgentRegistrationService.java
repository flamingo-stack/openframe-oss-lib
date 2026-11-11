package com.openframe.client.service.agentregistration;

import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.client.service.agentregistration.processor.AgentRegistrationProcessor;
import com.openframe.client.service.InstalledAgentService;
import com.openframe.client.service.ToolConnectionService;
import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.machine.MachineField;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;

import static com.openframe.client.service.AgentAuthService.CLIENT_CREDENTIALS_GRANT_TYPE;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static com.openframe.data.service.machine.MachineFields.AGENT_VERSION;
import static com.openframe.data.service.machine.MachineFields.HOSTNAME;
import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.MANUFACTURER;
import static com.openframe.data.service.machine.MachineFields.MODEL;
import static com.openframe.data.service.machine.MachineFields.ORGANIZATION_ID;
import static com.openframe.data.service.machine.MachineFields.OS_TYPE;
import static com.openframe.data.service.machine.MachineFields.OS_UUID;
import static com.openframe.data.service.machine.MachineFields.SERIAL_NUMBER;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineFields.TIMEZONE;
import static com.openframe.data.service.machine.MachineFields.USER_ID;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
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
    private final MachineWriter machineWriter;
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

    public AgentRegistrationResponse register(String initialKey, AgentRegistrationRequest request) {
        secretValidator.validate(initialKey);

        String machineId = machineIdGenerator.generate();
        String clientId = buildClientId(machineId);
        String clientSecret = agentSecretGenerator.generate();

        String resolvedOrganizationId = organizationIdResolver.resolve(request.getOrganizationId());

        createOAuthClient(machineId, clientId, clientSecret);
        Machine machine = createMachine(machineId, request, resolvedOrganizationId);

        postProcessMachine(machine, request);

        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
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
        registrationRequestFields(request).applyTo(machine);
        machine.setStatus(DeviceStatus.PENDING);
        machine.setOrganizationId(organizationId);
        machine.setType(DeviceType.DESKTOP);

        Machine savedMachine = machineRepository.save(machine);

        log.info("Saved machine {} with organizationId: {}", machineId, organizationId);

        return savedMachine;
    }

    public AgentRegistrationResponse reinstall(String initialKey, String machineId, String clientSecret, AgentRegistrationRequest request) {
        secretValidator.validate(initialKey);

        OAuthClient client = loadOAuthClient(machineId);
        clientSecretValidator.validate(client, clientSecret);

        log.info("Reinstall for existing machine {}", machineId);

        Machine machine = updateMachine(machineId, request);
        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);
        postProcessMachine(machine, request);

        String clientId = client.getClientId();
        log.info("Reinstall for existing machine {}, machine data overwritten", machineId);
        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
    }

    private OAuthClient loadOAuthClient(String machineId) {
        return oauthClientRepository.findByMachineId(machineId)
                .orElseThrow(() -> {
                    log.warn("Reinstall requested for unknown machine {}", machineId);
                    return new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret");
                });
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

    // Field-level: the machine already exists, and a whole-document save would overwrite what other writers set on it
    // (the directory summary, Fleet hardware facts) since it was read
    private Machine updateMachine(String machineId, AgentRegistrationRequest request) {
        MachineUpdate update = registrationRequestFields(request).set(STATUS, DeviceStatus.PENDING);
        String organizationId = organizationIdResolver.resolve(request.getOrganizationId());
        update.set(ORGANIZATION_ID, organizationId);

        Machine machine = machineWriter.update(machineId, update)
                .map(MachineWriteResult::after)
                .orElseThrow(() -> new IllegalStateException("Machine not found for registered client: " + machineId));

        log.info("Updated machine {} on reinstall, organizationId {}", machineId, organizationId);
        return machine;
    }

    private MachineUpdate registrationRequestFields(AgentRegistrationRequest request) {
        MachineUpdate update = machineUpdate()
                .set(HOSTNAME, request.getHostname())
                .set(OS_TYPE, normalizeOsType(request.getOsType()))
                .set(AGENT_VERSION, request.getAgentVersion())
                .set(LAST_SEEN, Instant.now());
        // Optional; keep the existing value on reinstall when the agent doesn't send it
        setIfNotBlank(update, USER_ID, request.getUserId());
        if (isNotBlank(request.getTimezone()) && isValidZone(request.getTimezone())) {
            update.set(TIMEZONE, request.getTimezone());
        }
        copyHardwareFacts(update, request);
        return update;
    }

    // Optional like userId: a fact the agent does not send keeps the stored value, and Fleet fills what is still
    // blank once it knows the host (FleetHostFactsWriter)
    private static void copyHardwareFacts(MachineUpdate update, AgentRegistrationRequest request) {
        setIfNotBlank(update, SERIAL_NUMBER, request.getSerialNumber());
        setIfNotBlank(update, MANUFACTURER, request.getManufacturer());
        setIfNotBlank(update, MODEL, request.getModel());
        setIfNotBlank(update, OS_UUID, request.getOsUuid());
    }

    private static void setIfNotBlank(MachineUpdate update, MachineField<String> field, String value) {
        if (isNotBlank(value)) {
            update.set(field, value);
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

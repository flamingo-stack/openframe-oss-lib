package com.openframe.client.service.agentregistration;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
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
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.device.ClientVersionKey;
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
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import static com.openframe.client.service.AgentAuthService.CLIENT_CREDENTIALS_GRANT_TYPE;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_ORGANIZATION_CHANGE;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REGISTER;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REGISTER_FAIL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REINSTALL;
import static com.openframe.data.service.machine.AgentVersionService.OPENFRAME_CLIENT_AGENT_TYPE;
import static com.openframe.data.service.machine.MachineFields.AGENT_VERSION;
import static com.openframe.data.service.machine.MachineFields.AGENT_VERSION_KEY;
import static com.openframe.data.service.machine.MachineFields.HOSTNAME;
import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.MANUFACTURER;
import static com.openframe.data.service.machine.MachineFields.MODEL;
import static com.openframe.data.service.machine.MachineFields.ORGANIZATION_ASSIGNED_AT;
import static com.openframe.data.service.machine.MachineFields.ORGANIZATION_ID;
import static com.openframe.data.service.machine.MachineFields.OS_BUILD;
import static com.openframe.data.service.machine.MachineFields.OS_TYPE;
import static com.openframe.data.service.machine.MachineFields.OS_UUID;
import static com.openframe.data.service.machine.MachineFields.OS_VERSION;
import static com.openframe.data.service.machine.MachineFields.PENDING_SINCE;
import static com.openframe.data.service.machine.MachineFields.SERIAL_NUMBER;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineFields.STUCK_NOTIFIED_AT;
import static com.openframe.data.service.machine.MachineFields.TIMEZONE;
import static com.openframe.data.service.machine.MachineFields.USER_ID;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

/** Registers and restores agent enrollment while keeping the device's identity. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AgentRegistrationService {

    private static final String AGENT_ROLE = "AGENT";
    private static final String CLIENT_ID_TEMPLATE = "agent_%s";
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
    private final AuditedMethodRunner auditedMethodRunner;
    private final AuditRecorder auditRecorder;
    private final DeletedMachineCleanup deletedMachineCleanup;

    public AgentRegistrationResponse register(String initialKey, AgentRegistrationRequest request) {
        String enrollmentKeyId = validateInitialKey(initialKey, null, request);
        String machineId = machineIdGenerator.generate();
        Map<String, Object> details = detailsOfRegistration(enrollmentKeyId, request);
        return auditedMethodRunner.run(DEVICE_REGISTER, machineId, details,
                () -> registerMachine(machineId, request, details));
    }

    private static Map<String, Object> detailsOfRegistration(String enrollmentKeyId, AgentRegistrationRequest request) {
        Map<String, Object> details = new HashMap<>();
        details.put("enrollmentKeyId", enrollmentKeyId);
        if (isNotBlank(request.getUserId())) {
            details.put("claimedUserId", request.getUserId());
        }
        return details;
    }

    private AgentRegistrationResponse registerMachine(String machineId, AgentRegistrationRequest request,
                                                      Map<String, Object> auditDetails) {
        String clientId = buildClientId(machineId);
        String clientSecret = agentSecretGenerator.generate();

        String resolvedOrganizationId = organizationIdResolver.resolve(request.getOrganizationId());
        addClaimedOrganization(auditDetails, request, resolvedOrganizationId);

        createOAuthClient(machineId, clientId, clientSecret);
        // TODO(CU-17tkuw6a582): a real serial number matching a WIPED device of the tenant reuses that device instead
        Machine machine = createMachine(machineId, request, resolvedOrganizationId);

        try {
            postProcessMachine(machine, request, auditDetails);
        } catch (RuntimeException e) {
            discardFailedRegistration(machineId);
            throw e;
        }

        return new AgentRegistrationResponse(machineId, clientId, clientSecret);
    }

    // The agent never received this machine id and registers again under a new one, so the device would stay PENDING
    // forever. A write, not a read-then-write: a read this soon after the insert can miss the machine on a secondary
    private void discardFailedRegistration(String machineId) {
        try {
            Optional<Machine> discarded = machineWriter.update(machineId, machineUpdate().set(STATUS, DeviceStatus.DELETED))
                    .map(MachineWriteResult::after);
            installedAgentService.disconnectAll(machineId);
            discarded.map(Machine::getTenantId)
                    .ifPresent(tenantId -> deletedMachineCleanup.cleanUpDeletedMachine(tenantId, machineId));
            log.warn("Registration failed after the machine was saved, machine {} marked DELETED", machineId);
        } catch (RuntimeException e) {
            log.error("Failed to discard machine {} of a failed registration", machineId, e);
        }
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
        MachineUpdate update = registrationRequestFields(request);
        backToPending(update);
        update.applyTo(machine);
        machine.setOrganizationId(organizationId);
        machine.setOrganizationAssignedAt(Instant.now());
        machine.setType(DeviceType.DESKTOP);

        Machine savedMachine = machineRepository.save(machine);

        log.info("Saved machine {} with organizationId: {}", machineId, organizationId);

        return savedMachine;
    }

    public AgentRegistrationResponse reinstall(String initialKey, String machineId, String clientSecret, AgentRegistrationRequest request) {
        String enrollmentKeyId = validateInitialKey(initialKey, machineId, request);
        OAuthClient client = loadOAuthClient(machineId, request);
        clientSecretValidator.validate(client, clientSecret, "reinstall");
        AuditContext device = auditRecorder.context(AuditActor.fromAgent(machineId, List.of(client.getRoles()), null));
        Map<String, Object> details = detailsOfRegistration(enrollmentKeyId, request);
        AuditCall auditCall = AuditCall.of(DEVICE_REINSTALL, machineId, details).withStoreIfUnchanged(_ -> true);
        return auditRecorder.runInContext(device, () -> auditedMethodRunner.run(auditCall,
                () -> reinstallMachine(machineId, clientSecret, client, request, details)));
    }

    private AgentRegistrationResponse reinstallMachine(String machineId, String clientSecret, OAuthClient client,
                                                       AgentRegistrationRequest request,
                                                       Map<String, Object> auditDetails) {
        log.info("Reinstall for existing machine {}", machineId);

        Machine machine = updateMachine(machineId, request, auditDetails);
        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);
        postProcessMachine(machine, request, auditDetails);

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
        String route = machineId == null ? "register" : "reinstall";
        Map<String, Object> details = new HashMap<>();
        details.put("request", route);
        details.put("claimedHostname", request.getHostname());
        details.put("claimedOrganizationId", request.getOrganizationId());
        String deviceKey = Objects.requireNonNullElse(machineId,
                request.getOrganizationId() + ":" + request.getHostname());
        auditRecorder.recordOnce(AuditEntry.builder()
                .action(action)
                .outcome(AuditOutcome.REFUSED)
                .reason(reason)
                .targetId(machineId)
                .details(details)
                .build(), route + ":" + deviceKey);
    }

    private void postProcessMachine(Machine machine, AgentRegistrationRequest request,
                                    Map<String, Object> auditDetails) {
        String machineId = machine.getMachineId();

        saveInstalledAgent(machineId, request);
        List<String> assignedTags = registrationTagAssignmentService.assignTags(machineId, request.getTags());
        if (!assignedTags.isEmpty()) {
            auditDetails.put("tags", assignedTags);
        }
        agentRegistrationToolInstallationService.process(machineId, auditRecorder.context());
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
    private Machine updateMachine(String machineId, AgentRegistrationRequest request,
                                  Map<String, Object> auditDetails) {
        Optional<Machine> existing = machineRepository.findOnPrimaryByMachineId(machineId);
        MachineUpdate update = registrationRequestFields(request);
        backToPending(update);
        String organizationId = organizationIdResolver.resolve(request.getOrganizationId());
        addClaimedOrganization(auditDetails, request, organizationId);
        update.set(ORGANIZATION_ID, organizationId);
        boolean newEnrollment = isNewEnrollment(existing, organizationId);
        if (newEnrollment) {
            update.set(ORGANIZATION_ASSIGNED_AT, Instant.now());
        }

        Machine machine = existing.filter(value -> value.getStatus() == DeviceStatus.DELETED)
                .map(value -> deletedMachineCleanup.reenrollDeleted(value, update))
                .orElseGet(() -> updateRegisteredMachine(machineId, update));

        log.info("Updated machine {} on reinstall, organizationId {}", machineId, organizationId);
        if (newEnrollment) {
            recordOrganizationChange(machine, existing.orElseThrow().getOrganizationId());
        }
        return machine;
    }

    private static void addClaimedOrganization(Map<String, Object> auditDetails, AgentRegistrationRequest request,
                                               String resolvedOrganizationId) {
        String claimed = request.getOrganizationId();
        if (!claimed.equals(resolvedOrganizationId)) {
            auditDetails.put("claimedOrganizationId", claimed);
        }
    }

    private Machine updateRegisteredMachine(String machineId, MachineUpdate update) {
        Criteria notDeleted = Criteria.where(STATUS.path()).ne(DeviceStatus.DELETED);
        return machineWriter.update(machineId, notDeleted, update)
                .map(MachineWriteResult::after)
                .orElseThrow(() -> new ConflictException("Device " + machineId + " changed during reinstall. Try again."));
    }

    private static boolean isNewEnrollment(Optional<Machine> existing, String organizationId) {
        return existing
                .map(machine -> !Objects.equals(machine.getOrganizationId(), organizationId))
                .orElse(false);
    }

    private void recordOrganizationChange(Machine machine, String previousOrganizationId) {
        String organizationId = machine.getOrganizationId();
        auditRecorder.record(AuditEntry.builder()
                .action(DEVICE_ORGANIZATION_CHANGE)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(machine.getMachineId())
                .targetName(machine.deviceName())
                .organizationId(organizationId)
                .deviceId(machine.getMachineId())
                .changes(Map.of("organizationId", new AuditChange(previousOrganizationId, organizationId)))
                .build());
    }

    private MachineUpdate registrationRequestFields(AgentRegistrationRequest request) {
        String agentVersion = request.getAgentVersion();
        Long agentVersionKey = ClientVersionKey.parse(agentVersion);
        MachineUpdate update = machineUpdate()
                .set(HOSTNAME, request.getHostname())
                .set(OS_TYPE, normalizeOsType(request.getOsType()))
                .set(AGENT_VERSION, agentVersion)
                .set(AGENT_VERSION_KEY, agentVersionKey)
                .set(LAST_SEEN, Instant.now());
        // Optional; keep the existing value on reinstall when the agent doesn't send it
        setIfNotBlank(update, USER_ID, request.getUserId());
        setIfNotBlank(update, OS_VERSION, request.getOsVersion());
        setIfNotBlank(update, OS_BUILD, request.getOsBuild());
        if (isNotBlank(request.getTimezone()) && isValidZone(request.getTimezone())) {
            update.set(TIMEZONE, request.getTimezone());
        }
        copyHardwareFacts(update, request);
        return update;
    }

    // The stuck-in-PENDING clock restarts and the alert re-arms; registeredAt stays the first registration the UI shows
    private static void backToPending(MachineUpdate update) {
        update.set(STATUS, DeviceStatus.PENDING)
                .set(PENDING_SINCE, Instant.now())
                .set(STUCK_NOTIFIED_AT, null);
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

package com.openframe.client.service;

import java.util.Map;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.client.exception.AgentRegistrationSecretValidationException;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.client.service.agentregistration.*;
import com.openframe.client.service.agentregistration.processor.AgentRegistrationProcessor;
import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.beans.BeanUtils;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.time.Instant;
import java.util.Optional;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REGISTER;
import static com.openframe.data.document.audit.AuditAction.DEVICE_REGISTER_FAIL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_ORGANIZATION_CHANGE;
import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentRegistrationServiceTest {

    @Mock
    private OAuthClientRepository oauthClientRepository;

    @Mock
    private MachineRepository machineRepository;

    @Mock
    private MachineWriter machineWriter;

    @Mock
    private RegistrationTagAssignmentService registrationTagAssignmentService;

    @Mock
    private InstalledAgentService installedAgentService;

    @Mock
    private OrganizationIdResolver organizationIdResolver;

    @Mock
    private AgentRegistrationSecretValidator agentRegistrationSecretValidator;

    @Mock
    private ClientSecretValidator clientSecretValidator;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AgentSecretGenerator agentSecretGenerator;

    @Mock
    private MachineIdGenerator machineIdGenerator;

    @Mock
    private AgentRegistrationToolInstallationService agentRegistrationToolInstallationService;

    @Mock
    private AgentRegistrationProcessor agentRegistrationProcessor;

    @Mock
    private ToolConnectionService toolConnectionService;

    @Mock
    private AgentRegistrationClientFeatureFlagsService agentRegistrationClientFeatureFlagsService;

    @Mock
    private AgentRegistrationClientUpdateService agentRegistrationClientUpdateService;

    @Mock
    private DeletedMachineCleanup deletedMachineCleanup;

    @Captor
    private ArgumentCaptor<OAuthClient> oauthClientCaptor;

    @Captor
    private ArgumentCaptor<Machine> machineCaptor;

    private AgentRegistrationService agentRegistrationService;
    private AgentRegistrationRequest request;
    private static final String INITIAL_KEY = "test-initial-key";
    private static final String MACHINE_ID = "test-machine-id";
    private static final String CLIENT_SECRET = "01234567890123456789012345678912";
    private static final String ORGANIZATION_ID = "custom-uuid";

    private final AuditRecorder auditRecorder = mock(AuditRecorder.class, CALLS_REAL_METHODS);
    private final AuditedMethodRunner auditedMethodRunner = mock(AuditedMethodRunner.class, CALLS_REAL_METHODS);

    @Captor
    private ArgumentCaptor<Map<String, Object>> detailsCaptor;

    @Captor
    private ArgumentCaptor<AuditCall> callCaptor;

    @BeforeEach
    void setUp() {
        agentRegistrationService = new AgentRegistrationService(
                oauthClientRepository,
                machineRepository,
                machineWriter,
                organizationIdResolver,
                agentRegistrationSecretValidator,
                clientSecretValidator,
                agentSecretGenerator,
                passwordEncoder,
                machineIdGenerator,
                agentRegistrationToolInstallationService,
                agentRegistrationProcessor,
                registrationTagAssignmentService,
                installedAgentService,
                toolConnectionService,
                agentRegistrationClientFeatureFlagsService,
                agentRegistrationClientUpdateService,
                auditedMethodRunner, auditRecorder,
                deletedMachineCleanup
        );
        request = createTestRequest();
    }

    @Test
    void registerAgent_WithNewMachine_ReturnsCredentials() {
        when(machineIdGenerator.generate()).thenReturn(MACHINE_ID);
        when(oauthClientRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);
        when(agentSecretGenerator.generate()).thenReturn(CLIENT_SECRET);
        when(organizationIdResolver.resolve(any())).thenReturn(ORGANIZATION_ID);
        when(passwordEncoder.encode(CLIENT_SECRET)).thenReturn("encoded-secret");
        when(oauthClientRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
        when(machineRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);

        AgentRegistrationResponse response = agentRegistrationService.register(INITIAL_KEY, request);

        assertNotNull(response);
        assertEquals(MACHINE_ID, response.getMachineId());
        assertEquals("agent_" + MACHINE_ID, response.getClientId());
        assertEquals(CLIENT_SECRET, response.getClientSecret());

        verify(agentRegistrationSecretValidator).validate(INITIAL_KEY);
        verify(machineIdGenerator).generate();
        verify(oauthClientRepository).existsByMachineId(MACHINE_ID);
        verify(agentSecretGenerator).generate();
        verify(passwordEncoder).encode(CLIENT_SECRET);

        verify(oauthClientRepository).save(oauthClientCaptor.capture());
        OAuthClient savedClient = oauthClientCaptor.getValue();
        assertEquals(MACHINE_ID, savedClient.getMachineId());
        assertEquals("agent_" + MACHINE_ID, savedClient.getClientId());
        assertEquals("encoded-secret", savedClient.getClientSecret());
        assertArrayEquals(new String[]{"client_credentials"}, savedClient.getGrantTypes());
        assertArrayEquals(new String[]{"AGENT"}, savedClient.getRoles());

        verify(machineRepository).save(machineCaptor.capture());
        Machine savedMachine = machineCaptor.getValue();
        assertEquals(MACHINE_ID, savedMachine.getMachineId());
        assertEquals("test-hostname", savedMachine.getHostname());
        assertEquals(OsType.WINDOWS, savedMachine.getOsType());
        assertEquals("1.0.0", savedMachine.getAgentVersion());
        assertEquals(ORGANIZATION_ID, savedMachine.getOrganizationId());
        assertEquals(DeviceStatus.PENDING, savedMachine.getStatus());
        assertNotNull(savedMachine.getLastSeen());
        assertNotNull(savedMachine.getOrganizationAssignedAt());

        verify(installedAgentService).addInstalledAgent(MACHINE_ID, "openframe-client", "1.0.0", false);
    }

    @Test
    void registerAgent_WithExistingMachine_ThrowsException() {
        when(machineIdGenerator.generate()).thenReturn(MACHINE_ID);
        when(oauthClientRepository.existsByMachineId(MACHINE_ID)).thenReturn(true);

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> agentRegistrationService.register(INITIAL_KEY, request)
        );
        assertEquals("Failed to register client", exception.getMessage());

        verify(agentRegistrationSecretValidator).validate(INITIAL_KEY);
        verify(machineIdGenerator).generate();
        verify(oauthClientRepository).existsByMachineId(MACHINE_ID);
        verify(oauthClientRepository, never()).save(any());
        verify(machineRepository, never()).save(any());
        verifyNoInteractions(machineWriter);
    }

    @Test
    void registerAgent_WithTags_AssignsTagsToDevice() {
        when(machineIdGenerator.generate()).thenReturn(MACHINE_ID);
        when(oauthClientRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);
        when(agentSecretGenerator.generate()).thenReturn(CLIENT_SECRET);
        when(organizationIdResolver.resolve(any())).thenReturn(ORGANIZATION_ID);
        when(passwordEncoder.encode(CLIENT_SECRET)).thenReturn("encoded-secret");
        when(oauthClientRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
        when(machineRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);

        List<AgentRegistrationTagInput> tags = List.of(
                AgentRegistrationTagInput.builder().key("site").values(List.of("CHICAGO")).build(),
                AgentRegistrationTagInput.builder().key("environment").values(List.of("production", "staging")).build()
        );
        request.setTags(tags);

        AgentRegistrationResponse response = agentRegistrationService.register(INITIAL_KEY, request);

        assertNotNull(response);
        assertEquals(MACHINE_ID, response.getMachineId());

        verify(registrationTagAssignmentService).assignTags(eq(MACHINE_ID), eq(tags));
    }

    @Test
    void registerAgent_WithoutTags_DoesNotAssignTags() {
        when(machineIdGenerator.generate()).thenReturn(MACHINE_ID);
        when(oauthClientRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);
        when(agentSecretGenerator.generate()).thenReturn(CLIENT_SECRET);
        when(organizationIdResolver.resolve(any())).thenReturn(ORGANIZATION_ID);
        when(passwordEncoder.encode(CLIENT_SECRET)).thenReturn("encoded-secret");
        when(oauthClientRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
        when(machineRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);

        AgentRegistrationResponse response = agentRegistrationService.register(INITIAL_KEY, request);

        assertNotNull(response);
        verify(registrationTagAssignmentService).assignTags(eq(MACHINE_ID), isNull());
    }

    @Test
    void reinstall_WithValidKeyAndSecret_OverwritesMachineAndReturnsExistingCreds() {
        OAuthClient existingClient = new OAuthClient();
        existingClient.setMachineId(MACHINE_ID);
        existingClient.setClientId("agent_" + MACHINE_ID);
        Machine existingMachine = new Machine();
        existingMachine.setMachineId(MACHINE_ID);
        existingMachine.setHostname("old-host");
        existingMachine.setAgentVersion("0.9.0");
        existingMachine.setOrganizationId("old-org");
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingClient));
        stubWriterOver(existingMachine);
        when(organizationIdResolver.resolve("org-1")).thenReturn("new-org");

        AgentRegistrationResponse response =
                agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        assertNotNull(response);
        assertEquals(MACHINE_ID, response.getMachineId());
        assertEquals("agent_" + MACHINE_ID, response.getClientId());
        assertEquals(CLIENT_SECRET, response.getClientSecret());

        // initial key is validated before the client secret
        InOrder inOrder = inOrder(agentRegistrationSecretValidator, clientSecretValidator);
        inOrder.verify(agentRegistrationSecretValidator).validate(INITIAL_KEY);
        inOrder.verify(clientSecretValidator).validate(existingClient, CLIENT_SECRET, "reinstall");

        // existing machine row is overwritten with request data (same id), field by field, not recreated or saved whole
        verify(machineRepository, never()).save(any());
        Machine savedMachine = writtenOver(existingMachine);
        assertEquals(MACHINE_ID, savedMachine.getMachineId());
        assertEquals("test-hostname", savedMachine.getHostname());
        assertEquals(OsType.WINDOWS, savedMachine.getOsType());
        assertEquals("1.0.0", savedMachine.getAgentVersion());
        assertEquals("new-org", savedMachine.getOrganizationId()); // organization can change on reinstall
        assertEquals(DeviceStatus.PENDING, savedMachine.getStatus()); // reset to PENDING on reinstall
        assertNotNull(savedMachine.getLastSeen());

        verify(organizationIdResolver).resolve("org-1");

        // stale tool connections and installed agents are reset on reinstall
        verify(toolConnectionService).disconnectAll(MACHINE_ID);
        verify(installedAgentService).disconnectAll(MACHINE_ID);

        // setup is re-run
        verify(registrationTagAssignmentService).assignTags(eq(MACHINE_ID), any());
        verify(agentRegistrationToolInstallationService).process(eq(MACHINE_ID), any());
        verify(agentRegistrationProcessor).postProcessAgentRegistration(machineCaptor.capture(), eq(request));
        assertEquals("new-org", machineCaptor.getValue().getOrganizationId());
        verify(installedAgentService).addInstalledAgent(MACHINE_ID, "openframe-client", "1.0.0", false);

        // nothing is re-created
        verify(machineIdGenerator, never()).generate();
        verify(agentSecretGenerator, never()).generate();
        verify(oauthClientRepository, never()).save(any());
    }

    @Test
    void reinstall_UnderAnotherOrganization_StampsTheNewEnrollment() {
        OAuthClient existingClient = new OAuthClient();
        existingClient.setMachineId(MACHINE_ID);
        Machine existingMachine = new Machine();
        existingMachine.setMachineId(MACHINE_ID);
        existingMachine.setOrganizationId("old-org");
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingClient));
        stubWriterOver(existingMachine);
        when(organizationIdResolver.resolve("org-1")).thenReturn("new-org");

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        Machine savedMachine = writtenOver(existingMachine);
        assertEquals("new-org", savedMachine.getOrganizationId());
        assertNotNull(savedMachine.getOrganizationAssignedAt());
        assertThat(recorded())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getOrganizationId,
                        AuditEntry::getChanges)
                .containsExactly(DEVICE_ORGANIZATION_CHANGE, MACHINE_ID, "new-org",
                        Map.of("organizationId", new AuditChange("old-org", "new-org")));
    }

    @Test
    void reinstall_UnderTheSameOrganization_KeepsTheEnrollment() {
        Instant assignedAt = Instant.parse("2026-10-20T10:00:00Z");
        OAuthClient existingClient = new OAuthClient();
        existingClient.setMachineId(MACHINE_ID);
        Machine existingMachine = new Machine();
        existingMachine.setMachineId(MACHINE_ID);
        existingMachine.setOrganizationId("same-org");
        existingMachine.setOrganizationAssignedAt(assignedAt);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingClient));
        stubWriterOver(existingMachine);
        when(organizationIdResolver.resolve("org-1")).thenReturn("same-org");

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        Machine savedMachine = writtenOver(existingMachine);
        assertEquals(assignedAt, savedMachine.getOrganizationAssignedAt());
        verify(auditRecorder, never()).record(any());
    }

    @Test
    void reinstall_FromDeletedStateClearsLegacyMembershipBeforeRestoring() {
        // setup
        OAuthClient existingClient = new OAuthClient();
        existingClient.setMachineId(MACHINE_ID);
        Machine deleted = new Machine();
        deleted.setMachineId(MACHINE_ID);
        deleted.setStatus(DeviceStatus.DELETED);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingClient));
        when(machineRepository.findOnPrimaryByMachineId(MACHINE_ID)).thenReturn(Optional.of(deleted));
        when(organizationIdResolver.resolve("org-1")).thenReturn("same-org");
        when(deletedMachineCleanup.reenrollDeleted(eq(deleted), any())).thenAnswer(invocation ->
                writeResult(deleted, invocation.getArgument(1, MachineUpdate.class)).orElseThrow().after());

        // execution
        AgentRegistrationResponse response = agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        // verifications
        assertEquals(MACHINE_ID, response.getMachineId());
        verify(deletedMachineCleanup).reenrollDeleted(eq(deleted), any(MachineUpdate.class));
        verifyNoInteractions(machineWriter);
    }

    @Test
    void reinstall_WithInvalidInitialKey_FailsBeforeClientSecretCheck() {
        doThrow(new AgentRegistrationSecretValidationException(ErrorCode.INITIAL_KEY_INVALID, "Invalid initial key"))
                .when(agentRegistrationSecretValidator).validate(INITIAL_KEY);

        assertThrows(
                AgentRegistrationSecretValidationException.class,
                () -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request)
        );

        verify(oauthClientRepository, never()).findByMachineId(any());
        verify(clientSecretValidator, never()).validate(any(), any(), any());
        verify(machineRepository, never()).findOnPrimaryByMachineId(any());
        verify(machineRepository, never()).save(any());
        verifyNoInteractions(machineWriter);
        verify(oauthClientRepository, never()).save(any());
        assertThat(refused())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(DEVICE_REGISTER_FAIL, AuditOutcome.REFUSED, "Invalid initial key", MACHINE_ID,
                        Map.of("request", "reinstall", "claimedHostname", "test-hostname",
                                "claimedOrganizationId", "org-1"));
    }

    @Test
    void reinstall_WithUnknownMachine_ThrowsGenericInvalidSecret() {
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request)
        );
        // indistinguishable from a bad secret: no machine-id existence oracle
        assertEquals(ErrorCode.CLIENT_SECRET_INVALID, ex.getErrorCode());
        assertEquals("Invalid client secret", ex.getMessage());

        verify(clientSecretValidator, never()).validate(any(), any(), any());
        verify(machineRepository, never()).findOnPrimaryByMachineId(any());
        verify(machineRepository, never()).save(any());
        verifyNoInteractions(machineWriter);
        assertThat(refused())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason, AuditEntry::getTargetId)
                .containsExactly(DEVICE_AUTH_FAIL, AuditOutcome.REFUSED, "Unknown machine", MACHINE_ID);
    }

    @Test
    void reinstall_WithInvalidClientSecret_ThrowsAndDoesNotTouchMachine() {
        OAuthClient existingClient = new OAuthClient();
        existingClient.setMachineId(MACHINE_ID);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingClient));
        doThrow(new InvalidClientSecretException(ErrorCode.CLIENT_SECRET_INVALID, "Invalid client secret"))
                .when(clientSecretValidator).validate(existingClient, CLIENT_SECRET, "reinstall");

        assertThrows(
                InvalidClientSecretException.class,
                () -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request)
        );

        verify(agentRegistrationSecretValidator).validate(INITIAL_KEY);
        verify(machineRepository, never()).findOnPrimaryByMachineId(any());
        verify(machineRepository, never()).save(any());
        verifyNoInteractions(machineWriter);
        verify(oauthClientRepository, never()).save(any());
    }

    private AgentRegistrationRequest createTestRequest() {
        AgentRegistrationRequest request = new AgentRegistrationRequest();
        request.setHostname("test-hostname");
        request.setOrganizationId("org-1");
        request.setIp("192.168.1.1");
        request.setMacAddress("00:11:22:33:44:55");
        request.setOsUuid("test-os-uuid");
        request.setOsType("WINDOWS");   // agent contract: exact OsType enum name
        request.setAgentVersion("1.0.0");
        return request;
    }

    @Test
    void registerAgent_WithAgentVersion_StoresItsComparableKey() {
        // setup
        stubNewMachineRegistration();
        request.setAgentVersion("1.6.2");

        // execution
        agentRegistrationService.register(INITIAL_KEY, request);

        // verifications
        verify(machineRepository).save(machineCaptor.capture());
        assertThat(machineCaptor.getValue())
                .extracting(Machine::getAgentVersion, Machine::getAgentVersionKey)
                .containsExactly("1.6.2", 1_000_006_000_002L);
    }

    @Test
    void registerAgent_WithUnparseableAgentVersion_StoresNoKey() {
        // setup
        stubNewMachineRegistration();
        request.setAgentVersion("dev-build");

        // execution
        agentRegistrationService.register(INITIAL_KEY, request);

        // verifications
        verify(machineRepository).save(machineCaptor.capture());
        assertThat(machineCaptor.getValue())
                .extracting(Machine::getAgentVersion, Machine::getAgentVersionKey)
                .containsExactly("dev-build", null);
    }

    @Test
    void reinstall_WithNewAgentVersion_OverwritesTheStoredKey() {
        // setup
        Machine existingMachine = new Machine();
        existingMachine.setMachineId(MACHINE_ID);
        existingMachine.setAgentVersion("1.5.9");
        existingMachine.setAgentVersionKey(1_000_005_000_009L);
        stubReinstallOf(existingMachine);
        request.setAgentVersion("1.6.0");

        // execution
        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        // verifications
        assertThat(writtenOver(existingMachine))
                .extracting(Machine::getAgentVersion, Machine::getAgentVersionKey)
                .containsExactly("1.6.0", 1_000_006_000_000L);
    }

    @Test
    void registerAgent_WithHardwareFacts_CopiesThemOntoTheNewMachine() {
        stubNewMachineRegistration();
        request.setSerialNumber("C02XG2JHJG5H");
        request.setManufacturer("Apple Inc.");
        request.setModel("MacBookPro18,3");

        agentRegistrationService.register(INITIAL_KEY, request);

        verify(machineRepository).save(machineCaptor.capture());
        Machine savedMachine = machineCaptor.getValue();
        assertEquals("C02XG2JHJG5H", savedMachine.getSerialNumber());
        assertEquals("Apple Inc.", savedMachine.getManufacturer());
        assertEquals("MacBookPro18,3", savedMachine.getModel());
        assertEquals("test-os-uuid", savedMachine.getOsUuid());
    }

    @Test
    void registerAgent_WithBlankHardwareFacts_LeavesThemUnset() {
        stubNewMachineRegistration();
        request.setSerialNumber("  ");
        request.setManufacturer("");
        request.setModel(null);
        request.setOsUuid(" ");

        agentRegistrationService.register(INITIAL_KEY, request);

        verify(machineRepository).save(machineCaptor.capture());
        Machine savedMachine = machineCaptor.getValue();
        assertNull(savedMachine.getSerialNumber());
        assertNull(savedMachine.getManufacturer());
        assertNull(savedMachine.getModel());
        assertNull(savedMachine.getOsUuid());
    }

    @Test
    void reinstall_WithHardwareFacts_OverwritesTheStoredOnes() {
        stubReinstallOf(machineWithHardwareFacts());
        request.setSerialNumber("NEW-SERIAL");
        request.setManufacturer("Dell Inc.");
        request.setModel("Latitude 7440");
        request.setOsUuid("new-os-uuid");

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        Machine savedMachine = writtenOver(machineWithHardwareFacts());
        assertEquals("NEW-SERIAL", savedMachine.getSerialNumber());
        assertEquals("Dell Inc.", savedMachine.getManufacturer());
        assertEquals("Latitude 7440", savedMachine.getModel());
        assertEquals("new-os-uuid", savedMachine.getOsUuid());
    }

    @Test
    void reinstall_WithoutHardwareFacts_KeepsTheStoredOnes() {
        stubReinstallOf(machineWithHardwareFacts());
        request.setSerialNumber(" ");
        request.setOsUuid(null);

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        Machine savedMachine = writtenOver(machineWithHardwareFacts());
        assertEquals("OLD-SERIAL", savedMachine.getSerialNumber());
        assertEquals("LENOVO", savedMachine.getManufacturer());
        assertEquals("ThinkPad T14", savedMachine.getModel());
        assertEquals("old-os-uuid", savedMachine.getOsUuid());
    }

    @Test
    void reinstall_WithUserId_RecordsWhoInstalledTheAgent() {
        stubReinstallOf(machineWithHardwareFacts());
        request.setUserId("new-user");

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        Machine savedMachine = writtenOver(machineWithHardwareFacts());
        assertEquals("new-user", savedMachine.getUserId());
    }

    @Test
    void reinstall_WithoutUserId_KeepsTheStoredOne() {
        stubReinstallOf(machineWithHardwareFacts());
        request.setUserId(" ");

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        Machine savedMachine = writtenOver(machineWithHardwareFacts());
        assertEquals("old-user", savedMachine.getUserId());
    }

    @Test
    void registerAgent_WhenPostProcessingFails_MarksTheMachineDeletedAndRethrows() {
        stubNewMachineRegistration();
        IllegalStateException failure = new IllegalStateException("post-processing failed");
        doThrow(failure).when(agentRegistrationProcessor).postProcessAgentRegistration(any(), any());

        IllegalStateException thrown = assertThrows(IllegalStateException.class,
                () -> agentRegistrationService.register(INITIAL_KEY, request));

        assertSame(failure, thrown);
        ArgumentCaptor<MachineUpdate> update = ArgumentCaptor.forClass(MachineUpdate.class);
        verify(machineWriter).update(eq(MACHINE_ID), update.capture());
        Machine discarded = new Machine();
        update.getValue().applyTo(discarded);
        assertEquals(DeviceStatus.DELETED, discarded.getStatus());
        verify(installedAgentService).disconnectAll(MACHINE_ID);
    }

    @Test
    void registerAgent_WhenPostProcessingFails_CleansUpTheDiscardedMachine() {
        // setup
        stubNewMachineRegistration();
        doThrow(new IllegalStateException("post-processing failed"))
                .when(agentRegistrationProcessor).postProcessAgentRegistration(any(), any());
        stubFailedRegistrationWriterOver(savedMachineOf("tenant-1"));

        // execution
        assertThrows(IllegalStateException.class, () -> agentRegistrationService.register(INITIAL_KEY, request));

        // verifications
        verify(deletedMachineCleanup).cleanUpDeletedMachine("tenant-1", MACHINE_ID);
    }

    @Test
    void registerAgent_WhenTheDiscardedMachineIsGone_NothingToCleanUp() {
        // setup
        stubNewMachineRegistration();
        doThrow(new IllegalStateException("post-processing failed"))
                .when(agentRegistrationProcessor).postProcessAgentRegistration(any(), any());
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class))).thenReturn(Optional.empty());

        // execution
        assertThrows(IllegalStateException.class, () -> agentRegistrationService.register(INITIAL_KEY, request));

        // verifications
        verifyNoInteractions(deletedMachineCleanup);
    }

    @Test
    void registerAgent_WhenTheCleanupFails_StillThrowsTheOriginalError() {
        // setup
        stubNewMachineRegistration();
        IllegalStateException failure = new IllegalStateException("post-processing failed");
        doThrow(failure).when(agentRegistrationProcessor).postProcessAgentRegistration(any(), any());
        stubFailedRegistrationWriterOver(savedMachineOf("tenant-1"));
        doThrow(new IllegalStateException("mongo is down"))
                .when(deletedMachineCleanup).cleanUpDeletedMachine("tenant-1", MACHINE_ID);

        // execution
        IllegalStateException thrown = assertThrows(IllegalStateException.class,
                () -> agentRegistrationService.register(INITIAL_KEY, request));

        // verifications
        assertSame(failure, thrown);
    }

    @Test
    void registerAgent_RetryAfterAFailedAttempt_LeavesOneLiveDevice() {
        when(machineIdGenerator.generate()).thenReturn("failed-machine-id", MACHINE_ID);
        when(agentSecretGenerator.generate()).thenReturn(CLIENT_SECRET);
        when(organizationIdResolver.resolve(any())).thenReturn(ORGANIZATION_ID);
        when(machineRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
        doThrow(new IllegalStateException("installed agent failed"))
                .doNothing()
                .when(installedAgentService).addInstalledAgent(any(), any(), any(), eq(false));

        assertThrows(IllegalStateException.class, () -> agentRegistrationService.register(INITIAL_KEY, request));
        AgentRegistrationResponse response = agentRegistrationService.register(INITIAL_KEY, request);

        assertEquals(MACHINE_ID, response.getMachineId());
        ArgumentCaptor<MachineUpdate> update = ArgumentCaptor.forClass(MachineUpdate.class);
        verify(machineWriter).update(eq("failed-machine-id"), update.capture());
        Machine discarded = new Machine();
        update.getValue().applyTo(discarded);
        assertEquals(DeviceStatus.DELETED, discarded.getStatus());
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void registerAgent_WhenTheDiscardItselfFails_StillThrowsTheOriginalError() {
        stubNewMachineRegistration();
        IllegalStateException failure = new IllegalStateException("post-processing failed");
        doThrow(failure).when(agentRegistrationProcessor).postProcessAgentRegistration(any(), any());
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class)))
                .thenThrow(new IllegalStateException("mongo is down"));

        IllegalStateException thrown = assertThrows(IllegalStateException.class,
                () -> agentRegistrationService.register(INITIAL_KEY, request));

        assertSame(failure, thrown);
    }

    @Test
    void registerAgent_WithOsVersionAndBuild_CopiesThemOntoTheNewMachine() {
        // setup
        stubNewMachineRegistration();
        request.setOsVersion("11.7.10");
        request.setOsBuild("20G1427");

        // execution
        agentRegistrationService.register(INITIAL_KEY, request);

        // verifications
        verify(machineRepository).save(machineCaptor.capture());
        assertThat(machineCaptor.getValue())
                .extracting(Machine::getOsVersion, Machine::getOsBuild)
                .containsExactly("11.7.10", "20G1427");
    }

    @Test
    void registerAgent_WithBlankOsVersionAndBuild_LeavesThemUnset() {
        // setup
        stubNewMachineRegistration();
        request.setOsVersion(" ");
        request.setOsBuild("");

        // execution
        agentRegistrationService.register(INITIAL_KEY, request);

        // verifications
        verify(machineRepository).save(machineCaptor.capture());
        assertThat(machineCaptor.getValue())
                .extracting(Machine::getOsVersion, Machine::getOsBuild)
                .containsExactly(null, null);
    }

    @Test
    void reinstall_WithOsVersionAndBuild_OverwritesTheStoredOnes() {
        // setup
        stubReinstallOf(machineWithOsInfo());
        request.setOsVersion("14.2.1");
        request.setOsBuild("23C71");

        // execution
        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        // verifications
        assertThat(writtenOver(machineWithOsInfo()))
                .extracting(Machine::getOsVersion, Machine::getOsBuild)
                .containsExactly("14.2.1", "23C71");
    }

    @Test
    void reinstall_WithBlankOsVersionAndBuild_KeepsTheStoredOnes() {
        // setup
        stubReinstallOf(machineWithOsInfo());
        request.setOsVersion(" ");
        request.setOsBuild(null);

        // execution
        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        // verifications
        assertThat(writtenOver(machineWithOsInfo()))
                .extracting(Machine::getOsVersion, Machine::getOsBuild)
                .containsExactly("13.6.1", "22G313");
    }

    private void stubNewMachineRegistration() {
        when(machineIdGenerator.generate()).thenReturn(MACHINE_ID);
        when(oauthClientRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);
        when(agentSecretGenerator.generate()).thenReturn(CLIENT_SECRET);
        when(organizationIdResolver.resolve(any())).thenReturn(ORGANIZATION_ID);
        when(passwordEncoder.encode(CLIENT_SECRET)).thenReturn("encoded-secret");
        when(oauthClientRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
        when(machineRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
    }

    private void stubReinstallOf(Machine existingMachine) {
        OAuthClient existingClient = new OAuthClient();
        existingClient.setMachineId(MACHINE_ID);
        existingClient.setClientId("agent_" + MACHINE_ID);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingClient));
        stubWriterOver(existingMachine);
        when(organizationIdResolver.resolve("org-1")).thenReturn("new-org");
    }

    private void stubWriterOver(Machine existingMachine) {
        when(machineRepository.findOnPrimaryByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingMachine));
        when(machineWriter.update(eq(MACHINE_ID), any(Criteria.class), any(MachineUpdate.class))).thenAnswer(invocation ->
                writeResult(existingMachine, invocation.getArgument(2, MachineUpdate.class)));
    }

    private void stubFailedRegistrationWriterOver(Machine existingMachine) {
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class))).thenAnswer(invocation ->
                writeResult(existingMachine, invocation.getArgument(1, MachineUpdate.class)));
    }

    private static Optional<MachineWriteResult> writeResult(Machine before, MachineUpdate update) {
        Machine after = copyOf(before);
        update.applyTo(after);
        return Optional.of(new MachineWriteResult(before, after));
    }

    private Machine writtenOver(Machine existingMachine) {
        ArgumentCaptor<MachineUpdate> update = ArgumentCaptor.forClass(MachineUpdate.class);
        verify(machineWriter).update(eq(MACHINE_ID), any(Criteria.class), update.capture());
        assertFalse(update.getValue().paths().stream().anyMatch(path -> path.startsWith("directory")),
                "a reinstall never writes the directory summary");
        Machine after = copyOf(existingMachine);
        update.getValue().applyTo(after);
        return after;
    }

    private static Machine savedMachineOf(String tenantId) {
        Machine machine = new Machine();
        machine.setTenantId(tenantId);
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.PENDING);
        return machine;
    }

    private static Machine copyOf(Machine source) {
        Machine copy = new Machine();
        BeanUtils.copyProperties(source, copy);
        return copy;
    }

    private static Machine machineWithHardwareFacts() {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setSerialNumber("OLD-SERIAL");
        machine.setManufacturer("LENOVO");
        machine.setModel("ThinkPad T14");
        machine.setOsUuid("old-os-uuid");
        machine.setUserId("old-user");
        return machine;
    }

    @Test
    void register_invalidInitialKey_recordsTheRefusalBeforeAnyMachineExists() {
        doThrow(new AgentRegistrationSecretValidationException(ErrorCode.INITIAL_KEY_INVALID, "Invalid initial key"))
                .when(agentRegistrationSecretValidator).validate(INITIAL_KEY);

        assertThatThrownBy(() -> agentRegistrationService.register(INITIAL_KEY, request))
                .isInstanceOf(AgentRegistrationSecretValidationException.class)
                .hasMessage("Invalid initial key");

        assertThat(refused())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId)
                .containsExactly(DEVICE_REGISTER_FAIL, null);
    }

    @Test
    void register_invalidInitialKey_refusesOncePerClaimedHost() {
        doThrow(new AgentRegistrationSecretValidationException(ErrorCode.INITIAL_KEY_INVALID, "Invalid initial key"))
                .when(agentRegistrationSecretValidator).validate(INITIAL_KEY);

        assertThatThrownBy(() -> agentRegistrationService.register(INITIAL_KEY, request))
                .isInstanceOf(AgentRegistrationSecretValidationException.class)
                .hasMessage("Invalid initial key");

        verify(auditRecorder).recordOnce(any(AuditEntry.class), eq("register:org-1:test-hostname"));
    }

    @Test
    void reinstall_unknownMachine_refusesOncePerDevice() {
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request))
                .isInstanceOf(InvalidClientSecretException.class)
                .hasMessage("Invalid client secret");

        verify(auditRecorder).recordOnce(any(AuditEntry.class), eq("reinstall:" + MACHINE_ID));
    }

    @Test
    void register_someTagValuesRefused_storesOnlyTheAssignedTags() {
        stubNewRegistration();
        List<AgentRegistrationTagInput> tags = List.of(
                AgentRegistrationTagInput.builder().key("env").values(List.of("prod")).build(),
                AgentRegistrationTagInput.builder().key("site").values(List.of("New York")).build());
        request.setTags(tags);
        when(registrationTagAssignmentService.assignTags(MACHINE_ID, tags)).thenReturn(List.of("env"));

        agentRegistrationService.register(INITIAL_KEY, request);

        assertThat(registrationDetails()).containsEntry("tags", List.of("env"));
    }

    @Test
    void register_everyTagValueRefused_storesNoTags() {
        stubNewRegistration();
        List<AgentRegistrationTagInput> tags =
                List.of(AgentRegistrationTagInput.builder().key("site").values(List.of("New York")).build());
        request.setTags(tags);
        when(registrationTagAssignmentService.assignTags(MACHINE_ID, tags)).thenReturn(List.of());

        agentRegistrationService.register(INITIAL_KEY, request);

        assertThat(registrationDetails()).doesNotContainKey("tags");
    }

    @Test
    void register_withUserId_storesTheClaimedUser() {
        stubNewRegistration();
        request.setUserId("installer-1");

        agentRegistrationService.register(INITIAL_KEY, request);

        assertThat(registrationDetails()).containsEntry("claimedUserId", "installer-1");
    }

    @Test
    void register_blankUserId_storesNoClaimedUser() {
        stubNewRegistration();
        request.setUserId(" ");

        agentRegistrationService.register(INITIAL_KEY, request);

        assertThat(registrationDetails()).doesNotContainKey("claimedUserId");
    }

    @Test
    void register_unknownOrganization_storesTheClaimedOne() {
        stubNewRegistration();
        when(organizationIdResolver.resolve("org-1")).thenReturn("default-org");

        agentRegistrationService.register(INITIAL_KEY, request);

        assertThat(registrationDetails()).containsEntry("claimedOrganizationId", "org-1");
    }

    @Test
    void register_knownOrganization_storesNoClaimedOne() {
        stubNewRegistration();
        when(organizationIdResolver.resolve("org-1")).thenReturn("org-1");

        agentRegistrationService.register(INITIAL_KEY, request);

        assertThat(registrationDetails()).doesNotContainKey("claimedOrganizationId");
    }

    @Test
    void reinstall_unknownOrganization_storesTheClaimedOne() {
        stubReinstall();
        when(organizationIdResolver.resolve("org-1")).thenReturn("default-org");

        agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        assertThat(reinstallDetails()).containsEntry("claimedOrganizationId", "org-1");
    }

    @Test
    void reinstall_deviceRecordUnchanged_isStillRecorded() {
        stubReinstall();

        AgentRegistrationResponse response =
                agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request);

        assertThat(reinstallCall().storeIfUnchanged().test(response)).isTrue();
    }

    @Test
    void reinstall_machineGone_refusesWithAConflict() {
        stubRegisteredClient();

        assertThatThrownBy(() -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Device test-machine-id changed during reinstall. Try again.");
    }

    private void stubNewRegistration() {
        when(machineIdGenerator.generate()).thenReturn(MACHINE_ID);
        when(machineRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);
    }

    private void stubRegisteredClient() {
        OAuthClient client = new OAuthClient();
        client.setMachineId(MACHINE_ID);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(client));
    }

    private void stubReinstall() {
        stubRegisteredClient();
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        stubWriterOver(machine);
    }

    private Map<String, Object> registrationDetails() {
        verify(auditedMethodRunner).run(eq(DEVICE_REGISTER), eq(MACHINE_ID), detailsCaptor.capture(), any(Supplier.class));
        return detailsCaptor.getValue();
    }

    private AuditCall reinstallCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private Map<String, Object> reinstallDetails() {
        return reinstallCall().detailsFromResult().apply(null);
    }

    private AuditEntry recorded() {
        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).record(entry.capture());
        return entry.getValue();
    }

    private AuditEntry refused() {
        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).recordOnce(entry.capture(), anyString());
        return entry.getValue();
    }

    private static Machine machineWithOsInfo() {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setOsVersion("13.6.1");
        machine.setOsBuild("22G313");
        return machine;
    }
}

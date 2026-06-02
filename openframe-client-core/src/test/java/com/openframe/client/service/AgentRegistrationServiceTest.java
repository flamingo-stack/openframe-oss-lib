package com.openframe.client.service;

import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.client.exception.AgentRegistrationSecretValidationException;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.client.service.agentregistration.*;
import com.openframe.client.service.agentregistration.processor.AgentRegistrationProcessor;
import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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

    @BeforeEach
    void setUp() {
        agentRegistrationService = new AgentRegistrationService(
                oauthClientRepository,
                machineRepository,
                organizationIdResolver,
                agentRegistrationSecretValidator,
                clientSecretValidator,
                agentSecretGenerator,
                passwordEncoder,
                machineIdGenerator,
                agentRegistrationToolInstallationService,
                agentRegistrationProcessor,
                registrationTagAssignmentService,
                installedAgentService
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
        assertEquals("linux", savedMachine.getOsType());
        assertEquals("1.0.0", savedMachine.getAgentVersion());
        assertEquals(ORGANIZATION_ID, savedMachine.getOrganizationId());
        assertEquals(DeviceStatus.PENDING, savedMachine.getStatus());
        assertNotNull(savedMachine.getLastSeen());

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
        when(clientSecretValidator.validate(MACHINE_ID, CLIENT_SECRET)).thenReturn(existingClient);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(existingMachine));
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
        inOrder.verify(clientSecretValidator).validate(MACHINE_ID, CLIENT_SECRET);

        // existing machine row is overwritten with request data (same id), not recreated
        verify(machineRepository).save(machineCaptor.capture());
        Machine savedMachine = machineCaptor.getValue();
        assertEquals(MACHINE_ID, savedMachine.getMachineId());
        assertEquals("test-hostname", savedMachine.getHostname());
        assertEquals("linux", savedMachine.getOsType());
        assertEquals("1.0.0", savedMachine.getAgentVersion());
        assertEquals("new-org", savedMachine.getOrganizationId()); // organization can change on reinstall
        assertNotNull(savedMachine.getLastSeen());

        verify(organizationIdResolver).resolve("org-1");

        // setup is re-run
        verify(registrationTagAssignmentService).assignTags(eq(MACHINE_ID), any());
        verify(agentRegistrationToolInstallationService).process(MACHINE_ID);
        verify(agentRegistrationProcessor).postProcessAgentRegistration(existingMachine, request);
        verify(installedAgentService).addInstalledAgent(MACHINE_ID, "openframe-client", "1.0.0", false);

        // nothing is re-created
        verify(machineIdGenerator, never()).generate();
        verify(agentSecretGenerator, never()).generate();
        verify(oauthClientRepository, never()).save(any());
    }

    @Test
    void reinstall_WithInvalidInitialKey_FailsBeforeClientSecretCheck() {
        doThrow(new AgentRegistrationSecretValidationException(ErrorCode.INITIAL_KEY_INVALID, "Invalid initial key"))
                .when(agentRegistrationSecretValidator).validate(INITIAL_KEY);

        assertThrows(
                AgentRegistrationSecretValidationException.class,
                () -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request)
        );

        verify(clientSecretValidator, never()).validate(any(), any());
        verify(machineRepository, never()).findByMachineId(any());
        verify(machineRepository, never()).save(any());
        verify(oauthClientRepository, never()).save(any());
    }

    @Test
    void reinstall_WithInvalidClientSecret_ThrowsAndDoesNotTouchMachine() {
        when(clientSecretValidator.validate(MACHINE_ID, CLIENT_SECRET))
                .thenThrow(new InvalidClientSecretException(ErrorCode.CLIENT_SECRET_INVALID, "Invalid client secret"));

        assertThrows(
                InvalidClientSecretException.class,
                () -> agentRegistrationService.reinstall(INITIAL_KEY, MACHINE_ID, CLIENT_SECRET, request)
        );

        verify(agentRegistrationSecretValidator).validate(INITIAL_KEY);
        verify(machineRepository, never()).findByMachineId(any());
        verify(machineRepository, never()).save(any());
        verify(oauthClientRepository, never()).save(any());
    }

    private AgentRegistrationRequest createTestRequest() {
        AgentRegistrationRequest request = new AgentRegistrationRequest();
        request.setHostname("test-hostname");
        request.setOrganizationId("org-1");
        request.setIp("192.168.1.1");
        request.setMacAddress("00:11:22:33:44:55");
        request.setOsUuid("test-os-uuid");
        request.setOsType("linux");
        request.setAgentVersion("1.0.0");
        return request;
    }
}

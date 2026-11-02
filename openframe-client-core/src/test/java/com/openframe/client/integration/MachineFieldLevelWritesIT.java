package com.openframe.client.integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.service.AgentUninstallService;
import com.openframe.client.service.InstalledAgentService;
import com.openframe.client.service.MachineHostnameService;
import com.openframe.client.service.MachineStatusService;
import com.openframe.client.service.MachineTimezoneService;
import com.openframe.client.service.ToolConnectionService;
import com.openframe.client.service.agentregistration.AgentRegistrationClientFeatureFlagsService;
import com.openframe.client.service.agentregistration.AgentRegistrationClientUpdateService;
import com.openframe.client.service.agentregistration.AgentRegistrationService;
import com.openframe.client.service.agentregistration.AgentRegistrationToolInstallationService;
import com.openframe.client.service.agentregistration.AgentSecretGenerator;
import com.openframe.client.service.agentregistration.MachineIdGenerator;
import com.openframe.client.service.agentregistration.OrganizationIdResolver;
import com.openframe.client.service.agentregistration.RegistrationTagAssignmentService;
import com.openframe.client.service.agentregistration.processor.AgentRegistrationProcessor;
import com.openframe.client.service.validator.AgentRegistrationSecretValidator;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Stream;

import static com.openframe.data.service.machine.MachineFields.COMPUTER_NAME;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_SOURCES;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_IDS;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_LINK;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_NAME;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// The post-registration writers read the machine, decide, then write. Between the read and the write an external
// directory integration (or the Fleet facts writer) may $set its own fields: each path must write only the fields it
// owns, so those concurrent values survive.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineFieldLevelWritesIT {

    private static final String MACHINE_ID = "m-1";
    private static final String SECRET = "secret";
    private static final Instant SEEN = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant LATER = Instant.parse("2026-01-01T00:05:00Z");

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    private static MongoClient client;
    private static MongoTemplate template;
    private static MachineRepository storedMachines;
    private static MachineWriter machineWriter;

    private Services services;

    @BeforeAll
    static void startMongo() {
        String uri = System.getProperty("mongo.external.uri");
        if (uri == null) {
            if (!MONGO.isRunning()) {
                MONGO.start();
            }
            uri = MONGO.getConnectionString() + "/?directConnection=true";
        }
        client = MongoClients.create(uri);
        template = new MongoTemplate(client, "test");
        storedMachines = new MongoRepositoryFactory(template).getRepository(MachineRepository.class,
                RepositoryFragments.just(new CustomMachineRepositoryImpl(template)));
        machineWriter = new MachineWriter(template);
    }

    @AfterAll
    static void stopMongo() {
        client.close();
    }

    @BeforeEach
    void setUp() {
        template.dropCollection(Machine.class);
        services = new Services(interleavingRepository());
    }

    static Stream<Arguments> postRegistrationWriters() {
        return Stream.of(
                path("status transition PENDING -> ONLINE", DeviceStatus.PENDING,
                        s -> s.status().updateToOnline(MACHINE_ID, LATER),
                        m -> m.getStatus() == DeviceStatus.ONLINE && LATER.equals(m.getFirstConnectedAt())),
                path("connectivity flip of a deleted machine", DeviceStatus.DELETED,
                        s -> s.status().updateToOffline(MACHINE_ID, LATER),
                        m -> m.getTelemetryStatus() == TelemetryStatus.OFFLINE && m.getStatus() == DeviceStatus.DELETED),
                path("timezone update", DeviceStatus.ONLINE,
                        s -> s.timezone().updateTimezone(MACHINE_ID, "Europe/Kyiv"),
                        m -> "Europe/Kyiv".equals(m.getTimezone())),
                path("hostname update", DeviceStatus.ONLINE,
                        s -> s.hostname().updateHostname(MACHINE_ID, "new-host"),
                        m -> "new-host".equals(m.getHostname())),
                path("agent uninstall", DeviceStatus.ONLINE,
                        s -> s.uninstall().uninstall(MACHINE_ID, SECRET),
                        m -> m.getStatus() == DeviceStatus.DELETED),
                path("re-registration of an existing machine", DeviceStatus.ONLINE,
                        s -> s.registration().reinstall("initial-key", MACHINE_ID, SECRET, reinstallRequest()),
                        m -> m.getStatus() == DeviceStatus.PENDING && "reinstalled-host".equals(m.getHostname())
                                && "org-2".equals(m.getOrganizationId()))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("postRegistrationWriters")
    void write_concurrentDirectoryAndFleetSetBetweenReadAndWrite_survives(String path, DeviceStatus seededStatus,
                                                                        Consumer<Services> action,
                                                                        Function<Machine, Boolean> ownChangeLanded) {
        // setup
        seed(seededStatus);

        // execution
        action.accept(services);

        // verifications
        Machine stored = storedMachines.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(ownChangeLanded.apply(stored)).as("the path's own change").isTrue();
        assertThat(stored).extracting(Machine::getDirectorySources, Machine::getDirectoryUserLink,
                        Machine::getDirectoryUserIds, Machine::getDirectoryUserName, Machine::getComputerName)
                .containsExactly(List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.PRIMARY,
                        List.of("acc-1"), "Jane Doe", "Jane's MacBook Pro");
    }

    private static Arguments path(String name, DeviceStatus seededStatus, Consumer<Services> action,
                                  Function<Machine, Boolean> ownChangeLanded) {
        return Arguments.of(name, seededStatus, action, ownChangeLanded);
    }

    // Every read of the machine is followed by the concurrent write, before the service gets to write
    private static MachineRepository interleavingRepository() {
        MachineRepository repository = mock(MachineRepository.class, delegatesTo(storedMachines));
        doAnswer(invocation -> {
            Optional<Machine> read = storedMachines.findByMachineId(invocation.getArgument(0));
            concurrentDirectoryAndFleetWrite();
            return read;
        }).when(repository).findByMachineId(anyString());
        return repository;
    }

    private static void concurrentDirectoryAndFleetWrite() {
        machineWriter.update(MACHINE_ID, machineUpdate()
                .set(DIRECTORY_SOURCES, List.of(DirectorySource.MICROSOFT_365))
                .set(DIRECTORY_USER_LINK, DirectoryUserLink.PRIMARY)
                .set(DIRECTORY_USER_IDS, List.of("acc-1"))
                .set(DIRECTORY_USER_NAME, "Jane Doe")
                .set(COMPUTER_NAME, "Jane's MacBook Pro"));
    }

    private static void seed(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId("tenant-1");
        machine.setStatus(status);
        machine.setTelemetryStatus(TelemetryStatus.ONLINE);
        machine.setLastSeen(SEEN);
        machine.setHostname("old-host");
        machine.setTimezone("UTC");
        machine.setOrganizationId("org-1");
        template.save(machine);
    }

    private static AgentRegistrationRequest reinstallRequest() {
        AgentRegistrationRequest request = new AgentRegistrationRequest();
        request.setHostname("reinstalled-host");
        request.setOrganizationId("org-2");
        request.setOsType("WINDOWS");
        request.setAgentVersion("1.0.0");
        return request;
    }

    record Services(MachineStatusService status, MachineTimezoneService timezone, MachineHostnameService hostname,
                    AgentUninstallService uninstall, AgentRegistrationService registration) {

        Services(MachineRepository machines) {
            this(new MachineStatusService(machines, machineWriter, mock(ApplicationEventPublisher.class)),
                    new MachineTimezoneService(machines, machineWriter),
                    new MachineHostnameService(machines, machineWriter),
                    uninstallService(machines),
                    registrationService(machines));
        }

        private static AgentUninstallService uninstallService(MachineRepository machines) {
            return new AgentUninstallService(knownClient(false), mock(ClientSecretValidator.class), machines, machineWriter,
                    mock(ToolConnectionService.class), mock(InstalledAgentService.class),
                    mock(DeletedMachineCleanup.class), mock(ApplicationEventPublisher.class));
        }

        private static AgentRegistrationService registrationService(MachineRepository machines) {
            OrganizationIdResolver organizations = mock(OrganizationIdResolver.class);
            when(organizations.resolve("org-2")).thenReturn("org-2");
            // a reinstall no longer reads the machine, so the concurrent write lands after its first read, the client
            return new AgentRegistrationService(knownClient(true), machines, machineWriter, organizations,
                    mock(AgentRegistrationSecretValidator.class), mock(ClientSecretValidator.class),
                    mock(AgentSecretGenerator.class), mock(PasswordEncoder.class), mock(MachineIdGenerator.class),
                    mock(AgentRegistrationToolInstallationService.class), mock(AgentRegistrationProcessor.class),
                    mock(RegistrationTagAssignmentService.class), mock(InstalledAgentService.class),
                    mock(ToolConnectionService.class), mock(AgentRegistrationClientFeatureFlagsService.class),
                    mock(AgentRegistrationClientUpdateService.class));
        }

        private static OAuthClientRepository knownClient(boolean concurrentWriteAfterTheRead) {
            OAuthClient oauthClient = new OAuthClient();
            oauthClient.setMachineId(MACHINE_ID);
            oauthClient.setClientId("agent_" + MACHINE_ID);
            OAuthClientRepository clients = mock(OAuthClientRepository.class);
            when(clients.findByMachineId(MACHINE_ID)).thenAnswer(invocation -> {
                if (concurrentWriteAfterTheRead) {
                    concurrentDirectoryAndFleetWrite();
                }
                return Optional.of(oauthClient);
            });
            return clients;
        }
    }
}

package com.openframe.management.integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.management.service.DeviceHeartbeatOfflineDetectionService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.util.List;

import static com.openframe.data.service.machine.MachineFields.COMPUTER_NAME;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_SOURCES;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_IDS;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_LINK;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_NAME;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

// The offline sweep reads the silent machines, then marks them. A write made between the two (an external directory
// integration's summary, a Fleet fact, a heartbeat) must survive it.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceHeartbeatOfflineDetectionIT {

    private static final String MACHINE_ID = "m-1";
    private static final Instant LONG_AGO = Instant.parse("2026-01-01T00:00:00Z");

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    private static MongoClient client;
    private static MongoTemplate template;
    private static MachineRepository storedMachines;
    private static MachineWriter machineWriter;

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
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId("tenant-1");
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setTelemetryStatus(TelemetryStatus.ONLINE);
        machine.setLastSeen(LONG_AGO);
        template.save(machine);
    }

    @Test
    void markStaleDevicesOffline_concurrentDirectoryAndFleetSetAfterTheRead_survives() {
        // setup
        DeviceHeartbeatOfflineDetectionService service = serviceWithWriteAfterTheRead(() -> machineWriter.update(
                MACHINE_ID, machineUpdate()
                        .set(DIRECTORY_SOURCES, List.of(DirectorySource.MICROSOFT_365))
                        .set(DIRECTORY_USER_LINK, DirectoryUserLink.PRIMARY)
                        .set(DIRECTORY_USER_IDS, List.of("acc-1"))
                        .set(DIRECTORY_USER_NAME, "Jane Doe")
                        .set(COMPUTER_NAME, "Jane's MacBook Pro")));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        Machine stored = storedMachines.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(stored).extracting(Machine::getStatus, Machine::getTelemetryStatus)
                .containsExactly(DeviceStatus.OFFLINE, TelemetryStatus.OFFLINE);
        assertThat(stored).extracting(Machine::getDirectorySources, Machine::getDirectoryUserLink,
                        Machine::getDirectoryUserIds, Machine::getDirectoryUserName, Machine::getComputerName)
                .containsExactly(List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.PRIMARY,
                        List.of("acc-1"), "Jane Doe", "Jane's MacBook Pro");
    }

    @Test
    void markStaleDevicesOffline_heartbeatAfterTheRead_machineStaysOnline() {
        // setup
        Instant heartbeat = Instant.now();
        DeviceHeartbeatOfflineDetectionService service =
                serviceWithWriteAfterTheRead(() -> storedMachines.updateLastSeen(MACHINE_ID, heartbeat));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        Machine stored = storedMachines.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(stored).extracting(Machine::getStatus, Machine::getTelemetryStatus)
                .containsExactly(DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
    }

    @Test
    void markStaleDevicesOffline_uninstallAfterTheRead_deletedStatusKept() {
        // setup
        DeviceHeartbeatOfflineDetectionService service = serviceWithWriteAfterTheRead(() -> machineWriter.update(
                MACHINE_ID, machineUpdate().set(STATUS, DeviceStatus.DELETED)));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        Machine stored = storedMachines.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(DeviceStatus.DELETED);
    }

    private static DeviceHeartbeatOfflineDetectionService serviceWithWriteAfterTheRead(Runnable concurrentWrite) {
        MachineRepository machines = mock(MachineRepository.class, delegatesTo(storedMachines));
        doAnswer(invocation -> {
            List<Machine> read = storedMachines.findByTelemetryStatusAndLastSeenBefore(
                    invocation.getArgument(0), invocation.getArgument(1));
            concurrentWrite.run();
            return read;
        }).when(machines).findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class));
        DeviceHeartbeatOfflineDetectionService service = new DeviceHeartbeatOfflineDetectionService(machines, machineWriter);
        ReflectionTestUtils.setField(service, "offlineThresholdSeconds", 130L);
        return service;
    }
}

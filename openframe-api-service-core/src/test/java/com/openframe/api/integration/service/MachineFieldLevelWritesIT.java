package com.openframe.api.integration.service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.ForceClientUninstallService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.Optional;

import static com.openframe.data.service.machine.MachineFields.COMPUTER_NAME;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_SOURCES;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_IDS;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_LINK;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_NAME;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// The status writers read the machine, decide, then write. A $set an external directory integration (or the Fleet
// facts writer) makes between the read and the write must survive it.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineFieldLevelWritesIT {

    private static final String MACHINE_ID = "m-1";

    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    private static MongoClient client;
    private static MongoTemplate template;
    private static MachineRepository storedMachines;
    private static MachineWriter machineWriter;

    private MachineRepository interleavingMachines;

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
        template.save(machine);
        interleavingMachines = mock(MachineRepository.class, delegatesTo(storedMachines));
        doAnswer(invocation -> {
            Optional<Machine> read = storedMachines.findByMachineId(invocation.getArgument(0));
            concurrentDirectoryAndFleetWrite();
            return read;
        }).when(interleavingMachines).findByMachineId(anyString());
    }

    @Test
    void forceClientUninstall_concurrentDirectoryAndFleetSetAfterTheRead_survives() {
        // setup
        DeliveryRouter deliveryRouter = mock(DeliveryRouter.class);
        when(deliveryRouter.dispatch(any())).thenReturn(true);
        ForceClientUninstallService service =
                new ForceClientUninstallService(interleavingMachines, machineWriter, deliveryRouter);
        ForceClientUninstallRequest request = new ForceClientUninstallRequest();
        request.setMachineIds(List.of(MACHINE_ID));

        // execution
        service.process(request);

        // verifications
        assertStatusWrittenAndConcurrentFieldsKept(DeviceStatus.PENDING_DELETION);
    }

    @Test
    void updateStatusByMachineId_concurrentDirectoryAndFleetSetAfterTheRead_survives() {
        // setup
        DeviceService service = new DeviceService(interleavingMachines, mock(DeletedMachineCleanup.class),
                machineWriter, mock(TagRepository.class), mock(TagAssignmentRepository.class),
                mock(DeviceStatusProcessor.class), mock(DeviceFilterOptionMapper.class),
                mock(TenantIdProvider.class), mock(ApplicationEventPublisher.class));

        // execution
        service.updateStatusByMachineId(MACHINE_ID, DeviceStatus.ARCHIVED);

        // verifications
        assertStatusWrittenAndConcurrentFieldsKept(DeviceStatus.ARCHIVED);
    }

    private static void assertStatusWrittenAndConcurrentFieldsKept(DeviceStatus expectedStatus) {
        Machine stored = storedMachines.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(expectedStatus);
        assertThat(stored).extracting(Machine::getDirectorySources, Machine::getDirectoryUserLink,
                        Machine::getDirectoryUserIds, Machine::getDirectoryUserName, Machine::getComputerName)
                .containsExactly(List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.PRIMARY,
                        List.of("acc-1"), "Jane Doe", "Jane's MacBook Pro");
    }

    private static void concurrentDirectoryAndFleetWrite() {
        machineWriter.update(MACHINE_ID, machineUpdate()
                .set(DIRECTORY_SOURCES, List.of(DirectorySource.MICROSOFT_365))
                .set(DIRECTORY_USER_LINK, DirectoryUserLink.PRIMARY)
                .set(DIRECTORY_USER_IDS, List.of("acc-1"))
                .set(DIRECTORY_USER_NAME, "Jane Doe")
                .set(COMPUTER_NAME, "Jane's MacBook Pro"));
    }
}

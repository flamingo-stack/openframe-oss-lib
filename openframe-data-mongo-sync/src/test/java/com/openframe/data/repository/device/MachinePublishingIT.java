package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.publishing.MachineAggregateSpec;
import com.openframe.data.repository.device.publishing.MachineOnTicketsProjection;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.config.OutboxIndexAutoConfiguration;
import com.openframe.publishing.persistence.OutboxEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.service.machine.MachineFields.NICKNAME;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.assertj.core.api.Assertions.assertThat;

// The real MachineRepository and MachineWriter with MachineAggregateSpec: both write paths publish.
@SpringBootTest(classes = MachinePublishingIT.TestApplication.class,
        properties = {"openframe.events.topics.machines.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachinePublishingIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private MachineRepository machineRepository;
    @Autowired private MachineWriter machineWriter;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(Machine.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void savingAMachine_writesItsEventWithTheNamesOnly() {
        Machine saved = machineRepository.save(buildMachine());

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).singleElement().satisfies(row -> {
            assertThat(row.getAggregateType()).isEqualTo("machines");
            assertThat(row.getAggregateId()).isEqualTo(saved.getId());
            assertThat(readEvent(row)).containsEntry("machineId", "machine-1").containsEntry("hostname", "host-1")
                    .doesNotContainKeys("ip", "serialNumber");
        });
    }

    @Test
    void aNicknameWrittenByMachineWriter_writesAnEventWithTheNewNicknameAndVersion() {
        Machine saved = machineRepository.save(buildMachine());

        machineWriter.update("machine-1", machineUpdate().set(NICKNAME, "Front desk"));

        List<OutboxEvent> rows = mongoTemplate.findAll(OutboxEvent.class).stream()
                .sorted(Comparator.comparing(row -> readVersion(row)))
                .toList();
        assertThat(rows).hasSize(2);
        OutboxEvent written = rows.getLast();
        assertThat(written.getAggregateId()).isEqualTo(saved.getId());
        assertThat(readEvent(written)).containsEntry("nickname", "Front desk");
        Long storedVersion = mongoTemplate.findById(saved.getId(), Machine.class).getVersion();
        assertThat(readVersion(written)).isEqualTo(storedVersion);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> readEvent(OutboxEvent row) {
        return (Map<String, Object>) row.getPayload().get("event");
    }

    private static long readVersion(OutboxEvent row) {
        Number version = (Number) row.getPayload().get("version");
        return version.longValue();
    }

    // The reconcile reads only the names, not whole machines.
    @Test
    void theReconcileRead_returnsTheNamesOnly() {
        machineRepository.save(buildMachine());
        Set<String> tenantIds = Set.of("tenant-1");
        Set<String> machineIds = Set.of("machine-1");

        List<Machine> found = machineRepository.findByTenantIdInAndMachineIdIn(tenantIds, machineIds);

        assertThat(found).singleElement().satisfies(machine -> {
            assertThat(machine.getHostname()).isNotNull();
            assertThat(machine.getIp()).isNull();
        });
    }

    private static Machine buildMachine() {
        Machine machine = new Machine();
        machine.setTenantId("tenant-1");
        machine.setMachineId("machine-1");
        machine.setHostname("host-1");
        machine.setIp("10.0.0.1");
        return machine;
    }

    // Only what a service gets from these modules: not @EnableAutoConfiguration, which would also load MongoSyncConfig.
    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class, AggregateSpecAutoConfiguration.class,
            OutboxAutoConfiguration.class, OutboxIndexAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = MachineRepository.class)
    @Import({MachineAggregateSpec.class, MachineOnTicketsProjection.class, TicketProjectionRepository.class, MachineWriter.class})
    static class TestApplication {
    }
}

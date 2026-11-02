package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// The backfill marker is stamped on every attempt, so it must touch nothing else the machine carries.
@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomMachineRepositoryHostFactsCheckedIT extends BaseMongoIntegrationTest {

    private static final String MACHINE_ID = "m-1";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId("tenant-1");
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setSerialNumber("C02XG2JHJG5H");
        machine.setDirectorySources(List.of(DirectorySource.MICROSOFT_365));
        machine.setDirectoryUserLink(DirectoryUserLink.PRIMARY);
        mongoTemplate.save(machine);
    }

    @Test
    void markHostFactsChecked_stampsTheMarkerOnly() {
        // setup
        Instant checkedAt = Instant.parse("2026-10-30T03:15:00Z").truncatedTo(ChronoUnit.MILLIS);

        // execution
        repository.markHostFactsChecked(MACHINE_ID, checkedAt);

        // verifications
        Machine stored = repository.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(stored.getHostFactsCheckedAt()).isEqualTo(checkedAt);
        assertThat(stored).extracting(Machine::getStatus, Machine::getSerialNumber, Machine::getDirectorySources,
                        Machine::getDirectoryUserLink)
                .containsExactly(DeviceStatus.ONLINE, "C02XG2JHJG5H", List.of(DirectorySource.MICROSOFT_365),
                        DirectoryUserLink.PRIMARY);
    }

    @Test
    void markHostFactsChecked_unknownMachine_createsNothing() {
        // setup

        // execution
        repository.markHostFactsChecked("m-unknown", Instant.now());

        // verifications
        assertThat(repository.findByMachineId("m-unknown")).isEmpty();
        assertThat(repository.count()).isEqualTo(1);
    }
}

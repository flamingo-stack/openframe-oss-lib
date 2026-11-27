package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
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

@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineRepositoryPendingSinceIT extends BaseMongoIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-11-19T12:00:00Z");
    private static final Instant THRESHOLD = NOW.minus(15, ChronoUnit.MINUTES);
    private static final Instant LONG_AGO = NOW.minus(30, ChronoUnit.DAYS);

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
    }

    @Test
    void findPendingSinceBefore_pendingLongerThanThreshold_found() {
        // setup
        save("stuck", DeviceStatus.PENDING, LONG_AGO, NOW.minus(20, ChronoUnit.MINUTES));

        // execution
        List<Machine> found = repository.findPendingSinceBefore(THRESHOLD);

        // verifications
        assertThat(found).extracting(Machine::getMachineId).containsExactly("stuck");
    }

    @Test
    void findPendingSinceBefore_reinstalledWithinThreshold_notFound() {
        // setup
        save("reinstalled", DeviceStatus.PENDING, LONG_AGO, NOW.minus(1, ChronoUnit.MINUTES));

        // execution
        List<Machine> found = repository.findPendingSinceBefore(THRESHOLD);

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void findPendingSinceBefore_withoutPendingSince_countsFromRegistration() {
        // setup
        save("legacy-stuck", DeviceStatus.PENDING, NOW.minus(20, ChronoUnit.MINUTES), null);
        save("legacy-recent", DeviceStatus.PENDING, NOW.minus(1, ChronoUnit.MINUTES), null);

        // execution
        List<Machine> found = repository.findPendingSinceBefore(THRESHOLD);

        // verifications
        assertThat(found).extracting(Machine::getMachineId).containsExactly("legacy-stuck");
    }

    @Test
    void findPendingSinceBefore_notPending_notFound() {
        // setup
        save("managed", DeviceStatus.MANAGED, LONG_AGO, LONG_AGO);

        // execution
        List<Machine> found = repository.findPendingSinceBefore(THRESHOLD);

        // verifications
        assertThat(found).isEmpty();
    }

    private void save(String machineId, DeviceStatus status, Instant registeredAt, Instant pendingSince) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId("tenant-1");
        machine.setStatus(status);
        machine.setRegisteredAt(registeredAt);
        machine.setPendingSince(pendingSince);
        mongoTemplate.save(machine);
    }
}

package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// The Fleet host facts backfill reads only what this query returns, so the query alone decides which machines Fleet
// is asked about, and in which order.
@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomMachineRepositoryDueForFleetHostFactsIT extends BaseMongoIntegrationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final Instant NOW = Instant.parse("2026-11-02T12:15:00Z");
    private static final Instant CUTOFF = NOW.minus(Duration.ofDays(7));
    private static final int LIMIT = 200;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
    }

    @Test
    void findDueForFleetHostFacts_machineWithEveryFact_notDue() {
        // setup
        save(fullyKnown("m-1"));

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, LIMIT);

        // verifications
        assertThat(due).isEmpty();
    }

    @ParameterizedTest(name = "{0} absent")
    @ValueSource(strings = {"serialNumber", "model", "manufacturer", "osUuid", "computerName"})
    void findDueForFleetHostFacts_oneFactAbsent_due(String fact) {
        // setup
        save(fullyKnown("m-1"));
        mongoTemplate.updateFirst(byMachineId("m-1"), new Update().unset(fact), Machine.class);

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, LIMIT);

        // verifications
        assertThat(due).extracting(Machine::getMachineId).containsExactly("m-1");
    }

    @ParameterizedTest(name = "{0} empty")
    @ValueSource(strings = {"serialNumber", "model", "manufacturer", "osUuid", "computerName"})
    void findDueForFleetHostFacts_oneFactEmpty_due(String fact) {
        // setup
        save(fullyKnown("m-1"));
        mongoTemplate.updateFirst(byMachineId("m-1"), new Update().set(fact, ""), Machine.class);

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, LIMIT);

        // verifications
        assertThat(due).extracting(Machine::getMachineId).containsExactly("m-1");
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void findDueForFleetHostFacts_retiredMachine_notDue(DeviceStatus status) {
        // setup
        Machine retired = blank("m-1");
        retired.setStatus(status);
        save(retired);

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, LIMIT);

        // verifications
        assertThat(due).isEmpty();
    }

    @Test
    void findDueForFleetHostFacts_checkedSinceTheCutoff_notDue_checkedBefore_due() {
        // setup
        save(checkedAt(blank("m-recent"), CUTOFF.plus(Duration.ofHours(1))));
        save(checkedAt(blank("m-stale"), CUTOFF.minus(Duration.ofHours(1))));

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, LIMIT);

        // verifications
        assertThat(due).extracting(Machine::getMachineId).containsExactly("m-stale");
    }

    @Test
    void findDueForFleetHostFacts_neverCheckedFirst_thenTheOldestCheck_atMostTheLimit() {
        // setup
        save(checkedAt(blank("m-a"), CUTOFF.minus(Duration.ofDays(1))));
        save(checkedAt(blank("m-b"), CUTOFF.minus(Duration.ofDays(3))));
        save(blank("m-c"));
        save(checkedAt(blank("m-d"), CUTOFF.minus(Duration.ofDays(2))));

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, 3);

        // verifications
        assertThat(due).extracting(Machine::getMachineId).containsExactly("m-c", "m-b", "m-d");
    }

    @Test
    void findDueForFleetHostFacts_anotherTenantsMachine_notDue() {
        // setup
        Machine foreign = blank("m-1");
        foreign.setTenantId("tenant-2");
        save(foreign);

        // execution
        List<Machine> due = repository.findDueForFleetHostFacts(TENANT_ID, CUTOFF, LIMIT);

        // verifications
        assertThat(due).isEmpty();
    }

    private void save(Machine machine) {
        mongoTemplate.save(machine);
    }

    private static Query byMachineId(String machineId) {
        return new Query(Criteria.where("machineId").is(machineId));
    }

    private static Machine checkedAt(Machine machine, Instant checkedAt) {
        machine.setHostFactsCheckedAt(checkedAt.truncatedTo(ChronoUnit.MILLIS));
        return machine;
    }

    private static Machine fullyKnown(String machineId) {
        Machine machine = blank(machineId);
        machine.setSerialNumber("C02XG2JHJG5H");
        machine.setModel("MacBookPro18,3");
        machine.setManufacturer("Apple Inc.");
        machine.setOsUuid("6F1A2B3C-0000-4D5E-8F90-123456789ABC");
        machine.setComputerName("Jane's MacBook Pro");
        return machine;
    }

    private static Machine blank(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId(TENANT_ID);
        machine.setStatus(DeviceStatus.MANAGED);
        return machine;
    }
}

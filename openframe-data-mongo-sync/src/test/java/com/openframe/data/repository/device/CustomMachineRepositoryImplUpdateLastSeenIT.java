package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link CustomMachineRepositoryImpl#updateLastSeen} against a real MongoDB.
 *
 * <p>The method deliberately bypasses {@code save}/{@code saveAll} so the Pinot publishing aspect
 * does not fire on heartbeats. That is only safe as long as it touches nothing but {@code lastSeen} —
 * every other field here is part of, or adjacent to, the Pinot payload.
 */
@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomMachineRepositoryImplUpdateLastSeenIT extends BaseMongoIntegrationTest {

    private static final String MACHINE = "m-1";
    private static final String OTHER_MACHINE = "m-2";
    private static final Instant SEEN = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant LATER = Instant.parse("2026-01-01T00:05:00Z");

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(Machine.class);
    }

    private Machine save(String machineId, DeviceStatus status, Instant lastSeen) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId("tenant-1");
        machine.setStatus(status);
        machine.setLastSeen(lastSeen);
        machine.setOrganizationId("org-1");
        machine.setType(DeviceType.LAPTOP);
        machine.setOsType(OsType.WINDOWS);
        machine.setHostname("host-" + machineId);
        return mongoTemplate.save(machine);
    }

    private Machine reload(String machineId) {
        return repository.findByMachineId(machineId).orElseThrow();
    }

    @Test
    @DisplayName("T12: updateLastSeen writes lastSeen and leaves every Pinot-payload field untouched")
    void updatesOnlyLastSeenField() {
        save(MACHINE, DeviceStatus.ONLINE, SEEN);

        repository.updateLastSeen(MACHINE, LATER);

        Machine stored = reload(MACHINE);
        assertThat(stored.getLastSeen()).isEqualTo(LATER);
        assertThat(stored.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(stored.getOrganizationId()).isEqualTo("org-1");
        assertThat(stored.getType()).isEqualTo(DeviceType.LAPTOP);
        assertThat(stored.getOsType()).isEqualTo(OsType.WINDOWS);
        assertThat(stored.getHostname()).isEqualTo("host-" + MACHINE);
        assertThat(stored.getTenantId()).isEqualTo("tenant-1");
    }

    @Test
    @DisplayName("T13: updateLastSeen for an unknown machineId changes nothing and creates nothing")
    void unknownMachineId_changesNothing() {
        save(MACHINE, DeviceStatus.ONLINE, SEEN);

        repository.updateLastSeen("does-not-exist", LATER);

        assertThat(mongoTemplate.count(new Query(), Machine.class)).isEqualTo(1);
        assertThat(reload(MACHINE).getLastSeen()).isEqualTo(SEEN);
    }

    @Test
    @DisplayName("T14: updateLastSeen touches only the targeted machine")
    void updatesOnlyTargetMachine() {
        save(MACHINE, DeviceStatus.ONLINE, SEEN);
        save(OTHER_MACHINE, DeviceStatus.OFFLINE, SEEN);

        repository.updateLastSeen(MACHINE, LATER);

        assertThat(reload(MACHINE).getLastSeen()).isEqualTo(LATER);
        assertThat(reload(OTHER_MACHINE).getLastSeen()).isEqualTo(SEEN);
        assertThat(reload(OTHER_MACHINE).getStatus()).isEqualTo(DeviceStatus.OFFLINE);
    }
}

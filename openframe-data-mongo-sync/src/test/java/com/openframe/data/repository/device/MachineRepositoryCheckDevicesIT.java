package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import com.openframe.data.repository.device.model.MachineIdView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineRepositoryCheckDevicesIT extends BaseMongoIntegrationTest {

    private static final String NORTHWIND = "org-northwind";
    private static final Set<OsType> WINDOWS = EnumSet.of(OsType.WINDOWS);

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
        save("fs01", NORTHWIND, DeviceStatus.MANAGED, OsType.WINDOWS);
        save("ws02", NORTHWIND, DeviceStatus.ONLINE, OsType.WINDOWS);
        save("ws03", NORTHWIND, DeviceStatus.OFFLINE, OsType.WINDOWS);
        save("mac04", NORTHWIND, DeviceStatus.MANAGED, OsType.MAC_OS);
        save("pending05", NORTHWIND, DeviceStatus.PENDING, OsType.WINDOWS);
        save("archived06", NORTHWIND, DeviceStatus.ARCHIVED, OsType.WINDOWS);
        save("other07", "org-contoso", DeviceStatus.MANAGED, OsType.WINDOWS);
    }

    @Test
    void countByStatusInAndOsTypeInAndOrganizationId_connectedWindowsMachinesOfTheCustomer() {
        // execution
        long count = repository.countByStatusInAndOsTypeInAndOrganizationId(DeviceStatus.CONNECTED, WINDOWS, NORTHWIND);

        // verifications
        assertThat(count).isEqualTo(3);
    }

    @Test
    void countByStatusInAndOsTypeInAndMachineIdIn_skipsOtherOsAndDisconnectedMachines() {
        // execution
        long count = repository.countByStatusInAndOsTypeInAndMachineIdIn(DeviceStatus.CONNECTED, WINDOWS,
                List.of("fs01", "mac04", "pending05", "unknown"));

        // verifications
        assertThat(count).isEqualTo(1);
    }

    @Test
    void findByStatusInAndOsTypeInAndOrganizationId_machineIdsOfTheConnectedWindowsMachines() {
        // execution
        List<MachineIdView> machines = repository.findByStatusInAndOsTypeInAndOrganizationId(DeviceStatus.CONNECTED,
                WINDOWS, NORTHWIND);

        // verifications
        assertThat(machines).extracting(MachineIdView::getMachineId).containsExactlyInAnyOrder("fs01", "ws02", "ws03");
    }

    @Test
    void findByStatusInAndOsTypeInAndMachineIdIn_macCheck_onlyTheMac() {
        // execution
        List<MachineIdView> machines = repository.findByStatusInAndOsTypeInAndMachineIdIn(DeviceStatus.CONNECTED,
                EnumSet.of(OsType.MAC_OS), List.of("fs01", "mac04"));

        // verifications
        assertThat(machines).extracting(MachineIdView::getMachineId).containsExactly("mac04");
    }

    private void save(String machineId, String organizationId, DeviceStatus status, OsType osType) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId("tenant-1");
        machine.setOrganizationId(organizationId);
        machine.setStatus(status);
        machine.setOsType(osType);
        mongoTemplate.save(machine);
    }
}

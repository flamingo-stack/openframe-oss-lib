package com.openframe.data.service.machine;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import com.openframe.data.repository.device.MachineRepository;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static com.openframe.data.service.machine.MachineFields.COMPUTER_NAME;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_SOURCES;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_IDS;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_LINK;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_NAME;
import static com.openframe.data.service.machine.MachineFields.MANUFACTURER;
import static com.openframe.data.service.machine.MachineFields.MODEL;
import static com.openframe.data.service.machine.MachineFields.OS_UUID;
import static com.openframe.data.service.machine.MachineFields.SERIAL_NUMBER;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.assertj.core.api.Assertions.assertThat;

// An external directory integration writes the directory summary through MachineWriter, and the OSS GraphQL and Mongo device filters
// read it back, so the stored shape is the contract: enums by name, lists as arrays.
@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineWriterRoundTripIT extends BaseMongoIntegrationTest {

    private static final String MACHINE_ID = "m-1";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    private MachineWriter writer;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
        writer = new MachineWriter(mongoTemplate);
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId("tenant-1");
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setHostname("janes-mbp");
        mongoTemplate.save(machine);
    }

    @Test
    void update_hardwareAndDirectoryFields_readBackAsWrittenWithEnumsStoredByName() {
        // setup
        MachineUpdate update = machineUpdate()
                .set(SERIAL_NUMBER, "C02XG2JHJG5H")
                .set(MODEL, "MacBookPro18,3")
                .set(MANUFACTURER, "Apple Inc.")
                .set(OS_UUID, "6F1A2B3C-0000-4D5E-8F90-123456789ABC")
                .set(COMPUTER_NAME, "Jane's MacBook Pro")
                .set(DIRECTORY_SOURCES, List.of(DirectorySource.MICROSOFT_365))
                .set(DIRECTORY_USER_LINK, DirectoryUserLink.SHARED)
                .set(DIRECTORY_USER_IDS, List.of("acc-1", "acc-2"))
                .set(DIRECTORY_USER_NAME, null);

        // execution
        writer.update(MACHINE_ID, update);

        // verifications
        Machine stored = repository.findByMachineId(MACHINE_ID).orElseThrow();
        assertThat(stored).extracting(Machine::getSerialNumber, Machine::getModel, Machine::getManufacturer,
                        Machine::getOsUuid, Machine::getComputerName, Machine::getHostname)
                .containsExactly("C02XG2JHJG5H", "MacBookPro18,3", "Apple Inc.",
                        "6F1A2B3C-0000-4D5E-8F90-123456789ABC", "Jane's MacBook Pro", "janes-mbp");
        assertThat(stored).extracting(Machine::getDirectorySources, Machine::getDirectoryUserLink,
                        Machine::getDirectoryUserIds, Machine::getDirectoryUserName)
                .containsExactly(List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.SHARED,
                        List.of("acc-1", "acc-2"), null);
        Document raw = mongoTemplate.getCollection("machines").find(new Document("machineId", MACHINE_ID)).first();
        assertThat(raw.getList("directorySources", String.class)).containsExactly("MICROSOFT_365");
        assertThat(raw.getString("directoryUserLink")).isEqualTo("SHARED");
    }

    @Test
    void findByMachineId_machineSavedBeforeTheFieldsExisted_readsThemAsNull() {
        // setup

        // execution
        Machine stored = repository.findByMachineId(MACHINE_ID).orElseThrow();

        // verifications
        assertThat(stored).extracting(Machine::getComputerName, Machine::getDirectorySources,
                        Machine::getDirectoryUserLink, Machine::getDirectoryUserIds, Machine::getDirectoryUserName)
                .containsOnlyNulls();
    }
}

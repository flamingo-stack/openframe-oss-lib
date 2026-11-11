package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// The NONE rule rests on Mongo's $in-with-null semantics and on enum conversion inside the $in, which a query-shape
// test cannot prove.
@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomMachineRepositoryDirectoryFilterIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
        save("m-primary", List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.PRIMARY, "Jane Doe");
        save("m-shared", List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.SHARED, null);
        save("m-none", List.of(), DirectoryUserLink.NONE, null);
        save("m-unwritten", null, null, null);
    }

    @Test
    void findMachineIds_userLinkNone_explicitNoneAndNeverWrittenMachines() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .directoryUserLinks(List.of(DirectoryUserLink.NONE)).build();

        // execution
        List<String> machineIds = repository.findMachineIds(TENANT, filter, "");

        // verifications
        assertThat(machineIds).containsExactlyInAnyOrder("m-none", "m-unwritten");
    }

    @Test
    void findMachineIds_userLinkPrimary_onlyThePrimaryMachine() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .directoryUserLinks(List.of(DirectoryUserLink.PRIMARY)).build();

        // execution
        List<String> machineIds = repository.findMachineIds(TENANT, filter, "");

        // verifications
        assertThat(machineIds).containsExactly("m-primary");
    }

    @Test
    void findMachineIds_directorySourceMicrosoft_machinesMicrosoftKnows() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder()
                .directorySources(List.of(DirectorySource.MICROSOFT_365)).build();

        // execution
        List<String> machineIds = repository.findMachineIds(TENANT, filter, "");

        // verifications
        assertThat(machineIds).containsExactlyInAnyOrder("m-primary", "m-shared");
    }

    @Test
    void findMachineIds_searchByUserName_theMachineOfThatUser() {
        // setup
        MachineQueryFilter filter = MachineQueryFilter.builder().build();

        // execution
        List<String> machineIds = repository.findMachineIds(TENANT, filter, "jane");

        // verifications
        assertThat(machineIds).containsExactly("m-primary");
    }

    private void save(String machineId, List<DirectorySource> sources, DirectoryUserLink link, String userName) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId(TENANT);
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setHostname("host-" + machineId);
        machine.setDirectorySources(sources);
        machine.setDirectoryUserLink(link);
        machine.setDirectoryUserName(userName);
        mongoTemplate.save(machine);
    }
}

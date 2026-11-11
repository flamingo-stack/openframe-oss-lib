package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineRepositoryCveDevicesPageIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final Sort BY_HOSTNAME = Sort.by("hostname", "machineId");
    private static final List<String> CVE_MACHINES = List.of("m1", "m2", "m3", "m4", "m9");

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Machine.class);
        save(TENANT, "m1", "charlie");
        save(TENANT, "m2", "Alpha");
        save(TENANT, "m3", "bravo");
        save(TENANT, "m4", "al.pha");
        save(TENANT, "m5", "alpha-not-affected");
        save(OTHER_TENANT, "m9", "alpha-other-tenant");
    }

    @Test
    void findByTenantIdAndMachineIdIn_pagesTheTenantsMachinesByHostname() {
        Pageable firstPage = PageRequest.of(0, 2, BY_HOSTNAME);

        Page<Machine> page = repository.findByTenantIdAndMachineIdIn(TENANT, CVE_MACHINES, firstPage);

        assertThat(page.getContent()).extracting(Machine::getMachineId).containsExactly("m2", "m4");
        assertThat(page.getTotalElements()).isEqualTo(4);
        assertThat(page.hasNext()).isTrue();
    }

    @Test
    void findByTenantIdAndMachineIdInAndHostnameContainingIgnoreCase_matchesCaseInsensitively() {
        Pageable firstPage = PageRequest.of(0, 10, BY_HOSTNAME);

        Page<Machine> page = repository.findByTenantIdAndMachineIdInAndHostnameContainingIgnoreCase(
                TENANT, CVE_MACHINES, "ALPHA", firstPage);

        assertThat(page.getContent()).extracting(Machine::getMachineId).containsExactly("m2");
        assertThat(page.getTotalElements()).isEqualTo(1);
    }

    @Test
    void findByTenantIdAndMachineIdInAndHostnameContainingIgnoreCase_treatsTheSearchAsText() {
        Pageable firstPage = PageRequest.of(0, 10, BY_HOSTNAME);

        Page<Machine> page = repository.findByTenantIdAndMachineIdInAndHostnameContainingIgnoreCase(
                TENANT, CVE_MACHINES, "l.p", firstPage);

        assertThat(page.getContent()).extracting(Machine::getMachineId).containsExactly("m4");
    }

    private void save(String tenantId, String machineId, String hostname) {
        Machine machine = new Machine();
        machine.setTenantId(tenantId);
        machine.setMachineId(machineId);
        machine.setHostname(hostname);
        mongoTemplate.save(machine);
    }
}

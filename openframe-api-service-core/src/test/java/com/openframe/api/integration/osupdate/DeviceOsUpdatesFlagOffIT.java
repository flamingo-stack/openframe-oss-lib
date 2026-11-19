package com.openframe.api.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.device.DeviceStatus;
import graphql.ExecutionResult;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.util.ClassUtils;

import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

// A16, the api half: without openframe.rmm.os-update.enabled the service starts, neither the data fetcher nor its
// service and mappers run, and the device read still answers. The flag gates those beans only: the repositories and
// query components may be there, and deleting a device removes its OS rows whatever the flag says (A13).
@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "openframe.tenant-isolation.enabled=true")
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceOsUpdatesFlagOffIT extends BaseMongoIntegrationTest {

    // the three machines of this class: its setup touches no other row of the shared database
    private static final String READ = "os-flag-off-read";
    private static final String DELETED = "os-flag-off-deleted";
    private static final String KEPT = "os-flag-off-kept";

    @Autowired
    private ApplicationContext context;

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private DeviceService deviceService;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void removeTheMachinesOfThisClass() {
        Bson ownMachines = Filters.in("machineId", READ, DELETED, KEPT);
        machines().deleteMany(ownMachines);
        pending().deleteMany(ownMachines);
        history().deleteMany(ownMachines);
    }

    @Test
    void osUpdateFlagAbsent_apiStartsWithoutTheFetcherItsServiceAndMappers_deviceReadStillAnswers() {
        // setup
        machines().insertOne(machine(READ).append("osVersion", "Windows 11 Pro"));

        // execution
        List<String> beans = Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType).filter(Objects::nonNull)
                .map(ClassUtils::getUserClass).map(Class::getSimpleName).toList();
        ExecutionResult device = queryExecutor.execute(
                "query($machineId: String!) { device(machineId: $machineId) { machineId osVersion } }",
                Map.of("machineId", READ));

        // verifications
        assertThat(beans).contains("DeviceDataFetcher");
        assertThat(beans)
                .doesNotContain("OsUpdateDataFetcher", "OsUpdateService", "OsUpdateMapper", "GraphQLOsUpdateMapper");
        assertThat(device.getErrors()).isEmpty();
        assertThat(device.<Map<String, Object>>getData())
                .containsEntry("device", Map.of("machineId", READ, "osVersion", "Windows 11 Pro"));
    }

    @Test
    void osUpdateFlagAbsent_deletingADeviceStillRemovesItsPendingAndHistoryRows_andNoOtherDevices() {
        // setup
        machines().insertMany(List.of(machine(DELETED), machine(KEPT)));
        pending().insertMany(List.of(pendingRow(DELETED), pendingRow(KEPT)));
        history().insertMany(List.of(historyRow(DELETED), historyRow(KEPT)));

        // execution
        deviceService.updateStatusByMachineId(DELETED, DeviceStatus.DELETED);

        // verifications
        assertThat(machines().find(Filters.eq("machineId", DELETED)).first().getString("status")).isEqualTo("DELETED");
        assertThat(pending().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(history().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(pending().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
        assertThat(history().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
    }

    private static Document machine(String machineId) {
        return new Document("machineId", machineId).append("tenantId", TENANT_ID).append("status", "ONLINE");
    }

    private static Document pendingRow(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("updateKey", "k-1").append("title", "Update one")
                .append("discoveredAt", Date.from(Instant.parse("2026-11-19T10:14:51Z")));
    }

    private static Document historyRow(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("entryKey", "k-0|2026-10-16T02:41:10Z|INSTALL").append("updateKey", "k-0")
                .append("title", "Update zero").append("operation", "INSTALL").append("result", "SUCCEEDED")
                .append("installedAt", Date.from(Instant.parse("2026-10-16T02:41:10Z")));
    }

    private MongoCollection<Document> machines() {
        return mongoTemplate.getCollection("machines");
    }

    private MongoCollection<Document> pending() {
        return mongoTemplate.getCollection("device_os_updates");
    }

    private MongoCollection<Document> history() {
        return mongoTemplate.getCollection("device_os_update_history");
    }
}

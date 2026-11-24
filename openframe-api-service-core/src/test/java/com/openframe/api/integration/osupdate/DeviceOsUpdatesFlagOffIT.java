package com.openframe.api.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.device.DeviceStatus;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.util.ClassUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "openframe.tenant-isolation.enabled=true")
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceOsUpdatesFlagOffIT extends BaseMongoIntegrationTest {

    private static final String READ = "os-flag-off-read";
    private static final String DELETED = "os-flag-off-deleted";
    private static final String KEPT = "os-flag-off-kept";
    // WARNING: counted from now: a row older than the retention is deleted by the TTL monitor of the container
    private static final Instant INSTALLED_AT =
            Instant.now().truncatedTo(ChronoUnit.SECONDS).minus(DeviceOsUpdateHistoryEntry.RETENTION.dividedBy(6));

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
        states().deleteMany(ownMachines);
        pending().deleteMany(ownMachines);
        history().deleteMany(ownMachines);
    }

    @Test
    void osUpdateFlagAbsent_apiStartsWithoutTheDataFetcherTheQueryServiceAndTheMappers_deviceReadStillAnswers() {
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
                .doesNotContain("DeviceOsDataFetcher", "DeviceOsQueryService", "DeviceOsResponseMapper",
                        "DeviceOsGraphQLMapper", "OsUpdateDataFetcher", "OsUpdateQueryService",
                        "OsUpdateResponseMapper", "OsUpdateGraphQLMapper", "OsUpdateDeviceCountsDataLoader");
        assertThat(device.getErrors()).isEmpty();
        assertThat(device.<Map<String, Object>>getData())
                .containsEntry("device", Map.of("machineId", READ, "osVersion", "Windows 11 Pro"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "deviceOsPendingUpdates(machineId: $machineId) { identifier }",
            "deviceOsUpdateHistory(machineId: $machineId) { pageInfo { hasNextPage } }"})
    void osUpdateFlagAbsent_listReadIsInTheSchemaAndAnswersWithAnError(String read) {
        // setup
        machines().insertOne(machine(READ));
        states().insertOne(stateDocument(READ));

        // execution
        ExecutionResult result = queryExecutor.execute(
                "query($machineId: String!) { " + read + " }", Map.of("machineId", READ));

        // verifications
        assertThat(result.getErrors()).as("errors of %s", read).isNotEmpty();
        assertThat(result.getErrors()).extracting(GraphQLError::getMessage)
                .as("%s is in the schema: no FieldUndefined validation error", read)
                .noneMatch(message -> message.contains("FieldUndefined"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "osUpdates { pageInfo { hasNextPage } }",
            "osUpdateDevices(osUpdateId: \"6aff19c07ce86a3f0386ff82\", status: PENDING) { pageInfo { hasNextPage } }"})
    void osUpdateFlagAbsent_tenantWideListReadIsInTheSchemaAndAnswersWithAnError(String read) {
        // setup

        // execution
        ExecutionResult result = queryExecutor.execute("query { " + read + " }");

        // verifications
        assertThat(result.getErrors()).as("errors of %s", read).isNotEmpty();
        assertThat(result.getErrors()).extracting(GraphQLError::getMessage)
                .as("%s is in the schema: no FieldUndefined validation error", read)
                .noneMatch(message -> message.contains("FieldUndefined"));
    }

    @Test
    void osUpdateFlagAbsent_deviceOsStateIsInTheSchemaAndAnswersNullWithoutAnError() {
        // setup
        machines().insertOne(machine(READ));
        states().insertOne(stateDocument(READ));

        // execution
        ExecutionResult result = queryExecutor.execute(
                "query($machineId: String!) { deviceOsState(machineId: $machineId) { receivedAt } }",
                Map.of("machineId", READ));

        // verifications
        assertThat(result.getErrors()).as("errors of deviceOsState").isEmpty();
        assertThat(result.<Map<String, Object>>getData()).as("data of deviceOsState")
                .containsKey("deviceOsState").containsEntry("deviceOsState", null);
    }

    @Test
    void osUpdateFlagAbsent_deletingADeviceStillRemovesItsStatePendingAndHistoryRows_andNoOtherDevices() {
        // setup
        machines().insertMany(List.of(machine(DELETED), machine(KEPT)));
        states().insertMany(List.of(stateDocument(DELETED), stateDocument(KEPT)));
        pending().insertMany(List.of(pendingUpdate(DELETED), pendingUpdate(KEPT)));
        history().insertMany(List.of(historyEntry(DELETED), historyEntry(KEPT)));

        // execution
        deviceService.updateStatusByMachineId(DELETED, DeviceStatus.DELETED);

        // verifications
        assertThat(machines().find(Filters.eq("machineId", DELETED)).first().getString("status")).isEqualTo("DELETED");
        assertThat(states().countDocuments(Filters.eq("machineId", DELETED)))
                .as("device_os_states documents of the deleted device").isZero();
        assertThat(pending().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(history().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(states().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
        assertThat(pending().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
        assertThat(history().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
    }

    private static Document machine(String machineId) {
        return new Document("machineId", machineId).append("tenantId", TENANT_ID).append("status", "ONLINE");
    }

    private static Document stateDocument(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("platform", "WINDOWS").append("osVersion", "11 24H2").append("osBuild", "26100.4061")
                .append("receivedAt", Date.from(Instant.parse("2026-11-19T10:15:02.417Z")));
    }

    private static Document pendingUpdate(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("platform", "WINDOWS").append("identifier", "k-1")
                .append("discoveredAt", Date.from(Instant.parse("2026-11-19T10:14:51Z")));
    }

    private static Document historyEntry(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("entryKey", "k-0|" + INSTALLED_AT.toEpochMilli() + "|INSTALL").append("identifier", "k-0")
                .append("title", "Update zero").append("operation", "INSTALL").append("result", "SUCCEEDED")
                .append("installedAt", Date.from(INSTALLED_AT));
    }

    private MongoCollection<Document> machines() {
        return mongoTemplate.getCollection("machines");
    }

    private MongoCollection<Document> states() {
        return mongoTemplate.getCollection("device_os_states");
    }

    private MongoCollection<Document> pending() {
        return mongoTemplate.getCollection("device_os_pending_updates");
    }

    private MongoCollection<Document> history() {
        return mongoTemplate.getCollection("device_os_update_history");
    }
}

package com.openframe.client.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.openframe.client.integration.support.OsReportIngestTestApplication;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import org.bson.Document;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

import static com.openframe.client.integration.support.OsReportIngestTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = OsReportIngestTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "openframe.rmm.package-manager-bootstrap.enabled=true")
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineOsUpdatesFlagOffIT extends BaseOsReportIngestIT {

    private static final String DELETED = "os-flag-off-deleted";
    private static final String KEPT = "os-flag-off-kept";
    // WARNING: counted from now: a row older than the retention is deleted by the TTL monitor of the container
    private static final Instant INSTALLED_AT =
            Instant.now().truncatedTo(ChronoUnit.SECONDS).minus(DeviceOsUpdateHistoryEntry.RETENTION.dividedBy(6));

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private DeletedMachineCleanup deletedMachineCleanup;

    @Test
    void osUpdateFlagAbsent_clientStartsWithoutTheListenerAndItsFacade() {
        // setup

        // execution
        List<String> beans = beanClassNames(context);

        // verifications
        assertThat(beans).as("the same context does run a listener whose flag is on")
                .contains("MachinePackageManagersListener");
        assertThat(beans).doesNotContain("MachineOsUpdatesListener", "DeviceOsReportFacade");
    }

    @Test
    void osUpdateFlagAbsent_deletedMachineCleanupStillRemovesTheStateAndTheRowsOfThatMachineOnly() {
        // setup
        states().deleteMany(Filters.in("machineId", DELETED, KEPT));
        pending().deleteMany(Filters.in("machineId", DELETED, KEPT));
        history().deleteMany(Filters.in("machineId", DELETED, KEPT));
        states().insertMany(List.of(stateDocument(DELETED), stateDocument(KEPT)));
        pending().insertMany(List.of(pendingUpdate(DELETED), pendingUpdate(KEPT)));
        history().insertMany(List.of(historyEntry(DELETED), historyEntry(KEPT)));

        // execution
        deletedMachineCleanup.cleanUpDeletedMachine(TENANT_ID, DELETED);

        // verifications
        assertThat(states().countDocuments(Filters.eq("machineId", DELETED)))
                .as("device_os_states documents of the deleted device").isZero();
        assertThat(pending().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(history().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(states().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
        assertThat(pending().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
        assertThat(history().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
    }

    private static Document stateDocument(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("platform", "WINDOWS").append("osVersion", "11 24H2")
                .append("receivedAt", Date.from(Instant.parse("2026-11-20T09:14:03.120Z")));
    }

    private static Document pendingUpdate(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("platform", "WINDOWS").append("identifier", "kb-1")
                .append("discoveredAt", Date.from(Instant.parse("2026-11-20T09:14:03.120Z")));
    }

    private static Document historyEntry(String machineId) {
        return new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("entryKey", "kb-0|" + INSTALLED_AT.toEpochMilli() + "|INSTALL").append("identifier", "kb-0")
                .append("operation", "INSTALL").append("result", "SUCCEEDED")
                .append("installedAt", Date.from(INSTALLED_AT));
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

package com.openframe.client.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.openframe.client.integration.support.OsReportIngestTestApplication;
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
import java.util.Date;
import java.util.List;

import static com.openframe.client.integration.support.OsReportIngestTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

// A16, the client half: without openframe.rmm.os-update.enabled the service starts and neither the listener nor its
// service and mapper run. The flag gates those beans only: the repositories may be there, and a deleted device loses
// its OS rows whatever the flag says (A13).
@SpringBootTest(
        classes = OsReportIngestTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "openframe.rmm.package-manager-bootstrap.enabled=true")
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineOsUpdatesFlagOffIT extends BaseOsReportIngestIT {

    // the two machines of this class: its setup touches no other row of the shared database
    private static final String DELETED = "os-flag-off-deleted";
    private static final String KEPT = "os-flag-off-kept";

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private DeletedMachineCleanup deletedMachineCleanup;

    @Test
    void osUpdateFlagAbsent_clientStartsWithoutTheListenerItsServiceAndMapper() {
        // setup

        // execution
        List<String> beans = beanClassNames(context);

        // verifications
        assertThat(beans).as("the same context does run a listener whose flag is on")
                .contains("MachinePackageManagersListener");
        assertThat(beans).doesNotContain("MachineOsUpdatesListener", "MachineOsUpdatesService", "OsUpdateReportMapper");
    }

    @Test
    void osUpdateFlagAbsent_deletedMachineCleanupStillRemovesThePendingAndHistoryRowsOfThatMachineOnly() {
        // setup
        pending().deleteMany(Filters.in("machineId", DELETED, KEPT));
        history().deleteMany(Filters.in("machineId", DELETED, KEPT));
        pending().insertMany(List.of(pendingRow(DELETED), pendingRow(KEPT)));
        history().insertMany(List.of(historyRow(DELETED), historyRow(KEPT)));

        // execution
        deletedMachineCleanup.cleanUpDeletedMachine(TENANT_ID, DELETED);

        // verifications
        assertThat(pending().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(history().countDocuments(Filters.eq("machineId", DELETED))).isZero();
        assertThat(pending().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
        assertThat(history().countDocuments(Filters.eq("machineId", KEPT))).isEqualTo(1);
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

    private MongoCollection<Document> pending() {
        return mongoTemplate.getCollection("device_os_updates");
    }

    private MongoCollection<Document> history() {
        return mongoTemplate.getCollection("device_os_update_history");
    }
}

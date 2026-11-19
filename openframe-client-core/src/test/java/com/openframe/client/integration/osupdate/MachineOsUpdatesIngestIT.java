package com.openframe.client.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import com.openframe.client.integration.support.OsReportIngestTestApplication;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import io.nats.client.Connection;
import io.nats.client.JetStreamApiException;
import io.nats.client.JetStreamManagement;
import io.nats.client.api.AckPolicy;
import io.nats.client.api.ConsumerConfiguration;
import io.nats.client.api.ConsumerInfo;
import io.nats.client.api.DeliverPolicy;
import org.assertj.core.groups.Tuple;
import org.awaitility.core.ConditionTimeoutException;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.openframe.client.integration.support.OsReportIngestTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.assertj.core.api.SoftAssertions.assertSoftly;
import static org.awaitility.Awaitility.await;

/**
 * Acceptance of the ingest half of CU-17tkuw67mjf, pass 1: what the agent publishes on
 * {@code machine.<machineId>.os-updates} (os-report-contract-draft.md, draft v1) is what MongoDB holds afterwards.
 *
 * <p>In: the report as bytes over a real JetStream. Out: the raw documents of {@code device_os_states},
 * {@code device_os_updates} and {@code device_os_update_history}, in the shapes design.md gives (ruling 11: the OS
 * state is its own document, the device document is not written) and the read half (DeviceOsUpdatesReadIT in
 * openframe-api-service-core) reads. The fixtures under {@code os-updates/} are the two
 * examples of the contract and the reports of scenarios E1 to E7; the stand script publishes the same files.
 */
@SpringBootTest(
        classes = OsReportIngestTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.rmm.package-manager-bootstrap.enabled=true"
        })
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MachineOsUpdatesIngestIT extends BaseOsReportIngestIT {

    private static final JsonMapper JSON = new JsonMapper();
    private static final AtomicInteger MACHINES = new AtomicInteger();
    private static final Duration FIRST_WAIT = Duration.ofSeconds(10);
    private static final Duration SHORT_WAIT = Duration.ofSeconds(1);
    // set by the first report nobody applied, so a run without the feature does not wait ten seconds per test
    private static volatile boolean nothingApplies;

    private static final String OTHER_TENANT_ID = "tenant-b";
    // every machine id of this class starts with it: setup and cleanup leave the rest of the shared database alone
    private static final String OWN_MACHINES = "os-ingest-";

    private static final String WINDOWS_FIRST_REPORT = "windows-first-report";
    private static final String WINDOWS_INSTALLED = "windows-installed";
    private static final String WINDOWS_MANAGED_ELSEWHERE = "windows-managed-elsewhere-wsus";
    private static final String WINDOWS_NEVER_SCANNED = "windows-never-scanned";
    private static final String WINDOWS_FAILED_SCAN = "windows-failed-scan";
    private static final String WINDOWS_TWO_PENDING = "windows-two-pending";
    private static final String MAC_NOT_AUTHORIZED = "mac-not-authorized";

    private static final String KB5068861_KEY = "7d2f1c0e-3b0a-4c59-9d53-0c8f4d1f6a21:201";
    private static final String KB5068861_TITLE =
            "2026-11 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems (KB5068861)";
    private static final String DOTNET_KEY = "c4e5a6b7-0d1e-4f2a-9b3c-5d6e7f8091a2:102";
    private static final String DEFENDER_KEY = "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b:200";
    private static final String OCTOBER_KEY = "b0a7e1d4-52c3-4f0e-8a6d-91f3c2e4d7aa:200";
    private static final String OCTOBER_TITLE =
            "2026-10 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems (KB5066835)";
    private static final String MAC_KEY = "MSU_UPDATE_25G342_patch_26.7.3_minor";
    private static final String SECURITY_UPDATES_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final String DEFINITION_UPDATES_ID = "e0789628-ce08-4437-be74-2495b842f43b";

    private static final Instant FIRST_SCAN = Instant.parse("2026-11-19T10:14:51Z");
    private static final Instant SECOND_SCAN = Instant.parse("2026-11-19T16:14:51Z");
    private static final Instant OCTOBER_INSTALL = Instant.parse("2026-10-16T02:41:10Z");
    private static final Instant NOVEMBER_INSTALL = Instant.parse("2026-11-20T02:41:10Z");

    @Autowired
    private Connection natsConnection;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private DeletedMachineCleanup deletedMachineCleanup;

    // the stream sequence of the report this test published last
    private long lastStored;

    @BeforeEach
    void removeTheMachinesOfThisClass() {
        // deleteMany, not drop: the indexes of the three feature collections must outlive a test
        Bson ownMachines = Filters.regex("machineId", "^" + OWN_MACHINES);
        machines().deleteMany(ownMachines);
        stateCollection().deleteMany(ownMachines);
        pendingCollection().deleteMany(ownMachines);
        historyCollection().deleteMany(ownMachines);
    }

    // ───────── harness ─────────

    @Test
    void harness_packageManagersReportOverTheSameRoute_storedOnTheMachine() throws Exception {
        // setup
        String machineId = newMachine();
        byte[] report = "{\"packageManagers\":{\"BREW\":\"PRESENT\"}}".getBytes(StandardCharsets.UTF_8);

        // execution
        natsConnection.jetStream().publish("machine." + machineId + ".package-managers", report);

        // verifications
        await().atMost(FIRST_WAIT).untilAsserted(() ->
                assertThat(machine(machineId).get("packageManagers", Document.class)).containsEntry("BREW", "PRESENT"));
    }

    // ───────── A16, flag on ─────────

    @Test
    void osUpdateFlagOn_listenerAndServiceRun_oneDurableConsumerOnTheStream() throws Exception {
        // setup
        JetStreamManagement streams = natsConnection.jetStreamManagement();

        // execution
        List<String> consumers = streams.getConsumerNames(OS_UPDATES_STREAM);

        // verifications
        // the names MachineOsUpdatesFlagOffIT asserts absent: present here, so that guard cannot pass on a rename
        assertThat(beanClassNames(context))
                .contains("MachineOsUpdatesListener", "MachineOsUpdatesService", "OsUpdateReportMapper");
        assertThat(consumers).as("consumers of %s", OS_UPDATES_STREAM).hasSize(1);
        ConsumerConfiguration consumer =
                streams.getConsumerInfo(OS_UPDATES_STREAM, consumers.getFirst()).getConsumerConfiguration();
        assertThat(consumer.getDurable()).isNotBlank();
        assertThat(consumer.getFilterSubject()).isEqualTo(OS_UPDATES_SUBJECTS);
        assertThat(consumer.getAckPolicy()).isEqualTo(AckPolicy.Explicit);
    }

    // ───────── A1, A9, E1: Windows first report ─────────

    @Test
    void windowsFirstReport_versionBuildStateAndThePendingUpdateStored() {
        // setup
        String machineId = newMachine();

        // execution
        Instant storedByNats = publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.getString("tenantId")).isEqualTo(TENANT_ID);
        assertThat(osState.getString("machineId")).isEqualTo(machineId);
        assertThat(osState.getString("osVersion")).isEqualTo("Windows 11 Pro");
        assertThat(osState.getString("osBuild")).isEqualTo("26100.4061");
        assertThat(osState.get("restartPending")).isEqualTo(false);
        assertThat(osState.get("restartPendingSince")).isNull();
        assertThat(instant(osState, "lastScanAt")).isEqualTo(FIRST_SCAN);
        assertThat(osState.get("lastScanError")).isNull();
        assertThat(instant(osState, "lastInstalledAt")).isEqualTo(OCTOBER_INSTALL);
        assertThat(osState.get("managementState")).isEqualTo("MANAGED");
        assertThat(osState.get("managedElsewhereReason")).isNull();
        assertThat(osState.get("observedReason")).isNull();
        assertThat(osState.get("authorization")).isEqualTo("NOT_REQUIRED");
        assertThat(instant(osState, "receivedAt")).as("the time NATS stored the report").isEqualTo(storedByNats);

        assertThat(pendingRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("tenantId")).isEqualTo(TENANT_ID);
            assertThat(row.getString("updateKey")).isEqualTo(KB5068861_KEY);
            assertThat(row.getString("title")).isEqualTo(KB5068861_TITLE);
            assertThat(row.get("version")).isNull();
            assertThat(strings(row, "kbArticleIds")).containsExactly("5068861");
            assertThat(row.get("severity")).isEqualTo("CRITICAL");
            assertThat(categories(row)).as("each category with the id and the name of the wire")
                    .containsExactly(Tuple.tuple(SECURITY_UPDATES_ID, "Security Updates"));
            assertThat(row.get("browseOnly")).isEqualTo(false);
            assertThat(instant(row, "publishedAt")).as("the agent's publishedAt, under its own name")
                    .isEqualTo(Instant.parse("2026-11-10T18:00:00Z"));
            assertThat(row).doesNotContainKey("releasedAt");
            assertThat(number(row, "sizeBytes")).isEqualTo(812646400L);
            assertThat(row.get("restartBehaviour")).isEqualTo("ALWAYS");
            assertThat(instant(row, "discoveredAt")).isEqualTo(FIRST_SCAN);
        });
        assertThat(historyRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("tenantId")).isEqualTo(TENANT_ID);
            assertThat(row.getString("entryKey")).isNotBlank();
            assertThat(row.getString("updateKey")).isEqualTo(OCTOBER_KEY);
            assertThat(row.getString("title")).isEqualTo(OCTOBER_TITLE);
            assertThat(instant(row, "installedAt")).isEqualTo(OCTOBER_INSTALL);
            assertThat(row.get("operation")).isEqualTo("INSTALL");
            assertThat(row.get("result")).isEqualTo("SUCCEEDED");
            assertThat(row.get("errorCode")).isEqualTo("0x00000000");
        });
    }

    // ───────── A6, A9, E3: Mac, not authorized ─────────

    @Test
    void macReport_notAuthorizedAndThePendingUpdateStored_withoutSeverityAndKb() {
        // setup
        String machineId = newMachine();

        // execution
        publish(machineId, fixtureText(MAC_NOT_AUTHORIZED));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.getString("osVersion")).isEqualTo("26.2");
        assertThat(osState.getString("osBuild")).isEqualTo("25C56");
        assertThat(osState.get("authorization")).isEqualTo("NOT_AUTHORIZED");
        assertThat(osState.get("managementState")).isEqualTo("MANAGED");
        assertThat(osState.get("restartPending")).isEqualTo(false);
        assertThat(instant(osState, "lastScanAt")).isEqualTo(Instant.parse("2026-11-19T10:14:40Z"));
        assertThat(osState.get("lastInstalledAt")).as("nothing installed yet").isNull();
        assertThat(pendingRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("updateKey")).isEqualTo(MAC_KEY);
            assertThat(row.getString("title")).isEqualTo("macOS Tahoe 26.7.3");
            assertThat(row.getString("version")).isEqualTo("26.7.3");
            assertThat(row.get("severity")).isNull();
            assertThat(strings(row, "kbArticleIds")).isEmpty();
            assertThat(categories(row)).isEmpty();
            assertThat(row.get("publishedAt")).isNull();
            assertThat(row).doesNotContainKey("releasedAt");
            assertThat(number(row, "sizeBytes")).as("above the int range").isEqualTo(3481600000L);
            assertThat(row.get("restartBehaviour")).isEqualTo("ALWAYS");
            assertThat(instant(row, "discoveredAt")).isEqualTo(Instant.parse("2026-11-19T10:14:40Z"));
        });
        assertThat(historyRows(machineId)).isEmpty();
    }

    // ───────── A2: a later report replaces the list ─────────

    @Test
    void laterReport_replacesTheList_updateStillListedKeepsItsDiscoveredAtAndTakesTheNewFields() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        ObjectNode second = fixture(WINDOWS_TWO_PENDING);
        ((ObjectNode) pending(second).get(0)).put("sizeBytes", 900000000L);
        ObjectNode third = fixture(WINDOWS_TWO_PENDING);
        pending(third).remove(0);
        state(third).put("lastScanAt", "2026-11-19T22:14:51Z");

        // execution
        publish(machineId, second.toString());
        awaitProcessed();
        Map<String, Document> afterSecond = pendingByKey(machineId);
        publish(machineId, third.toString());
        awaitProcessed();
        Map<String, Document> afterThird = pendingByKey(machineId);

        // verifications
        assertThat(afterSecond).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY);
        assertThat(instant(afterSecond.get(KB5068861_KEY), "discoveredAt")).isEqualTo(FIRST_SCAN);
        assertThat(number(afterSecond.get(KB5068861_KEY), "sizeBytes")).isEqualTo(900000000L);
        assertThat(instant(afterSecond.get(DOTNET_KEY), "discoveredAt")).isEqualTo(SECOND_SCAN);
        assertThat(afterSecond.get(DOTNET_KEY).get("severity")).isEqualTo("IMPORTANT");
        assertThat(afterSecond.get(DOTNET_KEY).get("restartBehaviour")).isEqualTo("MAY_REQUIRE");
        assertThat(afterThird).containsOnlyKeys(DOTNET_KEY);
        assertThat(instant(afterThird.get(DOTNET_KEY), "discoveredAt")).isEqualTo(SECOND_SCAN);
        assertThat(instant(osState(machineId), "lastScanAt")).isEqualTo(Instant.parse("2026-11-19T22:14:51Z"));
    }

    // design.md, known limit: an update withdrawn and offered again is discovered anew
    @Test
    void updateListedAgainAfterItDisappeared_getsTheDiscoveredAtOfTheNewScan() {
        // setup
        String machineId = newMachine();
        ObjectNode gone = fixture(WINDOWS_FIRST_REPORT);
        gone.putArray("pendingUpdates");
        state(gone).put("lastScanAt", "2026-11-20T08:00:00Z");
        ObjectNode back = fixture(WINDOWS_FIRST_REPORT);
        state(back).put("lastScanAt", "2026-11-21T08:00:00Z");

        // execution
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        publish(machineId, gone.toString());
        awaitProcessed();
        List<Document> whileGone = pendingRows(machineId);
        publish(machineId, back.toString());
        awaitProcessed();

        // verifications
        assertThat(whileGone).isEmpty();
        assertThat(pendingRows(machineId)).singleElement().satisfies(row ->
                assertThat(instant(row, "discoveredAt")).isEqualTo(Instant.parse("2026-11-21T08:00:00Z")));
    }

    // ───────── A3, E2: installed ─────────

    @Test
    void installedUpdate_leavesThePendingList_entersTheHistory_movesLastInstalledAt() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));

        // execution
        publish(machineId, fixtureText(WINDOWS_INSTALLED));
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId)).isEmpty();
        Map<String, Document> history = historyByUpdateKey(machineId);
        assertThat(history).containsOnlyKeys(KB5068861_KEY, OCTOBER_KEY);
        Document installed = history.get(KB5068861_KEY);
        assertThat(installed.getString("title")).isEqualTo(KB5068861_TITLE);
        assertThat(instant(installed, "installedAt")).isEqualTo(NOVEMBER_INSTALL);
        assertThat(installed.get("operation")).isEqualTo("INSTALL");
        assertThat(installed.get("result")).isEqualTo("SUCCEEDED");
        Document osState = osState(machineId);
        assertThat(instant(osState, "lastInstalledAt")).isEqualTo(NOVEMBER_INSTALL);
        assertThat(osState.get("restartPending")).isEqualTo(true);
    }

    // ───────── A15 (ingest side): history rows ─────────

    @Test
    void sameHistoryEntryInSeveralReports_storedOnce_andAShorterHistoryDeletesNothing() {
        // setup
        String machineId = newMachine();

        // execution
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        publish(machineId, fixtureText(WINDOWS_INSTALLED));
        publish(machineId, fixtureText(WINDOWS_INSTALLED));
        ObjectNode withoutHistory = fixture(WINDOWS_INSTALLED);
        withoutHistory.putArray("installHistory");
        publish(machineId, withoutHistory.toString());
        ObjectNode historyAbsent = fixture(WINDOWS_INSTALLED);
        historyAbsent.remove("installHistory");
        publish(machineId, historyAbsent.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId)).extracting(row -> row.getString("updateKey"))
                .containsExactlyInAnyOrder(KB5068861_KEY, OCTOBER_KEY);
        assertThat(instant(osState(machineId), "lastInstalledAt")).isEqualTo(NOVEMBER_INSTALL);
        assertNothingLeftForRedelivery();
    }

    @Test
    void historyEntriesWithoutUpdateKey_keptApartByTitleAndInstallTime() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(MAC_NOT_AUTHORIZED);
        ArrayNode history = report.putArray("installHistory");
        history.add(historyEntry(null, "macOS Tahoe 26.2", "2026-09-30T19:02:11Z", "INSTALL", "SUCCEEDED"));
        history.add(historyEntry(null, "macOS Tahoe 26.2", "2026-10-04T07:45:00Z", "INSTALL", "SUCCEEDED"));
        history.add(historyEntry(null, "Safari", "2026-10-04T07:45:00Z", "INSTALL", "SUCCEEDED"));

        // execution
        publish(machineId, report.toString());
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId))
                .extracting(row -> row.get("updateKey"), row -> row.getString("title"), row -> instant(row, "installedAt"))
                .containsExactlyInAnyOrder(
                        Tuple.tuple(null, "macOS Tahoe 26.2", Instant.parse("2026-09-30T19:02:11Z")),
                        Tuple.tuple(null, "macOS Tahoe 26.2", Instant.parse("2026-10-04T07:45:00Z")),
                        Tuple.tuple(null, "Safari", Instant.parse("2026-10-04T07:45:00Z")));
        assertThat(instant(osState(machineId), "lastInstalledAt")).isEqualTo(Instant.parse("2026-10-04T07:45:00Z"));
    }

    @Test
    void sameUpdateInstalledAndUninstalledAtTheSameInstant_twoHistoryRows() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ArrayNode history = report.putArray("installHistory");
        history.add(historyEntry(OCTOBER_KEY, OCTOBER_TITLE, "2026-10-16T02:41:10Z", "INSTALL", "SUCCEEDED"));
        history.add(historyEntry(OCTOBER_KEY, OCTOBER_TITLE, "2026-10-16T02:41:10Z", "UNINSTALL", "SUCCEEDED"));

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId)).extracting(row -> row.get("operation"))
                .containsExactlyInAnyOrder("INSTALL", "UNINSTALL");
    }

    @Test
    void lastInstalledAt_newestSucceededInstallOfTheStoredHistory_notAFailedOneNorAnUninstall() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ArrayNode history = report.putArray("installHistory");
        history.add(historyEntry("k-1", "Update one", "2026-10-16T02:41:10Z", "INSTALL", "SUCCEEDED"));
        history.add(historyEntry("k-2", "Update two", "2026-10-20T03:00:00Z", "INSTALL", "SUCCEEDED_WITH_ERRORS"));
        history.add(historyEntry("k-3", "Update three", "2026-11-01T03:00:00Z", "INSTALL", "FAILED"));
        history.add(historyEntry("k-2", "Update two", "2026-11-05T03:00:00Z", "UNINSTALL", "SUCCEEDED"));
        history.add(historyEntry("k-4", "Update four", "2026-11-07T03:00:00Z", "INSTALL", "ABORTED"));
        ObjectNode onlyTheFailedOne = fixture(WINDOWS_FIRST_REPORT);
        onlyTheFailedOne.putArray("installHistory")
                .add(historyEntry("k-3", "Update three", "2026-11-01T03:00:00Z", "INSTALL", "FAILED"));

        // execution
        publish(machineId, report.toString());
        awaitProcessed();
        Instant afterFullHistory = instant(osState(machineId), "lastInstalledAt");
        publish(machineId, onlyTheFailedOne.toString());
        awaitProcessed();

        // verifications
        assertThat(afterFullHistory).isEqualTo(Instant.parse("2026-10-20T03:00:00Z"));
        assertThat(instant(osState(machineId), "lastInstalledAt")).isEqualTo(Instant.parse("2026-10-20T03:00:00Z"));
        List<Document> storedHistory = historyRows(machineId);
        assertThat(storedHistory).hasSize(5);
        // k-2 has two rows, its install and its uninstall, so this history is not read through historyByUpdateKey
        assertThat(storedHistory).filteredOn(row -> "k-2".equals(row.getString("updateKey")))
                .extracting(row -> row.get("operation")).containsExactlyInAnyOrder("INSTALL", "UNINSTALL");
        assertThat(storedHistory).filteredOn(row -> "k-3".equals(row.getString("updateKey"))).singleElement()
                .satisfies(failed -> {
                    assertThat(failed.get("result")).isEqualTo("FAILED");
                    assertThat(failed.get("errorCode")).as("hresult of the wire").isEqualTo("0x80240022");
                });
    }

    @Test
    void oneHundredAndTwentyHistoryEntries_allStored_eachOnce() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ArrayNode history = report.putArray("installHistory");
        Instant oldest = Instant.parse("2026-01-01T00:00:00Z");
        for (int i = 0; i < 120; i++) {
            String installedAt = oldest.plus(i, ChronoUnit.HOURS).toString();
            history.add(historyEntry("k-" + i, "Update " + i, installedAt, "INSTALL", "SUCCEEDED"));
        }

        // execution
        publish(machineId, report.toString());
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId)).hasSize(120);
        assertThat(instant(osState(machineId), "lastInstalledAt")).isEqualTo(oldest.plus(119, ChronoUnit.HOURS));
        assertNothingLeftForRedelivery();
    }

    // ───────── A4: restart pending ─────────

    @Test
    void restartPending_sinceSetByTheFirstReportThatSaysTrue_keptWhileTrue_clearedWhenFalse() {
        // setup
        String machineId = newMachine();
        ObjectNode restartNeeded = fixture(WINDOWS_FIRST_REPORT);
        state(restartNeeded).put("restartPending", true);
        ObjectNode stillNeeded = fixture(WINDOWS_FIRST_REPORT);
        state(stillNeeded).put("restartPending", true).put("lastScanAt", "2026-11-19T16:14:51Z");

        // execution
        Instant firstTrueStoredByNats = publish(machineId, restartNeeded.toString());
        awaitProcessed();
        Document afterFirstTrue = osState(machineId);
        Instant secondStoredByNats = publish(machineId, stillNeeded.toString());
        awaitProcessed();
        Document afterSecondTrue = osState(machineId);
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();
        Document afterFalse = osState(machineId);
        publish(machineId, restartNeeded.toString());
        awaitProcessed();
        Document afterTrueAgain = osState(machineId);

        // verifications
        Instant since = instant(afterFirstTrue, "restartPendingSince");
        assertThat(afterFirstTrue.get("restartPending")).isEqualTo(true);
        assertThat(since).as("restartPendingSince = arrival of the first report with restartPending true")
                .isCloseTo(firstTrueStoredByNats, within(1, ChronoUnit.MINUTES));
        assertThat(afterSecondTrue.get("restartPending")).isEqualTo(true);
        assertThat(instant(afterSecondTrue, "restartPendingSince")).isEqualTo(since);
        assertThat(instant(afterSecondTrue, "receivedAt")).isEqualTo(secondStoredByNats);
        assertThat(afterFalse.get("restartPending")).isEqualTo(false);
        assertThat(afterFalse.get("restartPendingSince")).isNull();
        assertThat(afterTrueAgain.get("restartPending")).isEqualTo(true);
        assertThat(instant(afterTrueAgain, "restartPendingSince")).isAfter(since);
    }

    // ───────── A5, E4: managed elsewhere ─────────

    @Test
    void deviceUnderWsus_managedElsewhereWithItsReason_andAllThreePendingUpdatesStored() {
        // setup
        String machineId = newMachine();

        // execution
        publish(machineId, fixtureText(WINDOWS_MANAGED_ELSEWHERE));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.get("managementState")).isEqualTo("MANAGED_ELSEWHERE");
        assertThat(osState.get("managedElsewhereReason")).isEqualTo("WSUS");
        assertThat(osState.get("observedReason")).isNull();
        Map<String, Document> pending = pendingByKey(machineId);
        assertThat(pending).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY, DEFENDER_KEY);
        assertThat(pending.get(KB5068861_KEY).get("severity")).isEqualTo("CRITICAL");
        assertThat(pending.get(DOTNET_KEY).get("severity")).isEqualTo("IMPORTANT");
        assertThat(pending.get(DEFENDER_KEY).get("severity")).as("no vendor severity is not LOW").isNull();
        assertThat(pending.get(DEFENDER_KEY).get("restartBehaviour")).isEqualTo("NEVER");
        assertThat(categories(pending.get(DEFENDER_KEY)))
                .containsExactly(Tuple.tuple(DEFINITION_UPDATES_ID, "Definition Updates"));
    }

    @Test
    void observedDevice_observedWithItsReasonStored() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        state(report).put("managementState", "OBSERVED").put("observedReason", "HOME_EDITION");

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.get("managementState")).isEqualTo("OBSERVED");
        assertThat(osState.get("observedReason")).isEqualTo("HOME_EDITION");
        assertThat(osState.get("managedElsewhereReason")).isNull();
    }

    // ───────── A7, E5: never scanned ─────────

    @Test
    void neverScannedDevice_stateWithNullLastScanAtAndTheErrorStored_noRows() {
        // setup
        String machineId = newMachine();

        // execution
        Instant storedByNats = publish(machineId, fixtureText(WINDOWS_NEVER_SCANNED));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.get("lastScanAt")).isNull();
        assertThat(osState.get("lastScanError")).isEqualTo("0x8024402C");
        assertThat(osState.get("lastInstalledAt")).isNull();
        assertThat(instant(osState, "receivedAt")).isEqualTo(storedByNats);
        assertThat(osState.getString("osVersion")).isEqualTo("Windows 11 Pro");
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
    }

    @Test
    void deviceThatNeverReported_hasNoOsStateDocumentAndNoRows() {
        // setup
        String machineId = newMachine();

        // execution
        publish(newMachine(), fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();

        // verifications
        assertThat(stateDocuments(machineId)).isEmpty();
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
    }

    // ───────── A8, E6: a failed scan keeps the list ─────────

    static Stream<String> failedScanReports() {
        ObjectNode nullList = fixture(WINDOWS_FAILED_SCAN);
        nullList.putNull("pendingUpdates");
        ObjectNode emptyList = fixture(WINDOWS_FAILED_SCAN);
        emptyList.putArray("pendingUpdates");
        return Stream.of(fixtureText(WINDOWS_FAILED_SCAN), nullList.toString(), emptyList.toString());
    }

    @ParameterizedTest
    @MethodSource("failedScanReports")
    void failedScan_errorStored_lastScanAtAndThePendingListKept(String failedScanReport) {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));

        // execution
        Instant storedByNats = publish(machineId, failedScanReport);
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.get("lastScanError")).isEqualTo("0x80072EE2");
        assertThat(instant(osState, "lastScanAt")).isEqualTo(FIRST_SCAN);
        assertThat(instant(osState, "receivedAt")).isEqualTo(storedByNats);
        assertThat(pendingRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("updateKey")).isEqualTo(KB5068861_KEY);
            assertThat(instant(row, "discoveredAt")).isEqualTo(FIRST_SCAN);
        });
        assertThat(historyRows(machineId)).hasSize(1);
    }

    @Test
    void successfulScanAfterAFailedOne_errorCleared_listReplaced() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        publish(machineId, fixtureText(WINDOWS_FAILED_SCAN));

        // execution
        publish(machineId, fixtureText(WINDOWS_TWO_PENDING));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.get("lastScanError")).isNull();
        assertThat(instant(osState, "lastScanAt")).isEqualTo(SECOND_SCAN);
        assertThat(pendingByKey(machineId)).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY);
    }

    @Test
    void emptyLastScanErrorWithAPendingList_isASuccessfulScan_listReplaced_noErrorStored() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        publish(machineId, fixtureText(WINDOWS_FAILED_SCAN));
        ObjectNode emptyError = fixture(WINDOWS_TWO_PENDING);
        state(emptyError).put("lastScanError", "");

        // execution
        publish(machineId, emptyError.toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.get("lastScanError")).as("an empty error is no error").isNull();
        assertThat(instant(osState, "lastScanAt")).isEqualTo(SECOND_SCAN);
        assertThat(pendingByKey(machineId)).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY);
    }

    // os-report-contract-draft.md §2: absent pendingUpdates = no list in this report
    @Test
    void reportWithOnlyOsState_stateWritten_listAndHistoryKept() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        ObjectNode onlyState = fixture(WINDOWS_FIRST_REPORT);
        onlyState.remove("pendingUpdates");
        onlyState.remove("installHistory");
        state(onlyState).put("restartPending", true).put("osBuild", "26100.4202");

        // execution
        publish(machineId, onlyState.toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.getString("osBuild")).isEqualTo("26100.4202");
        assertThat(osState.get("restartPending")).isEqualTo(true);
        assertThat(instant(osState, "lastInstalledAt")).isEqualTo(OCTOBER_INSTALL);
        assertThat(pendingRows(machineId)).singleElement().satisfies(row ->
                assertThat(instant(row, "discoveredAt")).isEqualTo(FIRST_SCAN));
        assertThat(historyRows(machineId)).hasSize(1);
    }

    static Stream<String> reportsWithoutVersionAndBuild() {
        ObjectNode absent = fixture(WINDOWS_TWO_PENDING);
        state(absent).remove(List.of("osVersion", "osBuild"));
        ObjectNode nulls = fixture(WINDOWS_TWO_PENDING);
        state(nulls).putNull("osVersion").putNull("osBuild");
        ObjectNode empty = fixture(WINDOWS_TWO_PENDING);
        state(empty).put("osVersion", "").put("osBuild", "");
        ObjectNode spaces = fixture(WINDOWS_TWO_PENDING);
        state(spaces).put("osVersion", "  ").put("osBuild", "  ");
        return Stream.of(absent.toString(), nulls.toString(), empty.toString(), spaces.toString());
    }

    // a report that has no version and build must not blank the ones the OS tab shows
    @ParameterizedTest
    @MethodSource("reportsWithoutVersionAndBuild")
    void reportWithoutOsVersionAndBuild_stateKeepsTheOnesItHad_restOfTheReportApplied(String report) {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));

        // execution
        publish(machineId, report);
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.getString("osVersion")).isEqualTo("Windows 11 Pro");
        assertThat(osState.getString("osBuild")).isEqualTo("26100.4061");
        assertThat(instant(osState, "lastScanAt")).isEqualTo(SECOND_SCAN);
        assertThat(pendingByKey(machineId)).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY);
    }

    // ───────── A9: the vendor's severity ─────────

    @Test
    void msrcSeverity_mappedWithoutRegardToCase_emptyUnknownOrAbsentIsNoSeverity() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ObjectNode template = (ObjectNode) pending(report).get(0);
        ArrayNode updates = report.putArray("pendingUpdates");
        updates.add(withSeverity(template, "critical", "Critical"));
        updates.add(withSeverity(template, "important", "IMPORTANT"));
        updates.add(withSeverity(template, "moderate", "moderate"));
        updates.add(withSeverity(template, "low", "Low"));
        updates.add(withSeverity(template, "empty", ""));
        updates.add(withSeverity(template, "unknown", "Unspecified"));
        ObjectNode absent = withSeverity(template, "absent", "x");
        absent.remove("msrcSeverity");
        updates.add(absent);

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        Map<String, Document> pending = pendingByKey(machineId);
        assertThat(pending).hasSize(7);
        assertThat(pending.get("critical").get("severity")).isEqualTo("CRITICAL");
        assertThat(pending.get("important").get("severity")).isEqualTo("IMPORTANT");
        assertThat(pending.get("moderate").get("severity")).isEqualTo("MODERATE");
        assertThat(pending.get("low").get("severity")).isEqualTo("LOW");
        assertThat(pending.get("empty").get("severity")).isNull();
        assertThat(pending.get("unknown").get("severity")).isNull();
        assertThat(pending.get("absent").get("severity")).isNull();
    }

    // ───────── A17: a report is not written into the device document ─────────

    @Test
    void reports_changeNothingInTheDeviceDocument() {
        // setup
        String machineId = newMachine();
        Date updatedBeforeTheReports = Date.from(Instant.parse("2026-11-01T00:00:00Z"));
        machines().updateOne(Filters.eq("machineId", machineId), Updates.combine(
                Updates.set("osVersion", "Windows 10 Pro"),
                Updates.set("osBuild", "19045.5011"),
                Updates.set("updatedAt", updatedBeforeTheReports)));
        Document deviceBeforeTheReports = machine(machineId);

        // execution
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        publish(machineId, fixtureText(WINDOWS_INSTALLED));
        awaitProcessed();

        // verifications
        Document device = machine(machineId);
        assertSoftly(softly -> {
            softly.assertThat(device.getString("osVersion")).as("machines.osVersion").isEqualTo("Windows 10 Pro");
            softly.assertThat(device.getString("osBuild")).as("machines.osBuild").isEqualTo("19045.5011");
            softly.assertThat(device.getDate("updatedAt")).as("machines.updatedAt").isEqualTo(updatedBeforeTheReports);
            softly.assertThat(device).as("the device document has no osState").doesNotContainKey("osState");
            softly.assertThat(device).as("the whole device document").isEqualTo(deviceBeforeTheReports);
            softly.assertThat(stateDocuments(machineId)).as("the reports did arrive: device_os_states").hasSize(1);
        });
    }

    // ───────── A10: reports are ordered by the time NATS stored them ─────────

    @Test
    void reportStoredByNatsEarlierThanTheOneAlreadyApplied_changesNothing() {
        // setup
        String machineId = newMachine();
        Date appliedReportStoredAt = Date.from(Instant.now().plus(1, ChronoUnit.DAYS));
        stateCollection().insertOne(new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("osVersion", "from the applied report")
                .append("lastScanError", "from the applied report")
                .append("receivedAt", appliedReportStoredAt));

        // execution
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.getString("osVersion")).isEqualTo("from the applied report");
        assertThat(osState.get("osBuild")).isNull();
        assertThat(osState.getDate("receivedAt")).isEqualTo(appliedReportStoredAt);
        assertThat(osState.get("lastScanError")).isEqualTo("from the applied report");
        assertThat(osState.get("lastScanAt")).isNull();
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
        assertNothingLeftForRedelivery();
    }

    // design.md, ingest: the state is written before the rows. When the row write fails the report is not
    // acknowledged and NATS delivers it again with the time it stored it, so that time must pass the guard.
    @Test
    void reportDeliveredAgainAfterItsRowsWereLost_rowsWrittenAgainOnce_discoveredAtAndRestartPendingSinceKept() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        state(report).put("restartPending", true);
        long sequence = store(machineId, report.toString());
        awaitProcessed();
        Document stateOfTheFirstDelivery = osState(machineId);
        List<Document> pendingOfTheFirstDelivery = pendingRows(machineId);
        List<Document> historyOfTheFirstDelivery = historyRows(machineId);
        pendingCollection().deleteMany(Filters.eq("machineId", machineId));
        historyCollection().deleteMany(Filters.eq("machineId", machineId));

        // execution
        deliverAgain(machineId, sequence);
        List<Document> pendingAfterTheRedelivery = pendingRows(machineId);
        List<Document> historyAfterTheRedelivery = historyRows(machineId);
        deliverAgain(machineId, sequence);

        // verifications
        assertThat(instant(stateOfTheFirstDelivery, "receivedAt")).isEqualTo(storedAt(sequence));
        assertThat(pendingOfTheFirstDelivery).hasSize(1);
        assertThat(historyOfTheFirstDelivery).hasSize(1);
        assertThat(pendingAfterTheRedelivery).as("pending rows written by the redelivery").singleElement()
                .satisfies(row -> {
                    assertThat(row.getString("updateKey")).isEqualTo(KB5068861_KEY);
                    assertThat(instant(row, "discoveredAt")).isEqualTo(FIRST_SCAN)
                            .isEqualTo(instant(pendingOfTheFirstDelivery.getFirst(), "discoveredAt"));
                });
        assertThat(historyAfterTheRedelivery).as("history rows written by the redelivery").singleElement()
                .satisfies(row -> {
                    assertThat(row.getString("updateKey")).isEqualTo(OCTOBER_KEY);
                    assertThat(row.get("entryKey")).isEqualTo(historyOfTheFirstDelivery.getFirst().get("entryKey"));
                    assertThat(instant(row, "installedAt")).isEqualTo(OCTOBER_INSTALL);
                });
        assertThat(pendingRows(machineId)).as("pending rows after one more delivery").singleElement()
                .satisfies(row -> assertThat(instant(row, "discoveredAt")).isEqualTo(FIRST_SCAN));
        assertThat(historyRows(machineId)).as("history rows after one more delivery").hasSize(1);
        Document osState = osState(machineId);
        assertThat(instant(osState, "receivedAt")).isEqualTo(storedAt(sequence));
        assertThat(osState.get("restartPending")).isEqualTo(true);
        assertThat(instant(osState, "restartPendingSince")).isNotNull()
                .isEqualTo(instant(stateOfTheFirstDelivery, "restartPendingSince"));
        assertThat(instant(osState, "lastInstalledAt")).isEqualTo(OCTOBER_INSTALL);
        assertNothingLeftForRedelivery();
    }

    // ───────── A11, E7: malformed reports ─────────

    static Stream<String> malformedReports() {
        ObjectNode listOfTheWrongType = fixture(WINDOWS_TWO_PENDING);
        listOfTheWrongType.put("pendingUpdates", "none");
        ObjectNode timestampOfTheWrongFormat = fixture(WINDOWS_TWO_PENDING);
        state(timestampOfTheWrongFormat).put("lastScanAt", "yesterday");
        return Stream.of(
                "{\"osState\": \"x\"",
                "not json",
                "",
                "[]",
                "\"text\"",
                "{\"osState\": \"x\"}",
                // osState is required (contract §2): a report without it carries nothing to apply
                "{}",
                "{\"pendingUpdates\": []}",
                "{\"osState\": null, \"pendingUpdates\": [], \"installHistory\": []}",
                listOfTheWrongType.toString(),
                timestampOfTheWrongFormat.toString());
    }

    @ParameterizedTest
    @MethodSource("malformedReports")
    void malformedReport_changesNothing_isNotRedelivered_andTheNextValidReportIsApplied(String malformed) {
        // setup
        String machineId = newMachine();
        Instant firstStoredByNats = publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));

        // execution
        publish(machineId, malformed);
        awaitProcessed();
        Document stateAfterMalformed = osState(machineId);
        Map<String, Document> pendingAfterMalformed = pendingByKey(machineId);
        assertNothingLeftForRedelivery();
        publish(machineId, fixtureText(WINDOWS_TWO_PENDING));
        awaitProcessed();

        // verifications
        assertThat(instant(stateAfterMalformed, "receivedAt")).isEqualTo(firstStoredByNats);
        assertThat(instant(stateAfterMalformed, "lastScanAt")).isEqualTo(FIRST_SCAN);
        assertThat(pendingAfterMalformed).containsOnlyKeys(KB5068861_KEY);
        assertThat(pendingByKey(machineId)).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY);
        assertThat(instant(osState(machineId), "lastScanAt")).isEqualTo(SECOND_SCAN);
    }

    @Test
    void unknownEnumValues_reportStillApplied_thoseFieldsStoredAsNull() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        state(report).put("managementState", "QUARANTINED")
                .put("managedElsewhereReason", "INTUNE")
                .put("observedReason", "KIOSK")
                .put("osUpdateAuthorization", "PENDING")
                .put("architecture", "RISCV64");
        ((ObjectNode) pending(report).get(0)).put("restartBehaviour", "SOMETIMES");
        ((ObjectNode) report.get("installHistory").get(0)).put("operation", "REPAIR").put("result", "PENDING_RESTART");

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState.getString("osVersion")).isEqualTo("Windows 11 Pro");
        assertThat(instant(osState, "lastScanAt")).isEqualTo(FIRST_SCAN);
        assertThat(osState.get("managementState")).isNull();
        assertThat(osState.get("managedElsewhereReason")).isNull();
        assertThat(osState.get("observedReason")).isNull();
        assertThat(osState.get("authorization")).isNull();
        assertThat(osState.get("lastInstalledAt")).as("an entry of unknown operation is not an install").isNull();
        assertThat(pendingRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("updateKey")).isEqualTo(KB5068861_KEY);
            assertThat(row.get("restartBehaviour")).isNull();
            assertThat(row.get("severity")).isEqualTo("CRITICAL");
        });
        assertThat(historyRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("updateKey")).isEqualTo(OCTOBER_KEY);
            assertThat(row.get("operation")).isNull();
            assertThat(row.get("result")).isNull();
        });
    }

    // contract §6.5: a missing boolean is unknown, not false
    @Test
    void absentBooleans_storedAsUnknown_notAsFalse() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        state(report).remove("restartPending");
        ((ObjectNode) pending(report).get(0)).remove("browseOnly");

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(instant(osState, "lastScanAt")).isEqualTo(FIRST_SCAN);
        assertThat(osState.get("restartPending")).isNull();
        assertThat(pendingRows(machineId)).singleElement().satisfies(row ->
                assertThat(row.get("browseOnly")).isNull());
    }

    @Test
    void browseOnlyUpdate_storedAsBrowseOnly() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ((ObjectNode) pending(report).get(0)).put("browseOnly", true);

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId)).singleElement().satisfies(row ->
                assertThat(row.get("browseOnly")).isEqualTo(true));
    }

    // the read answers kbArticleIds as [String!]!: a null stored in the row would fail the whole list
    @Test
    void nullAmongTheKbArticleIds_rowStoresTheIdsWithoutIt() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ((ObjectNode) pending(report).get(0)).putArray("kbArticleIds").add("5068861").addNull();

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId)).singleElement().satisfies(row -> {
            assertThat(row.getString("updateKey")).isEqualTo(KB5068861_KEY);
            assertThat(strings(row, "kbArticleIds")).containsExactly("5068861");
        });
        assertNothingLeftForRedelivery();
    }

    // design.md, ruling 10: the row keeps each category as id + name
    @Test
    void categories_storedWithIdAndName_oneWithOnlyOneOfThemKept_oneWithNeitherSkipped() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        ArrayNode categories = ((ObjectNode) pending(report).get(0)).putArray("categories");
        categories.addObject().put("id", SECURITY_UPDATES_ID).put("name", "Security Updates");
        categories.addObject().put("id", "only-an-id");
        categories.addObject();
        categories.addObject().putNull("id").put("name", "Only a name");
        categories.addObject().put("id", "").put("name", " ");
        categories.addNull();

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId)).singleElement().satisfies(row -> assertThat(categories(row))
                .containsExactly(
                        Tuple.tuple(SECURITY_UPDATES_ID, "Security Updates"),
                        Tuple.tuple("only-an-id", null),
                        Tuple.tuple(null, "Only a name")));
        assertNothingLeftForRedelivery();
    }

    // ───────── A12, A13: whose report it is ─────────

    @Test
    void reportForAnUnknownMachine_storesNothing_isNotRedelivered() {
        // setup
        String unknownMachineId = OWN_MACHINES + "unknown-" + UUID.randomUUID();

        // execution
        publish(unknownMachineId, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();

        // verifications
        assertThat(machine(unknownMachineId)).isNull();
        assertThat(stateDocuments(unknownMachineId)).isEmpty();
        assertThat(pendingRows(unknownMachineId)).isEmpty();
        assertThat(historyRows(unknownMachineId)).isEmpty();
        assertNothingLeftForRedelivery();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void reportOfAFrozenMachine_ignored(DeviceStatus frozen) {
        // setup
        String machineId = OWN_MACHINES + MACHINES.incrementAndGet();
        saveMachine(machineId, frozen, TENANT_ID);

        // execution
        publish(machineId, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();

        // verifications
        assertThat(stateDocuments(machineId)).isEmpty();
        assertThat(machine(machineId).getString("status")).isEqualTo(frozen.name());
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
        assertNothingLeftForRedelivery();
    }

    @Test
    void deletedMachineCleanup_removesTheStateThePendingAndTheHistoryRowsOfThatMachineOnly() {
        // setup
        String deleted = newMachine();
        String kept = newMachine();
        publish(deleted, fixtureText(WINDOWS_FIRST_REPORT));
        publish(kept, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();
        int statesBefore = stateDocuments(deleted).size();
        int pendingBefore = pendingRows(deleted).size();
        int historyBefore = historyRows(deleted).size();

        // execution
        deletedMachineCleanup.cleanUpDeletedMachine(TENANT_ID, deleted);

        // verifications
        assertThat(statesBefore).as("device_os_states documents before the deletion").isEqualTo(1);
        assertThat(pendingBefore).isEqualTo(1);
        assertThat(historyBefore).isEqualTo(1);
        assertThat(stateDocuments(deleted)).as("device_os_states documents of the deleted device").isEmpty();
        assertThat(pendingRows(deleted)).isEmpty();
        assertThat(historyRows(deleted)).isEmpty();
        assertThat(stateDocuments(kept)).as("device_os_states documents of the other device").hasSize(1);
        assertThat(pendingRows(kept)).hasSize(1);
        assertThat(historyRows(kept)).hasSize(1);
    }

    @Test
    void sameUpdateKeyOnMachinesOfTwoTenants_oneRowEach_withItsOwnTenant_replacedApart() {
        // setup
        String ours = newMachine();
        String theirs = OWN_MACHINES + MACHINES.incrementAndGet();
        saveMachine(theirs, DeviceStatus.ONLINE, OTHER_TENANT_ID);

        // execution
        publish(ours, fixtureText(WINDOWS_FIRST_REPORT));
        publish(theirs, fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();
        List<Document> oursFirst = pendingRows(ours);
        List<Document> theirsFirst = pendingRows(theirs);
        publish(ours, fixtureText(WINDOWS_INSTALLED));
        awaitProcessed();

        // verifications
        assertThat(oursFirst).extracting(row -> row.getString("tenantId"), row -> row.getString("updateKey"))
                .containsExactly(Tuple.tuple(TENANT_ID, KB5068861_KEY));
        assertThat(theirsFirst).extracting(row -> row.getString("tenantId"), row -> row.getString("updateKey"))
                .containsExactly(Tuple.tuple(OTHER_TENANT_ID, KB5068861_KEY));
        assertThat(pendingRows(ours)).isEmpty();
        assertThat(pendingRows(theirs)).hasSize(1);
        assertThat(historyRows(theirs)).extracting(row -> row.getString("tenantId")).containsOnly(OTHER_TENANT_ID);
        assertThat(osState(ours).getString("tenantId")).isEqualTo(TENANT_ID);
        assertThat(osState(theirs).getString("tenantId")).isEqualTo(OTHER_TENANT_ID);
    }

    // A report naming one update twice must not wedge the consumer on the unique key. Whether such a report is
    // applied with one row or dropped as a whole is not in the contract, so both pass.
    @Test
    void sameUpdateKeyTwiceInOneReport_neverTwoRows_reportNotRedelivered_nextReportApplied() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(WINDOWS_FIRST_REPORT);
        pending(report).add(pending(report).get(0).deepCopy());

        // execution
        publish(machineId, report.toString());
        awaitProcessed();
        List<Document> afterTheDuplicate = pendingRows(machineId);
        assertNothingLeftForRedelivery();
        publish(machineId, fixtureText(WINDOWS_TWO_PENDING));
        awaitProcessed();

        // verifications
        assertThat(afterTheDuplicate).hasSizeLessThanOrEqualTo(1);
        assertThat(pendingByKey(machineId)).containsOnlyKeys(KB5068861_KEY, DOTNET_KEY);
    }

    // ───────── design.md, storage ─────────

    @Test
    void featureCollections_haveTheirUniqueKeysAndTheHistoryReadIndex() {
        // setup
        publish(newMachine(), fixtureText(WINDOWS_FIRST_REPORT));
        awaitProcessed();

        // execution
        List<Document> stateIndexes = stateCollection().listIndexes().into(new ArrayList<>());
        List<Document> pendingIndexes = pendingCollection().listIndexes().into(new ArrayList<>());
        List<Document> historyIndexes = historyCollection().listIndexes().into(new ArrayList<>());

        // verifications
        assertThat(uniqueKeys(stateIndexes)).as("unique indexes of device_os_states")
                .contains("{\"tenantId\": 1, \"machineId\": 1}");
        assertThat(uniqueKeys(pendingIndexes)).as("unique indexes of device_os_updates")
                .contains("{\"tenantId\": 1, \"machineId\": 1, \"updateKey\": 1}");
        assertThat(uniqueKeys(historyIndexes)).as("unique indexes of device_os_update_history")
                .contains("{\"tenantId\": 1, \"machineId\": 1, \"entryKey\": 1}");
        assertThat(keys(historyIndexes)).as("indexes of device_os_update_history")
                .contains("{\"tenantId\": 1, \"machineId\": 1, \"installedAt\": -1, \"_id\": -1}");
    }

    // ───────── publishing and reading ─────────

    // the time NATS stored the report, at the millisecond MongoDB keeps
    private Instant publish(String machineId, String report) {
        return storedAt(store(machineId, report));
    }

    // the stream sequence JetStream stored the report under
    private long store(String machineId, String report) {
        byte[] payload = report.getBytes(StandardCharsets.UTF_8);
        try {
            lastStored = natsConnection.jetStream().publish("machine." + machineId + ".os-updates", payload).getSeqno();
            return lastStored;
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException("The report was not stored by JetStream", e);
        }
    }

    private Instant storedAt(long sequence) {
        try {
            return natsConnection.jetStreamManagement().getMessage(OS_UPDATES_STREAM, sequence)
                    .getTime().toInstant().truncatedTo(ChronoUnit.MILLIS);
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException("No report under sequence " + sequence, e);
        }
    }

    // A second consumer on the listener's own delivery subject hands the listener the stored report once more:
    // the same payload with the same time NATS stored it, which is what a redelivery carries.
    private void deliverAgain(String machineId, long sequence) {
        String redelivery = "redelivery-" + UUID.randomUUID();
        addConsumer(redeliveryConsumer(redelivery, machineId, sequence));
        try {
            await().atMost(FIRST_WAIT).pollInterval(Duration.ofMillis(25))
                    .until(() -> consumerInfo(redelivery).getAckFloor().getConsumerSequence() == 1);
        } finally {
            deleteConsumer(redelivery);
        }
    }

    private ConsumerConfiguration redeliveryConsumer(String name, String machineId, long sequence) {
        ConsumerConfiguration listener = consumerInfo(onlyConsumer()).getConsumerConfiguration();
        return ConsumerConfiguration.builder()
                .durable(name)
                .ackPolicy(AckPolicy.Explicit)
                .deliverPolicy(DeliverPolicy.ByStartSequence)
                .startSequence(sequence)
                .filterSubject("machine." + machineId + ".os-updates")
                .maxDeliver(1)
                .deliverSubject(listener.getDeliverSubject())
                .deliverGroup(listener.getDeliverGroup())
                .build();
    }

    // One consumer handles the stream in order and acknowledges a report once it is done with it, so when its
    // acknowledgements reach the report this test published last, every report published before is handled.
    // Where the report was written is not part of the wait: the assertions after it say that.
    private void awaitProcessed() {
        String consumer = onlyConsumer();
        Duration wait = nothingApplies ? SHORT_WAIT : FIRST_WAIT;
        try {
            await().atMost(wait).pollInterval(Duration.ofMillis(25))
                    .until(() -> consumerInfo(consumer).getAckFloor().getStreamSequence() >= lastStored);
        } catch (ConditionTimeoutException timeout) {
            nothingApplies = true;
            throw new AssertionError("The report under sequence " + lastStored + " of " + OS_UPDATES_STREAM
                    + " was not acknowledged within " + wait, timeout);
        }
    }

    // a report left unacknowledged comes back after ackWait, up to maxDeliver times
    private void assertNothingLeftForRedelivery() {
        String consumer = onlyConsumer();
        await().atMost(Duration.ofSeconds(3)).untilAsserted(() ->
                assertThat(consumerInfo(consumer).getNumAckPending())
                        .as("reports delivered and not acknowledged").isZero());
    }

    private String onlyConsumer() {
        List<String> consumers = consumerNames();
        assertThat(consumers).as("consumers of %s", OS_UPDATES_STREAM).hasSize(1);
        return consumers.getFirst();
    }

    private List<String> consumerNames() {
        try {
            return natsConnection.jetStreamManagement().getConsumerNames(OS_UPDATES_STREAM);
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException(e);
        }
    }

    private ConsumerInfo consumerInfo(String consumer) {
        try {
            return natsConnection.jetStreamManagement().getConsumerInfo(OS_UPDATES_STREAM, consumer);
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException(e);
        }
    }

    private void addConsumer(ConsumerConfiguration consumer) {
        try {
            natsConnection.jetStreamManagement().addOrUpdateConsumer(OS_UPDATES_STREAM, consumer);
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException(e);
        }
    }

    private void deleteConsumer(String consumer) {
        try {
            natsConnection.jetStreamManagement().deleteConsumer(OS_UPDATES_STREAM, consumer);
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException(e);
        }
    }

    private String newMachine() {
        String machineId = OWN_MACHINES + MACHINES.incrementAndGet();
        saveMachine(machineId, DeviceStatus.ONLINE, TENANT_ID);
        return machineId;
    }

    private void saveMachine(String machineId, DeviceStatus status, String tenantId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId(tenantId);
        machine.setStatus(status);
        machine.setHostname("host-" + machineId);
        mongoTemplate.save(machine);
    }

    private MongoCollection<Document> machines() {
        return mongoTemplate.getCollection("machines");
    }

    private MongoCollection<Document> stateCollection() {
        return mongoTemplate.getCollection("device_os_states");
    }

    private MongoCollection<Document> pendingCollection() {
        return mongoTemplate.getCollection("device_os_updates");
    }

    private MongoCollection<Document> historyCollection() {
        return mongoTemplate.getCollection("device_os_update_history");
    }

    private Document machine(String machineId) {
        return machines().find(Filters.eq("machineId", machineId)).first();
    }

    // the OS state of a device that reported: its one document of device_os_states
    private Document osState(String machineId) {
        List<Document> states = stateDocuments(machineId);
        assertThat(states).as("documents of device_os_states for machine %s", machineId).hasSize(1);
        return states.getFirst();
    }

    private List<Document> stateDocuments(String machineId) {
        return stateCollection().find(Filters.eq("machineId", machineId)).into(new ArrayList<>());
    }

    private List<Document> pendingRows(String machineId) {
        return pendingCollection().find(Filters.eq("machineId", machineId)).into(new ArrayList<>());
    }

    private List<Document> historyRows(String machineId) {
        return historyCollection().find(Filters.eq("machineId", machineId)).into(new ArrayList<>());
    }

    private Map<String, Document> pendingByKey(String machineId) {
        return pendingRows(machineId).stream().collect(Collectors.toMap(row -> row.getString("updateKey"), row -> row));
    }

    private Map<String, Document> historyByUpdateKey(String machineId) {
        return historyRows(machineId).stream().collect(Collectors.toMap(row -> row.getString("updateKey"), row -> row));
    }

    private static Instant instant(Document document, String field) {
        Date date = document.getDate(field);
        return date == null ? null : date.toInstant();
    }

    private static Long number(Document document, String field) {
        Number number = document.get(field, Number.class);
        return number == null ? null : number.longValue();
    }

    // a list that is absent, null or empty holds nothing
    private static List<String> strings(Document document, String field) {
        List<String> values = document.getList(field, String.class);
        return values == null ? List.of() : values;
    }

    // the stored categories of a pending row, each as (id, name); an absent or null list holds nothing
    private static List<Tuple> categories(Document row) {
        List<Document> stored = row.getList("categories", Document.class);
        return stored == null ? List.of() : stored.stream()
                .map(category -> Tuple.tuple(category.getString("id"), category.getString("name")))
                .toList();
    }

    private static List<String> keys(List<Document> indexes) {
        return indexes.stream().map(index -> index.get("key", Document.class).toJson()).toList();
    }

    private static List<String> uniqueKeys(List<Document> indexes) {
        return indexes.stream()
                .filter(index -> Boolean.TRUE.equals(index.getBoolean("unique")))
                .map(index -> index.get("key", Document.class).toJson())
                .toList();
    }

    // ───────── reports ─────────

    private static String fixtureText(String name) {
        String path = "/os-updates/" + name + ".json";
        try (InputStream in = MachineOsUpdatesIngestIT.class.getResourceAsStream(path)) {
            return new String(Objects.requireNonNull(in, "No fixture " + path).readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ObjectNode fixture(String name) {
        return (ObjectNode) JSON.readTree(fixtureText(name));
    }

    private static ObjectNode state(ObjectNode report) {
        return (ObjectNode) report.get("osState");
    }

    private static ArrayNode pending(ObjectNode report) {
        return (ArrayNode) report.get("pendingUpdates");
    }

    private static ObjectNode withSeverity(ObjectNode template, String updateKey, String msrcSeverity) {
        ObjectNode update = template.deepCopy();
        update.put("updateKey", updateKey).put("msrcSeverity", msrcSeverity);
        return update;
    }

    private static ObjectNode historyEntry(String updateKey, String title, String installedAt,
                                           String operation, String result) {
        ObjectNode entry = JSON.createObjectNode();
        entry.put("updateKey", updateKey);
        entry.put("title", title);
        entry.put("installedAt", installedAt);
        entry.put("operation", operation);
        entry.put("result", result);
        entry.put("hresult", "FAILED".equals(result) ? "0x80240022" : "0x00000000");
        return entry;
    }
}

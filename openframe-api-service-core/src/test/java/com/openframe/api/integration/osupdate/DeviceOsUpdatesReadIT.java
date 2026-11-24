package com.openframe.api.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.util.ClassUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.IntStream;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.tenant-isolation.enabled=true"
        })
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceOsUpdatesReadIT extends BaseMongoIntegrationTest {

    private static final String OTHER_TENANT_ID = "tenant-b";
    private static final String OWN_MACHINES = "os-read-";
    private static final String MACHINE_ID = OWN_MACHINES + "win-1";
    private static final String SECOND_MACHINE_ID = OWN_MACHINES + "win-2";
    private static final String MAC_MACHINE_ID = OWN_MACHINES + "mac-1";
    private static final String OTHER_TENANT_MACHINE_ID = OWN_MACHINES + "of-tenant-b";
    private static final String UNKNOWN_MACHINE_ID = OWN_MACHINES + "nobody";
    private static final String OWN_UPDATES = "os-read-update-";

    private static final String WINDOWS_PENDING = OWN_UPDATES + "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String WINDOWS_PENDING_NAME =
            "2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)";
    private static final String WINDOWS_INSTALLED = "ffeeddcc-1111-2222-3333-445566778899:198";
    private static final String WINDOWS_INSTALLED_TITLE =
            "2026-10 Cumulative Update for Windows 11 Version 24H2 (KB5049981)";
    private static final String MAC_SAFARI = OWN_UPDATES + "Safari-18.2";
    private static final String MAC_OS_UPDATE = OWN_UPDATES + "MSU_UPDATE_25C56_patch_26.2";

    private static final String RECEIVED = "2026-11-20T09:14:03.120Z";
    private static final String REPORTED = "2026-11-20T09:14:02.481Z";
    private static final String LAST_SCAN = "2026-11-20T08:44:00Z";
    // WARNING: history rows older than the retention are deleted by the TTL monitor where the collection has its
    // TTL index, so every install time of this class is counted from now
    private static final String EARLIER_INSTALL = stepsAgo(20);
    private static final String LATER_INSTALL = stepsAgo(3);
    private static final String EARLIEST_INSTALL = stepsAgo(25);
    private static final String EARLIER_REPORT = "2026-11-18T07:02:11Z";

    private static final String STATE = """
            query($machineId: String!) {
              deviceOsState(machineId: $machineId) {
                platform osVersion osBuild osProductName scanState lastScanAt pendingUpdatesConfidence patchState
                rebootPending rebootPendingSince manageability { state reasons } osUpdateAuthorization
                lastOsInstall { identifier displayName displayVersion installedAt } reportedAt receivedAt
              }
            }
            """;
    private static final String PENDING = """
            query($machineId: String!) {
              deviceOsPendingUpdates(machineId: $machineId) {
                identifier displayName displayVersion kbArticleIds severity categories categoryIds updateType
                classification cveIds publishedAt sizeBytes rebootBehavior browseOnly discoveredAt downloaded
                macosPresence
              }
            }
            """;
    private static final String HISTORY = """
            query($machineId: String!, $first: Int, $after: String) {
              deviceOsUpdateHistory(machineId: $machineId, first: $first, after: $after) {
                edges { cursor node { identifier title installedAt operation result errorCode } }
                pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
              }
            }
            """;

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ApplicationContext context;

    @BeforeEach
    void removeTheMachinesAndUpdatesOfThisClass() {
        Bson ownMachines = Filters.regex("machineId", "^" + OWN_MACHINES);
        machines().deleteMany(ownMachines);
        stateCollection().deleteMany(ownMachines);
        pendingCollection().deleteMany(ownMachines);
        historyCollection().deleteMany(ownMachines);
        osUpdateCollection().deleteMany(Filters.regex("identifier", "^" + OWN_UPDATES));
    }

    @Test
    void harness_deviceReadOfTheSameContext_answersTheStoredMachine() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID).append("osVersion", "Windows 10 Pro").append("osBuild", "19045.5011"));
        saveState(windowsState(MACHINE_ID));

        // execution
        ExecutionResult result = queryExecutor.execute(
                "query($machineId: String!) { device(machineId: $machineId) { machineId osVersion osBuild } }",
                Map.of("machineId", MACHINE_ID));

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("device",
                Map.of("machineId", MACHINE_ID, "osVersion", "Windows 10 Pro", "osBuild", "19045.5011"));
    }

    @Test
    void osUpdateFlagOn_dataFetcherQueryServiceAndMappersRun() {
        // setup

        // execution
        List<String> beans = Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType).filter(Objects::nonNull)
                .map(ClassUtils::getUserClass).map(Class::getSimpleName).toList();

        // verifications
        assertThat(beans).contains("DeviceOsDataFetcher", "DeviceOsQueryService", "DeviceOsResponseMapper",
                "DeviceOsGraphQLMapper");
    }

    @Test
    void windowsDeviceThatReported_stateReadReturnsEverythingTheOsTabShows() {
        // setup
        Map<String, Object> expected = new HashMap<>();
        expected.put("platform", "WINDOWS");
        expected.put("osVersion", "11 24H2");
        expected.put("osBuild", "26100.4061");
        expected.put("osProductName", "Windows 11 Pro");
        expected.put("scanState", "FRESH");
        expected.put("lastScanAt", LAST_SCAN);
        expected.put("pendingUpdatesConfidence", "CONFIRMED");
        expected.put("patchState", "UPDATES_AVAILABLE");
        expected.put("rebootPending", "YES");
        expected.put("rebootPendingSince", EARLIER_REPORT);
        expected.put("manageability", Map.of("state", "NOT_MANAGEABLE",
                "reasons", List.of("WSUS", "GROUP_POLICY", "REASON_OF_A_NEWER_AGENT")));
        expected.put("osUpdateAuthorization", "NOT_REQUIRED");
        expected.put("lastOsInstall", lastOsInstall(WINDOWS_INSTALLED, WINDOWS_INSTALLED_TITLE, null, EARLIER_INSTALL));
        expected.put("reportedAt", REPORTED);
        expected.put("receivedAt", RECEIVED);
        saveReportedDevice(windowsState(MACHINE_ID).append("manageability", notManageable()));

        // execution
        Map<String, Object> state = state(MACHINE_ID);

        // verifications
        assertThat(state).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void macThatCouldNotReadItsUpdates_stateSaysSoAndThePendingUpdatesOfTheEarlierReportAreStillReturned() {
        // setup
        Document state = new Document("tenantId", TENANT_ID)
                .append("machineId", MAC_MACHINE_ID)
                .append("platform", "MACOS")
                .append("osVersion", "13.7.8")
                .append("osBuild", "22H730")
                .append("osProductName", "macOS")
                .append("scanState", "STALE")
                .append("lastScanAt", date("2026-11-06T04:11:00Z"))
                .append("pendingUpdatesConfidence", "UNREADABLE")
                .append("patchState", "UNKNOWN")
                .append("rebootPending", "UNKNOWN")
                .append("manageability", new Document("state", "MANAGEABLE").append("reasons", List.of()))
                .append("osUpdateAuthorization", "NOT_REQUIRED")
                .append("receivedAt", date(RECEIVED));
        saveReportedDevice(state);
        savePending(pendingUpdate(MAC_MACHINE_ID, TENANT_ID, "MACOS", MAC_SAFARI, EARLIER_REPORT)
                .append("macosPresence", "HELD_OVER"));
        saveOsUpdate(osUpdate(TENANT_ID, "MACOS", MAC_SAFARI, "Safari").append("displayVersion", "18.2"));

        // execution
        Map<String, Object> read = state(MAC_MACHINE_ID);
        List<Map<String, Object>> pending = pending(MAC_MACHINE_ID);

        // verifications
        assertThat(read)
                .containsEntry("platform", "MACOS")
                .containsEntry("pendingUpdatesConfidence", "UNREADABLE")
                .containsEntry("patchState", "UNKNOWN")
                .containsEntry("scanState", "STALE")
                .containsEntry("rebootPending", "UNKNOWN")
                .containsEntry("rebootPendingSince", null)
                .containsEntry("lastOsInstall", null)
                .containsEntry("reportedAt", null)
                .containsEntry("manageability", Map.of("state", "MANAGEABLE", "reasons", List.of()));
        assertThat(pending).extracting(update -> update.get("identifier"), update -> update.get("macosPresence"))
                .containsExactly(tuple(MAC_SAFARI, "HELD_OVER"));
    }

    @Test
    void stateWithNothingButItsReceiveTime_everyOtherValueNull() {
        // setup
        Map<String, Object> expected = new HashMap<>();
        List.of("platform", "osVersion", "osBuild", "osProductName", "scanState", "lastScanAt",
                        "pendingUpdatesConfidence", "patchState", "rebootPending", "rebootPendingSince",
                        "manageability", "osUpdateAuthorization", "lastOsInstall", "reportedAt")
                .forEach(field -> expected.put(field, null));
        expected.put("receivedAt", RECEIVED);
        saveReportedDevice(new Document("tenantId", TENANT_ID).append("machineId", MACHINE_ID)
                .append("receivedAt", date(RECEIVED)));

        // execution
        Map<String, Object> state = state(MACHINE_ID);

        // verifications
        assertThat(state).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void deviceThatNeverReported_deviceOsStateNullAndBothListsEmpty() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID));

        // execution
        Map<String, Object> state = state(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(state).isNull();
        assertThat(pending).isEmpty();
        assertThat(history.nodes()).isEmpty();
        assertThat(history.hasNextPage()).isFalse();
        assertThat(history.endCursor()).isNull();
    }

    @Test
    void windowsPendingUpdate_joinedWithItsOsUpdate_everyFieldReturned() {
        // setup
        Map<String, Object> expected = new HashMap<>();
        expected.put("identifier", WINDOWS_PENDING);
        expected.put("displayName", WINDOWS_PENDING_NAME);
        expected.put("displayVersion", null);
        expected.put("kbArticleIds", List.of("5051987"));
        expected.put("severity", "CRITICAL");
        expected.put("categories", List.of("Security Updates"));
        expected.put("categoryIds", List.of("0fa1201d-4330-4fa8-8ae9-b877473b6441"));
        expected.put("updateType", "SOFTWARE");
        expected.put("classification", "SECURITY");
        expected.put("cveIds", List.of("CVE-2026-21309", "CVE-2026-21311"));
        expected.put("publishedAt", "2026-11-11T18:00:00Z");
        expected.put("sizeBytes", 764317696L);
        expected.put("rebootBehavior", "ALWAYS");
        expected.put("browseOnly", false);
        expected.put("discoveredAt", RECEIVED);
        expected.put("downloaded", true);
        expected.put("macosPresence", null);
        saveReportedDevice(windowsState(MACHINE_ID));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", WINDOWS_PENDING, RECEIVED)
                .append("downloaded", true));
        saveOsUpdate(windowsOsUpdate(TENANT_ID));

        // execution
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(pending).singleElement()
                .satisfies(update -> assertThat(update).containsExactlyInAnyOrderEntriesOf(expected));
    }

    @Test
    void deviceThatIsNotManageable_pendingUpdatesReadEmpty_storedRowsStayAndAreReturnedOnceItIsManageable() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID).append("manageability", notManageable()));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", WINDOWS_PENDING, RECEIVED));
        saveOsUpdate(windowsOsUpdate(TENANT_ID));

        // execution
        List<Map<String, Object>> pendingWhileNotManageable = pending(MACHINE_ID);
        long storedWhileNotManageable = pendingCollection().countDocuments(Filters.eq("machineId", MACHINE_ID));
        stateCollection().updateOne(Filters.eq("machineId", MACHINE_ID),
                new Document("$set", new Document("manageability.state", "MANAGEABLE")));
        List<Map<String, Object>> pendingOnceManageable = pending(MACHINE_ID);

        // verifications
        assertThat(pendingWhileNotManageable).isEmpty();
        assertThat(storedWhileNotManageable).isEqualTo(1);
        assertThat(pendingOnceManageable).extracting(update -> update.get("identifier"))
                .containsExactly(WINDOWS_PENDING);
    }

    @Test
    void macPendingUpdate_nameAndVersionReturned_listsEmptyAndTheWindowsFieldsNull() {
        // setup
        Map<String, Object> expected = new HashMap<>();
        expected.put("identifier", MAC_OS_UPDATE);
        expected.put("displayName", "macOS Sequoia 26.2");
        expected.put("displayVersion", "26.2");
        expected.put("kbArticleIds", List.of());
        expected.put("severity", null);
        expected.put("categories", List.of());
        expected.put("categoryIds", List.of());
        expected.put("updateType", null);
        expected.put("classification", null);
        expected.put("cveIds", List.of());
        expected.put("publishedAt", null);
        expected.put("sizeBytes", null);
        expected.put("rebootBehavior", null);
        expected.put("browseOnly", null);
        expected.put("discoveredAt", RECEIVED);
        expected.put("downloaded", null);
        expected.put("macosPresence", "FRESH");
        saveMachine(machine(MAC_MACHINE_ID, TENANT_ID));
        savePending(pendingUpdate(MAC_MACHINE_ID, TENANT_ID, "MACOS", MAC_OS_UPDATE, RECEIVED)
                .append("macosPresence", "FRESH"));
        saveOsUpdate(osUpdate(TENANT_ID, "MACOS", MAC_OS_UPDATE, "macOS Sequoia 26.2").append("displayVersion", "26.2"));

        // execution
        List<Map<String, Object>> pending = pending(MAC_MACHINE_ID);

        // verifications
        assertThat(pending).singleElement()
                .satisfies(update -> assertThat(update).containsExactlyInAnyOrderEntriesOf(expected));
    }

    @Test
    void pendingUpdates_newestDiscoveredFirst_thenByIdentifier() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", OWN_UPDATES + "b", RECEIVED));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", OWN_UPDATES + "older", EARLIER_REPORT));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", OWN_UPDATES + "a", RECEIVED));
        saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", OWN_UPDATES + "a", "Update a"));
        saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", OWN_UPDATES + "b", "Update b"));
        saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", OWN_UPDATES + "older", "Older update"));

        // execution
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(pending).extracting(update -> update.get("identifier"), update -> update.get("displayName"))
                .containsExactly(
                        tuple(OWN_UPDATES + "a", "Update a"),
                        tuple(OWN_UPDATES + "b", "Update b"),
                        tuple(OWN_UPDATES + "older", "Older update"));
    }

    @Test
    void pendingUpdate_joinedOnlyWithTheOsUpdateOfItsOwnTenantAndPlatform() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", OWN_UPDATES + "shared", RECEIVED));
        saveOsUpdate(osUpdate(TENANT_ID, "MACOS", OWN_UPDATES + "shared", "Mac update of this tenant"));
        saveOsUpdate(osUpdate(OTHER_TENANT_ID, "WINDOWS", OWN_UPDATES + "shared", "Windows update of another tenant"));
        saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", OWN_UPDATES + "shared", "Windows update of this tenant"));

        // execution
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(pending).extracting(update -> update.get("identifier"), update -> update.get("displayName"))
                .containsExactly(tuple(OWN_UPDATES + "shared", "Windows update of this tenant"));
    }

    @Test
    void pendingUpdatesOfTwoDevices_eachReturnsItsOwnWithItsOwnDiscoveredAt() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID));
        saveMachine(machine(SECOND_MACHINE_ID, TENANT_ID));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", WINDOWS_PENDING, RECEIVED));
        savePending(pendingUpdate(SECOND_MACHINE_ID, TENANT_ID, "WINDOWS", WINDOWS_PENDING, EARLIER_REPORT));
        saveOsUpdate(windowsOsUpdate(TENANT_ID));

        // execution
        List<Map<String, Object>> first = pending(MACHINE_ID);
        List<Map<String, Object>> second = pending(SECOND_MACHINE_ID);

        // verifications
        assertThat(first).extracting(update -> update.get("identifier"), update -> update.get("discoveredAt"))
                .containsExactly(tuple(WINDOWS_PENDING, RECEIVED));
        assertThat(second).extracting(update -> update.get("identifier"), update -> update.get("discoveredAt"))
                .containsExactly(tuple(WINDOWS_PENDING, EARLIER_REPORT));
    }

    @Test
    void history_newestFirst_withTheErrorCodeOfAFailedInstall() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveHistory(historyEntry(MACHINE_ID, TENANT_ID, WINDOWS_INSTALLED, EARLIER_INSTALL, "INSTALL", "SUCCEEDED")
                .append("title", WINDOWS_INSTALLED_TITLE));
        saveHistory(historyEntry(MACHINE_ID, TENANT_ID, "11112222-3333-4444-5555-666677778888:200", LATER_INSTALL,
                "INSTALL", "FAILED").append("errorCode", "0x80240017"));
        saveHistory(new Document("tenantId", TENANT_ID).append("machineId", MACHINE_ID)
                .append("entryKey", "unknown-values").append("identifier", "aaaa0000-0000-0000-0000-000000000003")
                .append("installedAt", date(EARLIEST_INSTALL)));

        // execution
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(history.nodes())
                .extracting(node -> node.get("identifier"), node -> node.get("title"), node -> node.get("installedAt"),
                        node -> node.get("operation"), node -> node.get("result"), node -> node.get("errorCode"))
                .containsExactly(
                        tuple("11112222-3333-4444-5555-666677778888:200", null, LATER_INSTALL,
                                "INSTALL", "FAILED", "0x80240017"),
                        tuple(WINDOWS_INSTALLED, WINDOWS_INSTALLED_TITLE, EARLIER_INSTALL,
                                "INSTALL", "SUCCEEDED", null),
                        tuple("aaaa0000-0000-0000-0000-000000000003", null, EARLIEST_INSTALL,
                                null, null, null));
        assertThat(history.hasNextPage()).isFalse();
    }

    @Test
    void history_fortyFiveEntriesInPagesOfTwenty_newestFirst_everyEntryOnce() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, 45);

        // execution
        HistoryPage first = history(MACHINE_ID, 20, null);
        HistoryPage second = history(MACHINE_ID, 20, first.endCursor());
        HistoryPage third = history(MACHINE_ID, 20, second.endCursor());

        // verifications
        assertThat(first.nodes()).hasSize(20);
        assertThat(first.hasNextPage()).isTrue();
        assertThat(first.cursors()).doesNotContainNull().doesNotHaveDuplicates();
        assertThat(first.endCursor()).isEqualTo(first.cursors().getLast());
        assertThat(second.nodes()).hasSize(20);
        assertThat(second.hasNextPage()).isTrue();
        assertThat(third.nodes()).hasSize(5);
        assertThat(third.hasNextPage()).isFalse();
        assertThat(identifiers(first, second, third)).isEqualTo(identifiersNewestFirst(45));
    }

    @Test
    void history_cursorOfAnEntryInTheMiddleOfAPage_continuesRightAfterThatEntry() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, 12);

        // execution
        HistoryPage first = history(MACHINE_ID, 10, null);
        HistoryPage afterTheFourth = history(MACHINE_ID, 3, first.cursors().get(3));

        // verifications
        assertThat(identifiers(afterTheFourth)).isEqualTo(identifiersNewestFirst(12).subList(4, 7));
        assertThat(afterTheFourth.hasNextPage()).isTrue();
    }

    @Test
    void history_entriesInstalledAtTheSameInstant_splitOverPagesWithoutLossOrRepeat() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        String sameInstant = stepsAgo(8);
        IntStream.range(0, 9).forEach(number -> saveHistory(historyEntry(
                MACHINE_ID, TENANT_ID, "same-" + number, sameInstant, "INSTALL", "SUCCEEDED")));
        saveHistory(historyEntry(MACHINE_ID, TENANT_ID, "newer", stepsAgo(7), "INSTALL", "SUCCEEDED"));
        saveHistory(historyEntry(MACHINE_ID, TENANT_ID, "older", stepsAgo(9), "INSTALL", "SUCCEEDED"));

        // execution
        List<HistoryPage> pages = historyPages(MACHINE_ID, 4);

        // verifications
        List<String> walked = identifiers(pages.toArray(HistoryPage[]::new));
        assertThat(pages).hasSize(3);
        assertThat(walked).doesNotHaveDuplicates().hasSize(11).startsWith("newer").endsWith("older");
    }

    @Test
    void history_withoutFirst_twentyEntries_andNeverMoreThanAHundredNorFewerThanOne() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, 120);

        // execution
        HistoryPage byDefault = history(MACHINE_ID, null, null);
        HistoryPage one = history(MACHINE_ID, 1, null);
        HistoryPage zero = history(MACHINE_ID, 0, null);
        HistoryPage aHundred = history(MACHINE_ID, 100, null);
        HistoryPage fiveHundred = history(MACHINE_ID, 500, null);
        HistoryPage rest = history(MACHINE_ID, 100, aHundred.endCursor());

        // verifications
        assertThat(byDefault.nodes()).hasSize(20);
        assertThat(byDefault.hasNextPage()).isTrue();
        assertThat(one.nodes()).hasSize(1);
        assertThat(zero.nodes()).hasSize(1);
        assertThat(aHundred.nodes()).hasSize(100);
        assertThat(aHundred.hasNextPage()).isTrue();
        assertThat(fiveHundred.nodes()).hasSize(100);
        assertThat(fiveHundred.hasNextPage()).isTrue();
        assertThat(rest.nodes()).hasSize(20);
        assertThat(rest.hasNextPage()).isFalse();
        assertThat(identifiers(aHundred, rest)).isEqualTo(identifiersNewestFirst(120));
    }

    @ParameterizedTest
    @CsvSource({
            "19, 19, false",
            "20, 20, false",
            "21, 20, true"
    })
    void history_aroundThePageEdge_hasNextPageOnlyWhenAnEntryIsLeft(int stored, int expectedOnThePage,
                                                                     boolean expectedNextPage) {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, stored);

        // execution
        HistoryPage first = history(MACHINE_ID, 20, null);
        HistoryPage second = history(MACHINE_ID, 20, first.endCursor());

        // verifications
        assertThat(first.nodes()).hasSize(expectedOnThePage);
        assertThat(first.hasNextPage()).isEqualTo(expectedNextPage);
        assertThat(second.nodes()).hasSize(stored - expectedOnThePage);
        assertThat(second.hasNextPage()).isFalse();
    }

    @Test
    void history_ofTwoDevices_eachReturnsItsOwn() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveReportedDevice(windowsState(SECOND_MACHINE_ID));
        saveHistory(historyEntry(MACHINE_ID, TENANT_ID, "of-the-first", EARLIER_INSTALL, "INSTALL", "SUCCEEDED"));
        saveHistory(historyEntry(SECOND_MACHINE_ID, TENANT_ID, "of-the-second", LATER_INSTALL, "INSTALL", "SUCCEEDED"));

        // execution
        HistoryPage first = history(MACHINE_ID, null, null);
        HistoryPage second = history(SECOND_MACHINE_ID, null, null);

        // verifications
        assertThat(identifiers(first)).containsExactly("of-the-first");
        assertThat(identifiers(second)).containsExactly("of-the-second");
    }

    @ParameterizedTest
    @ValueSource(strings = {"no-separator", "yesterday|6aff19c07ce86a3f0386ff82", "1795142470000|not-an-object-id"})
    void history_afterThatIsNotACursorOfTheHistory_answersWithAnErrorAndNoPage(String rawCursor) {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, 3);
        String after = Base64.getEncoder().encodeToString(rawCursor.getBytes(StandardCharsets.UTF_8));
        Map<String, Object> variables = Map.of("machineId", MACHINE_ID, "after", after);

        // execution
        ExecutionResult result = queryExecutor.execute(HISTORY, variables);

        // verifications
        assertThat(result.getErrors()).hasSize(1);
        assertThat(result.<Object>getData()).isNull();
    }

    @Test
    void unknownMachineId_allThreeReadsAnswerDeviceNotFound() {
        // setup
        saveReportedDevice(windowsState(MACHINE_ID));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", WINDOWS_PENDING, RECEIVED));
        saveOsUpdate(windowsOsUpdate(TENANT_ID));

        // execution
        ExecutionResult state = queryExecutor.execute(STATE, Map.of("machineId", UNKNOWN_MACHINE_ID));
        ExecutionResult pending = queryExecutor.execute(PENDING, Map.of("machineId", UNKNOWN_MACHINE_ID));
        ExecutionResult history = queryExecutor.execute(HISTORY, Map.of("machineId", UNKNOWN_MACHINE_ID));

        // verifications
        assertStateDeviceNotFound(state);
        assertDeviceNotFound(pending);
        assertDeviceNotFound(history);
    }

    @Test
    void deviceOfAnotherTenant_readAnswersAsForAnUnknownDevice() {
        // setup
        saveReportedDevice(windowsState(OTHER_TENANT_MACHINE_ID).append("tenantId", OTHER_TENANT_ID));
        savePending(pendingUpdate(OTHER_TENANT_MACHINE_ID, OTHER_TENANT_ID, "WINDOWS", WINDOWS_PENDING, RECEIVED));
        saveOsUpdate(windowsOsUpdate(OTHER_TENANT_ID));
        saveHistory(historyEntry(OTHER_TENANT_MACHINE_ID, OTHER_TENANT_ID, WINDOWS_INSTALLED, EARLIER_INSTALL,
                "INSTALL", "SUCCEEDED"));

        // execution
        ExecutionResult state = queryExecutor.execute(STATE, Map.of("machineId", OTHER_TENANT_MACHINE_ID));
        ExecutionResult pending = queryExecutor.execute(PENDING, Map.of("machineId", OTHER_TENANT_MACHINE_ID));
        ExecutionResult history = queryExecutor.execute(HISTORY, Map.of("machineId", OTHER_TENANT_MACHINE_ID));

        // verifications
        assertStateDeviceNotFound(state);
        assertDeviceNotFound(pending);
        assertDeviceNotFound(history);
    }

    @Test
    void stateAndRowsOfAnotherTenantUnderTheSameMachineId_neverReturned() {
        // setup
        saveState(windowsState(MACHINE_ID).append("tenantId", OTHER_TENANT_ID).append("osVersion", "Of another tenant"));
        saveReportedDevice(windowsState(MACHINE_ID));
        savePending(pendingUpdate(MACHINE_ID, TENANT_ID, "WINDOWS", WINDOWS_PENDING, RECEIVED));
        savePending(pendingUpdate(MACHINE_ID, OTHER_TENANT_ID, "WINDOWS", OWN_UPDATES + "foreign", RECEIVED));
        saveOsUpdate(windowsOsUpdate(TENANT_ID));
        saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", OWN_UPDATES + "foreign", "Pending in another tenant only"));
        saveHistory(historyEntry(MACHINE_ID, TENANT_ID, WINDOWS_INSTALLED, EARLIER_INSTALL, "INSTALL", "SUCCEEDED"));
        saveHistory(historyEntry(MACHINE_ID, OTHER_TENANT_ID, "foreign", LATER_INSTALL, "INSTALL", "SUCCEEDED"));

        // execution
        Map<String, Object> state = state(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(state).containsEntry("osVersion", "11 24H2");
        assertThat(pending).extracting(update -> update.get("identifier")).containsExactly(WINDOWS_PENDING);
        assertThat(identifiers(history)).containsExactly(WINDOWS_INSTALLED);
    }

    // null = the read answered deviceOsState: null
    private Map<String, Object> state(String machineId) {
        Map<String, Object> data = data(STATE, Map.of("machineId", machineId));
        assertThat(data).as("data of the deviceOsState read").containsKey("deviceOsState");
        return map(data.get("deviceOsState"));
    }

    private List<Map<String, Object>> pending(String machineId) {
        Map<String, Object> data = data(PENDING, Map.of("machineId", machineId));
        return list(data.get("deviceOsPendingUpdates"));
    }

    private HistoryPage history(String machineId, Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("machineId", machineId);
        variables.put("first", first);
        variables.put("after", after);
        Map<String, Object> connection = map(data(HISTORY, variables).get("deviceOsUpdateHistory"));
        Map<String, Object> pageInfo = map(connection.get("pageInfo"));
        List<Map<String, Object>> edges = list(connection.get("edges"));
        List<Map<String, Object>> nodes = edges.stream().map(edge -> map(edge.get("node"))).toList();
        List<String> cursors = edges.stream().map(edge -> (String) edge.get("cursor")).toList();
        return new HistoryPage(nodes, cursors, (Boolean) pageInfo.get("hasNextPage"), (String) pageInfo.get("endCursor"));
    }

    // every page from the first one on, each asked with the end cursor of the one before; ten pages at most
    private List<HistoryPage> historyPages(String machineId, int first) {
        List<HistoryPage> pages = new ArrayList<>(List.of(history(machineId, first, null)));
        while (pages.getLast().hasNextPage() && pages.size() < 10) {
            pages.add(history(machineId, first, pages.getLast().endCursor()));
        }
        return pages;
    }

    private Map<String, Object> data(String query, Map<String, Object> variables) {
        ExecutionResult result = queryExecutor.execute(query, variables);
        assertThat(result.getErrors()).as("GraphQL errors").isEmpty();
        return result.getData();
    }

    // a list read is non-null: its error leaves no data at all
    private static void assertDeviceNotFound(ExecutionResult result) {
        assertDeviceNotFoundError(result);
        assertThat(result.<Object>getData()).isNull();
    }

    // deviceOsState is nullable: beside the error the field itself is null
    private static void assertStateDeviceNotFound(ExecutionResult result) {
        assertDeviceNotFoundError(result);
        assertThat(result.<Map<String, Object>>getData()).as("data beside the DEVICE_NOT_FOUND error")
                .containsOnlyKeys("deviceOsState").containsEntry("deviceOsState", null);
    }

    private static void assertDeviceNotFoundError(ExecutionResult result) {
        assertThat(result.getErrors()).singleElement().extracting(GraphQLError::getExtensions)
                .satisfies(extensions -> assertThat(extensions).containsEntry("code", "DEVICE_NOT_FOUND"));
    }

    private static List<String> identifiers(HistoryPage... pages) {
        return Arrays.stream(pages)
                .flatMap(page -> page.nodes().stream())
                .map(node -> (String) node.get("identifier"))
                .toList();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return (List<Map<String, Object>>) value;
    }

    private record HistoryPage(List<Map<String, Object>> nodes, List<String> cursors, boolean hasNextPage,
                               String endCursor) {
    }

    private static Document machine(String machineId, String tenantId) {
        return new Document("machineId", machineId)
                .append("tenantId", tenantId)
                .append("status", "ONLINE")
                .append("hostname", "host-" + machineId)
                .append("osType", "WINDOWS");
    }

    // the document of device_os_states the ingest leaves after the Windows report of the agent team's example
    private static Document windowsState(String machineId) {
        return new Document("tenantId", TENANT_ID)
                .append("machineId", machineId)
                .append("platform", "WINDOWS")
                .append("osVersion", "11 24H2")
                .append("osBuild", "26100.4061")
                .append("osProductName", "Windows 11 Pro")
                .append("scanState", "FRESH")
                .append("lastScanAt", date(LAST_SCAN))
                .append("pendingUpdatesConfidence", "CONFIRMED")
                .append("patchState", "UPDATES_AVAILABLE")
                .append("rebootPending", "YES")
                .append("rebootPendingSince", date(EARLIER_REPORT))
                .append("manageability", new Document("state", "MANAGEABLE").append("reasons", List.of()))
                .append("osUpdateAuthorization", "NOT_REQUIRED")
                .append("lastOsInstall", new Document("identifier", WINDOWS_INSTALLED)
                        .append("displayName", WINDOWS_INSTALLED_TITLE)
                        .append("installedAt", date(EARLIER_INSTALL)))
                .append("version", 3L)
                .append("reportedAt", date(REPORTED))
                .append("receivedAt", date(RECEIVED));
    }

    private static Document notManageable() {
        return new Document("state", "NOT_MANAGEABLE")
                .append("reasons", List.of("WSUS", "GROUP_POLICY", "REASON_OF_A_NEWER_AGENT"));
    }

    private static Map<String, Object> lastOsInstall(String identifier, String displayName, String displayVersion,
                                                     String installedAt) {
        Map<String, Object> lastOsInstall = new HashMap<>();
        lastOsInstall.put("identifier", identifier);
        lastOsInstall.put("displayName", displayName);
        lastOsInstall.put("displayVersion", displayVersion);
        lastOsInstall.put("installedAt", installedAt);
        return lastOsInstall;
    }

    private static Document pendingUpdate(String machineId, String tenantId, String platform, String identifier,
                                          String discoveredAt) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("platform", platform)
                .append("identifier", identifier)
                .append("discoveredAt", date(discoveredAt));
    }

    private static Document osUpdate(String tenantId, String platform, String identifier, String displayName) {
        return new Document("tenantId", tenantId)
                .append("platform", platform)
                .append("identifier", identifier)
                .append("displayName", displayName)
                .append("firstSeenAt", date(EARLIER_REPORT));
    }

    private static Document windowsOsUpdate(String tenantId) {
        return osUpdate(tenantId, "WINDOWS", WINDOWS_PENDING, WINDOWS_PENDING_NAME)
                .append("kbArticleIds", List.of("5051987"))
                .append("severity", "CRITICAL")
                .append("categories", List.of("Security Updates"))
                .append("categoryIds", List.of("0fa1201d-4330-4fa8-8ae9-b877473b6441"))
                .append("updateType", "SOFTWARE")
                .append("classification", "SECURITY")
                .append("cveIds", List.of("CVE-2026-21309", "CVE-2026-21311"))
                .append("publishedAt", date("2026-11-11T18:00:00Z"))
                .append("sizeBytes", 764317696L)
                .append("rebootBehavior", "ALWAYS")
                .append("browseOnly", false);
    }

    private static Document historyEntry(String machineId, String tenantId, String identifier, String installedAt,
                                         String operation, String result) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("entryKey", identifier + "|" + Instant.parse(installedAt).toEpochMilli() + "|" + operation)
                .append("identifier", identifier)
                .append("installedAt", date(installedAt))
                .append("operation", operation)
                .append("result", result);
    }

    // entry i was installed i minutes after the oldest: k-0 is the oldest
    private void saveHistoryEntries(String machineId, int count) {
        Instant oldest = Instant.parse(stepsAgo(10));
        List<Document> entries = new ArrayList<>(IntStream.range(0, count)
                .mapToObj(number -> historyEntry(machineId, TENANT_ID, "k-" + number,
                        oldest.plus(number, ChronoUnit.MINUTES).toString(), "INSTALL", "SUCCEEDED"))
                .toList());
        // stored out of order: the answer is ordered by the read, not by insertion
        entries.sort(Comparator.comparing(entry -> entry.getString("entryKey")));
        historyCollection().insertMany(entries);
    }

    private static List<String> identifiersNewestFirst(int count) {
        return IntStream.range(0, count).mapToObj(number -> "k-" + (count - 1 - number)).toList();
    }

    // forty steps make the retention of the history: any step count below forty is inside it
    private static String stepsAgo(int steps) {
        Duration step = DeviceOsUpdateHistoryEntry.RETENTION.dividedBy(40);
        return Instant.now().truncatedTo(ChronoUnit.SECONDS).minus(step.multipliedBy(steps)).toString();
    }

    private static Date date(String instant) {
        return Date.from(Instant.parse(instant));
    }

    private void saveMachine(Document machine) {
        machines().insertOne(machine);
    }

    private void saveState(Document state) {
        stateCollection().insertOne(state);
    }

    private void saveReportedDevice(Document state) {
        saveMachine(machine(state.getString("machineId"), state.getString("tenantId")));
        saveState(state);
    }

    private void savePending(Document pendingUpdate) {
        pendingCollection().insertOne(pendingUpdate);
    }

    private void saveOsUpdate(Document osUpdate) {
        osUpdateCollection().insertOne(osUpdate);
    }

    private void saveHistory(Document historyEntry) {
        historyCollection().insertOne(historyEntry);
    }

    private MongoCollection<Document> machines() {
        return mongoTemplate.getCollection("machines");
    }

    private MongoCollection<Document> stateCollection() {
        return mongoTemplate.getCollection("device_os_states");
    }

    private MongoCollection<Document> pendingCollection() {
        return mongoTemplate.getCollection("device_os_pending_updates");
    }

    private MongoCollection<Document> osUpdateCollection() {
        return mongoTemplate.getCollection("os_updates");
    }

    private MongoCollection<Document> historyCollection() {
        return mongoTemplate.getCollection("device_os_update_history");
    }
}

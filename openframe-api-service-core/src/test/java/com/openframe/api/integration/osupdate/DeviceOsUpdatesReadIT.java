package com.openframe.api.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.assertj.core.groups.Tuple;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Acceptance of the read half of CU-17tkuw67mjf, pass 1: what MongoDB holds after the agent's OS report is what
 * {@code device(machineId) { osVersion osBuild osState }}, {@code deviceOsUpdates} and {@code deviceOsUpdateHistory}
 * answer.
 *
 * <p>In: the raw documents of {@code machines}, {@code device_os_updates} and {@code device_os_update_history}, in
 * the shapes the ingest half (MachineOsUpdatesIngestIT in openframe-client-core) asserts for the fixtures of the
 * contract. Out: the GraphQL answer of the module's whole schema, in the SDL of design.md.
 */
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
    // every machine id of this class starts with it: setup and cleanup leave the rest of the shared database alone
    private static final String OWN_MACHINES = "os-read-";
    private static final String MACHINE_ID = OWN_MACHINES + "win-1";
    private static final String SECOND_MACHINE_ID = OWN_MACHINES + "win-2";
    private static final String MAC_MACHINE_ID = OWN_MACHINES + "mac-1";
    private static final String OTHER_TENANT_MACHINE_ID = OWN_MACHINES + "of-tenant-b";
    private static final String UNKNOWN_MACHINE_ID = OWN_MACHINES + "nobody";

    private static final String KB5068861_KEY = "7d2f1c0e-3b0a-4c59-9d53-0c8f4d1f6a21:201";
    private static final String KB5068861_TITLE =
            "2026-11 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems (KB5068861)";
    private static final String DOTNET_KEY = "c4e5a6b7-0d1e-4f2a-9b3c-5d6e7f8091a2:102";
    private static final String DOTNET_TITLE =
            "2026-11 Cumulative Update for .NET Framework 3.5 and 4.8.1 for Windows 11, version 24H2 for x64 (KB5066128)";
    private static final String DEFENDER_KEY = "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b:200";
    private static final String DEFENDER_TITLE =
            "Security Intelligence Update for Microsoft Defender Antivirus - KB2267602 (Version 1.421.112.0)";
    private static final String OCTOBER_KEY = "b0a7e1d4-52c3-4f0e-8a6d-91f3c2e4d7aa:200";
    private static final String OCTOBER_TITLE =
            "2026-10 Cumulative Update for Windows 11 Version 24H2 for x64-based Systems (KB5066835)";
    private static final String MAC_KEY = "MSU_UPDATE_25G342_patch_26.7.3_minor";
    private static final String SECURITY_UPDATES_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final String DEFINITION_UPDATES_ID = "e0789628-ce08-4437-be74-2495b842f43b";

    private static final String FIRST_SCAN = "2026-11-19T10:14:51Z";
    private static final String RECEIVED = "2026-11-19T10:15:02.417Z";
    private static final String OCTOBER_INSTALL = "2026-10-16T02:41:10Z";
    private static final String NOVEMBER_INSTALL = "2026-11-20T02:41:10Z";

    private static final String DEVICE = """
            query($machineId: String!) {
              device(machineId: $machineId) {
                machineId osVersion osBuild
                osState {
                  restartPending restartPendingSince lastScanAt lastScanError lastInstalledAt
                  managementState managedElsewhereReason observedReason authorization receivedAt
                }
              }
            }
            """;
    private static final String PENDING = """
            query($machineId: String!) {
              deviceOsUpdates(machineId: $machineId) {
                updateKey title version kbArticleIds severity categories browseOnly publishedAt sizeBytes
                restartBehaviour discoveredAt
              }
            }
            """;
    private static final String HISTORY = """
            query($machineId: String!, $first: Int, $after: String) {
              deviceOsUpdateHistory(machineId: $machineId, first: $first, after: $after) {
                edges { cursor node { updateKey title version installedAt operation result errorCode } }
                pageInfo { hasNextPage endCursor }
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
    void removeTheMachinesOfThisClass() {
        Bson ownMachines = Filters.regex("machineId", "^" + OWN_MACHINES);
        machines().deleteMany(ownMachines);
        pendingCollection().deleteMany(ownMachines);
        historyCollection().deleteMany(ownMachines);
    }

    // ───────── harness ─────────

    @Test
    void harness_deviceReadOfTheSameContext_answersTheStoredMachine() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID).append("osVersion", "Windows 10 Pro").append("osBuild", "19045.5011"));

        // execution
        ExecutionResult result = queryExecutor.execute(
                "query($machineId: String!) { device(machineId: $machineId) { machineId osVersion osBuild } }",
                Map.of("machineId", MACHINE_ID));

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("device",
                Map.of("machineId", MACHINE_ID, "osVersion", "Windows 10 Pro", "osBuild", "19045.5011"));
    }

    // ───────── A16, flag on ─────────

    @Test
    void osUpdateFlagOn_serviceAndDataFetcherRun() {
        // setup

        // execution
        List<String> beans = Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType).filter(Objects::nonNull)
                .map(ClassUtils::getUserClass).map(Class::getSimpleName).toList();

        // verifications
        // the names DeviceOsUpdatesFlagOffIT asserts absent: present here, so that guard cannot pass on a rename
        assertThat(beans)
                .contains("OsUpdateDataFetcher", "OsUpdateService", "OsUpdateMapper", "GraphQLOsUpdateMapper");
    }

    // ───────── A1, A9, E1: Windows first report ─────────

    @Test
    void windowsDeviceAfterItsFirstReport_deviceReadReturnsVersionBuildStateAndThePendingUpdate() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        savePending(kb5068861(MACHINE_ID, TENANT_ID));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(device).containsEntry("osVersion", "Windows 11 Pro").containsEntry("osBuild", "26100.4061");
        assertThat(osState(device))
                .containsEntry("restartPending", false)
                .containsEntry("restartPendingSince", null)
                .containsEntry("lastScanAt", FIRST_SCAN)
                .containsEntry("lastScanError", null)
                .containsEntry("lastInstalledAt", OCTOBER_INSTALL)
                .containsEntry("managementState", "MANAGED")
                .containsEntry("managedElsewhereReason", null)
                .containsEntry("observedReason", null)
                .containsEntry("authorization", "NOT_REQUIRED")
                .containsEntry("receivedAt", RECEIVED);
        assertThat(pending).singleElement().satisfies(update -> assertThat(update)
                .containsEntry("updateKey", KB5068861_KEY)
                .containsEntry("title", KB5068861_TITLE)
                .containsEntry("version", null)
                .containsEntry("kbArticleIds", List.of("5068861"))
                .containsEntry("severity", "CRITICAL")
                .containsEntry("categories", List.of("Security Updates"))
                .containsEntry("browseOnly", false)
                .containsEntry("publishedAt", "2026-11-10T18:00:00Z")
                .containsEntry("restartBehaviour", "ALWAYS")
                .containsEntry("discoveredAt", FIRST_SCAN));
        assertThat(((Number) pending.getFirst().get("sizeBytes")).longValue()).isEqualTo(812646400L);
    }

    // ───────── A6, A9, E3: Mac, not authorized ─────────

    @Test
    void macNotAuthorized_authorizationAndThePendingUpdateReturned_severityNullAndNoKb() {
        // setup
        saveMachine(machine(MAC_MACHINE_ID, TENANT_ID).append("osType", "MAC_OS")
                .append("osVersion", "26.2").append("osBuild", "25C56")
                .append("osState", new Document("restartPending", false)
                        .append("lastScanAt", date("2026-11-19T10:14:40Z"))
                        .append("managementState", "MANAGED")
                        .append("authorization", "NOT_AUTHORIZED")
                        .append("receivedAt", date(RECEIVED))));
        // lists the Mac report never carried are not in the row at all
        savePending(new Document("tenantId", TENANT_ID).append("machineId", MAC_MACHINE_ID)
                .append("updateKey", MAC_KEY).append("title", "macOS Tahoe 26.7.3").append("version", "26.7.3")
                .append("browseOnly", false).append("sizeBytes", 3481600000L).append("restartBehaviour", "ALWAYS")
                .append("discoveredAt", date("2026-11-19T10:14:40Z")));

        // execution
        Map<String, Object> device = device(MAC_MACHINE_ID);
        List<Map<String, Object>> pending = pending(MAC_MACHINE_ID);

        // verifications
        assertThat(device).containsEntry("osVersion", "26.2").containsEntry("osBuild", "25C56");
        assertThat(osState(device))
                .containsEntry("authorization", "NOT_AUTHORIZED")
                .containsEntry("managementState", "MANAGED")
                .containsEntry("lastInstalledAt", null);
        assertThat(pending).singleElement().satisfies(update -> assertThat(update)
                .containsEntry("updateKey", MAC_KEY)
                .containsEntry("title", "macOS Tahoe 26.7.3")
                .containsEntry("version", "26.7.3")
                .containsEntry("severity", null)
                .containsEntry("kbArticleIds", List.of())
                .containsEntry("categories", List.of())
                .containsEntry("publishedAt", null)
                .containsEntry("restartBehaviour", "ALWAYS")
                .containsEntry("discoveredAt", "2026-11-19T10:14:40Z"));
        assertThat(((Number) pending.getFirst().get("sizeBytes")).longValue()).as("above the int range")
                .isEqualTo(3481600000L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"AUTHORIZED", "NOT_AUTHORIZED", "NOT_REQUIRED"})
    void authorization_eachOfTheThreeStates_returnedAsItself(String authorization) {
        // setup
        Document machine = windowsMachineAfterFirstReport(MACHINE_ID);
        machine.get("osState", Document.class).append("authorization", authorization);
        saveMachine(machine);

        // execution
        Map<String, Object> device = device(MACHINE_ID);

        // verifications
        assertThat(osState(device)).containsEntry("authorization", authorization);
    }

    // ───────── A3, A4, E2: installed ─────────

    @Test
    void deviceAfterTheInstall_noPendingUpdates_historyNewestFirst_lastInstalledAtAndRestartPending() {
        // setup
        Document machine = windowsMachineAfterFirstReport(MACHINE_ID);
        machine.get("osState", Document.class)
                .append("restartPending", true)
                .append("restartPendingSince", date("2026-11-20T02:44:00.120Z"))
                .append("lastScanAt", date("2026-11-20T02:43:07Z"))
                .append("lastInstalledAt", date(NOVEMBER_INSTALL));
        saveMachine(machine);
        saveHistory(history(MACHINE_ID, TENANT_ID, OCTOBER_KEY, OCTOBER_TITLE, OCTOBER_INSTALL, "INSTALL", "SUCCEEDED"));
        saveHistory(history(MACHINE_ID, TENANT_ID, KB5068861_KEY, KB5068861_TITLE, NOVEMBER_INSTALL, "INSTALL", "SUCCEEDED"));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(pending).isEmpty();
        assertThat(osState(device))
                .containsEntry("restartPending", true)
                .containsEntry("restartPendingSince", "2026-11-20T02:44:00.120Z")
                .containsEntry("lastInstalledAt", NOVEMBER_INSTALL);
        assertThat(history.nodes()).extracting(node -> node.get("updateKey"))
                .containsExactly(KB5068861_KEY, OCTOBER_KEY);
        assertThat(history.nodes().getFirst())
                .containsEntry("title", KB5068861_TITLE)
                .containsEntry("version", null)
                .containsEntry("installedAt", NOVEMBER_INSTALL)
                .containsEntry("operation", "INSTALL")
                .containsEntry("result", "SUCCEEDED")
                .containsEntry("errorCode", "0x00000000");
        assertThat(history.hasNextPage()).isFalse();
    }

    @Test
    void failedInstallInTheHistory_resultAndErrorCodeReturnedVerbatim() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        saveHistory(history(MACHINE_ID, TENANT_ID, DOTNET_KEY, DOTNET_TITLE, "2026-11-01T03:00:00Z", "INSTALL", "FAILED")
                .append("errorCode", "0x80240022"));
        saveHistory(history(MACHINE_ID, TENANT_ID, null, "macOS Tahoe 26.2", "2026-10-04T07:45:00Z", null, null)
                .append("errorCode", null));

        // execution
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(history.nodes().getFirst())
                .containsEntry("result", "FAILED")
                .containsEntry("errorCode", "0x80240022");
        assertThat(history.nodes().get(1))
                .containsEntry("updateKey", null)
                .containsEntry("title", "macOS Tahoe 26.2")
                .containsEntry("operation", null)
                .containsEntry("result", null)
                .containsEntry("errorCode", null);
    }

    // ───────── A5, E4: managed elsewhere ─────────

    @Test
    void deviceUnderWsus_managedElsewhereWithItsReason_andItsPendingUpdatesStillReturned() {
        // setup
        Document machine = windowsMachineAfterFirstReport(MACHINE_ID);
        machine.get("osState", Document.class)
                .append("managementState", "MANAGED_ELSEWHERE")
                .append("managedElsewhereReason", "WSUS");
        saveMachine(machine);
        savePending(kb5068861(MACHINE_ID, TENANT_ID));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, DOTNET_KEY, DOTNET_TITLE, FIRST_SCAN)
                .append("severity", "IMPORTANT").append("restartBehaviour", "MAY_REQUIRE"));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, DEFENDER_KEY, DEFENDER_TITLE, FIRST_SCAN)
                .append("severity", null).append("restartBehaviour", "NEVER")
                .append("categories", List.of(category(DEFINITION_UPDATES_ID, "Definition Updates"))));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(osState(device))
                .containsEntry("managementState", "MANAGED_ELSEWHERE")
                .containsEntry("managedElsewhereReason", "WSUS")
                .containsEntry("observedReason", null);
        assertThat(pending).extracting(update -> update.get("updateKey"), update -> update.get("severity"),
                        update -> update.get("restartBehaviour"))
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(KB5068861_KEY, "CRITICAL", "ALWAYS"),
                        org.assertj.core.groups.Tuple.tuple(DOTNET_KEY, "IMPORTANT", "MAY_REQUIRE"),
                        org.assertj.core.groups.Tuple.tuple(DEFENDER_KEY, null, "NEVER"));
    }

    @Test
    void observedDevice_observedWithItsReasonReturned() {
        // setup
        Document machine = windowsMachineAfterFirstReport(MACHINE_ID);
        machine.get("osState", Document.class)
                .append("managementState", "OBSERVED")
                .append("observedReason", "HOME_EDITION");
        saveMachine(machine);

        // execution
        Map<String, Object> device = device(MACHINE_ID);

        // verifications
        assertThat(osState(device))
                .containsEntry("managementState", "OBSERVED")
                .containsEntry("observedReason", "HOME_EDITION")
                .containsEntry("managedElsewhereReason", null);
    }

    // ───────── A7, E5: never reported, never scanned ─────────

    @Test
    void deviceThatNeverReported_osStateNullAndBothListsEmpty() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(device).containsEntry("machineId", MACHINE_ID).containsEntry("osState", null);
        assertThat(pending).isEmpty();
        assertThat(history.nodes()).isEmpty();
        assertThat(history.hasNextPage()).isFalse();
    }

    @Test
    void deviceThatNeverScanned_lastScanAtNullAndTheScanErrorReturned_noPendingUpdates() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID)
                .append("osVersion", "Windows 11 Pro").append("osBuild", "26100.4061")
                .append("osState", new Document("restartPending", false)
                        .append("lastScanAt", null)
                        .append("lastScanError", "0x8024402C")
                        .append("managementState", "MANAGED")
                        .append("authorization", "NOT_REQUIRED")
                        .append("receivedAt", date(RECEIVED))));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(osState(device)).as("osState of a device that reported").isNotNull()
                .containsEntry("lastScanAt", null)
                .containsEntry("lastScanError", "0x8024402C")
                .containsEntry("lastInstalledAt", null)
                .containsEntry("receivedAt", RECEIVED);
        assertThat(pending).isEmpty();
    }

    // ───────── A8, E6: failed scan ─────────

    @Test
    void deviceAfterAFailedScan_errorAndTheKeptLastScanAtReturned_withTheListItHad() {
        // setup
        Document machine = windowsMachineAfterFirstReport(MACHINE_ID);
        machine.get("osState", Document.class).append("lastScanError", "0x80072EE2");
        saveMachine(machine);
        savePending(kb5068861(MACHINE_ID, TENANT_ID));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(osState(device))
                .containsEntry("lastScanError", "0x80072EE2")
                .containsEntry("lastScanAt", FIRST_SCAN);
        assertThat(pending).singleElement().satisfies(update -> assertThat(update)
                .containsEntry("updateKey", KB5068861_KEY)
                .containsEntry("discoveredAt", FIRST_SCAN));
    }

    // ───────── A11: what the ingest stored as unknown ─────────

    @Test
    void valuesStoredAsUnknown_returnedAsNull_listsAsEmpty() {
        // setup
        saveMachine(machine(MACHINE_ID, TENANT_ID)
                .append("osState", new Document("receivedAt", date(RECEIVED)).append("lastScanAt", date(FIRST_SCAN))));
        savePending(new Document("tenantId", TENANT_ID).append("machineId", MACHINE_ID)
                .append("updateKey", "k-bare").append("title", "Bare update").append("discoveredAt", date(FIRST_SCAN)));

        // execution
        Map<String, Object> device = device(MACHINE_ID);
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(osState(device))
                .containsEntry("restartPending", null)
                .containsEntry("managementState", null)
                .containsEntry("authorization", null)
                .containsEntry("receivedAt", RECEIVED);
        assertThat(pending).singleElement().satisfies(update -> assertThat(update)
                .containsEntry("updateKey", "k-bare")
                .containsEntry("severity", null)
                .containsEntry("browseOnly", null)
                .containsEntry("sizeBytes", null)
                .containsEntry("restartBehaviour", null)
                .containsEntry("kbArticleIds", List.of())
                .containsEntry("categories", List.of()));
    }

    // design.md, ruling 10: the row keeps id + name, the read answers the names
    @Test
    void categories_returnedAsTheirNamesInTheStoredOrder_oneWithoutANameLeftOut() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, "k-named", "Alpha", FIRST_SCAN)
                .append("categories", List.of(
                        category(SECURITY_UPDATES_ID, "Security Updates"),
                        new Document("id", "only-an-id"),
                        new Document("name", "Only a name"),
                        new Document("id", "null-name").append("name", null))));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, "k-unnamed", "Bravo", FIRST_SCAN)
                .append("categories", List.of(new Document("id", "only-an-id"))));

        // execution
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(pending).extracting(update -> update.get("updateKey"), update -> update.get("categories"))
                .containsExactly(
                        Tuple.tuple("k-named", List.of("Security Updates", "Only a name")),
                        Tuple.tuple("k-unnamed", List.of()));
    }

    // ───────── design.md: order of the pending list ─────────

    @Test
    void pendingUpdates_newestDiscoveredFirst_thenByTitle() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, "k-1", "Bravo", "2026-11-19T10:14:51Z"));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, "k-2", "Alpha", "2026-11-19T10:14:51Z"));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, "k-3", "Zulu", "2026-11-12T10:14:51Z"));
        savePending(pendingRow(MACHINE_ID, TENANT_ID, "k-4", "Mike", "2026-11-19T16:14:51Z"));

        // execution
        List<Map<String, Object>> pending = pending(MACHINE_ID);

        // verifications
        assertThat(pending).extracting(update -> update.get("title")).containsExactly("Mike", "Alpha", "Bravo", "Zulu");
    }

    // ───────── A12: tenant ─────────

    @Test
    void deviceOfAnotherTenant_readAnswersAsForAnUnknownDevice() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(OTHER_TENANT_MACHINE_ID).append("tenantId", OTHER_TENANT_ID));
        savePending(kb5068861(OTHER_TENANT_MACHINE_ID, OTHER_TENANT_ID));
        saveHistory(history(OTHER_TENANT_MACHINE_ID, OTHER_TENANT_ID, OCTOBER_KEY, OCTOBER_TITLE, OCTOBER_INSTALL,
                "INSTALL", "SUCCEEDED"));

        // execution
        ExecutionResult device = queryExecutor.execute(DEVICE, Map.of("machineId", OTHER_TENANT_MACHINE_ID));
        ExecutionResult pending = queryExecutor.execute(PENDING, Map.of("machineId", OTHER_TENANT_MACHINE_ID));
        ExecutionResult history = queryExecutor.execute(HISTORY, Map.of("machineId", OTHER_TENANT_MACHINE_ID));

        // verifications
        assertThat(device.getErrors()).isEmpty();
        assertThat(device.<Map<String, Object>>getData()).containsEntry("device", null);
        assertDeviceNotFound(pending);
        assertDeviceNotFound(history);
    }

    @Test
    void rowsOfAnotherTenantUnderTheSameMachineId_neverReturned() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        savePending(kb5068861(MACHINE_ID, TENANT_ID));
        savePending(pendingRow(MACHINE_ID, OTHER_TENANT_ID, "k-foreign", "Update of another tenant", FIRST_SCAN));
        saveHistory(history(MACHINE_ID, TENANT_ID, OCTOBER_KEY, OCTOBER_TITLE, OCTOBER_INSTALL, "INSTALL", "SUCCEEDED"));
        saveHistory(history(MACHINE_ID, OTHER_TENANT_ID, "k-foreign", "Update of another tenant", NOVEMBER_INSTALL,
                "INSTALL", "SUCCEEDED"));

        // execution
        List<Map<String, Object>> pending = pending(MACHINE_ID);
        HistoryPage history = history(MACHINE_ID, null, null);

        // verifications
        assertThat(pending).extracting(update -> update.get("updateKey")).containsExactly(KB5068861_KEY);
        assertThat(history.nodes()).extracting(node -> node.get("updateKey")).containsExactly(OCTOBER_KEY);
    }

    // ───────── A14: unknown device ─────────

    @Test
    void unknownMachineId_bothListsAnswerDeviceNotFound() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        savePending(kb5068861(MACHINE_ID, TENANT_ID));

        // execution
        ExecutionResult pending = queryExecutor.execute(PENDING, Map.of("machineId", UNKNOWN_MACHINE_ID));
        ExecutionResult history = queryExecutor.execute(HISTORY, Map.of("machineId", UNKNOWN_MACHINE_ID));

        // verifications
        assertDeviceNotFound(pending);
        assertDeviceNotFound(history);
    }

    // ───────── A15: history pages ─────────

    @Test
    void history_fortyFiveEntriesInPagesOfTwenty_newestFirst_everyEntryOnce() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
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
        List<String> walked = keys(first, second, third);
        assertThat(walked).doesNotHaveDuplicates().hasSize(45);
        assertThat(walked).as("newest first").isEqualTo(entryKeysNewestFirst(45));
    }

    @Test
    void history_cursorOfAnEntryInTheMiddleOfAPage_continuesRightAfterThatEntry() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, 12);

        // execution
        HistoryPage first = history(MACHINE_ID, 10, null);
        HistoryPage afterTheFourth = history(MACHINE_ID, 3, first.cursors().get(3));

        // verifications
        assertThat(keys(afterTheFourth)).isEqualTo(entryKeysNewestFirst(12).subList(4, 7));
        assertThat(afterTheFourth.hasNextPage()).isTrue();
    }

    @Test
    void history_entriesInstalledAtTheSameInstant_splitOverPagesWithoutLossOrRepeat() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        for (int i = 0; i < 9; i++) {
            saveHistory(history(MACHINE_ID, TENANT_ID, "same-" + i, "Same instant " + i, "2026-11-10T03:00:00Z",
                    "INSTALL", "SUCCEEDED"));
        }
        saveHistory(history(MACHINE_ID, TENANT_ID, "newer", "Newer", "2026-11-11T03:00:00Z", "INSTALL", "SUCCEEDED"));
        saveHistory(history(MACHINE_ID, TENANT_ID, "older", "Older", "2026-11-09T03:00:00Z", "INSTALL", "SUCCEEDED"));

        // execution
        List<HistoryPage> pages = historyPages(MACHINE_ID, 4);

        // verifications
        List<String> walked = keys(pages.toArray(HistoryPage[]::new));
        assertThat(pages).hasSize(3);
        assertThat(walked).doesNotHaveDuplicates().hasSize(11);
        assertThat(walked.getFirst()).isEqualTo("newer");
        assertThat(walked.getLast()).isEqualTo("older");
    }

    @Test
    void history_withoutFirst_twentyEntries_andNeverMoreThanAHundred() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, 120);

        // execution
        HistoryPage byDefault = history(MACHINE_ID, null, null);
        HistoryPage aHundred = history(MACHINE_ID, 100, null);
        HistoryPage fiveHundred = history(MACHINE_ID, 500, null);
        HistoryPage rest = history(MACHINE_ID, 100, aHundred.endCursor());

        // verifications
        assertThat(byDefault.nodes()).hasSize(20);
        assertThat(byDefault.hasNextPage()).isTrue();
        assertThat(aHundred.nodes()).hasSize(100);
        assertThat(aHundred.hasNextPage()).isTrue();
        assertThat(fiveHundred.nodes()).hasSize(100);
        assertThat(fiveHundred.hasNextPage()).isTrue();
        assertThat(rest.nodes()).hasSize(20);
        assertThat(rest.hasNextPage()).isFalse();
        assertThat(keys(aHundred, rest)).isEqualTo(entryKeysNewestFirst(120));
    }

    @ParameterizedTest
    @ValueSource(ints = {19, 20, 21})
    void history_aroundThePageEdge_hasNextPageOnlyWhenAnEntryIsLeft(int stored) {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        saveHistoryEntries(MACHINE_ID, stored);

        // execution
        HistoryPage first = history(MACHINE_ID, 20, null);
        HistoryPage second = first.endCursor() == null ? null : history(MACHINE_ID, 20, first.endCursor());

        // verifications
        assertThat(first.nodes()).hasSize(Math.min(stored, 20));
        assertThat(first.hasNextPage()).isEqualTo(stored > 20);
        assertThat(second).isNotNull();
        assertThat(second.nodes()).hasSize(Math.max(stored - 20, 0));
        assertThat(second.hasNextPage()).isFalse();
    }

    @Test
    void history_ofTwoDevices_eachReturnsItsOwn() {
        // setup
        saveMachine(windowsMachineAfterFirstReport(MACHINE_ID));
        saveMachine(windowsMachineAfterFirstReport(SECOND_MACHINE_ID));
        saveHistory(history(MACHINE_ID, TENANT_ID, OCTOBER_KEY, OCTOBER_TITLE, OCTOBER_INSTALL, "INSTALL", "SUCCEEDED"));
        saveHistory(history(SECOND_MACHINE_ID, TENANT_ID, KB5068861_KEY, KB5068861_TITLE, NOVEMBER_INSTALL, "INSTALL", "SUCCEEDED"));
        savePending(kb5068861(MACHINE_ID, TENANT_ID));

        // execution
        HistoryPage first = history(MACHINE_ID, null, null);
        HistoryPage second = history(SECOND_MACHINE_ID, null, null);

        // verifications
        assertThat(keys(first)).containsExactly(OCTOBER_KEY);
        assertThat(keys(second)).containsExactly(KB5068861_KEY);
        assertThat(pending(SECOND_MACHINE_ID)).isEmpty();
    }

    // ───────── reading ─────────

    private Map<String, Object> device(String machineId) {
        Map<String, Object> data = data(DEVICE, Map.of("machineId", machineId));
        return map(data.get("device"));
    }

    private static Map<String, Object> osState(Map<String, Object> device) {
        assertThat(device).as("device").isNotNull();
        return map(device.get("osState"));
    }

    private List<Map<String, Object>> pending(String machineId) {
        Map<String, Object> data = data(PENDING, Map.of("machineId", machineId));
        return list(data.get("deviceOsUpdates"));
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

    private static void assertDeviceNotFound(ExecutionResult result) {
        assertThat(result.getErrors()).singleElement().extracting(GraphQLError::getExtensions)
                .satisfies(extensions -> assertThat(extensions)
                        .containsEntry("code", "DEVICE_NOT_FOUND")
                        .containsEntry("httpStatus", 404));
        assertThat(result.<Object>getData()).isNull();
    }

    private static List<String> keys(HistoryPage... pages) {
        return Arrays.stream(pages)
                .flatMap(page -> page.nodes().stream())
                .map(node -> (String) node.get("updateKey"))
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

    // ───────── stored state, as the ingest half leaves it ─────────

    private static Document machine(String machineId, String tenantId) {
        return new Document("machineId", machineId)
                .append("tenantId", tenantId)
                .append("status", "ONLINE")
                .append("hostname", "host-" + machineId)
                .append("osType", "WINDOWS");
    }

    private static Document windowsMachineAfterFirstReport(String machineId) {
        return machine(machineId, TENANT_ID)
                .append("osVersion", "Windows 11 Pro")
                .append("osBuild", "26100.4061")
                .append("osState", new Document("restartPending", false)
                        .append("lastScanAt", date(FIRST_SCAN))
                        .append("lastInstalledAt", date(OCTOBER_INSTALL))
                        .append("managementState", "MANAGED")
                        .append("authorization", "NOT_REQUIRED")
                        .append("receivedAt", date(RECEIVED)));
    }

    private static Document kb5068861(String machineId, String tenantId) {
        return pendingRow(machineId, tenantId, KB5068861_KEY, KB5068861_TITLE, FIRST_SCAN)
                .append("kbArticleIds", List.of("5068861"))
                .append("severity", "CRITICAL")
                .append("categories", List.of(category(SECURITY_UPDATES_ID, "Security Updates")))
                .append("publishedAt", date("2026-11-10T18:00:00Z"))
                .append("sizeBytes", 812646400L)
                .append("restartBehaviour", "ALWAYS");
    }

    private static Document category(String id, String name) {
        return new Document("id", id).append("name", name);
    }

    private static Document pendingRow(String machineId, String tenantId, String updateKey, String title,
                                       String discoveredAt) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("updateKey", updateKey)
                .append("title", title)
                .append("kbArticleIds", List.of())
                .append("categories", List.of())
                .append("browseOnly", false)
                .append("discoveredAt", date(discoveredAt));
    }

    private static Document history(String machineId, String tenantId, String updateKey, String title,
                                    String installedAt, String operation, String result) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("entryKey", (updateKey == null ? title : updateKey) + "|" + installedAt + "|" + operation)
                .append("updateKey", updateKey)
                .append("title", title)
                .append("installedAt", date(installedAt))
                .append("operation", operation)
                .append("result", result)
                .append("errorCode", "0x00000000");
    }

    // entry i was installed i hours after the oldest: k-0 is the oldest
    private void saveHistoryEntries(String machineId, int count) {
        Instant oldest = Instant.parse("2026-01-01T00:00:00Z");
        List<Document> entries = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            String installedAt = oldest.plus(i, ChronoUnit.HOURS).toString();
            entries.add(history(machineId, TENANT_ID, "k-" + i, "Update " + i, installedAt, "INSTALL", "SUCCEEDED"));
        }
        // stored out of order: the answer is ordered by the read, not by insertion
        entries.sort(Comparator.comparing(entry -> entry.getString("title")));
        historyCollection().insertMany(entries);
    }

    private static List<String> entryKeysNewestFirst(int count) {
        List<String> keys = new ArrayList<>();
        for (int i = count - 1; i >= 0; i--) {
            keys.add("k-" + i);
        }
        return keys;
    }

    private static Date date(String instant) {
        return Date.from(Instant.parse(instant));
    }

    private void saveMachine(Document machine) {
        machines().insertOne(machine);
    }

    private void savePending(Document row) {
        pendingCollection().insertOne(row);
    }

    private void saveHistory(Document row) {
        historyCollection().insertOne(row);
    }

    private MongoCollection<Document> machines() {
        return mongoTemplate.getCollection("machines");
    }

    private MongoCollection<Document> pendingCollection() {
        return mongoTemplate.getCollection("device_os_updates");
    }

    private MongoCollection<Document> historyCollection() {
        return mongoTemplate.getCollection("device_os_update_history");
    }
}

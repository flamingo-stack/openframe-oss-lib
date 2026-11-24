package com.openframe.client.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.openframe.client.integration.support.OsReportIngestTestApplication;
import com.openframe.client.publisher.EventLogsPublisher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import io.micrometer.core.instrument.MeterRegistry;
import io.nats.client.Connection;
import io.nats.client.JetStreamApiException;
import io.nats.client.JetStreamManagement;
import io.nats.client.api.AckPolicy;
import io.nats.client.api.ConsumerConfiguration;
import io.nats.client.api.ConsumerInfo;
import io.nats.client.api.DeliverPolicy;
import org.awaitility.core.ConditionTimeoutException;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import tools.jackson.databind.JsonNode;
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
import static org.assertj.core.api.Assertions.tuple;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

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
    // WARNING: longer than the listener's ackWait of 30 s, or the redelivery of an unacknowledged report is missed
    private static final Duration REDELIVERY_WAIT = Duration.ofSeconds(50);
    // set by the first report nobody acknowledged, so a broken listener does not cost ten seconds per test
    private static volatile boolean nothingApplies;

    private static final String OTHER_TENANT_ID = "tenant-b";
    private static final String OWN_MACHINES = "os-ingest-";

    private static final String MAC_UPDATES_AVAILABLE = "macos-updates-available";
    private static final String MAC_UPDATES_UNREADABLE = "macos-updates-unreadable";
    private static final String WINDOWS_MANAGED_BY_WSUS = "windows-managed-by-wsus";
    private static final String WINDOWS_NOT_MANAGEABLE_MINIMAL = "windows-not-manageable-minimal";

    private static final String WINDOWS_PENDING = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String WINDOWS_PENDING_NAME =
            "2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)";
    private static final String WINDOWS_INSTALLED_UPDATE_ID = "ffeeddcc-1111-2222-3333-445566778899";
    private static final String WINDOWS_INSTALLED = WINDOWS_INSTALLED_UPDATE_ID + ":198";
    private static final String WINDOWS_INSTALLED_TITLE =
            "2026-10 Cumulative Update for Windows 11 Version 24H2 (KB5049981)";
    private static final Instant LAST_OS_INSTALL_AT = Instant.parse("2026-10-15T03:12:44Z");
    // WARNING: installs older than the retention are neither stored nor kept by the TTL monitor of the container,
    // so every install time of a history entry is counted from now and never taken from a fixture
    private static final Duration RETENTION = DeviceOsUpdateHistoryEntry.RETENTION;
    private static final Instant WINDOWS_INSTALLED_AT = stepsAgo(5);
    private static final Instant TWO_STEPS_AGO = stepsAgo(2);
    private static final String MAC_OS_UPDATE = "MSU_UPDATE_25C56_patch_26.2";
    private static final String MAC_XCODE = "Command Line Tools for Xcode-26.6";
    private static final String MAC_SAFARI = "Safari-18.2";

    @Autowired
    private Connection natsConnection;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private DeletedMachineCleanup deletedMachineCleanup;

    @Autowired
    private EventLogsPublisher eventLogsPublisher;

    @Autowired
    private MeterRegistry meterRegistry;

    private final ArgumentCaptor<CommonDebeziumMessage> logEventCaptor = ArgumentCaptor.captor();

    private final ArgumentCaptor<Map<String, Object>> logHeadersCaptor = ArgumentCaptor.captor();

    private long lastStored;

    @BeforeEach
    void removeTheMachinesOfThisClass() {
        // WARNING: deleteMany, not drop: the unique indexes of the feature collections must outlive a test
        Bson ownMachines = Filters.regex("machineId", "^" + OWN_MACHINES);
        machines().deleteMany(ownMachines);
        stateCollection().deleteMany(ownMachines);
        pendingCollection().deleteMany(ownMachines);
        historyCollection().deleteMany(ownMachines);
        osUpdateCollection().deleteMany(new Document());
    }

    @AfterEach
    void acceptHistoryWrites() {
        mongoTemplate.getDb().runCommand(new Document("collMod", "device_os_update_history")
                .append("validator", new Document()).append("validationLevel", "off"));
    }

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

    @Test
    void osUpdateFlagOn_listenerAndFacadeRun_oneDurableConsumerOnTheStream() throws Exception {
        // setup
        JetStreamManagement streams = natsConnection.jetStreamManagement();

        // execution
        List<String> consumers = streams.getConsumerNames(OS_UPDATES_STREAM);

        // verifications
        assertThat(beanClassNames(context)).contains("MachineOsUpdatesListener", "DeviceOsReportFacade");
        assertThat(consumers).as("consumers of %s", OS_UPDATES_STREAM).hasSize(1);
        ConsumerConfiguration consumer =
                streams.getConsumerInfo(OS_UPDATES_STREAM, consumers.getFirst()).getConsumerConfiguration();
        assertThat(consumer.getDurable()).isNotBlank();
        assertThat(consumer.getFilterSubject()).isEqualTo(OS_UPDATES_SUBJECTS);
        assertThat(consumer.getAckPolicy()).isEqualTo(AckPolicy.Explicit);
    }

    @Test
    void windowsReport_stateStored_theWindowsBlockOfTheReportIsNotKept() {
        // setup
        String machineId = newMachine();

        // execution
        Instant storedByNats = publish(machineId, windowsReport().toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState)
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("machineId", machineId)
                .containsEntry("platform", "WINDOWS")
                .containsEntry("osVersion", "11 24H2")
                .containsEntry("osBuild", "26100.4061")
                .containsEntry("osProductName", "Windows 11 Pro")
                .containsEntry("scanState", "FRESH")
                .containsEntry("pendingUpdatesConfidence", "CONFIRMED")
                .containsEntry("patchState", "UPDATES_AVAILABLE")
                .containsEntry("rebootPending", "NO")
                .containsEntry("osUpdateAuthorization", "NOT_REQUIRED")
                .containsEntry("version", 0L)
                .doesNotContainKeys("rebootPendingSince", "platformDetails", "windows", "history");
        assertThat(instant(osState, "receivedAt")).isEqualTo(storedByNats);
        assertThat(instant(osState, "reportedAt")).isEqualTo(Instant.parse("2026-11-20T09:14:02.481Z"));
        assertThat(instant(osState, "lastScanAt")).isEqualTo(Instant.parse("2026-11-20T08:44:00Z"));
        assertThat(osState.get("manageability", Document.class))
                .containsEntry("state", "NOT_MANAGEABLE")
                .containsEntry("reasons", List.of("WSUS", "GROUP_POLICY"));
        Document lastOsInstall = osState.get("lastOsInstall", Document.class);
        assertThat(lastOsInstall)
                .containsEntry("identifier", WINDOWS_INSTALLED)
                .containsEntry("displayName", WINDOWS_INSTALLED_TITLE)
                .doesNotContainKey("displayVersion");
        assertThat(instant(lastOsInstall, "installedAt")).isEqualTo(LAST_OS_INSTALL_AT);
    }

    @Test
    void windowsReport_updateDescribedOnceForTheTenant_pendingOnTheDevice_andTheInstallInTheHistory() {
        // setup
        String machineId = newMachine();

        // execution
        Instant storedByNats = publish(machineId, windowsReport().toString());
        awaitProcessed();

        // verifications
        assertThat(osUpdates()).singleElement().satisfies(osUpdate -> {
            assertThat(osUpdate)
                    .containsEntry("tenantId", TENANT_ID)
                    .containsEntry("platform", "WINDOWS")
                    .containsEntry("identifier", WINDOWS_PENDING)
                    .containsEntry("displayName", WINDOWS_PENDING_NAME)
                    .containsEntry("kbArticleIds", List.of("5051987"))
                    .containsEntry("severity", "CRITICAL")
                    .containsEntry("categories", List.of("Security Updates"))
                    .containsEntry("categoryIds", List.of("0fa1201d-4330-4fa8-8ae9-b877473b6441"))
                    .containsEntry("updateType", "SOFTWARE")
                    .containsEntry("cveIds", List.of("CVE-2026-21309", "CVE-2026-21311"))
                    .containsEntry("sizeBytes", 764317696L)
                    .containsEntry("rebootBehavior", "ALWAYS")
                    .containsEntry("browseOnly", false)
                    .doesNotContainKeys("displayVersion", "machineId");
            assertThat(instant(osUpdate, "publishedAt")).isEqualTo(Instant.parse("2026-11-11T18:00:00Z"));
            assertThat(instant(osUpdate, "firstSeenAt")).isEqualTo(storedByNats);
        });
        assertThat(pendingRows(machineId)).singleElement().satisfies(pending -> {
            assertThat(pending)
                    .containsEntry("tenantId", TENANT_ID)
                    .containsEntry("machineId", machineId)
                    .containsEntry("platform", "WINDOWS")
                    .containsEntry("identifier", WINDOWS_PENDING)
                    .containsEntry("downloaded", true)
                    .doesNotContainKeys("macosPresence", "displayName", "severity");
            assertThat(instant(pending, "discoveredAt")).isEqualTo(storedByNats);
        });
        assertThat(historyRows(machineId)).singleElement().satisfies(entry -> {
            assertThat(entry)
                    .containsEntry("tenantId", TENANT_ID)
                    .containsEntry("machineId", machineId)
                    .containsEntry("identifier", WINDOWS_INSTALLED)
                    .containsEntry("title", WINDOWS_INSTALLED_TITLE)
                    .containsEntry("operation", "INSTALL")
                    .containsEntry("result", "SUCCEEDED")
                    .doesNotContainKey("errorCode");
            assertThat(instant(entry, "installedAt")).isEqualTo(WINDOWS_INSTALLED_AT);
        });
    }

    @Test
    void macReport_stateStoredWithoutItsMacosBlock_threeUpdatesByNameAndVersionOnly_noHistory() {
        // setup
        String machineId = newMachine();

        // execution
        Instant storedByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState)
                .containsEntry("platform", "MACOS")
                .containsEntry("osVersion", "26.1")
                .containsEntry("osBuild", "25B78")
                .containsEntry("osProductName", "macOS")
                .containsEntry("scanState", "FRESH")
                .containsEntry("pendingUpdatesConfidence", "CONFIRMED")
                .containsEntry("patchState", "UPDATES_AVAILABLE")
                .containsEntry("rebootPending", "UNKNOWN")
                .containsEntry("osUpdateAuthorization", "AUTHORIZED")
                .doesNotContainKeys("rebootPendingSince", "platformDetails", "macos");
        assertThat(osState.get("manageability", Document.class))
                .containsEntry("state", "MANAGEABLE")
                .containsEntry("reasons", List.of());
        assertThat(osState.get("lastOsInstall", Document.class))
                .containsEntry("displayName", "macOS 26.1")
                .containsEntry("displayVersion", "26.1")
                .doesNotContainKey("identifier");
        assertThat(osUpdates())
                .extracting(osUpdate -> osUpdate.getString("identifier"), osUpdate -> osUpdate.getString("displayName"),
                        osUpdate -> osUpdate.getString("displayVersion"), osUpdate -> osUpdate.getString("platform"))
                .containsExactlyInAnyOrder(
                        tuple(MAC_OS_UPDATE, "macOS Sequoia 26.2", "26.2", "MACOS"),
                        tuple(MAC_XCODE, "Command Line Tools for Xcode", "26.6", "MACOS"),
                        tuple(MAC_SAFARI, "Safari", "18.2", "MACOS"));
        assertThat(osUpdates()).allSatisfy(osUpdate -> assertThat(osUpdate).doesNotContainKeys(
                "kbArticleIds", "severity", "categories", "cveIds", "publishedAt", "sizeBytes", "rebootBehavior",
                "browseOnly"));
        assertThat(pendingRows(machineId))
                .extracting(pending -> pending.getString("identifier"), pending -> pending.getString("macosPresence"),
                        pending -> pending.get("downloaded"), pending -> instant(pending, "discoveredAt"))
                .containsExactlyInAnyOrder(
                        tuple(MAC_OS_UPDATE, "FRESH", null, storedByNats),
                        tuple(MAC_XCODE, "FRESH", null, storedByNats),
                        tuple(MAC_SAFARI, "HELD_OVER", null, storedByNats));
        assertThat(historyRows(machineId)).isEmpty();
    }

    @Test
    void reportOfADeviceThatCouldNotReadItsUpdates_stateReplaced_pendingUpdatesOfTheEarlierReportKept() {
        // setup
        String machineId = newMachine();
        Instant firstStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();

        Document firstState = osState(machineId);

        // execution
        Instant secondStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_UNREADABLE));
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(firstState).containsEntry("version", 0L);
        assertThat(osState)
                .containsEntry("_id", firstState.get("_id"))
                .containsEntry("version", 1L)
                .containsEntry("pendingUpdatesConfidence", "UNREADABLE")
                .containsEntry("patchState", "UNKNOWN")
                .containsEntry("scanState", "STALE")
                .containsEntry("osVersion", "13.7.8")
                .containsEntry("osUpdateAuthorization", "NOT_REQUIRED")
                .doesNotContainKey("lastOsInstall");
        assertThat(osState.get("manageability", Document.class))
                .containsEntry("state", "NOT_MANAGEABLE")
                .containsEntry("reasons", List.of("NO_SERVICE_ACCOUNT"));
        assertThat(instant(osState, "receivedAt")).isEqualTo(secondStoredByNats);
        assertThat(pendingRows(machineId))
                .extracting(pending -> pending.getString("identifier"), pending -> instant(pending, "discoveredAt"))
                .containsExactlyInAnyOrder(
                        tuple(MAC_OS_UPDATE, firstStoredByNats),
                        tuple(MAC_XCODE, firstStoredByNats),
                        tuple(MAC_SAFARI, firstStoredByNats));
        assertThat(osUpdates()).hasSize(3);
    }

    static Stream<String> confidencesThatAreNotConfirmed() {
        return Stream.of("UNCONFIRMED", "RETAINED", "UNREADABLE", "TOO_LARGE", "CONFIDENCE_OF_A_NEWER_AGENT");
    }

    @ParameterizedTest
    @MethodSource("confidencesThatAreNotConfirmed")
    void listThatIsNotConfirmed_evenWithItems_pendingUpdatesKeptAndTheConfidenceShownOnTheState(String confidence) {
        // setup
        String machineId = newMachine();
        Instant firstStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        ObjectNode notConfirmed = fixture(MAC_UPDATES_AVAILABLE);
        updates(notConfirmed).put("confidence", confidence);
        updates(notConfirmed).putArray("items").add(macItem("Only-Item-1.0", "Only item", "1.0", "FRESH"));
        String expectedConfidence = confidence.startsWith("CONFIDENCE_OF") ? null : confidence;

        // execution
        publish(machineId, notConfirmed.toString());
        awaitProcessed();

        // verifications
        assertThat(osState(machineId).getString("pendingUpdatesConfidence")).isEqualTo(expectedConfidence);
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
        assertThat(pendingRows(machineId)).extracting(pending -> instant(pending, "discoveredAt"))
                .containsOnly(firstStoredByNats);
        assertThat(osUpdates()).extracting(osUpdate -> osUpdate.getString("identifier"))
                .doesNotContain("Only-Item-1.0");
    }

    @Test
    void confirmedListWithoutItems_pendingUpdatesKept() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        ObjectNode withoutItems = fixture(MAC_UPDATES_AVAILABLE);
        updates(withoutItems).remove("items");

        // execution
        Instant storedByNats = publish(machineId, withoutItems.toString());
        awaitProcessed();

        // verifications
        assertThat(instant(osState(machineId), "receivedAt")).isEqualTo(storedByNats);
        assertThat(osState(machineId)).containsEntry("pendingUpdatesConfidence", "CONFIRMED");
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
    }

    @Test
    void reportWithoutTheUpdatesBlock_pendingUpdatesKeptAndNoConfidenceOnTheState() {
        // setup
        String machineId = newMachine();
        publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        ObjectNode withoutUpdates = fixture(MAC_UPDATES_AVAILABLE);
        withoutUpdates.remove("updates");

        // execution
        publish(machineId, withoutUpdates.toString());
        awaitProcessed();

        // verifications
        assertThat(osState(machineId)).doesNotContainKey("pendingUpdatesConfidence");
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
    }

    @Test
    void minimalReportOfADeviceThatIsNotManageable_applied_stateWritten_pendingUpdatesAndHistoryKept() {
        // setup
        String machineId = newMachine();
        ObjectNode manageable = windowsReport();
        ((ObjectNode) manageable.get("manageability")).put("state", "MANAGEABLE").remove("reasons");
        publish(machineId, manageable.toString());
        awaitProcessed();
        long appliedBefore = handledReports("applied");
        long malformedBefore = handledReports("malformed");

        // execution
        Instant storedByNats = publish(machineId, fixtureText(WINDOWS_NOT_MANAGEABLE_MINIMAL));
        awaitProcessed();
        assertNothingLeftForRedelivery();

        // verifications
        await().atMost(SHORT_WAIT).untilAsserted(() ->
                assertThat(handledReports("applied")).isEqualTo(appliedBefore + 1));
        assertThat(handledReports("malformed")).isEqualTo(malformedBefore);
        Document osState = osState(machineId);
        assertThat(osState)
                .containsEntry("platform", "WINDOWS")
                .containsEntry("osVersion", "11 24H2")
                .containsEntry("osBuild", "26100.4061")
                .containsEntry("osProductName", "Windows 11 Pro")
                .containsEntry("osUpdateAuthorization", "NOT_REQUIRED")
                .doesNotContainKeys("pendingUpdatesConfidence", "patchState", "scanState", "lastScanAt",
                        "rebootPending", "lastOsInstall");
        assertThat(osState.get("manageability", Document.class))
                .containsEntry("state", "NOT_MANAGEABLE")
                .containsEntry("reasons", List.of("WSUS", "GROUP_POLICY"));
        assertThat(instant(osState, "receivedAt")).isEqualTo(storedByNats);
        assertThat(instant(osState, "reportedAt")).isEqualTo(Instant.parse("2026-11-24T12:00:00Z"));
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(WINDOWS_PENDING);
        assertThat(historyRows(machineId)).extracting(entry -> entry.getString("identifier"))
                .containsExactly(WINDOWS_INSTALLED);
        assertThat(osUpdates()).extracting(osUpdate -> osUpdate.getString("identifier"))
                .containsExactly(WINDOWS_PENDING);
    }

    @Test
    void minimalReportAsTheFirstReportOfADevice_applied_stateWrittenAndNothingElse() {
        // setup
        String machineId = newMachine();

        // execution
        Instant storedByNats = publish(machineId, fixtureText(WINDOWS_NOT_MANAGEABLE_MINIMAL));
        awaitProcessed();
        assertNothingLeftForRedelivery();

        // verifications
        assertThat(instant(osState(machineId), "receivedAt")).isEqualTo(storedByNats);
        assertThat(osState(machineId).get("manageability", Document.class))
                .containsEntry("state", "NOT_MANAGEABLE");
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
        assertThat(osUpdates()).isEmpty();
    }

    @Test
    void confirmedEmptyList_clearsThePendingUpdatesOfTheDevice_theUpdatesOfTheTenantStay() {
        // setup
        String machineId = newMachine();
        String otherMachineId = newMachine();
        publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        publish(otherMachineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        ObjectNode upToDate = fixture(MAC_UPDATES_AVAILABLE);
        upToDate.put("patchState", "UP_TO_DATE");
        updates(upToDate).putArray("items");

        // execution
        publish(machineId, upToDate.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(osState(machineId))
                .containsEntry("pendingUpdatesConfidence", "CONFIRMED")
                .containsEntry("patchState", "UP_TO_DATE");
        assertThat(pendingByIdentifier(otherMachineId)).containsOnlyKeys(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
        assertThat(osUpdates()).extracting(osUpdate -> osUpdate.getString("identifier"))
                .containsExactlyInAnyOrder(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
    }

    @Test
    void laterConfirmedReport_replacesTheList_updateStillNamedStaysTheSameDocumentWithItsDiscoveredAtAndTheNewValues() {
        // setup
        String machineId = newMachine();
        Instant firstStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        Object idOfSafari = pendingByIdentifier(machineId).get(MAC_SAFARI).get("_id");
        ObjectNode later = fixture(MAC_UPDATES_AVAILABLE);
        updates(later).putArray("items")
                .add(macItem(MAC_SAFARI, "Safari", "18.2", "FRESH"))
                .add(macItem("Pages-15.1", "Pages", "15.1", "FRESH"));

        // execution
        Instant secondStoredByNats = publish(machineId, later.toString());
        awaitProcessed();

        // verifications
        assertThat(secondStoredByNats).isAfter(firstStoredByNats);
        assertThat(pendingRows(machineId))
                .extracting(pending -> pending.getString("identifier"), pending -> pending.getString("macosPresence"),
                        pending -> instant(pending, "discoveredAt"))
                .containsExactlyInAnyOrder(
                        tuple(MAC_SAFARI, "FRESH", firstStoredByNats),
                        tuple("Pages-15.1", "FRESH", secondStoredByNats));
        assertThat(pendingByIdentifier(machineId).get(MAC_SAFARI)).containsEntry("_id", idOfSafari);
    }

    @Test
    void updateNamedAgainAfterItDisappeared_getsTheDiscoveredAtOfTheReportThatNamesItAgain() {
        // setup
        String machineId = newMachine();
        Instant firstStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        ObjectNode withoutSafari = fixture(MAC_UPDATES_AVAILABLE);
        updates(withoutSafari).putArray("items").add(macItem(MAC_XCODE, "Command Line Tools for Xcode", "26.6", "FRESH"));
        publish(machineId, withoutSafari.toString());
        awaitProcessed();
        List<String> pendingWithoutSafari = new ArrayList<>(pendingByIdentifier(machineId).keySet());

        // execution
        Instant thirdStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();

        // verifications
        assertThat(thirdStoredByNats).isAfter(firstStoredByNats);
        assertThat(pendingWithoutSafari).containsExactly(MAC_XCODE);
        Map<String, Document> pending = pendingByIdentifier(machineId);
        assertThat(pending).containsOnlyKeys(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
        assertThat(instant(pending.get(MAC_XCODE), "discoveredAt")).isEqualTo(firstStoredByNats);
        assertThat(instant(pending.get(MAC_SAFARI), "discoveredAt")).isEqualTo(thirdStoredByNats);
        assertThat(instant(pending.get(MAC_OS_UPDATE), "discoveredAt")).isEqualTo(thirdStoredByNats);
    }

    @Test
    void windowsUpdateNoLongerDownloaded_downloadStateOfThePendingUpdateReplaced() {
        // setup
        String machineId = newMachine();
        publish(machineId, windowsReport().toString());
        awaitProcessed();
        ObjectNode later = windowsReport();
        ObjectNode windowsOfTheItem = (ObjectNode) items(later).get(0).get("windows");
        windowsOfTheItem.remove("isDownloaded");

        // execution
        publish(machineId, later.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId)).singleElement()
                .satisfies(pending -> assertThat(pending)
                        .containsEntry("identifier", WINDOWS_PENDING)
                        .doesNotContainKey("downloaded"));
    }

    @Test
    void updateDescribedByTheFirstReport_laterReportsOfThisAndAnotherDeviceDoNotChangeIt() {
        // setup
        String machineId = newMachine();
        String otherMachineId = newMachine();
        Instant firstStoredByNats = publish(machineId, windowsReport().toString());
        awaitProcessed();
        ObjectNode describedOtherwise = windowsReport();
        ObjectNode item = (ObjectNode) items(describedOtherwise).get(0);
        item.put("displayName", "Described otherwise");
        ObjectNode windowsOfTheItem = (ObjectNode) item.get("windows");
        windowsOfTheItem.put("msrcSeverity", "Low");
        windowsOfTheItem.put("maxDownloadBytes", 1);
        windowsOfTheItem.put("rebootBehavior", "NEVER");
        windowsOfTheItem.put("browseOnly", true);
        windowsOfTheItem.putArray("kbArticleIds").add("9999999");
        windowsOfTheItem.putArray("cveIds");
        windowsOfTheItem.putArray("categories");

        // execution
        publish(machineId, describedOtherwise.toString());
        publish(otherMachineId, describedOtherwise.toString());
        awaitProcessed();

        // verifications
        assertThat(osUpdates()).singleElement().satisfies(osUpdate -> {
            assertThat(osUpdate)
                    .containsEntry("identifier", WINDOWS_PENDING)
                    .containsEntry("displayName", WINDOWS_PENDING_NAME)
                    .containsEntry("kbArticleIds", List.of("5051987"))
                    .containsEntry("severity", "CRITICAL")
                    .containsEntry("categories", List.of("Security Updates"))
                    .containsEntry("cveIds", List.of("CVE-2026-21309", "CVE-2026-21311"))
                    .containsEntry("sizeBytes", 764317696L)
                    .containsEntry("rebootBehavior", "ALWAYS")
                    .containsEntry("browseOnly", false);
            assertThat(instant(osUpdate, "firstSeenAt")).isEqualTo(firstStoredByNats);
        });
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(WINDOWS_PENDING);
        assertThat(pendingByIdentifier(otherMachineId)).containsOnlyKeys(WINDOWS_PENDING);
    }

    @Test
    void sameIdentifierInAnotherTenantAndOnAnotherPlatform_oneUpdateEach() {
        // setup
        String windowsMachineId = newMachine();
        String macMachineId = newMachine();
        String otherTenantMachineId = OWN_MACHINES + MACHINES.incrementAndGet();
        saveMachine(otherTenantMachineId, DeviceStatus.ONLINE, OTHER_TENANT_ID);
        ObjectNode windowsReport = windowsReport();
        ((ObjectNode) items(windowsReport).get(0)).put("identifier", "shared-identifier");
        ObjectNode macReport = fixture(MAC_UPDATES_AVAILABLE);
        updates(macReport).putArray("items").add(macItem("shared-identifier", "Mac update", "1.0", "FRESH"));

        // execution
        publish(windowsMachineId, windowsReport.toString());
        publish(macMachineId, macReport.toString());
        publish(otherTenantMachineId, windowsReport.toString());
        awaitProcessed();

        // verifications
        assertThat(osUpdates())
                .extracting(osUpdate -> osUpdate.getString("tenantId"), osUpdate -> osUpdate.getString("platform"),
                        osUpdate -> osUpdate.getString("identifier"), osUpdate -> osUpdate.getString("displayName"))
                .containsExactlyInAnyOrder(
                        tuple(TENANT_ID, "WINDOWS", "shared-identifier", WINDOWS_PENDING_NAME),
                        tuple(TENANT_ID, "MACOS", "shared-identifier", "Mac update"),
                        tuple(OTHER_TENANT_ID, "WINDOWS", "shared-identifier", WINDOWS_PENDING_NAME));
        assertThat(pendingRows(otherTenantMachineId)).singleElement()
                .satisfies(pending -> assertThat(pending).containsEntry("tenantId", OTHER_TENANT_ID));
        assertThat(osState(otherTenantMachineId)).containsEntry("tenantId", OTHER_TENANT_ID);
        assertThat(historyRows(otherTenantMachineId)).singleElement()
                .satisfies(entry -> assertThat(entry).containsEntry("tenantId", OTHER_TENANT_ID));
    }

    @Test
    void sameIdentifierTwiceInOneReport_oneUpdateAndOnePendingUpdateOfTheFirstMention_reportAcknowledged() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(MAC_UPDATES_AVAILABLE);
        updates(report).putArray("items")
                .add(macItem(MAC_SAFARI, "Safari", "18.2", "FRESH"))
                .add(macItem(MAC_SAFARI, "Safari", "18.2", "HELD_OVER"));

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingRows(machineId))
                .extracting(pending -> pending.getString("identifier"), pending -> pending.getString("macosPresence"))
                .containsExactly(tuple(MAC_SAFARI, "FRESH"));
        assertThat(osUpdates()).extracting(osUpdate -> osUpdate.getString("identifier")).containsExactly(MAC_SAFARI);
        assertNothingLeftForRedelivery();
    }

    @Test
    void itemsWithoutAnIdentifier_skipped_theOthersStored() {
        // setup
        String machineId = newMachine();
        ObjectNode report = fixture(MAC_UPDATES_AVAILABLE);
        ArrayNode items = updates(report).putArray("items");
        items.add(macItem(MAC_SAFARI, "Safari", "18.2", "FRESH"));
        items.addObject().put("displayName", "No identifier");
        items.add(macItem(" ", "Blank identifier", "1.0", "FRESH"));
        items.addNull();

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(MAC_SAFARI);
        assertThat(osUpdates()).extracting(osUpdate -> osUpdate.getString("identifier")).containsExactly(MAC_SAFARI);
    }

    @Test
    void sameHistoryEntryInSeveralReports_storedOnce_andAShorterHistoryDeletesNothing() {
        // setup
        String machineId = newMachine();
        publish(machineId, windowsReport().toString());
        awaitProcessed();
        ObjectNode withOneMore = windowsReport();
        history(withOneMore).add(historyEntry("11112222-3333-4444-5555-666677778888", 200,
                TWO_STEPS_AGO.toString(), "INSTALL", "FAILED", 2149842967L));
        ObjectNode withoutHistory = windowsReport();
        history(withoutHistory).removeAll();

        // execution
        publish(machineId, withOneMore.toString());
        publish(machineId, withOneMore.toString());
        publish(machineId, withoutHistory.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId))
                .extracting(entry -> entry.getString("identifier"), entry -> entry.getString("result"),
                        entry -> entry.getString("errorCode"), entry -> instant(entry, "installedAt"))
                .containsExactlyInAnyOrder(
                        tuple(WINDOWS_INSTALLED, "SUCCEEDED", null, WINDOWS_INSTALLED_AT),
                        tuple("11112222-3333-4444-5555-666677778888:200", "FAILED", "0x80240017",
                                TWO_STEPS_AGO));
    }

    @Test
    void historyEntriesWithoutUpdateIdOrInstallTime_skipped_sameUpdateInstalledAndUninstalledKeptApart() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        ArrayNode history = history(report);
        history.removeAll();
        history.add(historyEntry("aaaa0000-0000-0000-0000-000000000001", 3, stepsAgo(4).toString(),
                "INSTALL", "SUCCEEDED", 0L));
        history.add(historyEntry("aaaa0000-0000-0000-0000-000000000001", 3, stepsAgo(4).toString(),
                "UNINSTALL", "SUCCEEDED", 0L));
        history.add(historyEntry(null, 1, stepsAgo(3).toString(), "INSTALL", "SUCCEEDED", 0L));
        history.add(historyEntry("aaaa0000-0000-0000-0000-000000000002", 1, null, "INSTALL", "SUCCEEDED", 0L));
        history.add(historyEntry("aaaa0000-0000-0000-0000-000000000003", null, TWO_STEPS_AGO.toString(),
                "REPAIR", "HALF_DONE", -2145124329L));

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId))
                .extracting(entry -> entry.getString("identifier"), entry -> entry.getString("operation"),
                        entry -> entry.getString("result"), entry -> entry.getString("errorCode"))
                .containsExactlyInAnyOrder(
                        tuple("aaaa0000-0000-0000-0000-000000000001:3", "INSTALL", "SUCCEEDED", null),
                        tuple("aaaa0000-0000-0000-0000-000000000001:3", "UNINSTALL", "SUCCEEDED", null),
                        tuple("aaaa0000-0000-0000-0000-000000000003", null, null, "0x80240017"));
        assertNothingLeftForRedelivery();
    }

    @Test
    void installStoredForTheFirstTime_publishedToTheLogsOnceUnderTheMachineId_laterReportsPublishNothingMore() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        history(report).add(historyEntry("eeee0000-0000-0000-0000-000000000001", 7, TWO_STEPS_AGO.toString(),
                "UNINSTALL", "FAILED", 2149842967L));
        String firstEntryKey = WINDOWS_INSTALLED + "|" + WINDOWS_INSTALLED_AT.toEpochMilli() + "|INSTALL";
        String secondEntryKey = "eeee0000-0000-0000-0000-000000000001:7|" + TWO_STEPS_AGO.toEpochMilli() + "|UNINSTALL";

        // execution
        long sequence = store(machineId, report.toString());
        awaitProcessed();
        deliverAgain(machineId, sequence);
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        verify(eventLogsPublisher, times(2))
                .publish(eq(machineId), logEventCaptor.capture(), logHeadersCaptor.capture());
        assertThat(logHeadersCaptor.getAllValues())
                .containsOnly(Map.of("message-type", "OS_UPDATE_HISTORY_EVENT"));
        assertThat(logEventCaptor.getAllValues())
                .extracting(logEvent -> logField(logEvent, "tenantId"), logEvent -> logField(logEvent, "machineId"),
                        logEvent -> logField(logEvent, "entryKey"), logEvent -> logField(logEvent, "operation"),
                        logEvent -> logField(logEvent, "result"), logEvent -> logField(logEvent, "errorCode"),
                        logEvent -> logField(logEvent, "installedAt"))
                .containsExactlyInAnyOrder(
                        tuple(TENANT_ID, machineId, firstEntryKey, "INSTALL", "SUCCEEDED", null,
                                String.valueOf(WINDOWS_INSTALLED_AT.toEpochMilli())),
                        tuple(TENANT_ID, machineId, secondEntryKey, "UNINSTALL", "FAILED", "0x80240017",
                                String.valueOf(TWO_STEPS_AGO.toEpochMilli())));
        assertThat(historyRows(machineId)).hasSize(2);
    }

    @Test
    void installsNotStoredOrOfAnUnknownOutcome_notPublishedToTheLogs() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        ArrayNode history = history(report);
        history.removeAll();
        history.add(historyEntry("ffff0000-0000-0000-0000-000000000001", 1, ago(RETENTION.plusHours(1)).toString(),
                "INSTALL", "SUCCEEDED", 0L));
        history.add(historyEntry("ffff0000-0000-0000-0000-000000000002", 1, stepsAgo(3).toString(),
                "REPAIR", "SUCCEEDED", 0L));
        history.add(historyEntry("ffff0000-0000-0000-0000-000000000003", 1, stepsAgo(3).toString(),
                "INSTALL", "HALF_DONE", 0L));

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId)).extracting(entry -> entry.getString("identifier"))
                .containsExactlyInAnyOrder("ffff0000-0000-0000-0000-000000000002:1",
                        "ffff0000-0000-0000-0000-000000000003:1");
        verify(eventLogsPublisher, never())
                .publish(eq(machineId), logEventCaptor.capture(), logHeadersCaptor.capture());
    }

    @Test
    void sameInstallTwiceInOneReport_oneHistoryEntryOfTheFirstMention_reportAcknowledged() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        ObjectNode again = (ObjectNode) history(report).get(0).deepCopy();
        again.put("title", "Named again");
        history(report).add(again);

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId))
                .extracting(entry -> entry.getString("identifier"), entry -> entry.getString("title"))
                .containsExactly(tuple(WINDOWS_INSTALLED, WINDOWS_INSTALLED_TITLE));
        assertNothingLeftForRedelivery();
    }

    @Test
    void installOlderThanTheRetention_notStored_theOneInsideTheRetentionIs() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        ArrayNode history = history(report);
        history.removeAll();
        history.add(historyEntry("dddd0000-0000-0000-0000-000000000001", 1, ago(RETENTION.plusHours(1)).toString(),
                "INSTALL", "SUCCEEDED", 0L));
        history.add(historyEntry("dddd0000-0000-0000-0000-000000000002", 1, ago(RETENTION.minusHours(1)).toString(),
                "INSTALL", "SUCCEEDED", 0L));

        // execution
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId)).extracting(entry -> entry.getString("identifier"))
                .containsExactly("dddd0000-0000-0000-0000-000000000002:1");
        assertNothingLeftForRedelivery();
    }

    @Test
    void oneHundredAndTwentyHistoryEntries_allStored_eachOnce() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        ArrayNode history = history(report);
        history.removeAll();
        Instant firstInstall = stepsAgo(10);
        Stream.iterate(0, number -> number + 1).limit(120).forEach(number -> history.add(historyEntry(
                "bbbb0000-0000-0000-0000-" + String.format("%012d", number), 1,
                firstInstall.plusSeconds(number).toString(), "INSTALL", "SUCCEEDED", 0L)));

        // execution
        publish(machineId, report.toString());
        publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        assertThat(historyRows(machineId)).hasSize(120)
                .extracting(entry -> entry.getString("identifier")).doesNotHaveDuplicates();
    }

    @Test
    void rebootPending_sinceSetByTheFirstReportThatSaysYes_keptWhileYes_clearedOnNoAndOnUnknown() {
        // setup
        String machineId = newMachine();
        ObjectNode pending = windowsReport();
        pending.put("rebootPending", "YES");
        ObjectNode notPending = windowsReport();
        notPending.put("rebootPending", "NO");
        ObjectNode unknown = windowsReport();
        unknown.put("rebootPending", "UNKNOWN");

        // execution
        Instant firstYes = publish(machineId, pending.toString());
        awaitProcessed();
        Instant sinceAfterTheFirstYes = instant(osState(machineId), "rebootPendingSince");
        Instant secondYes = publish(machineId, pending.toString());
        awaitProcessed();
        Instant sinceAfterTheSecondYes = instant(osState(machineId), "rebootPendingSince");
        publish(machineId, notPending.toString());
        awaitProcessed();
        Document stateAfterNo = osState(machineId);
        Instant yesAgain = publish(machineId, pending.toString());
        awaitProcessed();
        Instant sinceAfterYesAgain = instant(osState(machineId), "rebootPendingSince");
        publish(machineId, unknown.toString());
        awaitProcessed();
        Document stateAfterUnknown = osState(machineId);

        // verifications
        assertThat(secondYes).isAfter(firstYes);
        assertThat(sinceAfterTheFirstYes).isEqualTo(firstYes);
        assertThat(sinceAfterTheSecondYes).isEqualTo(firstYes);
        assertThat(stateAfterNo).containsEntry("rebootPending", "NO").doesNotContainKey("rebootPendingSince");
        assertThat(sinceAfterYesAgain).isEqualTo(yesAgain).isAfter(firstYes);
        assertThat(stateAfterUnknown).containsEntry("rebootPending", "UNKNOWN").doesNotContainKey("rebootPendingSince");
    }

    @Test
    void valuesAndFieldsTheBackendDoesNotKnow_reportApplied_thoseValuesStoredAsNull_reasonsAsTheyCame() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        report.put("rebootPending", "PROBABLY");
        report.put("patchState", "HALF_PATCHED");
        report.put("scanState", "ANCIENT");
        report.put("osUpdateAuthorization", "ASK_LATER");
        report.putObject("fieldOfANewerAgent").put("nested", true);
        ObjectNode manageability = report.putObject("manageability");
        manageability.put("state", "PARTLY_MANAGEABLE");
        manageability.put("since", "2026-11-01T00:00:00Z");
        manageability.putArray("reasons").add("WSUS").add("REASON_OF_A_NEWER_AGENT");
        ObjectNode item = (ObjectNode) items(report).get(0);
        item.put("fieldOfANewerAgent", 1);
        ObjectNode windowsOfTheItem = (ObjectNode) item.get("windows");
        windowsOfTheItem.put("msrcSeverity", "Catastrophic");
        windowsOfTheItem.put("rebootBehavior", "TWICE");
        ObjectNode entry = (ObjectNode) history(report).get(0);
        entry.put("operation", "REPAIR");
        entry.put("resultCode", "HALF_DONE");

        // execution
        Instant storedByNats = publish(machineId, report.toString());
        awaitProcessed();

        // verifications
        Document osState = osState(machineId);
        assertThat(osState)
                .containsEntry("osVersion", "11 24H2")
                .containsEntry("pendingUpdatesConfidence", "CONFIRMED")
                .doesNotContainKeys("rebootPending", "rebootPendingSince", "patchState", "scanState",
                        "osUpdateAuthorization", "fieldOfANewerAgent");
        assertThat(instant(osState, "receivedAt")).isEqualTo(storedByNats);
        assertThat(osState.get("manageability", Document.class))
                .containsEntry("reasons", List.of("WSUS", "REASON_OF_A_NEWER_AGENT"))
                .doesNotContainKeys("state", "since");
        assertThat(osUpdates()).singleElement().satisfies(osUpdate -> assertThat(osUpdate)
                .containsEntry("identifier", WINDOWS_PENDING)
                .containsEntry("kbArticleIds", List.of("5051987"))
                .doesNotContainKeys("severity", "rebootBehavior", "fieldOfANewerAgent"));
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(WINDOWS_PENDING);
        assertThat(historyRows(machineId)).singleElement().satisfies(stored -> assertThat(stored)
                .containsEntry("identifier", WINDOWS_INSTALLED)
                .doesNotContainKeys("operation", "result"));
        assertNothingLeftForRedelivery();
    }

    @Test
    void reports_changeNothingInTheDeviceDocument() {
        // setup
        String machineId = newMachine();
        machines().updateOne(Filters.eq("machineId", machineId), new Document("$set",
                new Document("osVersion", "of the device").append("osBuild", "of the device")));
        Document machineBefore = machine(machineId);

        // execution
        publish(machineId, windowsReport().toString());
        awaitProcessed();

        // verifications
        assertThat(osState(machineId)).containsEntry("osVersion", "11 24H2");
        assertThat(machine(machineId)).isEqualTo(machineBefore);
    }

    @Test
    void reportStoredByNatsEarlierThanTheStateAlreadyStored_changesNothing() {
        // setup
        String machineId = newMachine();
        Date appliedReportStoredAt = Date.from(Instant.now().plus(1, ChronoUnit.DAYS));
        stateCollection().insertOne(new Document("tenantId", TENANT_ID).append("machineId", machineId)
                .append("platform", "WINDOWS")
                .append("osVersion", "from the applied report")
                .append("rebootPending", "YES")
                .append("rebootPendingSince", appliedReportStoredAt)
                .append("receivedAt", appliedReportStoredAt));
        Document stateBefore = osState(machineId);

        // execution
        publish(machineId, windowsReport().toString());
        awaitProcessed();

        // verifications
        assertThat(osState(machineId)).isEqualTo(stateBefore);
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
        assertThat(osUpdates()).isEmpty();
        assertNothingLeftForRedelivery();
    }

    @Test
    void olderReportDeliveredAgainAfterANewerOneWasApplied_changesNothing() {
        // setup
        String machineId = newMachine();
        ObjectNode older = windowsReport();
        older.put("rebootPending", "YES");
        history(older).add(historyEntry("cccc0000-0000-0000-0000-000000000001", 1, stepsAgo(6).toString(),
                "INSTALL", "SUCCEEDED", 0L));
        long olderSequence = store(machineId, older.toString());
        awaitProcessed();
        long newerSequence = store(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        Instant newerStoredByNats = storedAt(newerSequence);
        removeFromTheStream(newerSequence);
        historyCollection().deleteMany(Filters.eq("machineId", machineId));
        osUpdateCollection().deleteMany(Filters.eq("identifier", WINDOWS_PENDING));
        Document stateOfTheNewerReport = osState(machineId);
        List<Document> pendingOfTheNewerReport = pendingRows(machineId);

        // execution
        deliverAgain(machineId, olderSequence);

        // verifications
        assertThat(newerStoredByNats).isAfter(storedAt(olderSequence));
        assertThat(osState(machineId)).isEqualTo(stateOfTheNewerReport)
                .containsEntry("platform", "MACOS")
                .doesNotContainKey("rebootPendingSince");
        assertThat(pendingRows(machineId)).containsExactlyInAnyOrderElementsOf(pendingOfTheNewerReport);
        assertThat(pendingByIdentifier(machineId)).containsOnlyKeys(MAC_OS_UPDATE, MAC_XCODE, MAC_SAFARI);
        assertThat(historyRows(machineId)).isEmpty();
        assertThat(osUpdates()).extracting(osUpdate -> osUpdate.getString("identifier"))
                .doesNotContain(WINDOWS_PENDING);
        assertNothingLeftForRedelivery();
    }

    @Test
    void sameReportDeliveredAgain_appliedAgain_nothingChanges() {
        // setup
        String machineId = newMachine();
        ObjectNode report = windowsReport();
        report.put("rebootPending", "YES");
        long sequence = store(machineId, report.toString());
        awaitProcessed();
        Document stateOfTheFirstDelivery = osState(machineId);
        List<Document> pendingOfTheFirstDelivery = pendingRows(machineId);
        List<Document> historyOfTheFirstDelivery = historyRows(machineId);
        List<Document> osUpdatesOfTheFirstDelivery = osUpdates();

        // execution
        deliverAgain(machineId, sequence);
        deliverAgain(machineId, sequence);

        // verifications
        assertThat(instant(stateOfTheFirstDelivery, "receivedAt")).isEqualTo(storedAt(sequence));
        assertThat(instant(stateOfTheFirstDelivery, "rebootPendingSince")).isEqualTo(storedAt(sequence));
        assertThat(withoutVersion(osState(machineId))).isEqualTo(withoutVersion(stateOfTheFirstDelivery));
        assertThat(osState(machineId)).containsEntry("_id", stateOfTheFirstDelivery.get("_id"));
        assertThat(pendingRows(machineId)).hasSize(1).containsExactlyElementsOf(pendingOfTheFirstDelivery);
        assertThat(historyRows(machineId)).hasSize(1).containsExactlyElementsOf(historyOfTheFirstDelivery);
        assertThat(osUpdates()).hasSize(1).containsExactlyElementsOf(osUpdatesOfTheFirstDelivery);
        assertNothingLeftForRedelivery();
    }

    @Test
    void reportDeliveredAgainAfterItsPendingUpdatesAndHistoryWereLost_writtenAgainWithTheSameDiscoveredAt() {
        // setup
        String machineId = newMachine();
        long sequence = store(machineId, windowsReport().toString());
        awaitProcessed();
        pendingCollection().deleteMany(Filters.eq("machineId", machineId));
        historyCollection().deleteMany(Filters.eq("machineId", machineId));
        osUpdateCollection().deleteMany(new Document());

        // execution
        deliverAgain(machineId, sequence);

        // verifications
        assertThat(pendingRows(machineId)).singleElement().satisfies(pending -> {
            assertThat(pending).containsEntry("identifier", WINDOWS_PENDING);
            assertThat(instant(pending, "discoveredAt")).isEqualTo(storedAt(sequence));
        });
        assertThat(historyRows(machineId)).singleElement()
                .satisfies(entry -> assertThat(entry).containsEntry("identifier", WINDOWS_INSTALLED));
        assertThat(osUpdates()).singleElement()
                .satisfies(osUpdate -> assertThat(osUpdate).containsEntry("identifier", WINDOWS_PENDING));
        assertThat(instant(osState(machineId), "receivedAt")).isEqualTo(storedAt(sequence));
    }

    @Test
    void reportThatFailsWhileItsHistoryIsSaved_notAcknowledged_deliveredAgainByNatsAndAppliedInFull() {
        // setup
        String machineId = newMachine();
        refuseEveryHistoryWrite();

        // execution
        long sequence = store(machineId, windowsReport().toString());
        await().atMost(FIRST_WAIT).untilAsserted(() -> assertThat(stateDocuments(machineId)).hasSize(1));
        await().atMost(FIRST_WAIT).untilAsserted(() ->
                assertThat(consumerInfo(onlyConsumer()).getNumAckPending())
                        .as("reports delivered and not acknowledged").isEqualTo(1));
        acceptHistoryWrites();
        List<Document> historyWhileRefused = historyRows(machineId);
        await().atMost(REDELIVERY_WAIT).pollInterval(Duration.ofMillis(250)).untilAsserted(() ->
                assertThat(consumerInfo(onlyConsumer()).getNumAckPending()).isZero());

        // verifications
        assertThat(historyWhileRefused).isEmpty();
        assertThat(historyRows(machineId)).singleElement()
                .satisfies(entry -> assertThat(entry).containsEntry("identifier", WINDOWS_INSTALLED));
        assertThat(pendingRows(machineId)).singleElement().satisfies(pending ->
                assertThat(instant(pending, "discoveredAt")).isEqualTo(storedAt(sequence)));
        assertThat(instant(osState(machineId), "receivedAt")).isEqualTo(storedAt(sequence));
    }

    static Stream<String> malformedReports() {
        ObjectNode unknownPlatform = windowsReport();
        unknownPlatform.put("platform", "LINUX");
        ObjectNode withoutPlatform = windowsReport();
        withoutPlatform.remove("platform");
        ObjectNode nullPlatform = windowsReport();
        nullPlatform.putNull("platform");
        ObjectNode timestampOfTheWrongFormat = windowsReport();
        timestampOfTheWrongFormat.put("lastScanAt", "yesterday");
        ObjectNode updatesOfTheWrongType = windowsReport();
        updatesOfTheWrongType.put("updates", "none");
        return Stream.of(
                "{\"platform\": \"WINDOWS\"",
                "not json",
                "",
                "null",
                "[]",
                "\"text\"",
                "{}",
                unknownPlatform.toString(),
                withoutPlatform.toString(),
                nullPlatform.toString(),
                timestampOfTheWrongFormat.toString(),
                updatesOfTheWrongType.toString());
    }

    @ParameterizedTest
    @MethodSource("malformedReports")
    void malformedReport_changesNothing_isNotRedelivered_andTheNextValidReportIsApplied(String malformed) {
        // setup
        String machineId = newMachine();
        Instant firstStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_AVAILABLE));
        awaitProcessed();
        Document stateBefore = osState(machineId);
        List<Document> pendingBefore = pendingRows(machineId);

        // execution
        publish(machineId, malformed);
        awaitProcessed();
        Document stateAfterMalformed = osState(machineId);
        List<Document> pendingAfterMalformed = pendingRows(machineId);
        assertNothingLeftForRedelivery();
        Instant nextStoredByNats = publish(machineId, fixtureText(MAC_UPDATES_UNREADABLE));
        awaitProcessed();

        // verifications
        assertThat(instant(stateBefore, "receivedAt")).isEqualTo(firstStoredByNats);
        assertThat(stateAfterMalformed).isEqualTo(stateBefore);
        assertThat(pendingAfterMalformed).containsExactlyInAnyOrderElementsOf(pendingBefore);
        assertThat(historyRows(machineId)).isEmpty();
        assertThat(osState(machineId)).containsEntry("pendingUpdatesConfidence", "UNREADABLE");
        assertThat(instant(osState(machineId), "receivedAt")).isEqualTo(nextStoredByNats);
    }

    @Test
    void reportOfAnUnknownMachine_storesNothing_isNotRedelivered() {
        // setup
        String unknownMachineId = OWN_MACHINES + "unknown-" + UUID.randomUUID();

        // execution
        publish(unknownMachineId, windowsReport().toString());
        awaitProcessed();

        // verifications
        assertThat(machine(unknownMachineId)).isNull();
        assertThat(stateDocuments(unknownMachineId)).isEmpty();
        assertThat(pendingRows(unknownMachineId)).isEmpty();
        assertThat(historyRows(unknownMachineId)).isEmpty();
        assertThat(osUpdates()).isEmpty();
        assertNothingLeftForRedelivery();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void reportOfAMachineInAFrozenStatus_ignored_isNotRedelivered(DeviceStatus frozen) {
        // setup
        String machineId = OWN_MACHINES + MACHINES.incrementAndGet();
        saveMachine(machineId, frozen, TENANT_ID);

        // execution
        publish(machineId, windowsReport().toString());
        awaitProcessed();

        // verifications
        assertThat(stateDocuments(machineId)).isEmpty();
        assertThat(machine(machineId).getString("status")).isEqualTo(frozen.name());
        assertThat(pendingRows(machineId)).isEmpty();
        assertThat(historyRows(machineId)).isEmpty();
        assertThat(osUpdates()).isEmpty();
        assertNothingLeftForRedelivery();
    }

    @Test
    void deletedMachineCleanup_removesTheStateThePendingUpdatesAndTheHistoryOfThatMachineOnly_updatesStay() {
        // setup
        String deletedMachineId = newMachine();
        String keptMachineId = newMachine();
        publish(deletedMachineId, windowsReport().toString());
        publish(keptMachineId, windowsReport().toString());
        awaitProcessed();
        List<Document> osUpdatesBefore = osUpdates();

        // execution
        deletedMachineCleanup.cleanUpDeletedMachine(TENANT_ID, deletedMachineId);

        // verifications
        assertThat(stateDocuments(deletedMachineId)).isEmpty();
        assertThat(pendingRows(deletedMachineId)).isEmpty();
        assertThat(historyRows(deletedMachineId)).isEmpty();
        assertThat(stateDocuments(keptMachineId)).hasSize(1);
        assertThat(pendingRows(keptMachineId)).hasSize(1);
        assertThat(historyRows(keptMachineId)).hasSize(1);
        assertThat(osUpdatesBefore).hasSize(1);
        assertThat(osUpdates()).containsExactlyElementsOf(osUpdatesBefore);
    }

    @Test
    void featureCollections_haveTheirUniqueKeysTheHistoryReadIndexAndTheHistoryTtlOfItsRetention() {
        // setup

        // execution
        List<Document> stateIndexes = stateCollection().listIndexes().into(new ArrayList<>());
        List<Document> pendingIndexes = pendingCollection().listIndexes().into(new ArrayList<>());
        List<Document> osUpdateIndexes = osUpdateCollection().listIndexes().into(new ArrayList<>());
        List<Document> historyIndexes = historyCollection().listIndexes().into(new ArrayList<>());

        // verifications
        assertThat(uniqueKeys(stateIndexes)).containsExactly("{\"tenantId\": 1, \"machineId\": 1}");
        assertThat(uniqueKeys(pendingIndexes))
                .containsExactly("{\"tenantId\": 1, \"machineId\": 1, \"identifier\": 1}");
        assertThat(uniqueKeys(osUpdateIndexes))
                .containsExactly("{\"tenantId\": 1, \"platform\": 1, \"identifier\": 1}");
        assertThat(uniqueKeys(historyIndexes))
                .containsExactly("{\"tenantId\": 1, \"machineId\": 1, \"entryKey\": 1}");
        assertThat(keys(historyIndexes))
                .contains("{\"tenantId\": 1, \"machineId\": 1, \"installedAt\": -1, \"_id\": -1}");
        assertThat(historyIndexes)
                .filteredOn(index -> "device_os_update_history_ttl".equals(index.getString("name")))
                .singleElement()
                .satisfies(ttlIndex -> {
                    assertThat(ttlIndex).containsEntry("key", new Document("installedAt", 1));
                    assertThat(ttlIndex.get("expireAfterSeconds", Number.class).longValue())
                            .isEqualTo(RETENTION.toSeconds());
                });
    }

    private Instant publish(String machineId, String report) {
        return storedAt(store(machineId, report));
    }

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

    // WARNING: the redelivery consumer hands over every report of the machine from the given sequence on, so a
    // report stored later has to leave the stream for the earlier one to be delivered alone
    private void removeFromTheStream(long sequence) {
        try {
            natsConnection.jetStreamManagement().deleteMessage(OS_UPDATES_STREAM, sequence);
        } catch (IOException | JetStreamApiException e) {
            throw new IllegalStateException(e);
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

    private long handledReports(String outcome) {
        return meterRegistry.timer("openframe.rmm.os_update.report.duration", "outcome", outcome).count();
    }

    private void assertNothingLeftForRedelivery() {
        String consumer = onlyConsumer();
        await().atMost(Duration.ofSeconds(3)).untilAsserted(() ->
                assertThat(consumerInfo(consumer).getNumAckPending())
                        .as("reports delivered and not acknowledged").isZero());
    }

    private void refuseEveryHistoryWrite() {
        Document neverTrue = new Document("refusedByTheTest", new Document("$exists", true));
        mongoTemplate.getDb().runCommand(new Document("collMod", "device_os_update_history")
                .append("validator", neverTrue).append("validationLevel", "strict"));
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
        return mongoTemplate.getCollection("device_os_pending_updates");
    }

    private MongoCollection<Document> osUpdateCollection() {
        return mongoTemplate.getCollection("os_updates");
    }

    private MongoCollection<Document> historyCollection() {
        return mongoTemplate.getCollection("device_os_update_history");
    }

    private Document machine(String machineId) {
        return machines().find(Filters.eq("machineId", machineId)).first();
    }

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

    private List<Document> osUpdates() {
        return osUpdateCollection().find().into(new ArrayList<>());
    }

    private Map<String, Document> pendingByIdentifier(String machineId) {
        return pendingRows(machineId).stream()
                .collect(Collectors.toMap(pending -> pending.getString("identifier"), pending -> pending));
    }

    private static String logField(CommonDebeziumMessage logEvent, String field) {
        JsonNode value = logEvent.getPayload().getAfter().get(field);
        return value == null ? null : value.asString();
    }

    private static Document withoutVersion(Document state) {
        Document copy = new Document(state);
        copy.remove("version");
        return copy;
    }

    private static Instant instant(Document document, String field) {
        Date date = document.getDate(field);
        return date == null ? null : date.toInstant();
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

    private static ObjectNode windowsReport() {
        ObjectNode report = fixture(WINDOWS_MANAGED_BY_WSUS);
        ((ObjectNode) history(report).get(0)).put("installedAt", WINDOWS_INSTALLED_AT.toString());
        return report;
    }

    // forty steps make the retention of the history: any step count below forty is inside it
    private static Instant stepsAgo(int steps) {
        return ago(RETENTION.dividedBy(40).multipliedBy(steps));
    }

    private static Instant ago(Duration duration) {
        return Instant.now().truncatedTo(ChronoUnit.SECONDS).minus(duration);
    }

    private static ObjectNode updates(ObjectNode report) {
        return (ObjectNode) report.get("updates");
    }

    private static ArrayNode items(ObjectNode report) {
        return (ArrayNode) updates(report).get("items");
    }

    private static ArrayNode history(ObjectNode report) {
        return (ArrayNode) report.get("windows").get("history");
    }

    private static ObjectNode macItem(String identifier, String displayName, String displayVersion, String presence) {
        ObjectNode item = JSON.createObjectNode();
        item.put("identifier", identifier);
        item.put("displayName", displayName);
        item.put("displayVersion", displayVersion);
        item.putObject("macos").put("presence", presence);
        return item;
    }

    private static ObjectNode historyEntry(String updateId, Integer revision, String installedAt,
                                           String operation, String resultCode, Long hresult) {
        ObjectNode entry = JSON.createObjectNode();
        entry.put("updateId", updateId);
        entry.put("revision", revision);
        entry.put("title", "Update " + updateId);
        entry.put("installedAt", installedAt);
        entry.put("operation", operation);
        entry.put("resultCode", resultCode);
        entry.put("hresult", hresult);
        return entry;
    }
}

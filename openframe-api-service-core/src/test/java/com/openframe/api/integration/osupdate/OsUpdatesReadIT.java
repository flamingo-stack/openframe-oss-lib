package com.openframe.api.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.bson.Document;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.util.ClassUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.tenant-isolation.enabled=true"
        })
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsUpdatesReadIT extends BaseMongoIntegrationTest {

    private static final String OTHER_TENANT_ID = "tenant-b";
    private static final String OWN_MACHINES = "os-updates-read-";
    private static final String WIN_1 = OWN_MACHINES + "win-1";
    private static final String WIN_2 = OWN_MACHINES + "win-2";
    private static final String WIN_NOT_MANAGEABLE = OWN_MACHINES + "win-3";
    private static final String WIN_4 = OWN_MACHINES + "win-4";
    private static final String MAC_1 = OWN_MACHINES + "mac-1";
    private static final String GONE = OWN_MACHINES + "gone";
    private static final String OTHER_TENANT_MACHINE = OWN_MACHINES + "of-tenant-b";

    private static final String ORG_A = "org-a";
    private static final String ORG_B = "org-b";
    private static final String ORG_WITHOUT_DEVICES = "org-without-devices";

    private static final String CUMULATIVE = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String CUMULATIVE_NAME = "2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)";
    private static final String DRIVER = "0d1e2f3a-5555-4666-8777-112233445566:1";
    private static final String SAFARI = "Safari-18.2";
    private static final String UNKNOWN_ID = "6aff19c07ce86a3f0386ff82";

    private static final String NEWEST_SEEN = "2026-11-20T09:14:03.120Z";
    private static final String MIDDLE_SEEN = "2026-11-19T07:02:11Z";
    private static final String OLDEST_SEEN = "2026-11-18T07:02:11Z";
    private static final String ENRICHED_AT = "2026-11-21T08:25:00Z";
    // WARNING: history rows older than the retention are deleted by the TTL monitor where the collection has its
    // TTL index, so every install time of this class is counted from now
    private static final String LATER_INSTALL = stepsAgo(3);
    private static final String EARLIER_INSTALL = stepsAgo(20);
    private static final String EARLIEST_INSTALL = stepsAgo(25);

    private static final String OS_UPDATES = """
            query($filter: OsUpdateFilterInput, $first: Int, $after: String) {
              osUpdates(filter: $filter, first: $first, after: $after) {
                edges { cursor node {
                  id platform identifier displayName displayVersion kbArticleIds severity categories categoryIds
                  updateType classification cveIds publishedAt sizeBytes rebootBehavior browseOnly firstSeenAt
                  cvssScore exploited enrichedAt
                  pendingDeviceCount installedDeviceCount
                } }
                pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
              }
            }
            """;
    private static final String OS_UPDATE = """
            query($id: ID!) {
              osUpdate(id: $id) { id identifier classification pendingDeviceCount installedDeviceCount }
            }
            """;
    private static final String DEVICES = """
            query($osUpdateId: ID!, $status: OsUpdateDeviceStatus!, $organizationIds: [String!], $first: Int,
                  $after: String) {
              osUpdateDevices(osUpdateId: $osUpdateId, status: $status, organizationIds: $organizationIds,
                  first: $first, after: $after) {
                edges { cursor node { machineId status discoveredAt installedAt machine { machineId hostname } } }
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

    @MockitoSpyBean
    private OsUpdateService osUpdateService;

    @MockitoSpyBean
    private DeviceService deviceService;

    private String cumulativeId;
    private String driverId;
    private String safariId;
    private String otherTenantCumulativeId;

    // WARNING: deleteMany, not drop: the unique indexes of the feature collections must outlive a test
    @BeforeEach
    void storeTheUpdatesAndDevicesOfTheTenant() {
        machines().deleteMany(new Document("machineId", new Document("$regex", "^" + OWN_MACHINES)));
        stateCollection().deleteMany(new Document());
        pendingCollection().deleteMany(new Document());
        historyCollection().deleteMany(new Document());
        osUpdateCollection().deleteMany(new Document());

        Stream.of(WIN_1, WIN_NOT_MANAGEABLE)
                .forEach(machineId -> machines().insertOne(machine(machineId, TENANT_ID, ORG_A)));
        Stream.of(WIN_2, WIN_4, MAC_1)
                .forEach(machineId -> machines().insertOne(machine(machineId, TENANT_ID, ORG_B)));
        machines().insertOne(machine(OTHER_TENANT_MACHINE, OTHER_TENANT_ID, ORG_A));
        stateCollection().insertOne(state(WIN_1, TENANT_ID, "MANAGEABLE"));
        stateCollection().insertOne(state(WIN_NOT_MANAGEABLE, TENANT_ID, "NOT_MANAGEABLE"));
        stateCollection().insertOne(state(OTHER_TENANT_MACHINE, OTHER_TENANT_ID, "MANAGEABLE"));

        cumulativeId = saveOsUpdate(cumulative(TENANT_ID));
        driverId = saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", DRIVER, "Intel - Display - 31.0.101.5186", MIDDLE_SEEN)
                .append("updateType", "DRIVER").append("classification", "DRIVER"));
        safariId = saveOsUpdate(osUpdate(TENANT_ID, "MACOS", SAFARI, "Safari", OLDEST_SEEN)
                .append("displayVersion", "18.2").append("classification", "OTHER"));
        otherTenantCumulativeId = saveOsUpdate(cumulative(OTHER_TENANT_ID));

        pendingCollection().insertMany(List.of(
                pendingUpdate(WIN_1, TENANT_ID, "WINDOWS", CUMULATIVE, MIDDLE_SEEN),
                pendingUpdate(WIN_2, TENANT_ID, "WINDOWS", CUMULATIVE, NEWEST_SEEN),
                pendingUpdate(WIN_NOT_MANAGEABLE, TENANT_ID, "WINDOWS", CUMULATIVE, NEWEST_SEEN),
                pendingUpdate(WIN_1, TENANT_ID, "WINDOWS", DRIVER, MIDDLE_SEEN),
                pendingUpdate(MAC_1, TENANT_ID, "MACOS", SAFARI, OLDEST_SEEN),
                pendingUpdate(OTHER_TENANT_MACHINE, OTHER_TENANT_ID, "WINDOWS", CUMULATIVE, NEWEST_SEEN)));
        historyCollection().insertMany(List.of(
                historyEntry(WIN_4, TENANT_ID, CUMULATIVE, EARLIEST_INSTALL, "INSTALL", "SUCCEEDED"),
                historyEntry(WIN_4, TENANT_ID, CUMULATIVE, EARLIER_INSTALL, "INSTALL", "SUCCEEDED"),
                historyEntry(WIN_1, TENANT_ID, CUMULATIVE, LATER_INSTALL, "INSTALL", "SUCCEEDED_WITH_ERRORS"),
                historyEntry(WIN_2, TENANT_ID, CUMULATIVE, LATER_INSTALL, "INSTALL", "FAILED"),
                historyEntry(WIN_NOT_MANAGEABLE, TENANT_ID, CUMULATIVE, LATER_INSTALL, "UNINSTALL", "SUCCEEDED"),
                historyEntry(GONE, TENANT_ID, CUMULATIVE, EARLIEST_INSTALL, "INSTALL", "SUCCEEDED"),
                historyEntry(OTHER_TENANT_MACHINE, OTHER_TENANT_ID, CUMULATIVE, LATER_INSTALL, "INSTALL", "SUCCEEDED")));
        clearInvocations(osUpdateService);
    }

    @Test
    void osUpdateFlagOn_tenantWideReadSideRuns() {
        // setup

        // execution
        List<String> beans = Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType).filter(Objects::nonNull)
                .map(ClassUtils::getUserClass).map(Class::getSimpleName).toList();

        // verifications
        assertThat(beans).contains("OsUpdateDataFetcher", "OsUpdateService", "OsUpdateDeviceService", "OsUpdateResponseMapper",
                "OsUpdateGraphQLMapper", "OsUpdateDeviceCountsDataLoader");
    }

    @Test
    void osUpdates_updatesOfTheTenant_latestSeenFirst_withBothCountsLoadedInOneBatch() {
        // setup

        // execution
        Page page = osUpdates(null, null, null);

        // verifications
        assertThat(page.nodes())
                .extracting(node -> node.get("identifier"), node -> node.get("pendingDeviceCount"),
                        node -> node.get("installedDeviceCount"))
                .containsExactly(tuple(CUMULATIVE, 2, 3), tuple(DRIVER, 1, 0), tuple(SAFARI, 1, 0));
        assertThat(page.hasNextPage()).isFalse();
        verify(osUpdateService).countDevices(List.of(cumulativeId, driverId, safariId), OsUpdateDeviceScope.EVERY_DEVICE);
    }

    @Test
    void osUpdates_windowsUpdate_everyFieldReturned() {
        // setup
        Map<String, Object> expected = new HashMap<>();
        expected.put("id", cumulativeId);
        expected.put("platform", "WINDOWS");
        expected.put("identifier", CUMULATIVE);
        expected.put("displayName", CUMULATIVE_NAME);
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
        expected.put("firstSeenAt", NEWEST_SEEN);
        expected.put("cvssScore", 9.8);
        expected.put("exploited", true);
        expected.put("enrichedAt", ENRICHED_AT);
        expected.put("pendingDeviceCount", 2);
        expected.put("installedDeviceCount", 3);

        // execution
        Page page = osUpdates(Map.of("search", "KB5051987"), null, null);

        // verifications
        assertThat(page.nodes()).singleElement()
                .satisfies(node -> assertThat(node).containsExactlyInAnyOrderEntriesOf(expected));
    }

    @Test
    void osUpdates_updateStoredBeforeClassificationExisted_listsEmptyAndTheNewFieldsNull() {
        // setup
        saveOsUpdate(new Document("tenantId", TENANT_ID)
                .append("platform", "WINDOWS")
                .append("identifier", "stored-by-an-earlier-version")
                .append("displayName", "Stored by an earlier version")
                .append("firstSeenAt", date(OLDEST_SEEN)));

        // execution
        Page page = osUpdates(Map.of("search", "earlier version"), null, null);

        // verifications
        assertThat(page.nodes()).singleElement().satisfies(node -> assertThat(node)
                .containsEntry("categoryIds", List.of())
                .containsEntry("classification", null)
                .containsEntry("updateType", null)
                .containsEntry("cvssScore", null)
                .containsEntry("exploited", null)
                .containsEntry("enrichedAt", null)
                .containsEntry("pendingDeviceCount", 0)
                .containsEntry("installedDeviceCount", 0));
    }

    @Test
    void osUpdates_filters_platformClassificationsAndSearchEachNarrowTheList() {
        // setup
        Map<String, Object> securityAndDrivers = Map.of("classifications", List.of("SECURITY", "DRIVER"));
        Map<String, Object> driversOfMacos = Map.of("platform", "MACOS", "classifications", List.of("DRIVER"));

        // execution
        Page macos = osUpdates(Map.of("platform", "MACOS"), null, null);
        Page bySecurityAndDrivers = osUpdates(securityAndDrivers, null, null);
        Page byBoth = osUpdates(driversOfMacos, null, null);
        Page byName = osUpdates(Map.of("search", "intel - display"), null, null);
        Page byKbId = osUpdates(Map.of("search", "50519"), null, null);
        Page byCveId = osUpdates(Map.of("search", "cve-2026-21311"), null, null);
        Page byPattern = osUpdates(Map.of("search", ".*"), null, null);

        // verifications
        assertThat(identifiers(macos)).containsExactly(SAFARI);
        assertThat(identifiers(bySecurityAndDrivers)).containsExactly(CUMULATIVE, DRIVER);
        assertThat(identifiers(byBoth)).isEmpty();
        assertThat(identifiers(byName)).containsExactly(DRIVER);
        assertThat(identifiers(byKbId)).containsExactly(CUMULATIVE);
        assertThat(identifiers(byCveId)).containsExactly(CUMULATIVE);
        assertThat(identifiers(byPattern)).isEmpty();
    }

    @Test
    void osUpdates_inPagesOfTwo_everyUpdateOnce_countsLoadedOncePerPage() {
        // setup

        // execution
        Page firstPage = osUpdates(null, 2, null);
        Page secondPage = osUpdates(null, 2, firstPage.endCursor());

        // verifications
        assertThat(identifiers(firstPage)).containsExactly(CUMULATIVE, DRIVER);
        assertThat(firstPage.hasNextPage()).isTrue();
        assertThat(firstPage.hasPreviousPage()).isFalse();
        assertThat(firstPage.endCursor()).isEqualTo(firstPage.cursors().getLast());
        assertThat(identifiers(secondPage)).containsExactly(SAFARI);
        assertThat(secondPage.hasNextPage()).isFalse();
        assertThat(secondPage.hasPreviousPage()).isTrue();
        verify(osUpdateService).countDevices(List.of(cumulativeId, driverId), OsUpdateDeviceScope.EVERY_DEVICE);
        verify(osUpdateService).countDevices(List.of(safariId), OsUpdateDeviceScope.EVERY_DEVICE);
    }

    @Test
    void osUpdates_updatesSeenAtTheSameInstant_splitOverPagesWithoutLossOrRepeat() {
        // setup
        osUpdateCollection().deleteMany(new Document());
        List<String> stored = Stream.of("same-1", "same-2", "same-3", "same-4", "same-5").toList();
        stored.forEach(identifier ->
                saveOsUpdate(osUpdate(TENANT_ID, "WINDOWS", identifier, identifier, NEWEST_SEEN)));

        // execution
        Page firstPage = osUpdates(null, 2, null);
        Page secondPage = osUpdates(null, 2, firstPage.endCursor());
        Page thirdPage = osUpdates(null, 2, secondPage.endCursor());

        // verifications
        assertThat(identifiers(firstPage, secondPage, thirdPage)).containsExactlyInAnyOrderElementsOf(stored);
        assertThat(thirdPage.nodes()).hasSize(1);
        assertThat(thirdPage.hasNextPage()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"no-separator", "yesterday|6aff19c07ce86a3f0386ff82", "1795142470000|not-an-object-id"})
    void osUpdates_afterThatIsNotACursorOfTheList_answersWithAnErrorAndNoPage(String rawCursor) {
        // setup
        String after = Base64.getEncoder().encodeToString(rawCursor.getBytes(StandardCharsets.UTF_8));

        // execution
        ExecutionResult result = queryExecutor.execute(OS_UPDATES, Map.of("after", after));

        // verifications
        assertThat(result.getErrors()).hasSize(1);
        assertThat(result.<Object>getData()).isNull();
    }

    @Test
    void osUpdate_updateOfTheTenant_returnedWithBothCounts() {
        // setup
        Map<String, Object> expected = Map.of(
                "id", cumulativeId,
                "identifier", CUMULATIVE,
                "classification", "SECURITY",
                "pendingDeviceCount", 2,
                "installedDeviceCount", 3);

        // execution
        Map<String, Object> osUpdate = osUpdate(cumulativeId);

        // verifications
        assertThat(osUpdate).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void osUpdate_macUpdate_pendingCountedAndNothingInstalled() {
        // setup

        // execution
        Map<String, Object> osUpdate = osUpdate(safariId);

        // verifications
        assertThat(osUpdate)
                .containsEntry("identifier", SAFARI)
                .containsEntry("pendingDeviceCount", 1)
                .containsEntry("installedDeviceCount", 0);
    }

    @Test
    void osUpdate_idTheTenantDoesNotHave_null() {
        // setup

        // execution
        Map<String, Object> unknown = osUpdate(UNKNOWN_ID);
        Map<String, Object> notAnId = osUpdate("not-an-id");
        Map<String, Object> ofAnotherTenant = osUpdate(otherTenantCumulativeId);

        // verifications
        assertThat(unknown).isNull();
        assertThat(notAnId).isNull();
        assertThat(ofAnotherTenant).isNull();
    }

    @Test
    void osUpdateDevices_pending_newestDiscoveredFirst_withoutTheDeviceThatIsNotManageable_machineResolved() {
        // setup

        // execution
        Page page = devices(cumulativeId, "PENDING", null, null);

        // verifications
        assertThat(page.nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("status"),
                        node -> node.get("discoveredAt"), node -> node.get("installedAt"))
                .containsExactly(
                        tuple(WIN_2, "PENDING", NEWEST_SEEN, null),
                        tuple(WIN_1, "PENDING", MIDDLE_SEEN, null));
        assertThat(page.nodes())
                .extracting(node -> node.get("machine"))
                .containsExactly(
                        Map.of("machineId", WIN_2, "hostname", "host-" + WIN_2),
                        Map.of("machineId", WIN_1, "hostname", "host-" + WIN_1));
        assertThat(page.hasNextPage()).isFalse();
    }

    @Test
    void osUpdateDevices_pendingInPagesOfOne_everyDeviceOnce() {
        // setup

        // execution
        Page firstPage = devices(cumulativeId, "PENDING", 1, null);
        Page secondPage = devices(cumulativeId, "PENDING", 1, firstPage.endCursor());

        // verifications
        assertThat(machineIds(firstPage)).containsExactly(WIN_2);
        assertThat(firstPage.hasNextPage()).isTrue();
        assertThat(machineIds(secondPage)).containsExactly(WIN_1);
        assertThat(secondPage.hasNextPage()).isFalse();
        assertThat(secondPage.hasPreviousPage()).isTrue();
    }

    @Test
    void osUpdateDevices_installed_oneRowPerDeviceWithItsLatestSuccessfulInstall_latestInstalledFirst() {
        // setup

        // execution
        Page page = devices(cumulativeId, "INSTALLED", null, null);

        // verifications
        assertThat(page.nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("status"),
                        node -> node.get("installedAt"), node -> node.get("discoveredAt"))
                .containsExactly(
                        tuple(WIN_1, "INSTALLED", LATER_INSTALL, null),
                        tuple(WIN_4, "INSTALLED", EARLIER_INSTALL, null),
                        tuple(GONE, "INSTALLED", EARLIEST_INSTALL, null));
        assertThat(page.nodes().getLast()).as("a device no longer in the tenant").containsEntry("machine", null);
        assertThat(page.nodes().getFirst())
                .containsEntry("machine", Map.of("machineId", WIN_1, "hostname", "host-" + WIN_1));
    }

    @Test
    void osUpdateDevices_installedInPagesOfTwo_everyDeviceOnce() {
        // setup

        // execution
        Page firstPage = devices(cumulativeId, "INSTALLED", 2, null);
        Page secondPage = devices(cumulativeId, "INSTALLED", 2, firstPage.endCursor());

        // verifications
        assertThat(machineIds(firstPage)).containsExactly(WIN_1, WIN_4);
        assertThat(firstPage.hasNextPage()).isTrue();
        assertThat(machineIds(secondPage)).containsExactly(GONE);
        assertThat(secondPage.hasNextPage()).isFalse();
    }

    @Test
    void osUpdateDevices_updateNobodyInstalledAndMacUpdate_emptyInstalledPages() {
        // setup

        // execution
        Page installedDriver = devices(driverId, "INSTALLED", null, null);
        Page installedSafari = devices(safariId, "INSTALLED", null, null);
        Page pendingSafari = devices(safariId, "PENDING", null, null);

        // verifications
        assertThat(installedDriver.nodes()).isEmpty();
        assertThat(installedSafari.nodes()).isEmpty();
        assertThat(machineIds(pendingSafari)).containsExactly(MAC_1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "INSTALLED"})
    void osUpdateDevices_idTheTenantDoesNotHave_answersOsUpdateNotFound(String status) {
        // setup
        Map<String, Object> unknown = Map.of("osUpdateId", UNKNOWN_ID, "status", status);
        Map<String, Object> ofAnotherTenant = Map.of("osUpdateId", otherTenantCumulativeId, "status", status);

        // execution
        ExecutionResult unknownResult = queryExecutor.execute(DEVICES, unknown);
        ExecutionResult otherTenantResult = queryExecutor.execute(DEVICES, ofAnotherTenant);

        // verifications
        assertOsUpdateNotFound(unknownResult);
        assertOsUpdateNotFound(otherTenantResult);
    }

    @Test
    void osUpdateDevices_withoutAStatus_refusedByTheSchema() {
        // setup
        String withoutStatus = "query($osUpdateId: ID!) { osUpdateDevices(osUpdateId: $osUpdateId) { pageInfo { hasNextPage } } }";

        // execution
        ExecutionResult result = queryExecutor.execute(withoutStatus, Map.of("osUpdateId", cumulativeId));

        // verifications
        assertThat(result.getErrors()).extracting(GraphQLError::getMessage)
                .singleElement().asString().contains("status");
    }

    @Test
    void osUpdates_oneOrganization_onlyItsDevicesUpdates_countedOnItsDevicesOnly() {
        // setup

        // execution
        Page orgA = osUpdates(Map.of("organizationIds", List.of(ORG_A)), null, null);
        Page orgB = osUpdates(Map.of("organizationIds", List.of(ORG_B)), null, null);
        Page both = osUpdates(Map.of("organizationIds", List.of(ORG_A, ORG_B)), null, null);

        // verifications
        assertThat(orgA.nodes())
                .extracting(node -> node.get("identifier"), node -> node.get("pendingDeviceCount"),
                        node -> node.get("installedDeviceCount"))
                .containsExactly(tuple(CUMULATIVE, 1, 1), tuple(DRIVER, 1, 0));
        assertThat(orgB.nodes())
                .extracting(node -> node.get("identifier"), node -> node.get("pendingDeviceCount"),
                        node -> node.get("installedDeviceCount"))
                .containsExactly(tuple(CUMULATIVE, 1, 1), tuple(SAFARI, 1, 0));
        assertThat(both.nodes())
                .extracting(node -> node.get("identifier"), node -> node.get("pendingDeviceCount"),
                        node -> node.get("installedDeviceCount"))
                .containsExactly(tuple(CUMULATIVE, 2, 2), tuple(DRIVER, 1, 0), tuple(SAFARI, 1, 0));
    }

    @Test
    void osUpdates_organizationPageWithBothCounts_devicesOfTheOrganizationReadOnce() {
        // setup
        clearInvocations(deviceService);

        // execution
        Page page = osUpdates(Map.of("organizationIds", List.of(ORG_A, ORG_B)), null, null);

        // verifications
        assertThat(page.nodes()).hasSize(3);
        verify(deviceService, times(1)).findDeviceIdsOfOrganizations(any());
    }

    @Test
    void osUpdates_organizationWithoutDevices_noUpdate() {
        // setup

        // execution
        Page page = osUpdates(Map.of("organizationIds", List.of(ORG_WITHOUT_DEVICES)), null, null);

        // verifications
        assertThat(page.nodes()).isEmpty();
        assertThat(page.hasNextPage()).isFalse();
    }

    @Test
    void osUpdates_emptyOrganizationList_everyUpdateOfTheTenantCountedOnAllDevices() {
        // setup

        // execution
        Page page = osUpdates(Map.of("organizationIds", List.of()), null, null);

        // verifications
        assertThat(page.nodes())
                .extracting(node -> node.get("identifier"), node -> node.get("pendingDeviceCount"),
                        node -> node.get("installedDeviceCount"))
                .containsExactly(tuple(CUMULATIVE, 2, 3), tuple(DRIVER, 1, 0), tuple(SAFARI, 1, 0));
    }

    @Test
    void osUpdates_organizationAndOtherFilterInPagesOfOne_everyUpdateOnce() {
        // setup
        Map<String, Object> windowsOfOrgA = Map.of("organizationIds", List.of(ORG_A), "platform", "WINDOWS");

        // execution
        Page firstPage = osUpdates(windowsOfOrgA, 1, null);
        Page secondPage = osUpdates(windowsOfOrgA, 1, firstPage.endCursor());

        // verifications
        assertThat(identifiers(firstPage)).containsExactly(CUMULATIVE);
        assertThat(firstPage.hasNextPage()).isTrue();
        assertThat(identifiers(secondPage)).containsExactly(DRIVER);
        assertThat(secondPage.hasNextPage()).isFalse();
    }

    @Test
    void osUpdateDevices_oneOrganization_onlyItsDevices() {
        // setup

        // execution
        Page pendingOfOrgB = devices(cumulativeId, "PENDING", List.of(ORG_B), null, null);
        Page installedOfOrgA = devices(cumulativeId, "INSTALLED", List.of(ORG_A), null, null);
        Page installedOfOrgBInPagesOfOne = devices(cumulativeId, "INSTALLED", List.of(ORG_B), 1, null);

        // verifications
        assertThat(machineIds(pendingOfOrgB)).containsExactly(WIN_2);
        assertThat(machineIds(installedOfOrgA)).containsExactly(WIN_1);
        assertThat(machineIds(installedOfOrgBInPagesOfOne)).containsExactly(WIN_4);
        assertThat(installedOfOrgBInPagesOfOne.hasNextPage()).isFalse();
    }

    @Test
    void osUpdateDevices_organizationWithoutDevices_noDevice() {
        // setup
        List<String> withoutDevices = List.of(ORG_WITHOUT_DEVICES);

        // execution
        Page pending = devices(cumulativeId, "PENDING", withoutDevices, null, null);
        Page installed = devices(cumulativeId, "INSTALLED", withoutDevices, null, null);

        // verifications
        assertThat(pending.nodes()).isEmpty();
        assertThat(installed.nodes()).isEmpty();
    }

    @Test
    void osUpdateDevices_emptyOrganizationList_everyDevice() {
        // setup

        // execution
        Page pending = devices(cumulativeId, "PENDING", List.of(), null, null);
        Page installed = devices(cumulativeId, "INSTALLED", List.of(), null, null);

        // verifications
        assertThat(machineIds(pending)).containsExactly(WIN_2, WIN_1);
        assertThat(machineIds(installed)).containsExactly(WIN_1, WIN_4, GONE);
    }

    private Page osUpdates(Map<String, Object> filter, Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("filter", filter);
        variables.put("first", first);
        variables.put("after", after);
        return page(data(OS_UPDATES, variables).get("osUpdates"));
    }

    private Map<String, Object> osUpdate(String id) {
        return map(data(OS_UPDATE, Map.of("id", id)).get("osUpdate"));
    }

    private Page devices(String osUpdateId, String status, Integer first, String after) {
        return devices(osUpdateId, status, null, first, after);
    }

    private Page devices(String osUpdateId, String status, List<String> organizationIds, Integer first,
                         String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("osUpdateId", osUpdateId);
        variables.put("status", status);
        variables.put("organizationIds", organizationIds);
        variables.put("first", first);
        variables.put("after", after);
        return page(data(DEVICES, variables).get("osUpdateDevices"));
    }

    private Map<String, Object> data(String query, Map<String, Object> variables) {
        ExecutionResult result = queryExecutor.execute(query, variables);
        assertThat(result.getErrors()).as("GraphQL errors").isEmpty();
        return result.getData();
    }

    private static Page page(Object connection) {
        Map<String, Object> pageInfo = map(map(connection).get("pageInfo"));
        List<Map<String, Object>> edges = list(map(connection).get("edges"));
        List<Map<String, Object>> nodes = edges.stream().map(edge -> map(edge.get("node"))).toList();
        List<String> cursors = edges.stream().map(edge -> (String) edge.get("cursor")).toList();
        return new Page(nodes, cursors, (boolean) pageInfo.get("hasNextPage"),
                (boolean) pageInfo.get("hasPreviousPage"), (String) pageInfo.get("endCursor"));
    }

    private static void assertOsUpdateNotFound(ExecutionResult result) {
        assertThat(result.getErrors()).singleElement().extracting(GraphQLError::getExtensions)
                .satisfies(extensions -> assertThat(extensions).containsEntry("code", "OS_UPDATE_NOT_FOUND"));
        assertThat(result.<Object>getData()).isNull();
    }

    private static List<String> identifiers(Page... pages) {
        return Arrays.stream(pages)
                .flatMap(page -> page.nodes().stream())
                .map(node -> (String) node.get("identifier"))
                .toList();
    }

    private static List<String> machineIds(Page page) {
        return page.nodes().stream().map(node -> (String) node.get("machineId")).toList();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return (List<Map<String, Object>>) value;
    }

    private record Page(List<Map<String, Object>> nodes, List<String> cursors, boolean hasNextPage,
                        boolean hasPreviousPage, String endCursor) {
    }

    private static Document machine(String machineId, String tenantId, String organizationId) {
        return new Document("machineId", machineId)
                .append("tenantId", tenantId)
                .append("organizationId", organizationId)
                .append("status", "ONLINE")
                .append("hostname", "host-" + machineId)
                .append("osType", "WINDOWS");
    }

    private static Document state(String machineId, String tenantId, String manageabilityState) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("platform", "WINDOWS")
                .append("manageability", new Document("state", manageabilityState).append("reasons", List.of()))
                .append("version", 0L)
                .append("receivedAt", date(NEWEST_SEEN));
    }

    private static Document osUpdate(String tenantId, String platform, String identifier, String displayName,
                                     String firstSeenAt) {
        return new Document("tenantId", tenantId)
                .append("platform", platform)
                .append("identifier", identifier)
                .append("displayName", displayName)
                .append("firstSeenAt", date(firstSeenAt));
    }

    private static Document cumulative(String tenantId) {
        return osUpdate(tenantId, "WINDOWS", CUMULATIVE, CUMULATIVE_NAME, NEWEST_SEEN)
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
                .append("browseOnly", false)
                .append("cvssScore", 9.8)
                .append("exploited", true)
                .append("enrichedAt", date(ENRICHED_AT));
    }

    private static Document pendingUpdate(String machineId, String tenantId, String platform, String identifier,
                                          String discoveredAt) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("platform", platform)
                .append("identifier", identifier)
                .append("discoveredAt", date(discoveredAt));
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

    // forty steps make the retention of the history: any step count below forty is inside it
    private static String stepsAgo(int steps) {
        Duration step = DeviceOsUpdateHistoryEntry.RETENTION.dividedBy(40);
        return Instant.now().truncatedTo(ChronoUnit.SECONDS).minus(step.multipliedBy(steps)).toString();
    }

    private static Date date(String instant) {
        return Date.from(Instant.parse(instant));
    }

    private String saveOsUpdate(Document osUpdate) {
        osUpdateCollection().insertOne(osUpdate);
        return osUpdate.getObjectId("_id").toHexString();
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

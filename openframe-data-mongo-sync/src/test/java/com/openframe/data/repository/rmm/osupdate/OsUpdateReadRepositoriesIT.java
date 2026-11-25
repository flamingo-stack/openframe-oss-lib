package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsUpdateReadRepositoriesIT extends BaseMongoIntegrationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OTHER_TENANT_ID = "tenant-2";
    private static final String CUMULATIVE = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String DRIVER = "0d1e2f3a-5555-4666-8777-112233445566:1";
    private static final String SEQUOIA = "macOS Sequoia 15.4-24E248";
    private static final List<String> NO_MACHINES = List.of();
    // WARNING: history rows older than the retention are deleted by the TTL monitor of the container, so every
    // install time of this class is counted from now
    private static final Duration RETENTION = DeviceOsUpdateHistoryEntry.RETENTION;
    private static final Instant NEWEST = Instant.now().truncatedTo(ChronoUnit.MILLIS).minus(RETENTION.dividedBy(10));
    private static final Instant MIDDLE = NEWEST.minus(1, ChronoUnit.HOURS);
    private static final Instant OLDEST = NEWEST.minus(2, ChronoUnit.HOURS);

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private DeviceOsStateRepository deviceOsStateRepository;
    @Autowired private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Autowired private OsUpdateRepository osUpdateRepository;
    @Autowired private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;

    @BeforeEach
    void setUp() {
        MongoPersistentEntityIndexResolver indexResolver =
                new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext());
        Stream.of(DeviceOsState.class, DeviceOsPendingUpdate.class, OsUpdate.class, DeviceOsUpdateHistoryEntry.class)
                .forEach(document -> indexResolver.resolveIndexFor(document)
                        .forEach(mongoTemplate.indexOps(document)::createIndex));
        deviceOsStateRepository.deleteAll();
        deviceOsPendingUpdateRepository.deleteAll();
        osUpdateRepository.deleteAll();
        deviceOsUpdateHistoryRepository.deleteAll();
    }

    @Test
    void findPage_noFilter_updatesOfThatTenantLatestSeenFirst() {
        // setup
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, OLDEST));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, DRIVER, NEWEST));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.MACOS, SEQUOIA, MIDDLE));
        osUpdateRepository.save(osUpdate(OTHER_TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, NEWEST));

        // execution
        List<OsUpdate> page = osUpdateRepository.findPage(TENANT_ID, OsUpdateFilter.NONE, null, 10);

        // verifications
        assertThat(page)
                .extracting(OsUpdate::getTenantId, OsUpdate::getIdentifier)
                .containsExactly(tuple(TENANT_ID, DRIVER), tuple(TENANT_ID, SEQUOIA), tuple(TENANT_ID, CUMULATIVE));
    }

    @Test
    void findPage_pageByPageWithUpdatesSeenTogether_everyUpdateOnceInOneOrder() {
        // setup
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, "update-1", NEWEST));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, "update-2", NEWEST));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, "update-3", NEWEST));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, "update-4", OLDEST));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, "update-5", OLDEST));
        List<OsUpdate> allAtOnce = osUpdateRepository.findPage(TENANT_ID, OsUpdateFilter.NONE, null, 10);

        // execution
        List<OsUpdate> firstPage = osUpdateRepository.findPage(TENANT_ID, OsUpdateFilter.NONE, null, 2);
        String afterFirstPage = osUpdateRepository.encodeCursor(firstPage.getLast());
        List<OsUpdate> secondPage = osUpdateRepository.findPage(TENANT_ID, OsUpdateFilter.NONE, afterFirstPage, 2);
        String afterSecondPage = osUpdateRepository.encodeCursor(secondPage.getLast());
        List<OsUpdate> thirdPage = osUpdateRepository.findPage(TENANT_ID, OsUpdateFilter.NONE, afterSecondPage, 2);

        // verifications
        List<OsUpdate> pageByPage = Stream.of(firstPage, secondPage, thirdPage).flatMap(List::stream).toList();
        assertThat(pageByPage)
                .extracting(OsUpdate::getIdentifier)
                .hasSize(5)
                .containsExactlyElementsOf(allAtOnce.stream().map(OsUpdate::getIdentifier).toList());
        assertThat(thirdPage).hasSize(1);
    }

    @Test
    void findPage_platformAndClassifications_onlyTheUpdatesOfBoth() {
        // setup
        osUpdateRepository.save(classified(CUMULATIVE, OsPlatform.WINDOWS, OsUpdateClassification.SECURITY));
        osUpdateRepository.save(classified(DRIVER, OsPlatform.WINDOWS, OsUpdateClassification.DRIVER));
        osUpdateRepository.save(classified("preview", OsPlatform.WINDOWS, OsUpdateClassification.PREVIEW));
        osUpdateRepository.save(classified("unclassified", OsPlatform.WINDOWS, null));
        osUpdateRepository.save(classified(SEQUOIA, OsPlatform.MACOS, OsUpdateClassification.OTHER));
        OsUpdateFilter securityAndDriversOfWindows = OsUpdateFilter.builder()
                .platform(OsPlatform.WINDOWS)
                .classifications(List.of(OsUpdateClassification.SECURITY, OsUpdateClassification.DRIVER))
                .build();
        OsUpdateFilter macos = OsUpdateFilter.builder().platform(OsPlatform.MACOS).build();

        // execution
        List<OsUpdate> windowsPage = osUpdateRepository.findPage(TENANT_ID, securityAndDriversOfWindows, null, 10);
        List<OsUpdate> macosPage = osUpdateRepository.findPage(TENANT_ID, macos, null, 10);

        // verifications
        assertThat(windowsPage).extracting(OsUpdate::getIdentifier).containsExactlyInAnyOrder(CUMULATIVE, DRIVER);
        assertThat(macosPage).extracting(OsUpdate::getIdentifier).containsExactly(SEQUOIA);
    }

    @Test
    void findPage_search_matchesNameKbIdAndCveIdIgnoringCaseAndNeverAsAPattern() {
        // setup
        OsUpdate cumulative = osUpdate(TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, NEWEST);
        cumulative.setDisplayName("2026-11 Cumulative Update for Windows 11 (KB5051987)");
        cumulative.setKbArticleIds(List.of("5051987"));
        cumulative.setCveIds(List.of("CVE-2026-21309"));
        OsUpdate driver = osUpdate(TENANT_ID, OsPlatform.WINDOWS, DRIVER, MIDDLE);
        driver.setDisplayName("Intel - Display - 31.0.101.5186");
        driver.setKbArticleIds(List.of());
        driver.setCveIds(List.of());
        osUpdateRepository.saveAll(List.of(cumulative, driver));

        // execution
        List<OsUpdate> byName = osUpdateRepository.findPage(TENANT_ID, search("cumulative update"), null, 10);
        List<OsUpdate> byKbId = osUpdateRepository.findPage(TENANT_ID, search("50519"), null, 10);
        List<OsUpdate> byCveId = osUpdateRepository.findPage(TENANT_ID, search("cve-2026-21309"), null, 10);
        List<OsUpdate> byPattern = osUpdateRepository.findPage(TENANT_ID, search(".*"), null, 10);
        List<OsUpdate> byTextWithPatternCharacters = osUpdateRepository.findPage(TENANT_ID, search("(KB5051987)"), null, 10);

        // verifications
        assertThat(byName).extracting(OsUpdate::getIdentifier).containsExactly(CUMULATIVE);
        assertThat(byKbId).extracting(OsUpdate::getIdentifier).containsExactly(CUMULATIVE);
        assertThat(byCveId).extracting(OsUpdate::getIdentifier).containsExactly(CUMULATIVE);
        assertThat(byPattern).isEmpty();
        assertThat(byTextWithPatternCharacters).extracting(OsUpdate::getIdentifier).containsExactly(CUMULATIVE);
    }

    @Test
    void findByTenantIdAndId_updateOfAnotherTenant_empty() {
        // setup
        OsUpdate ofOtherTenant = osUpdateRepository.save(osUpdate(OTHER_TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, NEWEST));
        OsUpdate ofTenant = osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, NEWEST));
        List<String> bothIds = List.of(ofTenant.getId(), ofOtherTenant.getId());

        // execution
        boolean otherTenantsFound = osUpdateRepository.findByTenantIdAndId(TENANT_ID, ofOtherTenant.getId()).isPresent();
        boolean ownFound = osUpdateRepository.findByTenantIdAndId(TENANT_ID, ofTenant.getId()).isPresent();
        List<OsUpdate> foundByIds = osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, bothIds);

        // verifications
        assertThat(otherTenantsFound).isFalse();
        assertThat(ownFound).isTrue();
        assertThat(foundByIds).extracting(OsUpdate::getId).containsExactly(ofTenant.getId());
    }

    @Test
    void findByTenantIdAndManageabilityState_notManageable_onlyTheTenantsDevicesInThatState() {
        // setup
        deviceOsStateRepository.save(state(TENANT_ID, "machine-1", OsUpdateManageabilityState.NOT_MANAGEABLE));
        deviceOsStateRepository.save(state(TENANT_ID, "machine-2", OsUpdateManageabilityState.MANAGEABLE));
        deviceOsStateRepository.save(state(TENANT_ID, "machine-3", null));
        deviceOsStateRepository.save(state(OTHER_TENANT_ID, "machine-4", OsUpdateManageabilityState.NOT_MANAGEABLE));

        // execution
        List<DeviceOsState> states = deviceOsStateRepository.findByTenantIdAndManageabilityState(
                TENANT_ID, OsUpdateManageabilityState.NOT_MANAGEABLE);

        // verifications
        assertThat(states).extracting(DeviceOsState::getMachineId).containsExactly("machine-1");
    }

    @Test
    void countDevicesByIdentifier_pendingOnSeveralDevices_perIdentifierWithoutExcludedDevicesOtherPlatformsAndTenants() {
        // setup
        deviceOsPendingUpdateRepository.saveAll(List.of(
                pendingUpdate(TENANT_ID, "machine-1", OsPlatform.WINDOWS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-2", OsPlatform.WINDOWS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-3", OsPlatform.WINDOWS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-1", OsPlatform.WINDOWS, DRIVER, NEWEST),
                pendingUpdate(TENANT_ID, "machine-5", OsPlatform.MACOS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-1", OsPlatform.WINDOWS, "not-asked-for", NEWEST),
                pendingUpdate(OTHER_TENANT_ID, "machine-6", OsPlatform.WINDOWS, CUMULATIVE, NEWEST)));
        List<String> identifiers = List.of(CUMULATIVE, DRIVER, "pending-nowhere");
        List<String> excludedMachineIds = List.of("machine-3");

        // execution
        List<OsUpdateDeviceCount> deviceCounts = deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, identifiers, excludedMachineIds);
        List<OsUpdateDeviceCount> deviceCountsOfAll = deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, identifiers, NO_MACHINES);

        // verifications
        assertThat(deviceCounts)
                .containsExactlyInAnyOrder(new OsUpdateDeviceCount(CUMULATIVE, 2), new OsUpdateDeviceCount(DRIVER, 1));
        assertThat(deviceCountsOfAll)
                .containsExactlyInAnyOrder(new OsUpdateDeviceCount(CUMULATIVE, 3), new OsUpdateDeviceCount(DRIVER, 1));
    }

    @Test
    void findDevicePage_pageByPageWithDevicesDiscoveredTogether_everyDeviceOnceNewestDiscoveredFirst() {
        // setup
        deviceOsPendingUpdateRepository.saveAll(List.of(
                pendingUpdate(TENANT_ID, "machine-1", OsPlatform.WINDOWS, CUMULATIVE, OLDEST),
                pendingUpdate(TENANT_ID, "machine-2", OsPlatform.WINDOWS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-3", OsPlatform.WINDOWS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-4", OsPlatform.WINDOWS, CUMULATIVE, MIDDLE),
                pendingUpdate(TENANT_ID, "machine-5", OsPlatform.WINDOWS, CUMULATIVE, NEWEST),
                pendingUpdate(TENANT_ID, "machine-2", OsPlatform.WINDOWS, DRIVER, NEWEST),
                pendingUpdate(TENANT_ID, "machine-7", OsPlatform.MACOS, CUMULATIVE, NEWEST),
                pendingUpdate(OTHER_TENANT_ID, "machine-8", OsPlatform.WINDOWS, CUMULATIVE, NEWEST)));
        List<String> excludedMachineIds = List.of("machine-5");

        // execution
        List<DeviceOsPendingUpdate> firstPage = deviceOsPendingUpdateRepository.findDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, excludedMachineIds, null, 2);
        String afterFirstPage = deviceOsPendingUpdateRepository.encodeDeviceCursor(firstPage.getLast());
        List<DeviceOsPendingUpdate> secondPage = deviceOsPendingUpdateRepository.findDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, excludedMachineIds, afterFirstPage, 2);
        String afterSecondPage = deviceOsPendingUpdateRepository.encodeDeviceCursor(secondPage.getLast());
        List<DeviceOsPendingUpdate> thirdPage = deviceOsPendingUpdateRepository.findDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, CUMULATIVE, excludedMachineIds, afterSecondPage, 2);

        // verifications
        assertThat(firstPage).extracting(DeviceOsPendingUpdate::getMachineId).containsExactly("machine-3", "machine-2");
        assertThat(secondPage).extracting(DeviceOsPendingUpdate::getMachineId).containsExactly("machine-4", "machine-1");
        assertThat(thirdPage).isEmpty();
    }

    @Test
    void countInstalledDevicesByIdentifier_installsOfSeveralOutcomes_eachDeviceOnceAmongSuccessfulInstalls() {
        // setup
        deviceOsUpdateHistoryRepository.saveAll(List.of(
                historyEntry(TENANT_ID, "machine-1", CUMULATIVE, OLDEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-1", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-2", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS),
                historyEntry(TENANT_ID, "machine-3", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.FAILED),
                historyEntry(TENANT_ID, "machine-4", CUMULATIVE, NEWEST, OsUpdateOperation.UNINSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-5", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, null),
                historyEntry(TENANT_ID, "machine-1", DRIVER, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-1", "not-asked-for", NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(OTHER_TENANT_ID, "machine-6", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED)));
        List<String> identifiers = List.of(CUMULATIVE, DRIVER, "installed-nowhere");

        // execution
        List<OsUpdateDeviceCount> deviceCounts =
                deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(TENANT_ID, identifiers);

        // verifications
        assertThat(deviceCounts)
                .containsExactlyInAnyOrder(new OsUpdateDeviceCount(CUMULATIVE, 2), new OsUpdateDeviceCount(DRIVER, 1));
    }

    @Test
    void findInstalledDevicePage_pageByPage_oneRowPerDeviceWithItsLatestSuccessfulInstallNewestFirst() {
        // setup
        deviceOsUpdateHistoryRepository.saveAll(List.of(
                historyEntry(TENANT_ID, "machine-1", CUMULATIVE, OLDEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-1", CUMULATIVE, MIDDLE, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-1", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.FAILED),
                historyEntry(TENANT_ID, "machine-2", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-3", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS),
                historyEntry(TENANT_ID, "machine-4", CUMULATIVE, OLDEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-5", CUMULATIVE, NEWEST, OsUpdateOperation.UNINSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(TENANT_ID, "machine-6", DRIVER, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(OTHER_TENANT_ID, "machine-7", CUMULATIVE, NEWEST, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED)));

        // execution
        List<InstalledOsUpdateDevice> firstPage =
                deviceOsUpdateHistoryRepository.findInstalledDevicePage(TENANT_ID, CUMULATIVE, null, 2);
        String afterFirstPage = deviceOsUpdateHistoryRepository.encodeInstalledDeviceCursor(firstPage.getLast());
        List<InstalledOsUpdateDevice> secondPage =
                deviceOsUpdateHistoryRepository.findInstalledDevicePage(TENANT_ID, CUMULATIVE, afterFirstPage, 2);
        String afterSecondPage = deviceOsUpdateHistoryRepository.encodeInstalledDeviceCursor(secondPage.getLast());
        List<InstalledOsUpdateDevice> thirdPage =
                deviceOsUpdateHistoryRepository.findInstalledDevicePage(TENANT_ID, CUMULATIVE, afterSecondPage, 2);

        // verifications
        assertThat(firstPage).containsExactly(
                new InstalledOsUpdateDevice("machine-3", NEWEST), new InstalledOsUpdateDevice("machine-2", NEWEST));
        assertThat(secondPage).containsExactly(
                new InstalledOsUpdateDevice("machine-1", MIDDLE), new InstalledOsUpdateDevice("machine-4", OLDEST));
        assertThat(thirdPage).isEmpty();
    }

    @Test
    void featureCollections_eachHasTheIndexOfItsTenantWideRead() {
        // setup

        // execution
        List<Document> osUpdateIndexes = indexes("os_updates");
        List<Document> pendingIndexes = indexes("device_os_pending_updates");
        List<Document> historyIndexes = indexes("device_os_update_history");

        // verifications
        assertThat(osUpdateIndexes)
                .extracting(index -> index.getString("name"), index -> index.get("key", Document.class).toJson())
                .contains(tuple("tenant_first_seen", "{\"tenantId\": 1, \"firstSeenAt\": -1, \"_id\": -1}"));
        assertThat(pendingIndexes)
                .extracting(index -> index.getString("name"), index -> index.get("key", Document.class).toJson())
                .contains(tuple("tenant_identifier_discovered",
                        "{\"tenantId\": 1, \"identifier\": 1, \"discoveredAt\": -1, \"machineId\": -1}"));
        assertThat(historyIndexes)
                .extracting(index -> index.getString("name"), index -> index.get("key", Document.class).toJson())
                .contains(tuple("tenant_identifier_installed",
                        "{\"tenantId\": 1, \"identifier\": 1, \"installedAt\": -1}"));
    }

    private List<Document> indexes(String collection) {
        return mongoTemplate.getCollection(collection).listIndexes().into(new ArrayList<>());
    }

    private static OsUpdateFilter search(String search) {
        return OsUpdateFilter.builder().search(search).build();
    }

    private static OsUpdate osUpdate(String tenantId, OsPlatform platform, String identifier, Instant firstSeenAt) {
        return OsUpdate.builder()
                .tenantId(tenantId)
                .platform(platform)
                .identifier(identifier)
                .firstSeenAt(firstSeenAt)
                .build();
    }

    private static OsUpdate classified(String identifier, OsPlatform platform, OsUpdateClassification classification) {
        OsUpdate osUpdate = osUpdate(TENANT_ID, platform, identifier, NEWEST);
        osUpdate.setClassification(classification);
        return osUpdate;
    }

    private static DeviceOsState state(String tenantId, String machineId, OsUpdateManageabilityState manageabilityState) {
        OsUpdateManageability manageability = OsUpdateManageability.builder()
                .state(manageabilityState)
                .reasons(List.of())
                .build();
        return DeviceOsState.builder()
                .tenantId(tenantId)
                .machineId(machineId)
                .platform(OsPlatform.WINDOWS)
                .manageability(manageability)
                .receivedAt(NEWEST)
                .build();
    }

    private static DeviceOsPendingUpdate pendingUpdate(String tenantId, String machineId, OsPlatform platform,
                                                       String identifier, Instant discoveredAt) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(tenantId)
                .machineId(machineId)
                .platform(platform)
                .identifier(identifier)
                .discoveredAt(discoveredAt)
                .build();
    }

    private static DeviceOsUpdateHistoryEntry historyEntry(String tenantId, String machineId, String identifier,
                                                           Instant installedAt, OsUpdateOperation operation,
                                                           OsUpdateInstallResult result) {
        return DeviceOsUpdateHistoryEntry.builder()
                .tenantId(tenantId)
                .machineId(machineId)
                .entryKey(identifier + "|" + installedAt.toEpochMilli() + "|" + operation)
                .identifier(identifier)
                .installedAt(installedAt)
                .operation(operation)
                .result(result)
                .build();
    }
}

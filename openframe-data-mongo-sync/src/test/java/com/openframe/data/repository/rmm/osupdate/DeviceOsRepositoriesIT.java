package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.config.MongoIndexConfig;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.assertj.core.groups.Tuple;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceOsRepositoriesIT extends BaseMongoIntegrationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OTHER_TENANT_ID = "tenant-2";
    private static final String MACHINE_ID = "machine-1";
    private static final String OTHER_MACHINE_ID = "machine-2";
    // WARNING: history rows older than the retention are deleted by the TTL monitor of the container, so every
    // install time of this class is counted from now
    private static final Duration RETENTION = DeviceOsUpdateHistoryEntry.RETENTION;
    private static final Instant LATER = Instant.now().truncatedTo(ChronoUnit.MILLIS).minus(RETENTION.dividedBy(10));
    private static final Instant RECEIVED_AT = LATER.minus(RETENTION.dividedBy(100));
    private static final Instant EARLIER = RECEIVED_AT.minus(11, ChronoUnit.SECONDS);

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
    void saveState_firstStateOfTheDevice_storedWithVersionZero() {
        // setup
        DeviceOsState reported = state(TENANT_ID, RECEIVED_AT, "26100.4061");

        // execution
        deviceOsStateRepository.save(reported);

        // verifications
        assertThat(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).get()
                .extracting(DeviceOsState::getVersion, DeviceOsState::getReceivedAt, DeviceOsState::getOsBuild)
                .containsExactly(0L, RECEIVED_AT, "26100.4061");
    }

    @Test
    void saveState_stateWithTheStoredIdAndVersion_replacedWholesaleAndTheVersionMovesOn() {
        // setup
        DeviceOsState stored = state(TENANT_ID, EARLIER, "26100.3915");
        stored.setOsVersion("11 24H2");
        stored = deviceOsStateRepository.save(stored);
        DeviceOsState reported = state(TENANT_ID, RECEIVED_AT, "26100.4061");
        reported.setId(stored.getId());
        reported.setVersion(stored.getVersion());

        // execution
        deviceOsStateRepository.save(reported);

        // verifications
        assertThat(deviceOsStateRepository.findAll())
                .extracting(DeviceOsState::getVersion, DeviceOsState::getReceivedAt, DeviceOsState::getOsBuild,
                        DeviceOsState::getOsVersion)
                .containsExactly(tuple(1L, RECEIVED_AT, "26100.4061", null));
    }

    @Test
    void saveState_staleCopyOfAStateReplacedMeanwhile_throwsOptimisticLockingFailureAndTheNewerStateStays() {
        // setup
        deviceOsStateRepository.save(state(TENANT_ID, EARLIER, "26100.3915"));
        DeviceOsState staleCopy = deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID).orElseThrow();
        DeviceOsState freshCopy = deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID).orElseThrow();
        freshCopy.setReceivedAt(LATER);
        freshCopy.setOsBuild("26100.4061");
        deviceOsStateRepository.save(freshCopy);
        staleCopy.setReceivedAt(RECEIVED_AT);
        staleCopy.setOsBuild("26100.4000");

        // execution
        OptimisticLockingFailureException ex =
                assertThrows(OptimisticLockingFailureException.class, () -> deviceOsStateRepository.save(staleCopy));

        // verifications
        assertThat(ex.getMessage()).contains("device_os_states");
        assertThat(deviceOsStateRepository.findAll())
                .extracting(DeviceOsState::getVersion, DeviceOsState::getReceivedAt, DeviceOsState::getOsBuild)
                .containsExactly(tuple(1L, LATER, "26100.4061"));
    }

    @Test
    void saveState_secondNewStateOfTheSameDevice_throwsDuplicateKeyOfTheUniqueIndex() {
        // setup
        deviceOsStateRepository.save(state(TENANT_ID, EARLIER, "26100.3915"));
        DeviceOsState concurrentFirst = state(TENANT_ID, RECEIVED_AT, "26100.4061");

        // execution
        DuplicateKeyException ex =
                assertThrows(DuplicateKeyException.class, () -> deviceOsStateRepository.save(concurrentFirst));

        // verifications
        assertThat(ex.getMessage()).contains("tenant_machine");
        assertThat(deviceOsStateRepository.findAll()).extracting(DeviceOsState::getOsBuild)
                .containsExactly("26100.3915");
    }

    @Test
    void saveState_sameMachineIdInTwoTenants_eachTenantKeepsItsOwnState() {
        // setup
        deviceOsStateRepository.save(state(TENANT_ID, RECEIVED_AT, "26100.4061"));

        // execution
        deviceOsStateRepository.save(state(OTHER_TENANT_ID, EARLIER, "26100.3915"));

        // verifications
        assertThat(deviceOsStateRepository.findAll())
                .extracting(DeviceOsState::getTenantId, DeviceOsState::getOsBuild)
                .containsExactlyInAnyOrder(tuple(TENANT_ID, "26100.4061"), tuple(OTHER_TENANT_ID, "26100.3915"));
    }

    @Test
    void savePendingUpdate_sameIdentifierTwiceOnOneDevice_throwsDuplicateKeyOfTheUniqueIndex() {
        // setup
        deviceOsPendingUpdateRepository.save(pendingUpdate(MACHINE_ID, "kb-1", EARLIER));
        deviceOsPendingUpdateRepository.save(pendingUpdate(OTHER_MACHINE_ID, "kb-1", EARLIER));
        DeviceOsPendingUpdate sameAgain = pendingUpdate(MACHINE_ID, "kb-1", RECEIVED_AT);

        // execution
        DuplicateKeyException ex =
                assertThrows(DuplicateKeyException.class, () -> deviceOsPendingUpdateRepository.save(sameAgain));

        // verifications
        assertThat(ex.getMessage()).contains("tenant_machine_identifier");
        assertThat(deviceOsPendingUpdateRepository.findAll())
                .extracting(DeviceOsPendingUpdate::getMachineId, DeviceOsPendingUpdate::getDiscoveredAt)
                .containsExactlyInAnyOrder(tuple(MACHINE_ID, EARLIER), tuple(OTHER_MACHINE_ID, EARLIER));
    }

    @Test
    void saveOsUpdate_sameIdentifierTwiceInOneTenantAndPlatform_throwsDuplicateKeyAndTheFirstDescriptionStays() {
        // setup
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.WINDOWS, "kb-1", "First description"));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.MACOS, "kb-1", "Of another platform"));
        osUpdateRepository.save(osUpdate(OTHER_TENANT_ID, OsPlatform.WINDOWS, "kb-1", "Of another tenant"));
        OsUpdate describedAgain = osUpdate(TENANT_ID, OsPlatform.WINDOWS, "kb-1", "Second description");

        // execution
        DuplicateKeyException ex = assertThrows(DuplicateKeyException.class, () -> osUpdateRepository.save(describedAgain));

        // verifications
        assertThat(ex.getMessage()).contains("tenant_platform_identifier");
        assertThat(osUpdateRepository.findAll())
                .extracting(OsUpdate::getTenantId, OsUpdate::getPlatform, OsUpdate::getDisplayName)
                .containsExactlyInAnyOrder(
                        tuple(TENANT_ID, OsPlatform.WINDOWS, "First description"),
                        tuple(TENANT_ID, OsPlatform.MACOS, "Of another platform"),
                        tuple(OTHER_TENANT_ID, OsPlatform.WINDOWS, "Of another tenant"));
    }

    @Test
    void saveHistoryEntry_sameEntryKeyTwiceOnOneDevice_throwsDuplicateKeyOfTheUniqueIndex() {
        // setup
        deviceOsUpdateHistoryRepository.save(historyEntry(TENANT_ID, MACHINE_ID, "kb-0", EARLIER));
        deviceOsUpdateHistoryRepository.save(historyEntry(TENANT_ID, OTHER_MACHINE_ID, "kb-0", EARLIER));
        DeviceOsUpdateHistoryEntry sameAgain = historyEntry(TENANT_ID, MACHINE_ID, "kb-0", EARLIER);

        // execution
        DuplicateKeyException ex =
                assertThrows(DuplicateKeyException.class, () -> deviceOsUpdateHistoryRepository.save(sameAgain));

        // verifications
        assertThat(ex.getMessage()).contains("tenant_machine_entry");
        assertThat(deviceOsUpdateHistoryRepository.findAll()).hasSize(2);
    }

    @Test
    void findPendingUpdates_sameDiscoveredAt_newestFirstThenByIdentifier() {
        // setup
        deviceOsPendingUpdateRepository.saveAll(List.of(
                pendingUpdate(MACHINE_ID, "b-update", RECEIVED_AT),
                pendingUpdate(MACHINE_ID, "a-update", RECEIVED_AT),
                pendingUpdate(MACHINE_ID, "c-update", EARLIER),
                pendingUpdate(OTHER_MACHINE_ID, "of-another-machine", LATER)));

        // execution
        List<DeviceOsPendingUpdate> found = deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID);

        // verifications
        assertThat(found).extracting(DeviceOsPendingUpdate::getIdentifier)
                .containsExactly("a-update", "b-update", "c-update");
    }

    @Test
    void findOsUpdatesByIdentifierIn_sameIdentifierElsewhere_onlyTheOnesOfThatTenantAndPlatformAmongTheAsked() {
        // setup
        osUpdateRepository.saveAll(List.of(
                osUpdate(TENANT_ID, OsPlatform.WINDOWS, "kb-1", "Asked and stored"),
                osUpdate(TENANT_ID, OsPlatform.WINDOWS, "kb-2", "Not asked"),
                osUpdate(TENANT_ID, OsPlatform.MACOS, "kb-1", "Of another platform"),
                osUpdate(OTHER_TENANT_ID, OsPlatform.WINDOWS, "kb-1", "Of another tenant")));

        // execution
        List<OsUpdate> found = osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-3"));

        // verifications
        assertThat(found).extracting(OsUpdate::getDisplayName).containsExactly("Asked and stored");
    }

    @Test
    void findHistoryByEntryKeyIn_sameEntryKeyElsewhere_onlyTheOnesOfThatTenantAndMachineAmongTheAsked() {
        // setup
        DeviceOsUpdateHistoryEntry askedAndStored = historyEntry(TENANT_ID, MACHINE_ID, "kb-0", EARLIER);
        deviceOsUpdateHistoryRepository.saveAll(List.of(
                askedAndStored,
                historyEntry(TENANT_ID, MACHINE_ID, "kb-1", RECEIVED_AT),
                historyEntry(TENANT_ID, OTHER_MACHINE_ID, "kb-0", EARLIER),
                historyEntry(OTHER_TENANT_ID, MACHINE_ID, "kb-0", EARLIER)));
        List<String> asked = List.of(askedAndStored.getEntryKey(), "never-stored|0|INSTALL");

        // execution
        List<DeviceOsUpdateHistoryEntry> found =
                deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(TENANT_ID, MACHINE_ID, asked);

        // verifications
        assertThat(found)
                .extracting(DeviceOsUpdateHistoryEntry::getTenantId, DeviceOsUpdateHistoryEntry::getMachineId,
                        DeviceOsUpdateHistoryEntry::getIdentifier)
                .containsExactly(tuple(TENANT_ID, MACHINE_ID, "kb-0"));
    }

    @Test
    void findPage_cursorOfTheLastEntryOfAPage_nextPageContinuesWithoutLossOrRepeatAcrossTheSameInstant() {
        // setup
        deviceOsUpdateHistoryRepository.saveAll(List.of(
                historyEntry(TENANT_ID, MACHINE_ID, "newest", LATER),
                historyEntry(TENANT_ID, MACHINE_ID, "same-instant-a", RECEIVED_AT),
                historyEntry(TENANT_ID, MACHINE_ID, "same-instant-b", RECEIVED_AT),
                historyEntry(TENANT_ID, MACHINE_ID, "same-instant-c", RECEIVED_AT),
                historyEntry(TENANT_ID, MACHINE_ID, "oldest", EARLIER),
                historyEntry(TENANT_ID, OTHER_MACHINE_ID, "of-another-machine", LATER)));
        List<DeviceOsUpdateHistoryEntry> firstPage =
                deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 2);
        String cursor = deviceOsUpdateHistoryRepository.encodeCursor(firstPage.getLast());

        // execution
        List<DeviceOsUpdateHistoryEntry> secondPage =
                deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, cursor, 10);

        // verifications
        assertThat(firstPage).extracting(DeviceOsUpdateHistoryEntry::getInstalledAt)
                .containsExactly(LATER, RECEIVED_AT);
        assertThat(secondPage).extracting(DeviceOsUpdateHistoryEntry::getInstalledAt)
                .containsExactly(RECEIVED_AT, RECEIVED_AT, EARLIER);
        assertThat(Stream.concat(firstPage.stream(), secondPage.stream()))
                .extracting(DeviceOsUpdateHistoryEntry::getIdentifier)
                .containsExactlyInAnyOrder("newest", "same-instant-a", "same-instant-b", "same-instant-c", "oldest");
    }

    @Test
    void deleteByTenantIdAndMachineId_deviceWithEverything_itsStateAndPendingUpdatesAndHistoryRemovedOnly() {
        // setup
        deviceOsStateRepository.save(state(TENANT_ID, RECEIVED_AT, "26100.4061"));
        DeviceOsState ofAnotherMachine = state(TENANT_ID, RECEIVED_AT, "26100.4061");
        ofAnotherMachine.setMachineId(OTHER_MACHINE_ID);
        deviceOsStateRepository.save(ofAnotherMachine);
        deviceOsPendingUpdateRepository.saveAll(List.of(
                pendingUpdate(MACHINE_ID, "kb-1", RECEIVED_AT), pendingUpdate(OTHER_MACHINE_ID, "kb-1", RECEIVED_AT)));
        deviceOsUpdateHistoryRepository.saveAll(List.of(
                historyEntry(TENANT_ID, MACHINE_ID, "kb-0", EARLIER),
                historyEntry(TENANT_ID, OTHER_MACHINE_ID, "kb-0", EARLIER)));
        osUpdateRepository.save(osUpdate(TENANT_ID, OsPlatform.MACOS, "kb-1", "Stays"));

        // execution
        long removedStates = deviceOsStateRepository.deleteByTenantIdAndMachineId(TENANT_ID, MACHINE_ID);
        long removedPendingUpdates = deviceOsPendingUpdateRepository.deleteByTenantIdAndMachineId(TENANT_ID, MACHINE_ID);
        long removedHistoryEntries = deviceOsUpdateHistoryRepository.deleteByTenantIdAndMachineId(TENANT_ID, MACHINE_ID);

        // verifications
        assertThat(List.of(removedStates, removedPendingUpdates, removedHistoryEntries)).containsExactly(1L, 1L, 1L);
        assertThat(deviceOsStateRepository.existsByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).isFalse();
        assertThat(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, OTHER_MACHINE_ID)).isPresent();
        assertThat(deviceOsPendingUpdateRepository.findAll()).extracting(DeviceOsPendingUpdate::getMachineId)
                .containsExactly(OTHER_MACHINE_ID);
        assertThat(deviceOsUpdateHistoryRepository.findAll()).extracting(DeviceOsUpdateHistoryEntry::getMachineId)
                .containsExactly(OTHER_MACHINE_ID);
        assertThat(osUpdateRepository.findAll()).extracting(OsUpdate::getDisplayName).containsExactly("Stays");
    }

    @Test
    void initIndexes_historyCollection_ttlIndexOnTheInstallTimeWithTheRetentionOfTheHistory() {
        // setup
        MongoIndexConfig mongoIndexConfig = new MongoIndexConfig();
        ReflectionTestUtils.setField(mongoIndexConfig, "mongoTemplate", mongoTemplate);

        // execution
        mongoIndexConfig.initIndexes();
        mongoIndexConfig.initIndexes();

        // verifications
        assertThat(indexes("device_os_update_history"))
                .filteredOn(index -> "device_os_update_history_ttl".equals(index.getString("name")))
                .singleElement()
                .satisfies(ttlIndex -> {
                    assertThat(ttlIndex).containsEntry("key", new Document("installedAt", 1));
                    assertThat(ttlIndex.get("expireAfterSeconds", Number.class).longValue())
                            .isEqualTo(RETENTION.toSeconds());
                });
    }

    @Test
    void featureCollections_eachHasItsUniqueIndex() {
        // setup

        // execution
        List<Document> stateIndexes = indexes("device_os_states");
        List<Document> pendingIndexes = indexes("device_os_pending_updates");
        List<Document> osUpdateIndexes = indexes("os_updates");
        List<Document> historyIndexes = indexes("device_os_update_history");

        // verifications
        assertThat(uniqueIndexes(stateIndexes))
                .containsExactly(tuple("tenant_machine", "{\"tenantId\": 1, \"machineId\": 1}"));
        assertThat(uniqueIndexes(pendingIndexes))
                .containsExactly(tuple("tenant_machine_identifier",
                        "{\"tenantId\": 1, \"machineId\": 1, \"identifier\": 1}"));
        assertThat(uniqueIndexes(osUpdateIndexes))
                .containsExactly(tuple("tenant_platform_identifier",
                        "{\"tenantId\": 1, \"platform\": 1, \"identifier\": 1}"));
        assertThat(uniqueIndexes(historyIndexes))
                .containsExactly(tuple("tenant_machine_entry", "{\"tenantId\": 1, \"machineId\": 1, \"entryKey\": 1}"));
    }

    private List<Document> indexes(String collection) {
        return mongoTemplate.getCollection(collection).listIndexes().into(new ArrayList<>());
    }

    private static List<Tuple> uniqueIndexes(List<Document> indexes) {
        return indexes.stream()
                .filter(index -> Boolean.TRUE.equals(index.getBoolean("unique")))
                .map(index -> tuple(index.getString("name"), index.get("key", Document.class).toJson()))
                .toList();
    }

    private static DeviceOsState state(String tenantId, Instant receivedAt, String osBuild) {
        return DeviceOsState.builder()
                .tenantId(tenantId)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .osBuild(osBuild)
                .receivedAt(receivedAt)
                .build();
    }

    private static DeviceOsPendingUpdate pendingUpdate(String machineId, String identifier, Instant discoveredAt) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(machineId)
                .platform(OsPlatform.MACOS)
                .identifier(identifier)
                .discoveredAt(discoveredAt)
                .build();
    }

    private static OsUpdate osUpdate(String tenantId, OsPlatform platform, String identifier, String displayName) {
        return OsUpdate.builder()
                .tenantId(tenantId)
                .platform(platform)
                .identifier(identifier)
                .displayName(displayName)
                .firstSeenAt(RECEIVED_AT)
                .build();
    }

    private static DeviceOsUpdateHistoryEntry historyEntry(String tenantId, String machineId, String identifier,
                                                           Instant installedAt) {
        return DeviceOsUpdateHistoryEntry.builder()
                .tenantId(tenantId)
                .machineId(machineId)
                .entryKey(identifier + "|" + installedAt.toEpochMilli() + "|INSTALL")
                .identifier(identifier)
                .installedAt(installedAt)
                .operation(OsUpdateOperation.INSTALL)
                .build();
    }
}

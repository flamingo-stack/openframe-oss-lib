package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateCategory;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartBehaviour;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class OsUpdateReportMapperTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String UPDATE_KEY = "7d2f1c0e-3b0a-4c59-9d53-0c8f4d1f6a21:201";
    private static final String TITLE = "2026-11 Cumulative Update (KB5068861)";
    private static final String CATEGORY_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final Instant DISCOVERED_AT = Instant.parse("2026-11-19T10:14:51Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-10T18:00:00Z");
    private static final Instant INSTALLED_AT = Instant.parse("2026-10-16T02:41:10Z");
    private static final long INSTALLED_AT_MILLIS = INSTALLED_AT.toEpochMilli();

    private OsUpdateReportMapper mapper;

    private MachineOsUpdatesMessage.PendingUpdate pendingUpdate;
    private MachineOsUpdatesMessage.InstalledUpdate installedUpdate;

    @BeforeEach
    void setUp() {
        mapper = new OsUpdateReportMapper();

        pendingUpdate = new MachineOsUpdatesMessage.PendingUpdate();
        pendingUpdate.setUpdateKey(UPDATE_KEY);
        pendingUpdate.setTitle(TITLE);

        installedUpdate = new MachineOsUpdatesMessage.InstalledUpdate();
        installedUpdate.setUpdateKey(UPDATE_KEY);
        installedUpdate.setTitle(TITLE);
        installedUpdate.setInstalledAt(INSTALLED_AT);
        installedUpdate.setOperation(OsUpdateOperation.INSTALL);
        installedUpdate.setResult(OsUpdateInstallResult.SUCCEEDED);
    }

    @Test
    void toPendingUpdates_completeUpdate_everyFieldMappedForThatTenantAndMachine() {
        // setup
        MachineOsUpdatesMessage.Category category = new MachineOsUpdatesMessage.Category();
        category.setId(CATEGORY_ID);
        category.setName("Security Updates");
        pendingUpdate.setVersion("26.7.3");
        pendingUpdate.setKbArticleIds(List.of("5068861"));
        pendingUpdate.setMsrcSeverity("Critical");
        pendingUpdate.setCategories(List.of(category));
        pendingUpdate.setBrowseOnly(false);
        pendingUpdate.setPublishedAt(PUBLISHED_AT);
        pendingUpdate.setSizeBytes(3481600000L);
        pendingUpdate.setRestartBehaviour(OsUpdateRestartBehaviour.ALWAYS);
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate);
        DeviceOsUpdate expected = DeviceOsUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .updateKey(UPDATE_KEY)
                .title(TITLE)
                .version("26.7.3")
                .kbArticleIds(List.of("5068861"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(List.of(new DeviceOsUpdateCategory(CATEGORY_ID, "Security Updates")))
                .browseOnly(false)
                .publishedAt(PUBLISHED_AT)
                .sizeBytes(3481600000L)
                .restartBehaviour(OsUpdateRestartBehaviour.ALWAYS)
                .discoveredAt(DISCOVERED_AT)
                .build();

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending).containsExactly(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "Critical,  CRITICAL",
            "IMPORTANT, IMPORTANT",
            "moderate,  MODERATE",
            "Low,       LOW"
    })
    void toPendingUpdates_vendorSeverityInAnyCase_mapped(String msrcSeverity, OsUpdateSeverity expected) {
        // setup
        pendingUpdate.setMsrcSeverity(msrcSeverity);
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending).extracting(DeviceOsUpdate::getSeverity).containsExactly(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "Unspecified"})
    void toPendingUpdates_vendorSeverityAbsentEmptyOrUnknown_noSeverity(String msrcSeverity) {
        // setup
        pendingUpdate.setMsrcSeverity(msrcSeverity);
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending).extracting(DeviceOsUpdate::getSeverity).containsOnlyNulls();
    }

    @Test
    void toPendingUpdates_listsAndOptionalValuesAbsent_emptyListsAndNulls() {
        // setup
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending)
                .extracting(DeviceOsUpdate::getKbArticleIds, DeviceOsUpdate::getCategories,
                        DeviceOsUpdate::getBrowseOnly, DeviceOsUpdate::getSizeBytes, DeviceOsUpdate::getRestartBehaviour)
                .containsExactly(tuple(List.of(), List.of(), null, null, null));
    }

    @Test
    void toPendingUpdates_kbArticleIdsWithANull_nullLeftOut() {
        // setup
        pendingUpdate.setKbArticleIds(Arrays.asList("5068861", null));
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending).extracting(DeviceOsUpdate::getKbArticleIds).containsExactly(List.of("5068861"));
    }

    @Test
    void toPendingUpdates_categoriesWithIdOrNameOrNeither_keptWhenEitherIsGiven() {
        // setup
        MachineOsUpdatesMessage.Category onlyNamed = new MachineOsUpdatesMessage.Category();
        onlyNamed.setName("Definition Updates");
        MachineOsUpdatesMessage.Category onlyIdentified = new MachineOsUpdatesMessage.Category();
        onlyIdentified.setId(CATEGORY_ID);
        onlyIdentified.setName(" ");
        MachineOsUpdatesMessage.Category neither = new MachineOsUpdatesMessage.Category();
        MachineOsUpdatesMessage.Category blank = new MachineOsUpdatesMessage.Category();
        blank.setId("");
        blank.setName(" ");
        pendingUpdate.setCategories(Arrays.asList(onlyNamed, onlyIdentified, neither, blank, null));
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending)
                .flatExtracting(DeviceOsUpdate::getCategories)
                .containsExactly(
                        new DeviceOsUpdateCategory(null, "Definition Updates"),
                        new DeviceOsUpdateCategory(CATEGORY_ID, null));
    }

    @ParameterizedTest
    @CsvSource(value = {
            "NULL, Some title",
            "' ',  Some title",
            "k-2,  NULL",
            "k-2,  ''"
    }, nullValues = "NULL")
    void toPendingUpdates_updateWithoutKeyOrTitle_skippedAndTheRestKept(String updateKey, String title) {
        // setup
        MachineOsUpdatesMessage.PendingUpdate incomplete = new MachineOsUpdatesMessage.PendingUpdate();
        incomplete.setUpdateKey(updateKey);
        incomplete.setTitle(title);
        List<MachineOsUpdatesMessage.PendingUpdate> reported = Arrays.asList(incomplete, null, pendingUpdate);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending).extracting(DeviceOsUpdate::getUpdateKey).containsExactly(UPDATE_KEY);
    }

    @Test
    void toPendingUpdates_sameUpdateKeyTwice_oneRowOfTheLastOne() {
        // setup
        MachineOsUpdatesMessage.PendingUpdate again = new MachineOsUpdatesMessage.PendingUpdate();
        again.setUpdateKey(UPDATE_KEY);
        again.setTitle("Later title");
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of(pendingUpdate, again);

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending)
                .extracting(DeviceOsUpdate::getUpdateKey, DeviceOsUpdate::getTitle)
                .containsExactly(tuple(UPDATE_KEY, "Later title"));
    }

    @Test
    void toPendingUpdates_emptyList_noRows() {
        // setup
        List<MachineOsUpdatesMessage.PendingUpdate> reported = List.of();

        // execution
        List<DeviceOsUpdate> pending = mapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reported, DISCOVERED_AT);

        // verifications
        assertThat(pending).isEmpty();
    }

    @Test
    void toHistoryEntries_completeEntry_everyFieldMappedWithTheWireHresultAsErrorCode() {
        // setup
        installedUpdate.setVersion("26.2");
        installedUpdate.setHresult("0x80240022");
        List<MachineOsUpdatesMessage.InstalledUpdate> reported = List.of(installedUpdate);
        DeviceOsUpdateHistoryEntry expected = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey(UPDATE_KEY + "|" + INSTALLED_AT_MILLIS + "|INSTALL")
                .updateKey(UPDATE_KEY)
                .title(TITLE)
                .version("26.2")
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.SUCCEEDED)
                .errorCode("0x80240022")
                .build();

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, reported);

        // verifications
        assertThat(history).containsExactly(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void toHistoryEntries_entryWithoutUpdateKey_keyedByItsTitle(String updateKey) {
        // setup
        installedUpdate.setUpdateKey(updateKey);
        List<MachineOsUpdatesMessage.InstalledUpdate> reported = List.of(installedUpdate);

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, reported);

        // verifications
        assertThat(history)
                .extracting(DeviceOsUpdateHistoryEntry::getEntryKey)
                .containsExactly(TITLE + "|" + INSTALLED_AT_MILLIS + "|INSTALL");
    }

    @Test
    void toHistoryEntries_sameUpdateInstalledAndUninstalledAtTheSameInstant_twoEntries() {
        // setup
        MachineOsUpdatesMessage.InstalledUpdate uninstalled = new MachineOsUpdatesMessage.InstalledUpdate();
        uninstalled.setUpdateKey(UPDATE_KEY);
        uninstalled.setTitle(TITLE);
        uninstalled.setInstalledAt(INSTALLED_AT);
        uninstalled.setOperation(OsUpdateOperation.UNINSTALL);
        List<MachineOsUpdatesMessage.InstalledUpdate> reported = List.of(installedUpdate, uninstalled);

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, reported);

        // verifications
        assertThat(history)
                .extracting(DeviceOsUpdateHistoryEntry::getOperation)
                .containsExactly(OsUpdateOperation.INSTALL, OsUpdateOperation.UNINSTALL);
        assertThat(history).extracting(DeviceOsUpdateHistoryEntry::getEntryKey).doesNotHaveDuplicates();
    }

    @Test
    void toHistoryEntries_sameEntryTwice_oneEntry() {
        // setup
        List<MachineOsUpdatesMessage.InstalledUpdate> reported = List.of(installedUpdate, installedUpdate);

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, reported);

        // verifications
        assertThat(history).hasSize(1);
    }

    @Test
    void toHistoryEntries_entryWithoutTitleOrInstalledAt_skippedAndTheRestKept() {
        // setup
        MachineOsUpdatesMessage.InstalledUpdate untitled = new MachineOsUpdatesMessage.InstalledUpdate();
        untitled.setUpdateKey("k-untitled");
        untitled.setInstalledAt(INSTALLED_AT);
        MachineOsUpdatesMessage.InstalledUpdate undated = new MachineOsUpdatesMessage.InstalledUpdate();
        undated.setUpdateKey("k-undated");
        undated.setTitle("Undated");
        List<MachineOsUpdatesMessage.InstalledUpdate> reported =
                new ArrayList<>(Arrays.asList(untitled, undated, null, installedUpdate));

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, reported);

        // verifications
        assertThat(history).extracting(DeviceOsUpdateHistoryEntry::getUpdateKey).containsExactly(UPDATE_KEY);
    }

    @Test
    void toHistoryEntries_unknownOperationAndResult_entryKeptWithNulls() {
        // setup
        installedUpdate.setOperation(null);
        installedUpdate.setResult(null);
        List<MachineOsUpdatesMessage.InstalledUpdate> reported = List.of(installedUpdate);

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, reported);

        // verifications
        assertThat(history)
                .extracting(DeviceOsUpdateHistoryEntry::getOperation, DeviceOsUpdateHistoryEntry::getResult)
                .containsExactly(tuple(null, null));
    }

    @Test
    void toHistoryEntries_historyAbsent_noEntries() {
        // setup

        // execution
        List<DeviceOsUpdateHistoryEntry> history = mapper.toHistoryEntries(TENANT_ID, MACHINE_ID, null);

        // verifications
        assertThat(history).isEmpty();
    }
}

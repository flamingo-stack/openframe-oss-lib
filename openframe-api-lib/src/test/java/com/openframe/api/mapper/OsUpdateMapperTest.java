package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateCategory;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagedElsewhereReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagementState;
import com.openframe.data.document.rmm.osupdate.OsUpdateObservedReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartBehaviour;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateMapperTest {

    private static final String CATEGORY_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final Instant DISCOVERED_AT = Instant.parse("2026-11-19T10:14:51Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-10T18:00:00Z");
    private static final Instant INSTALLED_AT = Instant.parse("2026-10-16T02:41:10Z");
    private static final String CURSOR = "cursor-1";

    private OsUpdateMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new OsUpdateMapper();
    }

    @Test
    void toResponse_osState_everyApiFieldMapped() {
        // setup
        DeviceOsState state = DeviceOsState.builder()
                .id("id-1")
                .tenantId("tenant-1")
                .machineId("machine-1")
                .osVersion("Windows 11 Pro")
                .osBuild("26100.4061")
                .restartPending(true)
                .restartPendingSince(PUBLISHED_AT)
                .lastScanAt(DISCOVERED_AT)
                .lastScanError("0x80072EE2")
                .lastInstalledAt(INSTALLED_AT)
                .managementState(OsUpdateManagementState.MANAGED_ELSEWHERE)
                .managedElsewhereReason(OsUpdateManagedElsewhereReason.WSUS)
                .observedReason(OsUpdateObservedReason.HOME_EDITION)
                .authorization(OsUpdateAuthorization.NOT_REQUIRED)
                .receivedAt(DISCOVERED_AT)
                .build();
        DeviceOsStateResponse expected = DeviceOsStateResponse.builder()
                .osVersion("Windows 11 Pro")
                .osBuild("26100.4061")
                .restartPending(true)
                .restartPendingSince(PUBLISHED_AT)
                .lastScanAt(DISCOVERED_AT)
                .lastScanError("0x80072EE2")
                .lastInstalledAt(INSTALLED_AT)
                .managementState(OsUpdateManagementState.MANAGED_ELSEWHERE)
                .managedElsewhereReason(OsUpdateManagedElsewhereReason.WSUS)
                .observedReason(OsUpdateObservedReason.HOME_EDITION)
                .authorization(OsUpdateAuthorization.NOT_REQUIRED)
                .receivedAt(DISCOVERED_AT)
                .build();

        // execution
        DeviceOsStateResponse response = mapper.toResponse(state);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_pendingUpdate_everyApiFieldMappedWithTheNamesOfItsCategories() {
        // setup
        DeviceOsUpdate update = DeviceOsUpdate.builder()
                .id("id-1")
                .tenantId("tenant-1")
                .machineId("machine-1")
                .updateKey("k-1")
                .title("Update one")
                .version("26.7.3")
                .kbArticleIds(List.of("5068861"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(Arrays.asList(
                        new DeviceOsUpdateCategory(CATEGORY_ID, "Security Updates"),
                        new DeviceOsUpdateCategory(CATEGORY_ID, null),
                        null))
                .browseOnly(true)
                .publishedAt(PUBLISHED_AT)
                .sizeBytes(3481600000L)
                .restartBehaviour(OsUpdateRestartBehaviour.ALWAYS)
                .discoveredAt(DISCOVERED_AT)
                .build();
        DeviceOsUpdateResponse expected = DeviceOsUpdateResponse.builder()
                .updateKey("k-1")
                .title("Update one")
                .version("26.7.3")
                .kbArticleIds(List.of("5068861"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(List.of("Security Updates"))
                .browseOnly(true)
                .publishedAt(PUBLISHED_AT)
                .sizeBytes(3481600000L)
                .restartBehaviour(OsUpdateRestartBehaviour.ALWAYS)
                .discoveredAt(DISCOVERED_AT)
                .build();

        // execution
        DeviceOsUpdateResponse response = mapper.toResponse(update);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_pendingUpdateStoredWithoutLists_emptyListsAndNullsForTheUnknown() {
        // setup
        DeviceOsUpdate update = DeviceOsUpdate.builder()
                .updateKey("k-bare")
                .title("Bare update")
                .discoveredAt(DISCOVERED_AT)
                .build();

        // execution
        DeviceOsUpdateResponse response = mapper.toResponse(update);

        // verifications
        assertThat(response.getKbArticleIds()).isEmpty();
        assertThat(response.getCategories()).isEmpty();
        assertThat(response.getSeverity()).isNull();
        assertThat(response.getBrowseOnly()).isNull();
        assertThat(response.getSizeBytes()).isNull();
        assertThat(response.getRestartBehaviour()).isNull();
    }

    @Test
    void toResponse_historyEntry_everyApiFieldMappedWithItsCursor() {
        // setup
        DeviceOsUpdateHistoryEntry entry = DeviceOsUpdateHistoryEntry.builder()
                .id("id-1")
                .tenantId("tenant-1")
                .machineId("machine-1")
                .entryKey("k-1|1|INSTALL")
                .updateKey("k-1")
                .title("Update one")
                .version("26.2")
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.FAILED)
                .errorCode("0x80240022")
                .build();
        DeviceOsUpdateHistoryEntryResponse expected = DeviceOsUpdateHistoryEntryResponse.builder()
                .updateKey("k-1")
                .title("Update one")
                .version("26.2")
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.FAILED)
                .errorCode("0x80240022")
                .cursor(CURSOR)
                .build();

        // execution
        DeviceOsUpdateHistoryEntryResponse response = mapper.toResponse(entry, CURSOR);

        // verifications
        assertThat(response).isEqualTo(expected);
    }
}

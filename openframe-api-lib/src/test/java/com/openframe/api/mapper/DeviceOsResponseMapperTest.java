package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.LastOsInstall;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateScanState;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceOsResponseMapperTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant REPORTED_AT = Instant.parse("2026-11-20T09:14:02.481Z");
    private static final Instant LAST_SCAN_AT = Instant.parse("2026-11-20T08:44:00Z");
    private static final Instant REBOOT_PENDING_SINCE = Instant.parse("2026-11-18T07:02:11Z");
    private static final Instant INSTALLED_AT = Instant.parse("2026-10-15T03:12:44Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-11T18:00:00Z");

    private DeviceOsResponseMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new DeviceOsResponseMapper();
    }

    @Test
    void toResponse_state_everyValueTheOsTabShowsCarriedOver() {
        // setup
        OsUpdateManageability manageability = OsUpdateManageability.builder()
                .state(OsUpdateManageabilityState.NOT_MANAGEABLE).reasons(List.of("WSUS")).build();
        LastOsInstall lastOsInstall = LastOsInstall.builder().displayName("KB5049981").installedAt(INSTALLED_AT).build();
        DeviceOsState state = DeviceOsState.builder()
                .id("6aff19c07ce86a3f0386ff82")
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .osVersion("11 24H2")
                .osBuild("26100.4061")
                .osProductName("Windows 11 Pro")
                .scanState(OsUpdateScanState.FRESH)
                .lastScanAt(LAST_SCAN_AT)
                .pendingUpdatesConfidence(OsUpdateListConfidence.RETAINED)
                .patchState(OsPatchState.UPDATES_AVAILABLE)
                .rebootPending(OsRebootPending.YES)
                .rebootPendingSince(REBOOT_PENDING_SINCE)
                .manageability(manageability)
                .osUpdateAuthorization(OsUpdateAuthorization.NOT_REQUIRED)
                .lastOsInstall(lastOsInstall)
                .reportedAt(REPORTED_AT)
                .receivedAt(RECEIVED_AT)
                .build();
        DeviceOsStateResponse expected = DeviceOsStateResponse.builder()
                .platform(OsPlatform.WINDOWS)
                .osVersion("11 24H2")
                .osBuild("26100.4061")
                .osProductName("Windows 11 Pro")
                .scanState(OsUpdateScanState.FRESH)
                .lastScanAt(LAST_SCAN_AT)
                .pendingUpdatesConfidence(OsUpdateListConfidence.RETAINED)
                .patchState(OsPatchState.UPDATES_AVAILABLE)
                .rebootPending(OsRebootPending.YES)
                .rebootPendingSince(REBOOT_PENDING_SINCE)
                .manageability(manageability)
                .osUpdateAuthorization(OsUpdateAuthorization.NOT_REQUIRED)
                .lastOsInstall(lastOsInstall)
                .reportedAt(REPORTED_AT)
                .receivedAt(RECEIVED_AT)
                .build();

        // execution
        DeviceOsStateResponse response = mapper.toResponse(state);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_stateWithOnlyItsReceiveTime_restIsNull() {
        // setup
        DeviceOsState state = DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID)
                .receivedAt(RECEIVED_AT).build();
        DeviceOsStateResponse expected = DeviceOsStateResponse.builder().receivedAt(RECEIVED_AT).build();

        // execution
        DeviceOsStateResponse response = mapper.toResponse(state);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_windowsPendingUpdateWithItsOsUpdate_whatWaitsOnTheDeviceJoinedWithWhatTheUpdateIs() {
        // setup
        DeviceOsPendingUpdate pendingUpdate = DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(IDENTIFIER)
                .discoveredAt(RECEIVED_AT)
                .downloaded(true)
                .build();
        OsUpdate osUpdate = OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(IDENTIFIER)
                .displayName("2026-11 Cumulative Update (KB5051987)")
                .displayVersion("24H2")
                .kbArticleIds(List.of("5051987"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(List.of("Security Updates"))
                .categoryIds(List.of("0fa1201d-4330-4fa8-8ae9-b877473b6441"))
                .updateType(OsUpdateType.SOFTWARE)
                .classification(OsUpdateClassification.SECURITY)
                .cveIds(List.of("CVE-2026-21309"))
                .publishedAt(PUBLISHED_AT)
                .sizeBytes(764317696L)
                .rebootBehavior(OsUpdateRebootBehavior.ALWAYS)
                .browseOnly(false)
                .cvssScore(9.8)
                .exploited(true)
                .enrichedAt(INSTALLED_AT)
                .firstSeenAt(INSTALLED_AT)
                .build();
        DeviceOsPendingUpdateResponse expected = DeviceOsPendingUpdateResponse.builder()
                .identifier(IDENTIFIER)
                .displayName("2026-11 Cumulative Update (KB5051987)")
                .displayVersion("24H2")
                .kbArticleIds(List.of("5051987"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(List.of("Security Updates"))
                .categoryIds(List.of("0fa1201d-4330-4fa8-8ae9-b877473b6441"))
                .updateType(OsUpdateType.SOFTWARE)
                .classification(OsUpdateClassification.SECURITY)
                .cveIds(List.of("CVE-2026-21309"))
                .publishedAt(PUBLISHED_AT)
                .sizeBytes(764317696L)
                .rebootBehavior(OsUpdateRebootBehavior.ALWAYS)
                .browseOnly(false)
                .cvssScore(9.8)
                .exploited(true)
                .enrichedAt(INSTALLED_AT)
                .discoveredAt(RECEIVED_AT)
                .downloaded(true)
                .build();

        // execution
        DeviceOsPendingUpdateResponse response = mapper.toResponse(pendingUpdate, osUpdate);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_macPendingUpdateWithItsOsUpdate_presenceReturnedAndTheListsEmptyNotNull() {
        // setup
        DeviceOsPendingUpdate pendingUpdate = DeviceOsPendingUpdate.builder()
                .identifier("Safari-18.2")
                .discoveredAt(RECEIVED_AT)
                .macosPresence(MacosUpdatePresence.HELD_OVER)
                .build();
        OsUpdate osUpdate = OsUpdate.builder()
                .identifier("Safari-18.2")
                .displayName("Safari")
                .displayVersion("18.2")
                .build();
        DeviceOsPendingUpdateResponse expected = DeviceOsPendingUpdateResponse.builder()
                .identifier("Safari-18.2")
                .displayName("Safari")
                .displayVersion("18.2")
                .kbArticleIds(List.of())
                .categories(List.of())
                .categoryIds(List.of())
                .cveIds(List.of())
                .discoveredAt(RECEIVED_AT)
                .macosPresence(MacosUpdatePresence.HELD_OVER)
                .build();

        // execution
        DeviceOsPendingUpdateResponse response = mapper.toResponse(pendingUpdate, osUpdate);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_historyEntryWithACursor_entryWithThatCursor() {
        // setup
        DeviceOsUpdateHistoryEntry historyEntry = DeviceOsUpdateHistoryEntry.builder()
                .id("6aff19c07ce86a3f0386ff82")
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey("kb-0|1|INSTALL")
                .identifier("ffeeddcc-1111-2222-3333-445566778899:198")
                .title("2026-10 Cumulative Update (KB5049981)")
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.FAILED)
                .errorCode("0x80240017")
                .build();
        DeviceOsUpdateHistoryEntryResponse expected = DeviceOsUpdateHistoryEntryResponse.builder()
                .identifier("ffeeddcc-1111-2222-3333-445566778899:198")
                .title("2026-10 Cumulative Update (KB5049981)")
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.FAILED)
                .errorCode("0x80240017")
                .cursor("opaque-cursor")
                .build();

        // execution
        DeviceOsUpdateHistoryEntryResponse response = mapper.toResponse(historyEntry, "opaque-cursor");

        // verifications
        assertThat(response).isEqualTo(expected);
    }
}

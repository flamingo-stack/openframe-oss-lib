package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import com.openframe.data.repository.rmm.osupdate.InstalledOsUpdateDevice;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateResponseMapperTest {

    private static final String OS_UPDATE_ID = "6aff19c07ce86a3f0386ff82";
    private static final String IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String MACHINE_ID = "machine-1";
    private static final String CURSOR = "cursor-1";
    private static final Instant FIRST_SEEN_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-11T18:00:00Z");

    private OsUpdateResponseMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new OsUpdateResponseMapper();
    }

    @Test
    void toResponse_windowsUpdate_everyValueOfTheUpdateWithItsIdAndCursor() {
        // setup
        OsUpdate osUpdate = OsUpdate.builder()
                .id(OS_UPDATE_ID)
                .tenantId("tenant-1")
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
                .exploited(true)
                .enrichedAt(FIRST_SEEN_AT)
                .firstSeenAt(FIRST_SEEN_AT)
                .build();
        OsUpdateResponse expected = OsUpdateResponse.builder()
                .id(OS_UPDATE_ID)
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
                .exploited(true)
                .enrichedAt(FIRST_SEEN_AT)
                .firstSeenAt(FIRST_SEEN_AT)
                .cursor(CURSOR)
                .build();

        // execution
        OsUpdateResponse response = mapper.toResponse(osUpdate, CURSOR);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_updateStoredWithoutItsLists_listsEmptyNotNull() {
        // setup
        OsUpdate osUpdate = OsUpdate.builder()
                .id(OS_UPDATE_ID)
                .platform(OsPlatform.MACOS)
                .identifier("Safari-18.2")
                .firstSeenAt(FIRST_SEEN_AT)
                .build();

        // execution
        OsUpdateResponse response = mapper.toResponse(osUpdate, CURSOR);

        // verifications
        assertThat(response)
                .extracting(OsUpdateResponse::getKbArticleIds, OsUpdateResponse::getCategories,
                        OsUpdateResponse::getCategoryIds, OsUpdateResponse::getCveIds)
                .containsExactly(List.of(), List.of(), List.of(), List.of());
        assertThat(response)
                .extracting(OsUpdateResponse::getClassification, OsUpdateResponse::getUpdateType)
                .containsOnlyNulls();
    }

    @Test
    void toPendingDeviceResponse_pendingUpdate_deviceInPendingWithItsDiscoveryTime() {
        // setup
        DeviceOsPendingUpdate pendingUpdate = DeviceOsPendingUpdate.builder()
                .machineId(MACHINE_ID)
                .identifier(IDENTIFIER)
                .discoveredAt(FIRST_SEEN_AT)
                .build();
        OsUpdateDeviceResponse expected = OsUpdateDeviceResponse.builder()
                .machineId(MACHINE_ID)
                .status(OsUpdateDeviceStatus.PENDING)
                .discoveredAt(FIRST_SEEN_AT)
                .cursor(CURSOR)
                .build();

        // execution
        OsUpdateDeviceResponse response = mapper.toPendingDeviceResponse(pendingUpdate, CURSOR);

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toInstalledDeviceResponse_installedDevice_deviceInInstalledWithItsInstallTime() {
        // setup
        InstalledOsUpdateDevice installedDevice = new InstalledOsUpdateDevice(MACHINE_ID, PUBLISHED_AT);
        OsUpdateDeviceResponse expected = OsUpdateDeviceResponse.builder()
                .machineId(MACHINE_ID)
                .status(OsUpdateDeviceStatus.INSTALLED)
                .installedAt(PUBLISHED_AT)
                .cursor(CURSOR)
                .build();

        // execution
        OsUpdateDeviceResponse response = mapper.toInstalledDeviceResponse(installedDevice, CURSOR);

        // verifications
        assertThat(response).isEqualTo(expected);
    }
}

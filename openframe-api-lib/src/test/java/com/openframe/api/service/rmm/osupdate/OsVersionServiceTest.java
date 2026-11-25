package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.OsVersionResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.osupdate.release.WindowsRelease;
import com.openframe.api.service.rmm.osupdate.release.WindowsReleaseClient;
import com.openframe.api.service.rmm.osupdate.release.WindowsReleaseMatcher;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildCount;
import com.openframe.data.repository.rmm.osupdate.OsVersionDeviceCounts;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Limit;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsVersionServiceTest {

    private static final String TENANT_ID = "tenant-a";
    private static final List<String> ORGANIZATIONS = List.of("org-1");
    private static final List<String> ORGANIZATION_MACHINE_IDS = List.of("machine-1", "machine-2");
    private static final WindowsRelease WINDOWS_11_24H2 = WindowsRelease.builder()
            .cycle("11-24h2-w").latestBuild("26100").endOfSupportAt(LocalDate.parse("2026-10-13")).build();

    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private DeviceService deviceService;
    @Mock private ObjectProvider<WindowsReleaseClient> windowsReleaseClientProvider;
    @Mock private WindowsReleaseClient windowsReleaseClient;
    @Mock private TenantIdProvider tenantIdProvider;

    private OsVersionService osVersionService;

    @BeforeEach
    void createTheService() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        osVersionService = new OsVersionService(deviceOsStateRepository, deviceService, windowsReleaseClientProvider,
                new WindowsReleaseMatcher(), new CursorPageAssembler(), new OsVersionResponseMapper(),
                tenantIdProvider);
    }

    @Test
    void listOsVersions_withReleases_referenceFieldsWithoutDevicesBehindAndANextPage() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(1).build();
        OsVersionDeviceCounts windows11 = new OsVersionDeviceCounts("11 24H2", List.of(
                new OsVersionBuildCount("26100.4061", 3), new OsVersionBuildCount("26099.10", 2),
                new OsVersionBuildCount(null, 1)));
        OsVersionDeviceCounts windows10 = new OsVersionDeviceCounts("10 22H2", List.of(
                new OsVersionBuildCount("19045.1", 1)));
        when(deviceOsStateRepository.findOsVersionPage(OsPlatform.WINDOWS, null, null, 2, TENANT_ID))
                .thenReturn(List.of(windows11, windows10));
        when(windowsReleaseClientProvider.getIfAvailable()).thenReturn(windowsReleaseClient);
        when(windowsReleaseClient.listWindowsReleases()).thenReturn(List.of(WINDOWS_11_24H2));

        // execution
        GenericQueryResult<OsVersionResponse> osVersions = osVersionService.listOsVersions(List.of(), pagination);

        // verifications
        assertThat(osVersions.getItems()).singleElement().isEqualTo(OsVersionResponse.builder()
                .osVersion("11 24H2")
                .deviceCount(6)
                .currentBuild("26100")
                .endOfSupportAt(LocalDate.parse("2026-10-13"))
                .supportEnded(true)
                .cursor(CursorCodec.encode("11 24H2"))
                .build());
        assertThat(osVersions.getPageInfo().isHasNextPage()).isTrue();
        verifyNoInteractions(deviceService);
    }

    @Test
    void listOsVersions_referenceOffForOrganizations_countsOfTheirDevicesWithoutReferenceFields() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().cursor("11 24H2").build();
        OsVersionDeviceCounts windows10 = new OsVersionDeviceCounts("10 22H2", List.of(
                new OsVersionBuildCount("19045.1", 2)));
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(ORGANIZATION_MACHINE_IDS);
        when(deviceOsStateRepository.findOsVersionPage(
                OsPlatform.WINDOWS, ORGANIZATION_MACHINE_IDS, "11 24H2", 21, TENANT_ID))
                .thenReturn(List.of(windows10));

        // execution
        GenericQueryResult<OsVersionResponse> osVersions = osVersionService.listOsVersions(ORGANIZATIONS, pagination);

        // verifications
        assertThat(osVersions.getItems())
                .extracting(OsVersionResponse::getOsVersion, OsVersionResponse::getDeviceCount,
                        OsVersionResponse::getDevicesBehindCount, OsVersionResponse::getCurrentBuild,
                        OsVersionResponse::getSupportEnded)
                .containsExactly(tuple("10 22H2", 2, null, null, null));
        assertThat(osVersions.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void listOsVersionDevices_firstPage_devicesWithoutUpToDateFlag() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(5).build();
        when(deviceOsStateRepository.findOsVersionDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, "11 24H2", "", Limit.of(6)))
                .thenReturn(List.of(state("machine-1", "26100.4061"), state("machine-2", "26099.1"),
                        state("machine-3", null)));

        // execution
        GenericQueryResult<OsVersionDeviceResponse> devices =
                osVersionService.listOsVersionDevices("11 24H2", null, pagination);

        // verifications
        assertThat(devices.getItems())
                .extracting(OsVersionDeviceResponse::getMachineId, OsVersionDeviceResponse::getUpToDate,
                        OsVersionDeviceResponse::getCursor)
                .containsExactly(tuple("machine-1", null, CursorCodec.encode("machine-1")),
                        tuple("machine-2", null, CursorCodec.encode("machine-2")),
                        tuple("machine-3", null, CursorCodec.encode("machine-3")));
        assertThat(devices.getPageInfo().isHasNextPage()).isFalse();
        verifyNoInteractions(windowsReleaseClientProvider);
    }

    @Test
    void listOsVersionDevices_organizationsAfterACursor_theirDevicesAndNoFlag() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(1).cursor("machine-1").build();
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(ORGANIZATION_MACHINE_IDS);
        when(deviceOsStateRepository.findOsVersionDevicePageOnMachines(
                TENANT_ID, OsPlatform.WINDOWS, "11 24H2", "machine-1", ORGANIZATION_MACHINE_IDS, Limit.of(2)))
                .thenReturn(List.of(state("machine-2", "26100.1")));

        // execution
        GenericQueryResult<OsVersionDeviceResponse> devices =
                osVersionService.listOsVersionDevices("11 24H2", ORGANIZATIONS, pagination);

        // verifications
        assertThat(devices.getItems()).extracting(OsVersionDeviceResponse::getMachineId,
                OsVersionDeviceResponse::getUpToDate).containsExactly(tuple("machine-2", null));
        assertThat(devices.getPageInfo().isHasPreviousPage()).isTrue();
    }

    private static DeviceOsState state(String machineId, String osBuild) {
        return DeviceOsState.builder().machineId(machineId).osBuild(osBuild).build();
    }
}
